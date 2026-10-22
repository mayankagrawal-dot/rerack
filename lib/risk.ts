import { DEFAULT_THRESHOLDS, type Thresholds } from "./config";
import type { InventoryLine, Risk, StockRow, StoreStock, Style } from "./types";
import { buildStyles } from "./metrics";

export const RISK_LABEL: Record<Risk, string> = {
  at_risk: "At risk",
  watch: "Watch",
  fast: "Fast seller",
  ok: "Healthy",
  new: "Too new to judge",
};

export const RISK_RULE: Record<Risk, (t: Thresholds) => string> = {
  at_risk: (t) =>
    `At least ${t.markdownMinDays} days since receipt and ${t.markdownMinChainCoverWeeks} or more weeks of stock at this store (or no sales in the sales window).`,
  watch: (t) =>
    `At least ${t.moveSourceMinDays} days since receipt and ${t.moveSourceMinCoverWeeks} or more weeks of stock at this store (or no sales in the sales window).`,
  fast: (t) => `Selling, with ${t.moveDestMaxCoverWeeks} weeks of stock or fewer left. Often a destination for transfers.`,
  ok: () => "Stock level and sales pace are within the rules.",
  new: (t) => `Received less than ${t.newStockDays} days ago, so there is not enough history to judge it.`,
};

// Explicit rules, in order. The first one that matches wins.
export function classify(s: StoreStock, t: Thresholds = DEFAULT_THRESHOLDS): Risk {
  if (s.onHand === 0) return s.sold > 0 ? "fast" : "ok";
  if (s.daysOld < t.newStockDays) return "new";
  const slow = s.coverWeeks === null || s.coverWeeks >= t.markdownMinChainCoverWeeks;
  if (s.daysOld >= t.markdownMinDays && slow) return "at_risk";
  const surplus = s.coverWeeks === null || s.coverWeeks >= t.moveSourceMinCoverWeeks;
  if (s.daysOld >= t.moveSourceMinDays && surplus) return "watch";
  if (s.sold > 0 && s.coverWeeks !== null && s.coverWeeks <= t.moveDestMaxCoverWeeks) return "fast";
  return "ok";
}

export function buildLines(styles: Style[], t: Thresholds = DEFAULT_THRESHOLDS): InventoryLine[] {
  return styles.flatMap((style) =>
    style.stores.map((s) => ({
      ...s,
      id: `${style.key}@${s.store}`,
      styleKey: style.key,
      item: style.item,
      size: style.size,
      colour: style.colour,
      label: style.label,
      risk: classify(s, t),
    }))
  );
}

export function linesFromRows(rows: StockRow[], t: Thresholds = DEFAULT_THRESHOLDS) {
  const styles = buildStyles(rows);
  return { styles, lines: buildLines(styles, t) };
}
