import crypto from "crypto";

export default async function handler(req, res) {
  console.log("=== TELEGRAM LINK API HIT ===");

  // =========================
  // ONLY POST
  // =========================

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed"
    });
  }

  try {
    // =========================
    // ENVIRONMENT VARIABLES
    // =========================

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const channelId = process.env.TELEGRAM_CHANNEL_ID;

    const redisUrl = process.env.KV_REST_API_URL;
    const redisToken = process.env.KV_REST_API_TOKEN;

    if (!botToken) {
      console.error("❌ TELEGRAM_BOT_TOKEN missing");

      return res.status(500).json({
        ok: false,
        error: "Telegram bot configuration missing"
      });
    }

    if (!channelId) {
      console.error("❌ TELEGRAM_CHANNEL_ID missing");

      return res.status(500).json({
        ok: false,
        error: "Telegram channel configuration missing"
      });
    }

    if (!redisUrl || !redisToken) {
      console.error("❌ Redis configuration missing");

      return res.status(500).json({
        ok: false,
        error: "Redis configuration missing"
      });
    }

    // =========================
    // REQUEST DATA
    // =========================

    const body = req.body || {};

    const fbclid =
      typeof body.fbclid === "string"
        ? body.fbclid.trim()
        : "";

    const fbc =
      typeof body.fbc === "string"
        ? body.fbc.trim()
        : "";

    const fbp =
      typeof body.fbp === "string"
        ? body.fbp.trim()
        : "";

    // =========================
    // VISITOR IP
    // =========================

    let clientIp =
      req.headers["x-forwarded-for"] ||
      req.headers["x-real-ip"] ||
      req.socket?.remoteAddress ||
      "";

    if (Array.isArray(clientIp)) {
      clientIp = clientIp[0];
    }

    if (typeof clientIp === "string" && clientIp.includes(",")) {
      clientIp = clientIp.split(",")[0].trim();
    }

    // Remove IPv4-mapped IPv6 prefix if present
    if (
      typeof clientIp === "string" &&
      clientIp.startsWith("::ffff:")
    ) {
      clientIp = clientIp.substring(7);
    }

    // =========================
    // VISITOR USER AGENT
    // =========================

    const clientUserAgent =
      req.headers["user-agent"] || "";

    // =========================
    // TRACKING ID
    // =========================

    const trackingId =
      `${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;

    console.log("=== ATTRIBUTION DATA ===");
    console.log("Tracking ID:", trackingId);
    console.log("Has FBCLID:", !!fbclid);
    console.log("Has FBC:", !!fbc);
    console.log("Has FBP:", !!fbp);
    console.log("Has IP:", !!clientIp);
    console.log("Has User-Agent:", !!clientUserAgent);

    // =========================
    // REDIS HELPER
    // =========================

    async function redisCommand(command) {
      const response = await fetch(redisUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${redisToken}`
        },
        body: JSON.stringify(command)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error || "Redis request failed"
        );
      }

      return result;
    }

    // =========================
    // CREATE TELEGRAM INVITE LINK
    // =========================

    const telegramUrl =
      `https://api.telegram.org/bot${botToken}/createChatInviteLink`;

    const telegramResponse = await fetch(
      telegramUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: channelId,

          // IMPORTANT:
          // Join request required.
          // Do NOT use member_limit here.
          creates_join_request: true,

          // Unique name for easier debugging
          name: `track_${trackingId}`
        })
      }
    );

    const telegramResult =
      await telegramResponse.json();

    console.log(
      "=== TELEGRAM API RESPONSE ==="
    );

    console.log(
      JSON.stringify(telegramResult)
    );

    if (
      !telegramResponse.ok ||
      !telegramResult?.ok ||
      !telegramResult?.result?.invite_link
    ) {
      throw new Error(
        telegramResult?.description ||
        "Failed to create Telegram invite link"
      );
    }

    const inviteLink =
      telegramResult.result.invite_link;

    console.log(
      "✅ Telegram invite created:",
      inviteLink
    );

    // =========================
    // SAVE META ATTRIBUTION
    // =========================

    const attribution = {
      tracking_id: trackingId,

      invite_link: inviteLink,

      fbclid: fbclid || null,

      fbc: fbc || null,

      fbp: fbp || null,

      // IMPORTANT:
      // These are the LANDING PAGE visitor's
      // IP and User-Agent.
      client_ip_address:
        clientIp || null,

      client_user_agent:
        clientUserAgent || null,

      created_at:
        new Date().toISOString()
    };

    const attributionKey =
      `telegram_attribution:${encodeURIComponent(
        inviteLink
      )}`;

    await redisCommand([
      "SET",
      attributionKey,
      JSON.stringify(attribution),
      "EX",
      "2592000"
    ]);

    console.log(
      "✅ Attribution saved to Redis"
    );

    console.log(
      "Redis Key:",
      attributionKey
    );

    console.log(
      "Tracking ID:",
      trackingId
    );

    // =========================
    // RESPONSE
    // =========================

    return res.status(200).json({
      ok: true,

      invite_link: inviteLink,

      tracking_id: trackingId,

      attribution_saved: true
    });

  } catch (error) {
    console.error(
      "❌ TELEGRAM LINK ERROR"
    );

    console.error(error);

    return res.status(500).json({
      ok: false,
      error:
        error?.message ||
        "Internal server error"
    });
  }
}
