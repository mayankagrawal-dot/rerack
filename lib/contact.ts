// Checks for the landing-page contact form. Used by the API route; the browser form repeats the same
// limits so people get quick feedback, but the server never trusts the browser.

export const CONTACT_LIMITS = { name: 80, email: 254, stores: 40, message: 2000, messageMin: 10 } as const;

export const STORE_OPTIONS = ["Just exploring", "1 store", "2-5 stores", "6-15 stores", "16+ stores"] as const;

export type ContactInput = {
  name: string;
  email: string;
  stores: string;
  message: string;
};

export type ContactCheck = { ok: true; value: ContactInput } | { ok: false; errors: Partial<Record<keyof ContactInput, string>> };

// A deliberately simple email check: one @, no spaces, a dot in the domain. The real test is whether the
// acknowledgement email arrives.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Names and the email go into email headers and subjects, so remove line breaks and control characters.
const oneLine = (s: string) => s.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();

export function checkContact(input: unknown): ContactCheck {
  const o = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const get = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "");

  const name = oneLine(get("name"));
  const email = oneLine(get("email")).toLowerCase();
  const stores = oneLine(get("stores"));
  // The message may have line breaks, but no other control characters.
  const message = get("message").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/\r\n?/g, "\n").trim();

  const errors: Partial<Record<keyof ContactInput, string>> = {};
  if (name.length < 2) errors.name = "Please tell us your name.";
  else if (name.length > CONTACT_LIMITS.name) errors.name = `Keep your name under ${CONTACT_LIMITS.name} characters.`;

  if (!EMAIL.test(email) || email.length > CONTACT_LIMITS.email) errors.email = "Please enter a valid email address, like name@example.com.";

  if (stores && !(STORE_OPTIONS as readonly string[]).includes(stores)) errors.stores = "Please choose one of the options.";

  if (message.length < CONTACT_LIMITS.messageMin) errors.message = `Please write at least ${CONTACT_LIMITS.messageMin} characters.`;
  else if (message.length > CONTACT_LIMITS.message) errors.message = `Please keep your message under ${CONTACT_LIMITS.message} characters.`;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, email, stores, message } };
}
