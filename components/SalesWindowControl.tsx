"use client";

import { useState } from "react";
import { CalendarRange, Loader2 } from "lucide-react";
import { loadDataset, saveSalesWindow, useAppState } from "@/lib/appState";
import { describeWindow, reanalyze, resolveWindow } from "@/lib/client";
import { toast } from "@/lib/toast";
import { checkWindow, daysInWindow, presetFromIso, windowLabel, type SalesWindow } from "@/lib/window";
import { closeWindowDialog, useTodayIso, useWindowDialogOpen } from "@/lib/windowUi";
import { Button, Callout, Modal, cx } from "./ui";

const PRESET_WEEKS = [2, 4, 6, 8, 12];

// Pick the dates the "units sold" figures in the files cover. Calls onChange with the window when it is valid,
// and with null while the dates are incomplete or not allowed.
export function SalesWindowForm({ initial, onChange }: { initial: SalesWindow | null; onChange: (w: SalesWindow | null) => void }) {
  const today = useTodayIso();
  const fallback = presetFromIso(today, 4);
  const [start, setStart] = useState(initial?.start ?? "");
  const [end, setEnd] = useState(initial?.end ?? "");
  const s = start || fallback?.start || "";
  const e = end || fallback?.end || "";
  const check = today ? checkWindow(s, e, today) : null;

  function set(nextStart: string, nextEnd: string) {
    setStart(nextStart);
    setEnd(nextEnd);
    onChange(today && checkWindow(nextStart, nextEnd, today).ok ? { start: nextStart, end: nextEnd } : null);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick choices">
        {PRESET_WEEKS.map((w) => {
          const p = presetFromIso(today, w);
          const active = p !== null && p.start === s && p.end === e;
          return (
            <button
              key={w}
              type="button"
              disabled={!p}
              aria-pressed={active}
              onClick={() => p && set(p.start, p.end)}
              className={cx(
                "min-h-9 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
                active ? "border-navy bg-navy text-white" : "border-line-strong bg-card text-ink-soft hover:border-ink-soft"
              )}
            >
              Last {w} weeks
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="text-xs font-medium text-ink-soft">
          From
          <input
            type="date"
            value={s}
            max={today || undefined}
            onChange={(ev) => set(ev.target.value, e)}
            className="mt-1 block min-h-11 w-full rounded-lg border border-line-strong bg-card px-3 text-sm font-normal text-ink"
          />
        </label>
        <label className="text-xs font-medium text-ink-soft">
          To
          <input
            type="date"
            value={e}
            max={today || undefined}
            onChange={(ev) => set(s, ev.target.value)}
            className="mt-1 block min-h-11 w-full rounded-lg border border-line-strong bg-card px-3 text-sm font-normal text-ink"
          />
        </label>
      </div>

      <p aria-live="polite" className="mt-3 min-h-5 text-[13px]">
        {check?.error ? (
          <span className="text-risk">{check.error}</span>
        ) : check?.days ? (
          <span className="text-ink-soft">
            That is <strong className="text-ink">{check.days} days</strong>
            {windowLabel(check.days) !== `${check.days} days` && <> ({windowLabel(check.days)})</>}.
            {check.warning && <span className="block text-amber">{check.warning}</span>}
          </span>
        ) : null}
      </p>
    </div>
  );
}

export const WINDOW_EXPLAINER = (
  <>
    Tell Rerack <strong>which dates the &ldquo;units sold&rdquo; figures in your files cover</strong>. Your files hold one sales total per line, so Rerack can&rsquo;t
    recalculate sales for a different period. Pick the dates that match how you exported them. This sets weekly sales, stock cover, which items are
    flagged, and the transfers and markdowns suggested.
  </>
);

// The dialog behind the "Sales window" buttons. With data loaded it re-runs the analysis for the new window.
export function SalesWindowDialog() {
  const open = useWindowDialogOpen();
  const { dataset, decisions, thresholds, salesWindow } = useAppState();
  const [pending, setPending] = useState<SalesWindow | null | undefined>(undefined); // undefined = nothing changed yet
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const current: SalesWindow | null = dataset?.window.start && dataset.window.end ? { start: dataset.window.start, end: dataset.window.end } : salesWindow;
  const decided = Object.keys(decisions).length;
  const changed = Boolean(pending && (!current || pending.start !== current.start || pending.end !== current.end));
  const days = pending ? daysInWindow(pending.start, pending.end) : null;

  function close() {
    closeWindowDialog();
    setPending(undefined);
    setError("");
  }

  async function apply() {
    if (!pending) return;
    const info = resolveWindow(pending);
    if (!dataset) {
      saveSalesWindow(pending, `Sales window set to ${describeWindow(info)} for the next import.`);
      toast(`Sales window saved: ${describeWindow(info)}. It is used the next time you process files.`);
      close();
      return;
    }
    setBusy(true);
    setError("");
    const res = await reanalyze(dataset, thresholds, info);
    setBusy(false);
    if (!res.ok) {
      setError(res.errors[0]?.message ?? "We couldn't re-run the analysis. Please try again.");
      return;
    }
    saveSalesWindow(pending);
    loadDataset(res, {
      source: dataset.source,
      businessName: dataset.businessName,
      files: dataset.files,
      window: info,
      activityText: `Sales window changed from ${describeWindow(dataset.window)} to ${describeWindow(info)}. Re-ran the analysis: ${res.candidates.length} possible actions, ${res.actions.length} shown.${
        decided ? ` ${decided} earlier decision${decided > 1 ? "s were" : " was"} cleared because the actions changed.` : ""
      }`,
    });
    toast(res.usedAi ? "Sales window applied. Everything is recalculated." : "Sales window applied. AI ranking was unavailable, so the rule-based order is shown.", res.usedAi ? "ok" : "warn");
    close();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Sales window"
      footer={
        <>
          <Button onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={apply} disabled={!changed || busy}>
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden /> Re-running...
              </>
            ) : dataset ? (
              "Apply and re-run analysis"
            ) : (
              "Save sales window"
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Callout tone="info">{WINDOW_EXPLAINER}</Callout>
        {dataset && (
          <p className="flex items-start gap-2 text-[13px] text-ink-soft">
            <CalendarRange className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden />
            <span>
              Current data uses <strong className="text-ink">{describeWindow(dataset.window)}</strong>.
            </span>
          </p>
        )}
        <SalesWindowForm initial={current} onChange={(w) => setPending(w)} />
        {changed && days && (
          <p className="text-[13px] leading-relaxed text-ink-soft">
            {dataset ? (
              <>
                Applying re-runs the analysis (about 3 seconds)
                {decided > 0 && (
                  <>
                    {" "}
                    and <strong className="text-amber">clears your {decided} recorded decision{decided > 1 ? "s" : ""}</strong>, because the suggested actions can change
                  </>
                )}
                .
              </>
            ) : (
              <>This is saved for the next time you process files.</>
            )}
          </p>
        )}
        {error && <Callout tone="risk">{error}</Callout>}
      </div>
    </Modal>
  );
}
