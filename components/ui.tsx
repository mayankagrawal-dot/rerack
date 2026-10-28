"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CircleHelp, X } from "lucide-react";

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

// ---------- Layout ----------

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-accent">{eyebrow}</p>}
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-[38px] sm:leading-[1.1]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft sm:text-[15px]">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={cx("rounded-2xl border border-line/80 bg-card shadow-card", padded && "p-5 sm:p-6", className)}>
      {children}
    </section>
  );
}

export function CardTitle({ title, hint, right }: { title: string; hint?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
      <div className="min-w-0 flex-[1_1_15rem]">
        <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
        {hint && <p className="mt-1 text-[13px] leading-snug text-ink-soft">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

// ---------- Small pieces ----------

type Tone = "neutral" | "accent" | "amber" | "risk" | "info" | "navy";
const TONES: Record<Tone, string> = {
  neutral: "bg-paper text-ink-soft ring-line-strong",
  accent: "bg-accent-soft text-accent-strong ring-accent/20",
  amber: "bg-amber-soft text-amber ring-amber/20",
  risk: "bg-risk-soft text-risk ring-risk/20",
  info: "bg-info-soft text-info ring-info/20",
  navy: "bg-navy text-white ring-navy",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium ring-1 ring-inset",
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

type ButtonProps = {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "accentSoft";
  size?: "md" | "lg" | "sm";
  className?: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  ariaLabel?: string;
};

export function Button({
  children,
  variant = "secondary",
  size = "md",
  className,
  href,
  onClick,
  disabled,
  type = "button",
  ariaLabel,
}: ButtonProps) {
  const cls = cx(
    "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50",
    size === "lg" ? "min-h-12 px-5 text-[15px]" : size === "sm" ? "min-h-9 rounded-lg px-3 text-[13px]" : "min-h-11 px-4 text-sm",
    variant === "primary" &&
      "bg-gradient-to-b from-[#0f8a70] to-accent text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_6px_16px_-6px_rgba(11,122,99,0.6)] hover:to-accent-strong hover:shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_8px_20px_-6px_rgba(11,122,99,0.7)]",
    variant === "secondary" && "border border-line-strong bg-card text-ink shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:border-ink-faint hover:bg-paper/60",
    variant === "ghost" && "text-ink-soft hover:bg-paper hover:text-ink",
    variant === "danger" && "border border-risk/30 bg-card text-risk hover:bg-risk-soft",
    variant === "accentSoft" && "bg-accent-soft text-accent-strong hover:bg-accent-soft/70",
    className
  );
  if (href) {
    return (
      <Link href={href} className={cls} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls} aria-label={ariaLabel}>
      {children}
    </button>
  );
}

// A small "?" that explains a metric on hover or keyboard focus.
export function Tip({ text }: { text: ReactNode }) {
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const [alignRight, setAlignRight] = useState(false);
  // Open towards the side that has room, so the popover never runs off the screen.
  const measure = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setAlignRight(r.left + 256 > window.innerWidth - 12);
  };
  return (
    <span ref={ref} onMouseEnter={measure} onFocus={measure} className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-describedby={id}
        className="inline-flex size-5 items-center justify-center rounded-full text-ink-faint hover:text-ink focus-visible:text-ink"
      >
        <CircleHelp className="size-3.5" aria-hidden />
        <span className="sr-only">What is this?</span>
      </button>
      <span
        id={id}
        role="tooltip"
        className={cx(
          "pointer-events-none absolute top-full z-30 mt-1 hidden w-64 rounded-lg bg-navy px-3 py-2 text-left text-xs font-normal leading-relaxed text-white shadow-lg group-focus-within:block group-hover:block",
          alignRight ? "right-0" : "left-0"
        )}
      >
        {text}
      </span>
    </span>
  );
}

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "amber" | "risk" | "accent";
  title?: string;
  children: ReactNode;
}) {
  const styles = {
    info: "border-info/20 bg-info-soft text-ink",
    amber: "border-amber/25 bg-amber-soft text-ink",
    risk: "border-risk/25 bg-risk-soft text-ink",
    accent: "border-accent/20 bg-accent-soft text-ink",
  }[tone];
  return (
    <div role={tone === "risk" || tone === "amber" ? "alert" : "note"} className={cx("rounded-xl border px-4 py-3.5 text-sm leading-relaxed", styles)}>
      {title && <p className="mb-0.5 font-semibold">{title}</p>}
      <div className="text-ink-soft [&_strong]:text-ink">{children}</div>
    </div>
  );
}

// A quiet placeholder shown for a moment while the saved data is read from the browser.
export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse space-y-4">
      <div className="h-9 w-56 rounded-lg bg-line" />
      <div className="h-4 w-80 max-w-full rounded bg-line/70" />
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 rounded-xl border border-line bg-card" />
        ))}
      </div>
      <div className="h-64 rounded-xl border border-line bg-card" />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  actions,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Card className="mx-auto max-w-xl text-center" padded={false}>
      <div className="px-6 py-12">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-soft to-[#cfeadf] text-accent ring-1 ring-accent/15">
          {icon}
        </div>
        <h2 className="font-display text-2xl font-semibold text-ink">{title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">{children}</p>
        {actions && <div className="mt-6 flex flex-wrap justify-center gap-2">{actions}</div>}
      </div>
    </Card>
  );
}

// ---------- Segmented control (tabs / filters) ----------

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-xl border border-line bg-card p-1 shadow-card">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "min-h-9 shrink-0 rounded-lg px-3.5 text-[13px] font-medium transition-colors",
            value === o.value ? "bg-navy text-white shadow-sm" : "text-ink-soft hover:bg-paper hover:text-ink"
          )}
        >
          {o.label}
          {o.count !== undefined && (
            <span className={cx("ml-1.5 tabular-nums", value === o.value ? "text-white/70" : "text-ink-faint")}>{o.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ---------- Modal / side sheet (native <dialog>, so focus and Escape work properly) ----------

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  variant = "center",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  variant?: "center" | "side";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
  }, [open]);

  if (!open) return null; // closed dialogs don't exist in the page at all

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // a click on the dimmed backdrop closes it
      }}
      className={cx(
        "m-auto w-[calc(100%-1.5rem)] rounded-2xl border border-line bg-card p-0 shadow-2xl open:flex open:flex-col",
        variant === "side"
          ? "max-h-[92vh] max-w-2xl sm:mr-0 sm:ml-auto sm:h-screen sm:max-h-none sm:rounded-r-none"
          : "max-h-[90vh] max-w-lg"
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <h2 id={titleId} className="font-display text-xl font-semibold text-ink">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-soft hover:bg-paper hover:text-ink"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{open && children}</div>
      {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-paper/60 px-5 py-3">{footer}</div>}
    </dialog>
  );
}
