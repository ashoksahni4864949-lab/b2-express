export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "Method not allowed"
      });
    }

    const {
      fbc = null,
      fbp = null,
      fbclid = null
    } = req.body || {};

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const redisUrl = process.env.KV_REST_API_URL;
    const redisToken = process.env.KV_REST_API_TOKEN;

    if (!botToken) {
      return res.status(500).json({
        ok: false,
        error: "TELEGRAM_BOT_TOKEN missing"
      });
    }

    if (!redisUrl || !redisToken) {
      return res.status(500).json({
        ok: false,
        error: "Redis configuration missing"
      });
    }

    // Unique tracking ID
    const trackingId =
      `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;

    // Telegram private channel ID
    const channelId = "-1003778248565";

    // Create unique Telegram invite link
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/createChatInviteLink`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: channelId,
          creates_join_request: true,
          member_limit: 1
        })
      }
    );

    const telegramResult = await telegramResponse.json();

    if (!telegramResult.ok) {
      console.error("Telegram invite error:", telegramResult);

      return res.status(500).json({
        ok: false,
        error: "Could not create Telegram invite link"
      });
    }

    const inviteLink =
      telegramResult.result.invite_link;

    // Save Meta attribution + Telegram invite mapping
    const attribution = {
      tracking_id: trackingId,
      invite_link: inviteLink,
      fbc: fbc,
      fbp: fbp,
      fbclid: fbclid,
      created_at: new Date().toISOString()
    };

    const redisKey =
      `telegram_attribution:${encodeURIComponent(inviteLink)}`;

    const redisResponse = await fetch(redisUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${redisToken}`
      },
      body: JSON.stringify([
        "SET",
        redisKey,
        JSON.stringify(attribution),
        "EX",
        "2592000"
      ])
    });

    const redisResult = await redisResponse.json();

    if (!redisResponse.ok) {
      console.error("Redis error:", redisResult);

      return res.status(500).json({
        ok: false,
        error: "Could not save attribution"
      });
    }

    console.log("=== TELEGRAM TRACKING LINK CREATED ===");
    console.log("Tracking ID:", trackingId);
    console.log("Invite Link:", inviteLink);
    console.log("Redis Key:", redisKey);
    console.log("Has FBC:", !!fbc);
    console.log("Has FBP:", !!fbp);
    console.log("Has FBCLID:", !!fbclid);

    return res.status(200).json({
      ok: true,
      inviteLink: inviteLink,
      trackingId: trackingId
    });

  } catch (error) {
    console.error("Server error:", error);

    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
}
