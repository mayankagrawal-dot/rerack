"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Boxes,
  CalendarRange,
  CheckCircle2,
  History,
  Info,
  LayoutDashboard,
  ListChecks,
  Menu,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import { useAppState, useHydrated } from "@/lib/appState";
import { describeWindow } from "@/lib/client";
import { fmtAgo } from "@/lib/format";
import { windowDates } from "@/lib/window";
import { openWindowDialog } from "@/lib/windowUi";
import { useToasts } from "@/lib/toast";
import { SalesWindowDialog } from "./SalesWindowControl";
import { Badge, cx } from "./ui";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard, primary: true },
  { href: "/actions", label: "Action Centre", icon: ListChecks, primary: true },
  { href: "/inventory", label: "Inventory", icon: Boxes, primary: true },
  { href: "/stores", label: "Stores", icon: Store, primary: true },
  { href: "/import", label: "Data Imports", icon: Upload, primary: true },
  { href: "/activity", label: "Activity & Reports", icon: History, primary: false },
  { href: "/rules", label: "Rules", icon: SlidersHorizontal, primary: false },
] as const;

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="Rerack home">
      <span className="flex size-8 items-center justify-center rounded-lg bg-navy text-white">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M5 7h14M5 12h9M5 17h5" />
          <path d="m16 15 3 3 3-4" stroke="#5fd3b3" />
        </svg>
      </span>
      <span className="font-display text-xl font-semibold tracking-tight text-ink">Rerack</span>
    </Link>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { dataset, decisions } = useAppState();
  const open = dataset ? dataset.actions.filter((a) => !decisions[a.candidate.id]).length : 0;
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV.map((n) => {
        const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
        const Icon = n.icon;
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
              active ? "bg-accent-soft text-accent-strong" : "text-ink-soft hover:bg-paper hover:text-ink"
            )}
          >
            <Icon className="size-[18px]" aria-hidden />
            <span className="flex-1">{n.label}</span>
            {n.href === "/actions" && open > 0 && (
              <span className="rounded-full bg-navy px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">{open}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function Toaster() {
  const toasts = useToasts();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex max-w-md items-center gap-2.5 rounded-lg bg-navy px-4 py-3 text-sm text-white shadow-xl"
        >
          {t.tone === "warn" ? (
            <TriangleAlert className="size-4 shrink-0 text-amber-soft" aria-hidden />
          ) : t.tone === "info" ? (
            <Info className="size-4 shrink-0 text-info-soft" aria-hidden />
          ) : (
            <CheckCircle2 className="size-4 shrink-0 text-[#5fd3b3]" aria-hidden />
          )}
          {t.text}
        </div>
      ))}
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { dataset, salesWindow } = useAppState();
  const hydrated = useHydrated();
  const windowText = dataset
    ? describeWindow(dataset.window)
    : salesWindow
      ? (windowDates(salesWindow.start, salesWindow.end) ?? "custom dates")
      : "last 4 weeks";
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen md:grid md:grid-cols-[256px_1fr]">
      {/* Desktop navigation rail */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-card md:flex">
        <div className="px-5 pb-4 pt-5">
          <Wordmark />
        </div>
        <div className="flex-1 overflow-y-auto px-3">
          <NavList />
        </div>
        <div className="m-3 rounded-lg border border-line bg-paper p-3 text-xs leading-relaxed text-ink-soft">
          <p className="mb-1 flex items-center gap-1.5 font-semibold text-ink">
            <ShieldCheck className="size-3.5 text-accent" aria-hidden /> You stay in control
          </p>
          Approving an action records your decision here. Rerack never moves stock or changes prices.
        </div>
      </aside>

      <div className="min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
          <div className="mx-auto flex max-w-[1240px] items-center gap-3 px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="inline-flex size-10 items-center justify-center rounded-lg border border-line bg-card text-ink md:hidden"
            >
              <Menu className="size-5" aria-hidden />
            </button>
            <div className="md:hidden">
              <Wordmark />
            </div>

            <div className="hidden min-w-0 items-center gap-3 md:flex">
              <span className="truncate text-sm font-semibold text-ink">{dataset ? dataset.businessName : hydrated ? "No data loaded yet" : " "}</span>
              {dataset?.source === "demo" && (
                <Badge tone="amber">
                  <span className="xl:hidden">Demo data</span>
                  <span className="hidden xl:inline">Demo data, not a real retailer</span>
                </Badge>
              )}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={openWindowDialog}
                title="Change the dates the sales figures cover"
                className="hidden max-w-[320px] items-center gap-1.5 rounded-full border border-line-strong bg-card px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent md:inline-flex"
              >
                <CalendarRange className="size-3.5 shrink-0 text-accent" aria-hidden />
                <span className="truncate">Sales window: {windowText}</span>
              </button>
              {dataset && (
                <span className="hidden whitespace-nowrap text-xs text-ink-soft xl:inline" title="When the files were last processed">
                  Data updated {fmtAgo(dataset.processedAt)}
                </span>
              )}
              <Link
                href="/activity"
                aria-label="Activity and reports"
                className="inline-flex size-10 items-center justify-center rounded-lg border border-line bg-card text-ink-soft hover:text-ink"
              >
                <History className="size-[18px]" aria-hidden />
              </Link>
            </div>
          </div>
          {dataset?.source === "demo" && (
            <div className="border-t border-amber/20 bg-amber-soft px-4 py-1.5 text-center text-xs text-amber md:hidden">
              Demo data for a fictional retailer
            </div>
          )}
        </header>

        <main key={pathname} className="mx-auto max-w-[1240px] px-4 pb-28 pt-6 sm:px-6 md:pb-12 md:pt-8">
          {children}
        </main>
      </div>

      {/* Phone: slide-in menu with every page */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-navy/50" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-card p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <Wordmark />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="inline-flex size-10 items-center justify-center rounded-lg text-ink-soft hover:bg-paper"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <NavList onNavigate={() => setMenuOpen(false)} />
            <p className="mt-auto rounded-lg border border-line bg-paper p-3 text-xs leading-relaxed text-ink-soft">
              Approving an action records your decision here. Rerack never moves stock or changes prices.
            </p>
          </div>
        </div>
      )}

      {/* Phone: thumb-reach bar for the main pages */}
      <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {NAV.filter((n) => n.primary).map((n) => {
          const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={cx("flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium", active ? "text-accent-strong" : "text-ink-soft")}
            >
              <Icon className="size-5" aria-hidden />
              {n.label.replace("Action Centre", "Actions").replace("Data Imports", "Import")}
            </Link>
          );
        })}
      </nav>

      <SalesWindowDialog />
      <Toaster />
    </div>
  );
}
