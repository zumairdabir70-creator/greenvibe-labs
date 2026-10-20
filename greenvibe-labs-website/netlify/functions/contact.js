/**
 * GreenVibe Labs: contact form backend (Netlify Function)
 * -------------------------------------------------------
 * Receives the website form (POST /.netlify/functions/contact) and emails
 * every enquiry to you automatically using Resend (https://resend.com).
 *
 * No npm packages needed (uses Node 18+ built-in fetch).
 *
 * Environment variables (set in Netlify > Site settings > Environment variables):
 *   RESEND_API_KEY  required  your Resend API key (starts with "re_")
 *   TO_EMAIL        optional  where enquiries are sent (default below)
 *   FROM_EMAIL      optional  sender address. Default "GreenVibe Labs <onboarding@resend.dev>"
 *                             works for testing and for sending to the email you signed up to
 *                             Resend with. Once you verify your own domain in Resend, use e.g.
 *                             "GreenVibe Labs <hello@yourdomain.com>".
 */

const DEFAULT_TO = "zumairdabir70@gmail.com";
const NEEDS = ["Online store", "Portfolio website", "Automated workflows", "Website and workflows", "Not sure yet"];

const json = (statusCode, obj) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(obj),
});

// Escape user text before putting it in the HTML email
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return json(500, { ok: false, error: "Email service is not configured." });

  // Parse body (JSON from the site's fetch call)
  let data;
  try {
    data = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { ok: false, error: "Invalid request." });
  }

  // Spam trap: real visitors never see or fill this hidden field
  if (data.company) return json(200, { ok: true });

  const name = String(data.name || "").trim().slice(0, 100);
  const email = String(data.email || "").trim().slice(0, 200);
  const message = String(data.message || "").trim().slice(0, 5000);
  const type = NEEDS.includes(data.type) ? data.type : "Not specified";

  if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(400, { ok: false, error: "Please add your name, a valid email, and a message." });
  }

  const to = process.env.TO_EMAIL || DEFAULT_TO;
  const from = process.env.FROM_EMAIL || "GreenVibe Labs <onboarding@resend.dev>";

  const html = `
    <div style="font-family:system-ui,Arial,sans-serif;max-width:560px;color:#252A12">
      <h2 style="color:#5C6B2E;margin:0 0 12px">New project enquiry</h2>
      <p style="margin:4px 0"><strong>Name:</strong> ${esc(name)}</p>
      <p style="margin:4px 0"><strong>Email:</strong> <a href="mailto:${esc(email)}">${esc(email)}</a></p>
      <p style="margin:4px 0"><strong>Needs:</strong> ${esc(type)}</p>
      <hr style="border:0;border-top:1px solid #ddd;margin:16px 0">
      <p style="white-space:pre-wrap;line-height:1.6">${esc(message)}</p>
      <p style="color:#777;font-size:12px;margin-top:24px">Sent from the GreenVibe Labs website contact form. Hit Reply to answer ${esc(name)} directly.</p>
    </div>`;
  const text = `New project enquiry\n\nName: ${name}\nEmail: ${email}\nNeeds: ${type}\n\n${message}`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email, // pressing Reply in your inbox answers the client
        subject: `New enquiry from ${name} (${type})`,
        html,
        text,
      }),
    });

    if (!res.ok) {
      console.error("Resend error:", res.status, await res.text());
      return json(502, { ok: false, error: "Could not send your message right now." });
    }
    return json(200, { ok: true });
  } catch (err) {
    console.error("Send failed:", err);
    return json(502, { ok: false, error: "Could not send your message right now." });
  }
};
