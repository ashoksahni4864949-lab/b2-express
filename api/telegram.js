export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({
      ok: true,
      message: "Telegram webhook is active"
    });
  }

  try {
    const update = req.body;

    console.log("Telegram update:", JSON.stringify(update));

    // Channel member update
    if (update.chat_member) {
      const member = update.chat_member;

      const oldStatus = member.old_chat_member?.status;
      const newStatus = member.new_chat_member?.status;

      console.log("Old status:", oldStatus);
      console.log("New status:", newStatus);

      // User joined the channel
      if (
        newStatus === "member" &&
        oldStatus !== "member"
      ) {
        const user = member.new_chat_member.user;

        console.log("CHANNEL JOIN:", {
          user_id: user.id,
          username: user.username || null,
          first_name: user.first_name || null,
          channel_id: update.chat?.id
        });

        // YAHAN BAAD ME META CAPI EVENT ADD KARENGE
      }
    }

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error("Webhook error:", error);

    return res.status(500).json({
      ok: false,
      error: "Webhook error"
    });
  }
}
