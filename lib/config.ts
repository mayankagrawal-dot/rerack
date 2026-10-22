// Fixed settings for the app.
export const CONFIG = {
  model: "google/gemini-3.1-flash-lite", // an OpenRouter model id: fast and cheap (the account's guardrails block some others)
  aiTimeoutMs: 45_000,
  maxFiles: 30,
  maxFileBytes: 1_000_000,

  // How many candidates code sends to the AI, and how many the owner sees.
  topForAi: 24,
  topShown: 10,
  // Each weekly list includes at least this many transfers and this many markdowns, when the data supports them.
  minPerType: 4,
} as const;

// The owner-adjustable rules. Change a number on the Rules page and the whole app follows.
export type Thresholds = {
  newStockDays: number; // stock younger than this is "too new to judge"
  moveSourceMinDays: number; // stock must be at least this old to be moved away
  moveSourceMinCoverWeeks: number; // ...and the store must hold this many weeks of stock (or have no sales)
  moveSourceKeepWeeks: number; // the source store keeps enough for this many weeks of its own sales
  moveDestMaxCoverWeeks: number; // a store running this low (and selling) is a good destination
  moveDestTargetWeeks: number; // fill the destination up to about this many weeks of stock
  moveMinUnits: number; // don't propose moving fewer than this
  markdownMinDays: number; // stock must be at least this old to be flagged for markdown
  markdownMinChainCoverWeeks: number; // the whole chain must hold this many weeks of stock (or have no sales)
  markdownPct: number; // starting markdown for owner review
};

export const DEFAULT_THRESHOLDS: Thresholds = {
  newStockDays: 21,
  moveSourceMinDays: 45,
  moveSourceMinCoverWeeks: 8,
  moveSourceKeepWeeks: 4,
  moveDestMaxCoverWeeks: 3,
  moveDestTargetWeeks: 6,
  moveMinUnits: 2,
  markdownMinDays: 60,
  markdownMinChainCoverWeeks: 12,
  markdownPct: 15,
};

// Allowed range and wording for each rule (used by validation and the Rules page).
export const THRESHOLD_FIELDS: {
  key: keyof Thresholds;
  label: string;
  help: string;
  unit: string;
  min: number;
  max: number;
}[] = [
  { key: "newStockDays", label: "Too new to judge", help: "Stock received more recently than this is not judged yet.", unit: "days", min: 0, max: 90 },
  { key: "moveSourceMinDays", label: "Move: minimum stock age", help: "Stock must have sat at least this long before it is suggested for a transfer.", unit: "days", min: 7, max: 365 },
  { key: "moveSourceMinCoverWeeks", label: "Move: surplus at the source", help: "The source store must hold at least this many weeks of stock (or have no sales).", unit: "weeks", min: 2, max: 52 },
  { key: "moveSourceKeepWeeks", label: "Move: stock the source keeps", help: "The source store keeps enough for this many weeks of its own sales.", unit: "weeks", min: 0, max: 12 },
  { key: "moveDestMaxCoverWeeks", label: "Move: destination running low", help: "A store with this many weeks of stock or fewer, and selling, is a destination.", unit: "weeks", min: 0.5, max: 12 },
  { key: "moveDestTargetWeeks", label: "Move: destination target", help: "Fill the destination up to about this many weeks of its own sales.", unit: "weeks", min: 1, max: 24 },
  { key: "moveMinUnits", label: "Move: smallest transfer", help: "Transfers smaller than this are not suggested.", unit: "units", min: 1, max: 50 },
  { key: "markdownMinDays", label: "Markdown: minimum stock age", help: "Stock must have sat at least this long to be flagged for a markdown.", unit: "days", min: 14, max: 365 },
  { key: "markdownMinChainCoverWeeks", label: "Markdown: chain-wide cover", help: "The whole chain must hold at least this many weeks of stock (or have no sales).", unit: "weeks", min: 2, max: 104 },
  { key: "markdownPct", label: "Markdown: starting discount", help: "A starting point for owner review, not an optimised discount.", unit: "%", min: 5, max: 70 },
];

// Accepts anything (for example JSON from the browser) and returns safe thresholds.
export function sanitizeThresholds(input: unknown): Thresholds {
  const out: Thresholds = { ...DEFAULT_THRESHOLDS };
  if (typeof input !== "object" || input === null) return out;
  for (const f of THRESHOLD_FIELDS) {
    const v = (input as Record<string, unknown>)[f.key];
    if (typeof v === "number" && Number.isFinite(v)) out[f.key] = Math.min(f.max, Math.max(f.min, v));
  }
  return out;
}

export const REQUIRED_COLUMNS = ["item", "size", "colour", "date_received", "units_on_hand"] as const;

// The sales column covers whatever sales window the owner sets. Older names still work.
export const SOLD_COLUMN = "units_sold";
export const SOLD_COLUMN_ALIASES = ["units_sold", "units_sold_4w", "units_sold_last_4_weeks"] as const;
