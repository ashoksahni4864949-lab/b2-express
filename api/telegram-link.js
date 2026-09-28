export default async function handler(req, res) {
  console.log("=== TELEGRAM LINK API HIT ===");

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed"
    });
  }

  try {
    // =========================
    // ENV
    // =========================

    const telegramBotToken =
      process.env.TELEGRAM_BOT_TOKEN;

    const telegramChannelId =
      process.env.TELEGRAM_CHANNEL_ID;

    const redisUrl =
      process.env.KV_REST_API_URL;

    const redisToken =
      process.env.KV_REST_API_TOKEN;

    if (!telegramBotToken) {
      console.error("❌ TELEGRAM_BOT_TOKEN missing");

      return res.status(500).json({
        ok: false,
        error: "Telegram bot token missing"
      });
    }

    if (!telegramChannelId) {
      console.error("❌ TELEGRAM_CHANNEL_ID missing");

      return res.status(500).json({
        ok: false,
        error: "Telegram channel ID missing"
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

    let {
      fbclid = null,
      fbc = null,
      fbp = null
    } = body;

    // =========================
    // COOKIE PARSER
    // =========================

    const cookieHeader =
      req.headers.cookie || "";

    const cookies = {};

    cookieHeader
      .split(";")
      .forEach((cookie) => {
        const index = cookie.indexOf("=");

        if (index === -1) return;

        const key =
          cookie.substring(0, index).trim();

        const value =
          cookie.substring(index + 1).trim();

        cookies[key] = value;
      });

    // Browser cookies fallback
    if (!fbp && cookies._fbp) {
      fbp = cookies._fbp;
    }

    if (!fbc && cookies._fbc) {
      fbc = cookies._fbc;
    }

    // =========================
    // CREATE FBC FROM FBCLID
    // =========================

    if (!fbc && fbclid) {
      const timestamp =
        Math.floor(Date.now() / 1000);

      fbc =
        `fb.1.${timestamp}.${fbclid}`;
    }

    // =========================
    // CLIENT INFORMATION
    // =========================

    let clientIp =
      req.headers["x-forwarded-for"] ||
      req.headers["x-real-ip"] ||
      req.socket?.remoteAddress ||
      null;

    if (clientIp && clientIp.includes(",")) {
      clientIp =
        clientIp.split(",")[0].trim();
    }

    const clientUserAgent =
      req.headers["user-agent"] || null;

    // =========================
    // TRACKING ID
    // =========================

    const trackingId =
      `${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 12)}`;

    console.log("=== ATTRIBUTION DATA ===");

    console.log(
      "Tracking ID:",
      trackingId
    );

    console.log(
      "FBCLID:",
      fbclid || "none"
    );

    console.log(
      "FBC:",
      fbc ? "present" : "none"
    );

    console.log(
      "FBP:",
      fbp ? "present" : "none"
    );

    console.log(
      "Client IP:",
      clientIp ? "present" : "none"
    );

    console.log(
      "User Agent:",
      clientUserAgent
        ? "present"
        : "none"
    );

    // =========================
    // TELEGRAM API
    // =========================

    const telegramUrl =
      `https://api.telegram.org/bot${telegramBotToken}/createChatInviteLink`;

    const telegramResponse =
      await fetch(telegramUrl, {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          chat_id: telegramChannelId,

          creates_join_request: true
        })
      });

    const telegramResult =
      await telegramResponse.json();

    console.log(
      "=== TELEGRAM RESPONSE ==="
    );

    console.log(
      JSON.stringify(
        telegramResult
      )
    );

    if (
      !telegramResponse.ok ||
      !telegramResult.ok
    ) {
      console.error(
        "❌ Telegram invite creation failed"
      );

      return res.status(500).json({
        ok: false,
        error:
          telegramResult?.description ||
          "Failed to create Telegram invite link"
      });
    }

    const inviteLink =
      telegramResult.result?.invite_link;

    if (!inviteLink) {
      return res.status(500).json({
        ok: false,
        error:
          "Telegram did not return invite link"
      });
    }

    console.log(
      "✅ Invite Link:",
      inviteLink
    );

    // =========================
    // REDIS HELPER
    // =========================

    async function redisCommand(command) {
      const response =
        await fetch(redisUrl, {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${redisToken}`
          },

          body: JSON.stringify(command)
        });

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
          "Redis request failed"
        );
      }

      return result;
    }

    // =========================
    // REDIS ATTRIBUTION
    // =========================

    const attribution = {
      tracking_id: trackingId,

      invite_link: inviteLink,

      fbclid: fbclid || null,

      fbc: fbc || null,

      fbp: fbp || null,

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

    // =========================
    // RESPONSE
    // =========================

    return res.status(200).json({
      ok: true,

      invite_link: inviteLink,

      tracking_id: trackingId
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
        "Something went wrong"
    });
  }
}
