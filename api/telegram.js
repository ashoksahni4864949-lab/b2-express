export default async function handler(req, res) {
  console.log("=== TELEGRAM WEBHOOK HIT ===");
  console.log(JSON.stringify(req.body));

  if (req.method !== "POST") {
    return res.status(200).json({
      ok: true,
      message: "Webhook is working"
    });
  }

  const update = req.body;

  // Private channel JOIN REQUEST
  if (update.chat_join_request) {
    const request = update.chat_join_request;
    const user = request.from;

    console.log("=== JOIN REQUEST RECEIVED ===");

    console.log("Channel:", request.chat?.title);
    console.log("Channel ID:", request.chat?.id);

    console.log("User ID:", user?.id);
    console.log("Username:", user?.username || null);
    console.log("First Name:", user?.first_name || null);
    console.log("Last Name:", user?.last_name || null);

    console.log("Invite Link:", request.invite_link?.invite_link || null);
    console.log("Request Date:", request.date);

    // IMPORTANT:
    // Abhi request ko approve nahi kar rahe.
    // User ki request pending rahegi.

    // Baad me yahan:
    // Meta Conversions API
    // + attribution/tracking
    // add karenge.
  }

  return res.status(200).json({
    ok: true
  });
}
