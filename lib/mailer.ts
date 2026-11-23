import nodemailer from "nodemailer";
import type { ContactInput } from "./contact";

// Sends the two emails for a contact-form submission through Gmail (SMTP + an app password).
// Server-only: it reads secrets from environment variables and must never be imported by a client component.

export type MailResult = { owner: boolean; reply: boolean };

export function mailConfigured(): boolean {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

// Anything a visitor typed is escaped before it goes into HTML, so a message can't inject markup or links.
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export async function sendContactEmails(input: ContactInput): Promise<MailResult> {
  const user = process.env.GMAIL_USER!;
  const pass = process.env.GMAIL_APP_PASSWORD!.replace(/\s+/g, ""); // Google shows the app password in 4 blocks
  const owner = process.env.OWNER_EMAIL || user;

  const transporter = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } });
  const result: MailResult = { owner: false, reply: false };

  // 1. Notification to the website owner. Reply-To is the visitor, so "Reply" in Gmail answers them.
  try {
    await transporter.sendMail({
      from: `"Rerack website" <${user}>`,
      to: owner,
      replyTo: `"${input.name.replace(/"/g, "")}" <${input.email}>`,
      subject: `New Rerack enquiry from ${input.name}`,
      text: `${input.name} <${input.email}> sent a message through the Rerack landing page.\n\nStores: ${input.stores || "not said"}\n\n${input.message}\n`,
      html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.55;color:#121a2b">
<h2 style="margin:0 0 12px">New enquiry from the Rerack landing page</h2>
<p style="margin:0 0 4px"><b>Name:</b> ${esc(input.name)}</p>
<p style="margin:0 0 4px"><b>Email:</b> ${esc(input.email)}</p>
<p style="margin:0 0 12px"><b>Stores:</b> ${esc(input.stores || "not said")}</p>
<p style="margin:0 0 4px"><b>Message:</b></p>
<p style="margin:0;white-space:pre-wrap;padding:12px;background:#f6f3ec;border-radius:8px">${esc(input.message)}</p>
<p style="margin:16px 0 0;color:#566074;font-size:13px">Press Reply to answer ${esc(input.name)} directly.</p>
</div>`,
    });
    result.owner = true;
  } catch (err) {
    console.error("[contact] owner notification failed:", err instanceof Error ? err.message : err);
  }

  // 2. Automatic acknowledgement to the person who submitted the form.
  try {
    await transporter.sendMail({
      from: `"Rerack" <${user}>`,
      to: input.email,
      replyTo: owner,
      subject: "We got your message - Rerack",
      text: `Hi ${input.name},\n\nThanks for getting in touch with Rerack. We have your message and will reply personally, usually within two working days.\n\nYou wrote:\n"${input.message}"\n\nThis is an automatic reply, so you don't need to answer it.\n\nThe Rerack team\n`,
      html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.55;color:#121a2b;max-width:520px">
<h2 style="margin:0 0 12px;color:#0b7a63">Thanks, ${esc(input.name)}. We got your message.</h2>
<p style="margin:0 0 12px">We'll reply personally, usually within two working days.</p>
<p style="margin:0 0 4px;color:#566074;font-size:13px">You wrote:</p>
<p style="margin:0 0 16px;white-space:pre-wrap;padding:12px;background:#f6f3ec;border-radius:8px">${esc(input.message)}</p>
<p style="margin:0;color:#566074;font-size:13px">This is an automatic reply, so you don't need to answer it.<br/>The Rerack team</p>
</div>`,
    });
    result.reply = true;
  } catch (err) {
    console.error("[contact] acknowledgement failed:", err instanceof Error ? err.message : err);
  }

  return result;
}
