import type { StockRow, Style, StoreStock } from "./types";
import { DEFAULT_WINDOW_DAYS } from "./window";

// Units sold per week: the sales total divided by the number of weeks in the sales window.
export const weeklyRate = (sold: number, windowDays: number) => sold / (windowDays / 7);

// Weeks until the shelf is empty at the current sales rate. null = no sales, so "never".
export const coverWeeks = (onHand: number, sold: number, windowDays: number): number | null =>
  sold === 0 ? null : onHand / weeklyRate(sold, windowDays);

// Share of everything ever available (sold + still on hand) that has sold. null = nothing to measure.
export const sellThrough = (onHand: number, sold: number): number | null =>
  onHand + sold === 0 ? null : sold / (onHand + sold);

export const styleKey = (r: { item: string; size: string; colour: string }) =>
  `${r.item}|${r.size}|${r.colour}`.toLowerCase();

function storeStock(store: string, daysOld: number, onHand: number, sold: number, windowDays: number): StoreStock {
  return {
    store,
    daysOld,
    onHand,
    sold,
    weeklyRate: weeklyRate(sold, windowDays),
    coverWeeks: coverWeeks(onHand, sold, windowDays),
    sellThrough: sellThrough(onHand, sold),
  };
}

// Merge all the stores' rows into one view by style (item + size + colour).
export function buildStyles(rows: StockRow[], windowDays: number = DEFAULT_WINDOW_DAYS): Style[] {
  // If a store lists the same style twice, add the units up and keep the oldest date.
  const perStoreStyle = new Map<string, StockRow>();
  for (const r of rows) {
    const k = `${styleKey(r)}@${r.store}`;
    const existing = perStoreStyle.get(k);
    perStoreStyle.set(
      k,
      existing
        ? {
            ...existing,
            onHand: existing.onHand + r.onHand,
            sold: existing.sold + r.sold,
            daysOld: Math.max(existing.daysOld, r.daysOld),
          }
        : r
    );
  }

  const byStyle = new Map<string, Style>();
  for (const r of perStoreStyle.values()) {
    const key = styleKey(r);
    let style = byStyle.get(key);
    if (!style) {
      style = {
        key,
        item: r.item,
        size: r.size,
        colour: r.colour,
        label: `${r.colour} ${r.item}, size ${r.size}`,
        stores: [],
        chainOnHand: 0,
        chainSold: 0,
        chainCoverWeeks: null,
        chainSellThrough: null,
      };
      byStyle.set(key, style);
    }
    style.stores.push(storeStock(r.store, r.daysOld, r.onHand, r.sold, windowDays));
    style.chainOnHand += r.onHand;
    style.chainSold += r.sold;
  }

  const styles = [...byStyle.values()];
  for (const s of styles) {
    s.chainCoverWeeks = coverWeeks(s.chainOnHand, s.chainSold, windowDays);
    s.chainSellThrough = sellThrough(s.chainOnHand, s.chainSold);
    s.stores.sort((a, b) => a.store.localeCompare(b.store));
  }
  return styles;
}
