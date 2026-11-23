import { createClient } from "@supabase/supabase-js";
import { checkContact } from "@/lib/contact";
import { mailConfigured, sendContactEmails } from "@/lib/mailer";

// POST /api/contact: the landing-page form sends JSON here.
//   200 { ok: true, emailed: boolean }   saved (emailed=false means the row is saved but an email failed)
//   400 { ok: false, errors: {...} }     the input failed validation
//   429 { ok: false, message }           too many submissions from one address
//   503 { ok: false, message }           Supabase is not configured on this server
//   500 { ok: false, message }           the database refused the row

type Reply = { ok: true; emailed: boolean } | { ok: false; message?: string; errors?: Record<string, string> };
const reply = (body: Reply, status = 200) => Response.json(body, { status });

// A tiny in-memory limit: 5 submissions per IP per 10 minutes. It resets when the server restarts and
// isn't shared between serverless instances, so treat it as a speed bump, not real protection.
const hits = new Map<string, number[]>();
function tooMany(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 5;
}

export async function POST(request: Request) {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return reply({ ok: false, message: "The contact form isn't connected to its database yet. Please try again later." }, 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return reply({ ok: false, message: "We couldn't read that request." }, 400);
  }

  // Honeypot: real visitors never see this field, so a filled one means a bot. Pretend it worked.
  if (typeof body === "object" && body !== null && typeof (body as Record<string, unknown>).website === "string" && (body as Record<string, string>).website !== "") {
    return reply({ ok: true, emailed: true });
  }

  const checked = checkContact(body);
  if (!checked.ok) return reply({ ok: false, errors: checked.errors as Record<string, string> }, 400);

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (tooMany(ip)) return reply({ ok: false, message: "Too many messages from this connection. Please try again in a few minutes." }, 429);

  // Save the row. The anon key can only INSERT (see supabase/contact_messages.sql), so this call asks for no
  // data back: reading the row would need a SELECT policy, and visitors must never be able to read the table.
  const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error } = await supabase.from("contact_messages").insert({
    name: checked.value.name,
    email: checked.value.email,
    stores: checked.value.stores || null,
    message: checked.value.message,
  });
  if (error) {
    console.error("[contact] Supabase insert failed:", error.code, error.message);
    return reply({ ok: false, message: "We couldn't save your message just now. Please try again in a moment." }, 500);
  }

  // The row is saved, which is what matters. If an email fails the visitor still gets a success message.
  let emailed = false;
  if (mailConfigured()) {
    const sent = await sendContactEmails(checked.value);
    emailed = sent.owner && sent.reply;
  } else {
    console.warn("[contact] GMAIL_USER / GMAIL_APP_PASSWORD not set: row saved, no emails sent.");
  }
  return reply({ ok: true, emailed });
}
