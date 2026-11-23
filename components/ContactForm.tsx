"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, Send, TriangleAlert } from "lucide-react";
import { CONTACT_LIMITS, STORE_OPTIONS, checkContact, type ContactInput } from "@/lib/contact";
import { cx } from "./ui";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "done"; emailed: boolean }
  | { kind: "error"; message: string };

type Errors = Partial<Record<keyof ContactInput, string>>;

const FIELD =
  "w-full rounded-xl border bg-white px-3.5 py-2.5 text-[15px] text-ink shadow-[0_1px_2px_rgba(16,24,40,0.04)] placeholder:text-ink-faint focus:border-accent focus:outline-none";

export default function ContactForm() {
  const [values, setValues] = useState({ name: "", email: "", stores: "", message: "", website: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const set = (k: keyof typeof values) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    if (errors[k as keyof ContactInput]) setErrors((er) => ({ ...er, [k]: undefined }));
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (status.kind === "sending") return;

    const checked = checkContact(values); // same rules as the server, for instant feedback
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    setErrors({});
    setStatus({ kind: "sending" });

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json().catch(() => null)) as { ok: boolean; emailed?: boolean; message?: string; errors?: Errors } | null;
      if (res.ok && data?.ok) {
        setStatus({ kind: "done", emailed: data.emailed !== false });
        setValues({ name: "", email: "", stores: "", message: "", website: "" });
      } else if (data?.errors) {
        setErrors(data.errors);
        setStatus({ kind: "idle" });
      } else {
        setStatus({ kind: "error", message: data?.message ?? "Something went wrong. Please try again." });
      }
    } catch {
      setStatus({ kind: "error", message: "We couldn't reach the server. Check your connection and try again." });
    }
  }

  if (status.kind === "done") {
    return (
      <div role="status" className="rounded-2xl border border-accent/25 bg-accent-soft p-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-accent" aria-hidden />
        <h3 className="mt-3 font-display text-2xl font-semibold text-ink">Message sent. Thank you!</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
          {status.emailed
            ? "We've emailed you a confirmation, and we'll reply personally, usually within two working days."
            : "We've saved your message and will reply personally. (The confirmation email didn't go out, but nothing is lost.)"}
        </p>
        <button
          type="button"
          onClick={() => setStatus({ kind: "idle" })}
          className="mt-4 min-h-11 rounded-xl border border-line-strong bg-white px-4 text-sm font-medium text-ink hover:border-accent"
        >
          Send another message
        </button>
      </div>
    );
  }

  const sending = status.kind === "sending";
  const err = (k: keyof ContactInput) => (errors[k] ? <p id={`${k}-error`} className="mt-1.5 text-sm text-risk">{errors[k]}</p> : null);
  const border = (k: keyof ContactInput) => (errors[k] ? "border-risk" : "border-line-strong");

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" aria-describedby={status.kind === "error" ? "form-error" : undefined}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="c-name" className="mb-1.5 block text-sm font-medium text-ink">Your name</label>
          <input
            id="c-name"
            name="name"
            autoComplete="name"
            maxLength={CONTACT_LIMITS.name}
            value={values.name}
            onChange={set("name")}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "name-error" : undefined}
            className={cx(FIELD, border("name"))}
            placeholder="Asha Rao"
          />
          {err("name")}
        </div>
        <div>
          <label htmlFor="c-email" className="mb-1.5 block text-sm font-medium text-ink">Email</label>
          <input
            id="c-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={CONTACT_LIMITS.email}
            value={values.email}
            onChange={set("email")}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
            className={cx(FIELD, border("email"))}
            placeholder="asha@example.com"
          />
          {err("email")}
        </div>
      </div>

      <div>
        <label htmlFor="c-stores" className="mb-1.5 block text-sm font-medium text-ink">
          How many stores do you run? <span className="font-normal text-ink-faint">(optional)</span>
        </label>
        <select id="c-stores" name="stores" value={values.stores} onChange={set("stores")} className={cx(FIELD, border("stores"))}>
          <option value="">Choose one</option>
          {STORE_OPTIONS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        {err("stores")}
      </div>

      <div>
        <label htmlFor="c-message" className="mb-1.5 block text-sm font-medium text-ink">Your question</label>
        <textarea
          id="c-message"
          name="message"
          rows={5}
          maxLength={CONTACT_LIMITS.message}
          value={values.message}
          onChange={set("message")}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? "message-error" : undefined}
          className={cx(FIELD, border("message"), "resize-y")}
          placeholder="Tell us about your stores, or ask anything about Rerack."
        />
        <div className="mt-1 flex justify-between gap-3">
          <span>{err("message")}</span>
          <span className="ml-auto text-xs tabular-nums text-ink-faint">{values.message.length}/{CONTACT_LIMITS.message}</span>
        </div>
      </div>

      {/* Honeypot: hidden from people and screen readers; bots fill it in and the server drops the message. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="c-website">Leave this empty</label>
        <input id="c-website" name="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={set("website")} />
      </div>

      {status.kind === "error" && (
        <div id="form-error" role="alert" className="flex items-start gap-2.5 rounded-xl border border-risk/25 bg-risk-soft p-3.5 text-sm text-risk">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {status.message}
        </div>
      )}

      <button
        type="submit"
        disabled={sending}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 text-[15px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(11,122,99,0.7)] transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
      >
        {sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
        {sending ? "Sending..." : "Send message"}
      </button>
      <p className="text-xs leading-relaxed text-ink-faint">
        We store your name, email and message so we can reply. We don&rsquo;t share them or add you to any list.
      </p>
    </form>
  );
}
