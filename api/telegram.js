export default async function handler(req, res) {
  console.log("=== TELEGRAM WEBHOOK HIT ===");

  // Only Telegram POST requests
  if (req.method !== "POST") {
    return res.status(200).json({
      ok: true,
      message: "Webhook is working"
    });
  }

  // =========================
  // SECURITY: TELEGRAM SECRET
  // =========================

  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
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

  const update = req.body;

  console.log("Telegram update received");

  // =========================
  // REDIS CONFIG
  // =========================

  const redisUrl = process.env.KV_REST_API_URL;
  const redisToken = process.env.KV_REST_API_TOKEN;

  if (!redisUrl || !redisToken) {
    console.error("❌ Redis environment variables missing");

    return res.status(500).json({
      ok: false,
      error: "Redis configuration missing"
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
        result?.error || "Redis request failed"
      );
    }

    return result;
  }

  // =========================
  // PRIVATE CHANNEL JOIN REQUEST
  // =========================

  if (update.chat_join_request) {
    const request = update.chat_join_request;
    const user = request.from;

    const channelId = request.chat?.id || null;
    const channelTitle = request.chat?.title || null;

    const userId = user?.id || null;
    const username = user?.username || null;
    const firstName = user?.first_name || null;
    const lastName = user?.last_name || null;

    const inviteLink =
      request.invite_link?.invite_link || null;

    const requestDate = request.date || null;

    console.log("=== JOIN REQUEST RECEIVED ===");

    console.log("Channel:", channelTitle);
    console.log("Channel ID:", channelId);

    console.log("User ID:", userId);
    console.log("Username:", username);

    console.log("Invite Link:", inviteLink);
    console.log("Request Date:", requestDate);

    // =========================
    // SAVE JOIN REQUEST TO REDIS
    // =========================

    const joinData = {
      event: "telegram_join_request",
      channel_id: channelId,
      channel_title: channelTitle,

      telegram_user_id: userId,
      username: username,
      first_name: firstName,
      last_name: lastName,

      invite_link: inviteLink,
      request_date: requestDate,

      received_at: new Date().toISOString()
    };

    // Unique Redis key
    const redisKey = inviteLink
      ? `telegram_join:${inviteLink}`
      : `telegram_join:user:${userId}:${requestDate}`;

    await redisCommand([
      "SET",
      redisKey,
      JSON.stringify(joinData),
      "EX",
      "2592000"
    ]);

    console.log("✅ Join request saved to Redis");
    console.log("Redis Key:", redisKey);

    // IMPORTANT:
    // Request ko approve nahi kar rahe.
    // User ki request pending rahegi.
  }

  return res.status(200).json({
    ok: true
  });
}
