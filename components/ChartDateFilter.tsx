"use client";

import { useState } from "react";
import { CalendarRange, X } from "lucide-react";
import { ALL_DATES, isAllDates, rangeText, setChartRange, useChartRange, type ChartRange } from "@/lib/chartRange";
import { fmtInt } from "@/lib/format";
import { shiftIso } from "@/lib/window";
import { Card, Tip, cx } from "./ui";

// Filters the charts by the date the stock was received. Shown on every page that has charts.
export default function ChartDateFilter({
  processedAt,
  totalLines,
  shownLines,
  shownUnits,
}: {
  processedAt: string;
  totalLines: number;
  shownLines: number;
  shownUnits: number;
}) {
  const range = useChartRange();
  const anchor = processedAt.slice(0, 10); // ages are counted from the day the data was processed
  const [from, setFrom] = useState(range.start ?? "");
  const [to, setTo] = useState(range.end ?? "");
  const bad = from !== "" && to !== "" && from > to;

  const presets: { label: string; range: ChartRange }[] = [
    { label: "All dates", range: ALL_DATES },
    { label: "0-30 days", range: { start: shiftIso(anchor, -30), end: anchor } },
    { label: "31-60 days", range: { start: shiftIso(anchor, -60), end: shiftIso(anchor, -31) } },
    { label: "61-90 days", range: { start: shiftIso(anchor, -90), end: shiftIso(anchor, -61) } },
    { label: "Over 90 days", range: { start: null, end: shiftIso(anchor, -91) } },
  ];

  function choose(r: ChartRange) {
    setFrom(r.start ?? "");
    setTo(r.end ?? "");
    setChartRange(r);
  }

  function custom(nextFrom: string, nextTo: string) {
    setFrom(nextFrom);
    setTo(nextTo);
    if (nextFrom !== "" && nextTo !== "" && nextFrom > nextTo) return; // wait until the dates make sense
    setChartRange({ start: nextFrom || null, end: nextTo || null });
  }

  return (
    <Card className="!p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <CalendarRange className="size-4 text-accent" aria-hidden /> Chart dates
        </p>
        <Tip text="Charts can be limited to stock received in a date range, using the date_received column. Sales have no dates of their own (one total per line), so they always cover the sales window. The numbers at the top of the page always cover all stock." />
        <span className="text-xs text-ink-soft">Stock received:</span>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick date choices">
          {presets.map((p) => {
            const active = p.range.start === range.start && p.range.end === range.end;
            return (
              <button
                key={p.label}
                type="button"
                aria-pressed={active}
                onClick={() => choose(p.range)}
                className={cx(
                  "min-h-9 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
                  active ? "border-navy bg-navy text-white" : "border-line-strong bg-card text-ink-soft hover:border-ink-soft"
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-end gap-2">
          <label className="text-xs font-medium text-ink-soft">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => custom(e.target.value, to)}
              className="mt-1 block min-h-9 rounded-lg border border-line-strong bg-card px-2.5 text-sm font-normal text-ink"
            />
          </label>
          <label className="text-xs font-medium text-ink-soft">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => custom(from, e.target.value)}
              className="mt-1 block min-h-9 rounded-lg border border-line-strong bg-card px-2.5 text-sm font-normal text-ink"
            />
          </label>
          {!isAllDates(range) && (
            <button
              type="button"
              onClick={() => choose(ALL_DATES)}
              className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[13px] font-medium text-accent-strong hover:bg-accent-soft"
            >
              <X className="size-3.5" aria-hidden /> Reset
            </button>
          )}
        </div>
      </div>

      <p aria-live="polite" className="mt-3 text-[13px] leading-relaxed">
        {bad ? (
          <span className="text-risk">The &ldquo;From&rdquo; date must be on or before the &ldquo;To&rdquo; date.</span>
        ) : shownLines === 0 ? (
          <span className="text-amber">No stock was received in this range, so the charts below are empty. Try wider dates.</span>
        ) : (
          <span className="text-ink-soft">
            Charts show <strong className="text-ink tabular-nums">{fmtInt(shownLines)}</strong> of {fmtInt(totalLines)} stock lines (
            <strong className="text-ink tabular-nums">{fmtInt(shownUnits)}</strong> units): {rangeText(range)}.
          </span>
        )}
      </p>
    </Card>
  );
}
