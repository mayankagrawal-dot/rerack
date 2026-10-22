import type { StockRow, Style, StoreStock } from "./types";

// Units sold per week, from the last 4 weeks of sales.
export const weeklyRate = (sold4w: number) => sold4w / 4;

// Weeks until the shelf is empty at the current sales rate. null = no sales, so "never".
export const coverWeeks = (onHand: number, sold4w: number): number | null =>
  sold4w === 0 ? null : onHand / weeklyRate(sold4w);

// Share of everything ever available (sold + still on hand) that has sold. null = nothing to measure.
export const sellThrough = (onHand: number, sold4w: number): number | null =>
  onHand + sold4w === 0 ? null : sold4w / (onHand + sold4w);

export const styleKey = (r: { item: string; size: string; colour: string }) =>
  `${r.item}|${r.size}|${r.colour}`.toLowerCase();

function storeStock(store: string, daysOld: number, onHand: number, sold4w: number): StoreStock {
  return {
    store,
    daysOld,
    onHand,
    sold4w,
    weeklyRate: weeklyRate(sold4w),
    coverWeeks: coverWeeks(onHand, sold4w),
    sellThrough: sellThrough(onHand, sold4w),
  };
}

// Merge all the stores' rows into one view by style (item + size + colour).
export function buildStyles(rows: StockRow[]): Style[] {
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
            sold4w: existing.sold4w + r.sold4w,
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
        chainSold4w: 0,
        chainCoverWeeks: null,
        chainSellThrough: null,
      };
      byStyle.set(key, style);
    }
    style.stores.push(storeStock(r.store, r.daysOld, r.onHand, r.sold4w));
    style.chainOnHand += r.onHand;
    style.chainSold4w += r.sold4w;
  }

  const styles = [...byStyle.values()];
  for (const s of styles) {
    s.chainCoverWeeks = coverWeeks(s.chainOnHand, s.chainSold4w);
    s.chainSellThrough = sellThrough(s.chainOnHand, s.chainSold4w);
    s.stores.sort((a, b) => a.store.localeCompare(b.store));
  }
  return styles;
}
