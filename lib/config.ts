// All the "rules" in one place. Change a number here and the whole app follows.
export const CONFIG = {
  model: "google/gemini-3.1-flash-lite", // an OpenRouter model id: fast and cheap (the account's guardrails block some others)
  aiTimeoutMs: 45_000,
  maxFiles: 30,
  maxFileBytes: 1_000_000,

  // How many candidates code sends to the AI, and how many the owner sees.
  topForAi: 25,
  topShown: 10,

  move: {
    sourceMinDays: 45, // stock must be at least this old to be moved away
    sourceMinCoverWeeks: 8, // ...and the store must hold this many weeks of stock (or have no sales)
    sourceKeepWeeks: 4, // the source store keeps enough for this many weeks of its own sales
    destMaxCoverWeeks: 3, // a store running this low (and selling) is a good destination
    destTargetWeeks: 6, // fill the destination up to about this many weeks of stock
    minUnits: 2, // don't propose moving fewer than this
  },

  markdown: {
    minDays: 60, // stock must be at least this old
    minChainCoverWeeks: 12, // the whole chain must hold this many weeks of stock (or have no sales)
    pct: 15,
  },
} as const;

export const REQUIRED_COLUMNS = [
  "item",
  "size",
  "colour",
  "date_received",
  "units_on_hand",
  "units_sold_4w",
] as const;
