export default async function handler(req, res) {
  console.log("=== TELEGRAM WEBHOOK HIT ===");
  console.log("Method:", req.method);
  console.log("Body:", JSON.stringify(req.body));

  if (req.method !== "POST") {
    return res.status(200).json({
      ok: true,
      message: "Telegram webhook is working"
    });
  }

  const update = req.body;

  if (update?.chat_member) {
    const member = update.chat_member;

    console.log("=== CHAT MEMBER UPDATE ===");
    console.log("Chat:", update.chat?.title);
    console.log("Old status:", member.old_chat_member?.status);
    console.log("New status:", member.new_chat_member?.status);
    console.log("User ID:", member.new_chat_member?.user?.id);
    console.log("Username:", member.new_chat_member?.user?.username);

    if (
      member.new_chat_member?.status === "member" &&
      member.old_chat_member?.status !== "member"
    ) {
      console.log("=== CHANNEL JOIN DETECTED ===");
    }
  }

  return res.status(200).json({
    ok: true
  });
}
