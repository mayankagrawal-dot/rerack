import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight, ArrowRight, CheckCircle2, ClipboardCheck, ShieldCheck, Tag, Upload } from "lucide-react";
import ContactForm from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Rerack: stop old stock reaching the end-of-season sale",
  description:
    "Upload each store's stock file and get a short, ranked list of what to move between stores and what to mark down. You approve every action.",
};

const STEPS = [
  {
    icon: Upload,
    title: "Upload one file per store",
    text: "Drop in the stock and sales CSV from each store, plus a short note like \"Diwali in 3 weeks\". Billing-software column names are matched for you.",
  },
  {
    icon: ArrowLeftRight,
    title: "Get a ranked list of 10",
    text: "Rerack merges the stores by item, size and colour, finds stock that is ageing or stuck, and lists the transfers and markdowns that matter most.",
  },
  {
    icon: ClipboardCheck,
    title: "Approve, edit or reject",
    text: "Every card shows the numbers behind it. You decide from your phone, and each decision is time-stamped in a log.",
  },
];

const TRUST = [
  "Code does every number. The AI only ranks and explains.",
  "Nothing moves and no price changes without you.",
  "Bad data gets a plain message, not a wrong answer.",
  "Works from a phone, with no new software to install.",
];

function Mark() {
  return (
    <span className="flex size-9 items-center justify-center rounded-xl bg-navy text-white">
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <path d="M5 7h14M5 12h9M5 17h5" />
        <path d="m16 15 3 3 3-4" stroke="#5fd3b3" />
      </svg>
    </span>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen text-ink">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-line/70 bg-paper/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link href="/landing" className="flex items-center gap-2.5" aria-label="Rerack home">
            <Mark />
            <span className="font-display text-xl font-semibold tracking-tight">Rerack</span>
          </Link>
          <nav aria-label="Page sections" className="ml-auto hidden items-center gap-6 text-sm font-medium text-ink-soft sm:flex">
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#trust" className="hover:text-ink">Why trust it</a>
            <a href="#contact" className="hover:text-ink">Contact</a>
          </nav>
          <Link
            href="/"
            className="ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-navy px-4 text-sm font-semibold text-white hover:bg-[#243562] sm:ml-0"
          >
            Open the demo <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-12 sm:px-6 md:pt-20 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="inline-flex rounded-full border border-accent/20 bg-accent-soft px-3 py-1 text-xs font-semibold tracking-wide text-accent-strong">
              For owners of 3 to 30 clothing and footwear stores
            </p>
            <h1 className="mt-5 font-display text-[2.6rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Know what to move, what to mark down, and what to save{" "}
              <span className="text-accent">before the season ends.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
              Your stores&rsquo; stock reports sit in separate files, so ageing stock gets noticed too late and ends up in the deep-discount
              end-of-season sale. Rerack turns those files into a short, ranked list of what to do this week.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/"
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-accent px-5 text-[15px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(11,122,99,0.7)] hover:bg-accent-strong"
              >
                Explore the demo <ArrowRight className="size-4" aria-hidden />
              </Link>
              <a
                href="#contact"
                className="inline-flex min-h-12 items-center rounded-xl border border-line-strong bg-white px-5 text-[15px] font-semibold text-ink hover:border-accent"
              >
                Ask a question
              </a>
            </div>
            <p className="mt-4 text-sm text-ink-faint">The demo uses a fictional chain, Northstar Apparel. No sign-up needed.</p>
          </div>

          {/* Example action card, taken from the demo data */}
          <div className="rounded-2xl border border-line bg-card p-5 shadow-[0_2px_4px_rgba(16,24,40,0.05),0_14px_32px_-12px_rgba(16,24,40,0.18)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">This week&rsquo;s top action</p>
            <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-medium">
              <span className="rounded-full bg-info-soft px-2.5 py-1 text-info">Transfer</span>
              <span className="rounded-full bg-accent-soft px-2.5 py-1 text-accent-strong">Strong evidence</span>
            </div>
            <h2 className="mt-3 font-display text-2xl font-semibold leading-snug">Move 12 Navy Kurta, size M, from Jayanagar to Whitefield</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-paper p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Jayanagar</p>
                <p className="mt-1 font-medium">12 on hand, 0 sold</p>
                <p className="text-xs text-ink-soft">84 days since receipt</p>
              </div>
              <div className="rounded-xl bg-paper p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Whitefield</p>
                <p className="mt-1 font-medium">14 sold in 4 weeks</p>
                <p className="text-xs text-ink-soft">Selling fast here</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <span className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent text-sm font-semibold text-white">
                <CheckCircle2 className="size-4" aria-hidden /> Approve
              </span>
              <span className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-line-strong text-sm font-medium">Edit</span>
              <span className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-risk/30 text-sm font-medium text-risk">Reject</span>
            </div>
            <p className="mt-3 text-xs text-ink-faint">An example from the demo data. Nothing is moved until you act on it.</p>
          </div>
        </section>

        {/* Problem strip */}
        <section className="border-y border-line bg-navy text-white">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-3">
            {[
              ["Reports in separate files", "Each store exports its own report, and someone merges them by hand."],
              ["Decisions by eye", "Slow sellers hide in a long sheet until the season is almost over."],
              ["Deep discounts at the end", "Whatever is left is cleared at the season-end sale, at the lowest margin."],
            ].map(([t, d]) => (
              <div key={t}>
                <p className="font-display text-xl font-semibold text-mint">{t}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-[#c3cce0]">{d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">From stock files to a decision in minutes</h2>
          <p className="mt-2 max-w-2xl text-ink-soft">The demo finishes in two to three seconds. A real upload is the same steps.</p>
          <ol className="mt-8 grid gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <li key={s.title} className="rounded-2xl border border-line bg-card p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_4px_14px_-6px_rgba(16,24,40,0.08)]">
                  <div className="flex items-center justify-between">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="font-display text-3xl font-semibold text-line-strong">{i + 1}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{s.text}</p>
                </li>
              );
            })}
          </ol>
        </section>

        {/* What you get + trust */}
        <section id="trust" className="mx-auto grid max-w-6xl scroll-mt-20 gap-10 px-4 pb-16 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Built so you can check every suggestion</h2>
            <p className="mt-3 text-ink-soft">
              Rerack is only as good as the data it gets, so it shows its working. Each card has an evidence panel with the per-store figures,
              the calculation, and what the data can&rsquo;t tell you.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-line bg-card p-4">
                <ArrowLeftRight className="size-5 text-info" aria-hidden />
                <p className="mt-2 font-semibold">Transfers</p>
                <p className="text-sm text-ink-soft">Stock that is stuck in one store and selling in another.</p>
              </div>
              <div className="rounded-2xl border border-line bg-card p-4">
                <Tag className="size-5 text-amber" aria-hidden />
                <p className="mt-2 font-semibold">Markdowns</p>
                <p className="text-sm text-ink-soft">Old stock that is barely selling anywhere in the chain.</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-card p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_4px_14px_-6px_rgba(16,24,40,0.08)]">
            <p className="flex items-center gap-2 text-sm font-semibold text-accent-strong">
              <ShieldCheck className="size-4" aria-hidden /> You stay in control
            </p>
            <ul className="mt-4 space-y-3">
              {TRUST.map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-[15px] leading-relaxed">
                  <CheckCircle2 className="mt-0.5 size-[18px] shrink-0 text-accent" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="scroll-mt-16 border-t border-line bg-white/60">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Have a question? Ask us.</h2>
              <p className="mt-3 max-w-md text-ink-soft">
                Tell us a little about your stores, or ask how Rerack would work with your billing software. You&rsquo;ll get an automatic
                confirmation straight away and a personal reply within two working days.
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-card p-5 shadow-[0_2px_4px_rgba(16,24,40,0.05),0_14px_32px_-12px_rgba(16,24,40,0.18)] sm:p-7">
              <ContactForm />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-paper">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 text-sm text-ink-soft sm:px-6">
          <span className="font-display text-base font-semibold text-ink">Rerack</span>
          <span>Built as a hackathon MVP. The demo chain is fictional.</span>
          <Link href="/" className="ml-auto font-medium text-accent-strong hover:underline">Open the demo</Link>
        </div>
      </footer>
    </div>
  );
}
