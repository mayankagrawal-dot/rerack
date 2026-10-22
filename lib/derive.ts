import type { Candidate, InventoryLine, Style } from "./types";

export type Kpis = {
  unitsInStock: number;
  storeCount: number;
  lineCount: number;
  unitsAtRisk: number; // units in lines classified "at risk"
  linesFlagged: number; // "at risk" + "watch"
  moveOpportunities: number; // transfer candidates found by rules
  movableUnits: number;
  markdownStyles: number; // markdown candidates found by rules
  markdownUnits: number;
};

export function computeKpis(lines: InventoryLine[], candidates: Candidate[]): Kpis {
  const moves = candidates.filter((c) => c.type === "move");
  const markdowns = candidates.filter((c) => c.type === "markdown");
  return {
    unitsInStock: lines.reduce((s, l) => s + l.onHand, 0),
    storeCount: new Set(lines.map((l) => l.store)).size,
    lineCount: lines.length,
    unitsAtRisk: lines.filter((l) => l.risk === "at_risk").reduce((s, l) => s + l.onHand, 0),
    linesFlagged: lines.filter((l) => l.risk === "at_risk" || l.risk === "watch").length,
    moveOpportunities: moves.length,
    movableUnits: moves.reduce((s, c) => s + c.units, 0),
    markdownStyles: markdowns.length,
    markdownUnits: markdowns.reduce((s, c) => s + c.units, 0),
  };
}

export const AGE_BUCKETS = ["0-30 days", "31-60 days", "61-90 days", "Over 90 days"] as const;

export function ageBucketIndex(days: number) {
  return days <= 30 ? 0 : days <= 60 ? 1 : days <= 90 ? 2 : 3;
}

export function ageDistribution(lines: InventoryLine[]) {
  const units = [0, 0, 0, 0];
  for (const l of lines) units[ageBucketIndex(l.daysOld)] += l.onHand;
  return AGE_BUCKETS.map((bucket, i) => ({ bucket, units: units[i] }));
}

// Units on hand per store, split by how long they've sat.
export function storeAgeStack(lines: InventoryLine[], allStores: string[] = []) {
  const map = new Map<string, { store: string; b0: number; b1: number; b2: number; b3: number }>();
  for (const store of allStores) map.set(store, { store, b0: 0, b1: 0, b2: 0, b3: 0 }); // a store with nothing in range still shows, at zero
  for (const l of lines) {
    const row = map.get(l.store) ?? { store: l.store, b0: 0, b1: 0, b2: 0, b3: 0 };
    const k = (["b0", "b1", "b2", "b3"] as const)[ageBucketIndex(l.daysOld)];
    row[k] += l.onHand;
    map.set(l.store, row);
  }
  return [...map.values()].sort((a, b) => a.store.localeCompare(b.store));
}

export type StoreSummary = {
  store: string;
  onHand: number;
  sold: number;
  ageing: number; // units that are 60+ days since receipt
  atRisk: number;
  lines: number;
};

export function storeSummaries(lines: InventoryLine[], allStores: string[] = []): StoreSummary[] {
  const map = new Map<string, StoreSummary>();
  for (const store of allStores) map.set(store, { store, onHand: 0, sold: 0, ageing: 0, atRisk: 0, lines: 0 }); // a store with nothing in range still shows, at zero
  for (const l of lines) {
    const s = map.get(l.store) ?? { store: l.store, onHand: 0, sold: 0, ageing: 0, atRisk: 0, lines: 0 };
    s.onHand += l.onHand;
    s.sold += l.sold;
    if (l.daysOld >= 60) s.ageing += l.onHand;
    if (l.risk === "at_risk") s.atRisk += l.onHand;
    s.lines++;
    map.set(l.store, s);
  }
  return [...map.values()].sort((a, b) => a.store.localeCompare(b.store));
}

export function productRisk(lines: InventoryLine[]) {
  const map = new Map<string, { item: string; atRisk: number; watch: number; other: number }>();
  for (const l of lines) {
    const p = map.get(l.item) ?? { item: l.item, atRisk: 0, watch: 0, other: 0 };
    if (l.risk === "at_risk") p.atRisk += l.onHand;
    else if (l.risk === "watch") p.watch += l.onHand;
    else p.other += l.onHand;
    map.set(l.item, p);
  }
  return [...map.values()].sort((a, b) => b.atRisk + b.watch - (a.atRisk + a.watch));
}

export type MatrixMetric = "sold" | "onHand" | "ageing";

export function storeMatrix(lines: InventoryLine[], metric: MatrixMetric, allStores: string[] = []) {
  const stores = [...new Set([...allStores, ...lines.map((l) => l.store)])].sort();
  const items = [...new Set(lines.map((l) => l.item))].sort();
  const value = (l: InventoryLine) => (metric === "ageing" ? (l.daysOld >= 60 ? l.onHand : 0) : l[metric]);
  const rows = items.map((item) => {
    const values = stores.map((store) =>
      lines.filter((l) => l.item === item && l.store === store).reduce((s, l) => s + value(l), 0)
    );
    return { item, values, total: values.reduce((a, b) => a + b, 0) };
  });
  const max = Math.max(1, ...rows.flatMap((r) => r.values));
  return { stores, rows, max };
}

export type CrossStoreInsight = {
  styleKey: string;
  label: string;
  strongStore: string;
  strongSold: number;
  strongSellThrough: number | null;
  stuckStore: string;
  stuckOnHand: number;
  stuckSold: number;
  stuckDays: number;
};

// "Selling well here, stuck there": the same style moves quickly in one store and barely at all in another.
export function crossStoreInsights(styles: Style[], limit = 8): CrossStoreInsight[] {
  const out: CrossStoreInsight[] = [];
  for (const style of styles) {
    const strong = [...style.stores].sort((a, b) => b.sold - a.sold)[0];
    if (!strong || strong.sold < 5) continue;
    const stuck = style.stores
      .filter((s) => s.store !== strong.store && s.onHand >= 3 && s.sold <= 1 && s.daysOld >= 30)
      .sort((a, b) => b.onHand * b.daysOld - a.onHand * a.daysOld)[0];
    if (!stuck) continue;
    out.push({
      styleKey: style.key,
      label: style.label,
      strongStore: strong.store,
      strongSold: strong.sold,
      strongSellThrough: strong.sellThrough,
      stuckStore: stuck.store,
      stuckOnHand: stuck.onHand,
      stuckSold: stuck.sold,
      stuckDays: stuck.daysOld,
    });
  }
  return out.sort((a, b) => b.strongSold - a.strongSold).slice(0, limit);
}
