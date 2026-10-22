"use client";

import { useSyncExternalStore } from "react";
import type { InventoryLine } from "./types";
import { windowDates } from "./window";

// The date filter for the charts. Stock is filtered by the date it was RECEIVED (the date_received column),
// because that is the one real date on every line. Sales have no dates of their own (one total per line);
// they always cover the sales window.
export type ChartRange = { start: string | null; end: string | null }; // ISO dates, inclusive; null = no limit

export const ALL_DATES: ChartRange = { start: null, end: null };
export const isAllDates = (r: ChartRange) => r.start === null && r.end === null;

let current: ChartRange = ALL_DATES;
const listeners = new Set<() => void>();

export function setChartRange(r: ChartRange) {
  current = r;
  listeners.forEach((l) => l());
}

// Shared by every page with charts, so the choice follows you from one page to the next.
export function useChartRange(): ChartRange {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => ALL_DATES
  );
}

const DAY = 86_400_000;
const midnight = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);

// The date a line of stock was received: how many days old it was when the data was processed.
export function receivedIso(daysOld: number, processedAt: string): string {
  return new Date(midnight(processedAt) - daysOld * DAY).toISOString().slice(0, 10);
}

export function filterByReceived(lines: InventoryLine[], range: ChartRange, processedAt: string): InventoryLine[] {
  if (isAllDates(range)) return lines;
  return lines.filter((l) => {
    const d = receivedIso(l.daysOld, processedAt);
    return (range.start === null || d >= range.start) && (range.end === null || d <= range.end);
  });
}

export function rangeText(range: ChartRange): string {
  if (isAllDates(range)) return "all stock, whenever it was received";
  if (range.start && range.end) return `stock received ${windowDates(range.start, range.end) ?? "in this range"}`;
  if (range.start) return `stock received on or after ${windowDates(range.start, range.start)?.split(" to ")[0]}`;
  return `stock received on or before ${windowDates(range.end ?? "", range.end ?? "")?.split(" to ")[0]}`;
}
