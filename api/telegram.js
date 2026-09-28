export default async function handler(req, res) {
  console.log("=== TELEGRAM WEBHOOK HIT ===");

  // =========================
  // METHOD
  // =========================

  if (req.method !== "POST") {
    return res.status(200).json({
      ok: true,
      message: "Webhook is working"
    });
  }

  try {
    // =========================
    // TELEGRAM WEBHOOK SECRET
    // =========================

    const expectedSecret =
      process.env.TELEGRAM_WEBHOOK_SECRET;

    const receivedSecret =
      req.headers["x-telegram-bot-api-secret-token"];

    if (
      expectedSecret &&
      receivedSecret !== expectedSecret
    ) {
      console.log("❌ Invalid Telegram webhook secret");

      return res.status(401).json({
        ok: false,
        error: "Unauthorized"
      });
    }

    const update = req.body || {};

    console.log("Telegram update received");

    // =========================
    // ENVIRONMENT VARIABLES
    // =========================

    const redisUrl =
      process.env.KV_REST_API_URL;

    const redisToken =
      process.env.KV_REST_API_TOKEN;

    const metaPixelId =
      process.env.META_PIXEL_ID;

    const metaAccessToken =
      process.env.META_CAPI_ACCESS_TOKEN;

    const metaTestEventCode =
      process.env.META_TEST_EVENT_CODE;

    if (!redisUrl || !redisToken) {
      console.error(
        "❌ Redis environment variables missing"
      );

      return res.status(500).json({
        ok: false,
        error: "Redis configuration missing"
      });
    }

    if (!metaPixelId || !metaAccessToken) {
      console.error(
        "❌ Meta CAPI environment variables missing"
      );

      return res.status(500).json({
        ok: false,
        error: "Meta CAPI configuration missing"
      });
    }

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
          result?.error ||
          "Redis request failed"
        );
      }

      return result;
    }

    // =========================
    // META CAPI HELPER
    // =========================

    async function sendMetaEvent(eventData) {
      const metaUrl =
        `https://graph.facebook.com/v23.0/${metaPixelId}/events`;

      const payload = {
        data: [eventData],
        access_token: metaAccessToken
      };

      if (metaTestEventCode) {
        payload.test_event_code =
          metaTestEventCode;
      }

      console.log(
        "=== META CAPI REQUEST ==="
      );

      console.log(
        JSON.stringify({
          ...payload,
          access_token: "[HIDDEN]"
        })
      );

      const response = await fetch(
        metaUrl,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify(payload)
        }
      );

      const result =
        await response.json();

      console.log(
        "=== META CAPI RESPONSE ==="
      );

      console.log(
        JSON.stringify(result)
      );

      if (!response.ok) {
        throw new Error(
          result?.error?.message ||
          "Meta CAPI request failed"
        );
      }

      if (result?.error) {
        throw new Error(
          result.error.message ||
          "Meta CAPI returned an error"
        );
      }

      return result;
    }

    // =========================
    // TELEGRAM JOIN REQUEST
    // =========================

    if (update.chat_join_request) {
      const request =
        update.chat_join_request;

      const user =
        request.from || {};

      const channelId =
        request.chat?.id || null;

      const channelTitle =
        request.chat?.title || null;

      const userId =
        user.id || null;

      const username =
        user.username || null;

      const firstName =
        user.first_name || null;

      const lastName =
        user.last_name || null;

      const inviteLink =
        request.invite_link?.invite_link ||
        null;

      const requestDate =
        Number(request.date) ||
        Math.floor(Date.now() / 1000);

      console.log(
        "=== JOIN REQUEST RECEIVED ==="
      );

      console.log(
        "Channel:",
        channelTitle
      );

      console.log(
        "Channel ID:",
        channelId
      );

      console.log(
        "User ID:",
        userId
      );

      console.log(
        "Username:",
        username
      );

      console.log(
        "Invite Link:",
        inviteLink
      );

      console.log(
        "Request Date:",
        requestDate
      );

      // =========================
      // SAVE TELEGRAM JOIN
      // =========================

      const joinData = {
        event:
          "telegram_join_request",

        channel_id:
          channelId,

        channel_title:
          channelTitle,

        telegram_user_id:
          userId,

        username:
          username,

        first_name:
          firstName,

        last_name:
          lastName,

        invite_link:
          inviteLink,

        request_date:
          requestDate,

        received_at:
          new Date().toISOString()
      };

      const joinRedisKey =
        inviteLink
          ? `telegram_join:${inviteLink}`
          : `telegram_join:user:${userId}:${requestDate}`;

      await redisCommand([
        "SET",
        joinRedisKey,
        JSON.stringify(joinData),
        "EX",
        "2592000"
      ]);

      console.log(
        "✅ Join request saved to Redis"
      );

      console.log(
        "Redis Key:",
        joinRedisKey
      );

      // =========================
      // NO INVITE LINK
      // =========================

      if (!inviteLink) {
        console.log(
          "⚠️ No invite link found"
        );

        return res.status(200).json({
          ok: true,
          message:
            "Join request saved, no invite link"
        });
      }

      // =========================
      // FIND ATTRIBUTION
      // =========================

      const attributionKey =
        `telegram_attribution:${encodeURIComponent(
          inviteLink
        )}`;

      console.log(
        "Looking for attribution:",
        attributionKey
      );

      const attributionResult =
        await redisCommand([
          "GET",
          attributionKey
        ]);

      let attribution = null;

      if (attributionResult?.result) {
        try {
          attribution =
            JSON.parse(
              attributionResult.result
            );
        } catch (error) {
          console.error(
            "❌ Attribution JSON parse error",
            error
          );
        }
      }

      // =========================
      // ATTRIBUTION NOT FOUND
      // =========================

      if (!attribution) {
        console.log(
          "⚠️ No Meta attribution found"
        );

        return res.status(200).json({
          ok: true,
          message:
            "Join request saved, attribution not found"
        });
      }

      console.log(
        "=== META ATTRIBUTION FOUND ==="
      );

      console.log(
        "Tracking ID:",
        attribution.tracking_id
      );

      console.log(
        "Has FBC:",
        !!attribution.fbc
      );

      console.log(
        "Has FBP:",
        !!attribution.fbp
      );

      console.log(
        "Has FBCLID:",
        !!attribution.fbclid
      );

      console.log(
        "Has Client IP:",
        !!attribution.client_ip_address
      );

      console.log(
        "Has Client User-Agent:",
        !!attribution.client_user_agent
      );

      // =========================
      // META USER DATA
      // =========================

      const userData = {};

      // Landing-page visitor IP
      if (
        attribution.client_ip_address
      ) {
        userData.client_ip_address =
          attribution.client_ip_address;
      }

      // Landing-page visitor User-Agent
      if (
        attribution.client_user_agent
      ) {
        userData.client_user_agent =
          attribution.client_user_agent;
      }

      // Facebook Click ID
      if (attribution.fbc) {
        userData.fbc =
          attribution.fbc;
      }

      // Facebook Browser ID
      if (attribution.fbp) {
        userData.fbp =
          attribution.fbp;
      }

      console.log(
        "=== META USER DATA ==="
      );

      console.log(
        JSON.stringify({
          has_client_ip:
            !!userData.client_ip_address,

          has_client_user_agent:
            !!userData.client_user_agent,

          has_fbc:
            !!userData.fbc,

          has_fbp:
            !!userData.fbp
        })
      );

      // =========================
      // EVENT ID
      // =========================

      const eventId =
        attribution.tracking_id ||
        `${userId}_${requestDate}`;

      // =========================
      // META EVENT
      // =========================

      const metaEvent = {
        event_name:
          "Subscribe",

        event_time:
          requestDate,

        event_id:
          eventId,

        action_source:
          "website",

        user_data:
          userData,

        custom_data: {
          telegram_user_id:
            String(userId || ""),

          telegram_username:
            username || "",

          telegram_channel_id:
            String(channelId || ""),

          telegram_channel_title:
            channelTitle || ""
        }
      };

      console.log(
        "=== SENDING META CAPI EVENT ==="
      );

      console.log(
        "Event:",
        metaEvent.event_name
      );

      console.log(
        "Event ID:",
        eventId
      );

      // =========================
      // SEND META SUBSCRIBE
      // =========================

      const metaResult =
        await sendMetaEvent(
          metaEvent
        );

      console.log(
        "✅ META SUBSCRIBE EVENT SENT"
      );

      console.log(
        "Events received:",
        metaResult?.events_received
      );

      // =========================
      // SUCCESS
      // =========================

      return res.status(200).json({
        ok: true,

        telegram:
          "join_request_saved",

        attribution:
          "found",

        meta:
          "Subscribe_sent",

        events_received:
          metaResult?.events_received || 0
      });
    }

    // =========================
    // OTHER TELEGRAM UPDATES
    // =========================

    return res.status(200).json({
      ok: true,
      message: "Update received"
    });

  } catch (error) {
    console.error(
      "❌ TELEGRAM WEBHOOK ERROR"
    );

    console.error(
      error
    );

    return res.status(500).json({
      ok: false,
      error:
        error?.message ||
        "Internal server error"
    });
  }
}
