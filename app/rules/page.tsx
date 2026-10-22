"use client";

import { useState } from "react";
import { RotateCcw, Save, Upload } from "lucide-react";
import { Button, Callout, Card, CardTitle, PageHeader, PageSkeleton } from "@/components/ui";
import { saveThresholds, useAppState, useHydrated } from "@/lib/appState";
import { CONFIG, DEFAULT_THRESHOLDS, THRESHOLD_FIELDS, sanitizeThresholds, type Thresholds } from "@/lib/config";
import { toast } from "@/lib/toast";

const GROUPS: { title: string; hint: string; keys: (keyof Thresholds)[] }[] = [
  {
    title: "Judging stock",
    hint: "When there isn't enough history to judge an item.",
    keys: ["newStockDays"],
  },
  {
    title: "Transfers",
    hint: "When stock should move from one store to another.",
    keys: ["moveSourceMinDays", "moveSourceMinCoverWeeks", "moveSourceKeepWeeks", "moveDestMaxCoverWeeks", "moveDestTargetWeeks", "moveMinUnits"],
  },
  {
    title: "Markdowns",
    hint: "When stock is old everywhere and selling slowly.",
    keys: ["markdownMinDays", "markdownMinChainCoverWeeks", "markdownPct"],
  },
];

export default function RulesPage() {
  const { thresholds, dataset } = useAppState();
  const hydrated = useHydrated();
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const values: Record<string, string> = draft ?? Object.fromEntries(THRESHOLD_FIELDS.map((f) => [f.key, String(thresholds[f.key])]));

  const parsed = Object.fromEntries(THRESHOLD_FIELDS.map((f) => [f.key, Number(values[f.key])]));
  const problems = THRESHOLD_FIELDS.filter((f) => {
    const n = Number(values[f.key]);
    return values[f.key] === "" || !Number.isFinite(n) || n < f.min || n > f.max;
  });
  const dirty = draft !== null && THRESHOLD_FIELDS.some((f) => Number(draft[f.key]) !== thresholds[f.key]);

  function save() {
    if (problems.length > 0) return;
    const next = sanitizeThresholds(parsed);
    const changes = THRESHOLD_FIELDS.filter((f) => next[f.key] !== thresholds[f.key]).map((f) => `${f.label}: ${thresholds[f.key]} → ${next[f.key]}`);
    saveThresholds(next, `Rules changed. ${changes.join("; ")}`);
    setDraft(null);
    toast("Rules saved. They apply the next time you process your files.");
  }

  function reset() {
    saveThresholds({ ...DEFAULT_THRESHOLDS }, "Rules reset to the defaults.");
    setDraft(null);
    toast("Rules reset to the defaults.", "info");
  }

  if (!hydrated) return <PageSkeleton />;

  return (
    <>
      <PageHeader
        title="Rules"
        subtitle="The thresholds behind every flag, transfer and markdown. They're plain numbers, so you can see exactly why something was suggested."
        actions={
          <>
            <Button onClick={reset}>
              <RotateCcw className="size-4" aria-hidden /> Reset to defaults
            </Button>
            <Button variant="primary" disabled={!dirty || problems.length > 0} onClick={save}>
              <Save className="size-4" aria-hidden /> Save rules
            </Button>
          </>
        }
      />

      {dataset && (
        <div className="mb-5">
          <Callout tone="info" title="Changes apply the next time you process your files">
            Your current actions were found with the rules in place when you processed them. To use new rules, process your files again on Data imports.{" "}
            <Button href="/import" size="sm" className="ml-1">
              <Upload className="size-3.5" aria-hidden /> Go to Data imports
            </Button>
          </Callout>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {GROUPS.map((g) => (
            <Card key={g.title}>
              <CardTitle title={g.title} hint={g.hint} />
              <div className="grid gap-4 sm:grid-cols-2">
                {g.keys.map((key) => {
                  const f = THRESHOLD_FIELDS.find((x) => x.key === key)!;
                  const bad = problems.includes(f);
                  return (
                    <div key={key}>
                      <label htmlFor={`rule-${key}`} className="block text-sm font-medium text-ink">
                        {f.label}
                      </label>
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          id={`rule-${key}`}
                          type="number"
                          inputMode="decimal"
                          step={f.unit === "weeks" && f.min < 1 ? 0.5 : 1}
                          min={f.min}
                          max={f.max}
                          value={values[key]}
                          aria-invalid={bad}
                          onChange={(e) => setDraft({ ...values, [key]: e.target.value })}
                          className="min-h-11 w-28 rounded-lg border border-line-strong bg-card px-3 text-base tabular-nums text-ink aria-[invalid=true]:border-risk"
                        />
                        <span className="text-sm text-ink-soft">{f.unit}</span>
                      </div>
                      <p className="mt-1 text-xs leading-snug text-ink-soft">{f.help}</p>
                      {bad && (
                        <p className="mt-1 text-xs text-risk">
                          Enter a number from {f.min} to {f.max}.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardTitle title="Rules that don't change" />
            <ul className="list-disc space-y-2 pl-5 text-[13px] leading-relaxed text-ink-soft marker:text-ink-faint">
              <li>
                <strong className="text-ink">Code does every number.</strong> The AI only ranks and explains; it never calculates.
              </li>
              <li>The weekly list is capped at {CONFIG.topShown} actions.</li>
              <li>
                It includes at least {CONFIG.minPerType} transfers and {CONFIG.minPerType} markdowns when the data supports them.
              </li>
              <li>No transfer is suggested unless the destination is selling the item and the source holds spare stock.</li>
              <li>Nothing moves and no price changes until you do it yourself.</li>
            </ul>
          </Card>
          <Card>
            <CardTitle title="How the numbers are worked out" />
            <ul className="space-y-2 text-[13px] leading-relaxed text-ink-soft">
              <li>
                <strong className="text-ink">Sales per week</strong> = units sold in the sales window ÷ the number of weeks in that window (you choose the dates)
              </li>
              <li>
                <strong className="text-ink">Stock cover</strong> = units on hand ÷ sales per week. With no sales it shows &ldquo;No sales&rdquo; and is never divided by zero.
              </li>
              <li>
                <strong className="text-ink">Sell-through</strong> = sold ÷ (sold + on hand)
              </li>
              <li>
                <strong className="text-ink">Days since receipt</strong> comes from the date_received column. It may not equal the true age of the stock.
              </li>
            </ul>
          </Card>
        </aside>
      </div>
    </>
  );
}
