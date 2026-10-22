// One row of a store's CSV, after it has been checked.
export type StockRow = {
  store: string;
  item: string;
  size: string;
  colour: string;
  daysOld: number;
  onHand: number;
  sold: number;
};

// A store's stock of one style (item + size + colour), with the arithmetic done by code.
export type StoreStock = {
  store: string;
  daysOld: number;
  onHand: number;
  sold: number;
  weeklyRate: number;
  coverWeeks: number | null; // null = no sales, so cover can't be worked out
  sellThrough: number | null; // 0..1, null when nothing on hand and nothing sold
};

export type Style = {
  key: string;
  item: string;
  size: string;
  colour: string;
  label: string; // "Navy Kurta, size M"
  stores: StoreStock[];
  chainOnHand: number;
  chainSold: number;
  chainCoverWeeks: number | null;
  chainSellThrough: number | null;
};

// How much the numbers behind an action support it. Rule-based, not an AI confidence score.
export type Strength = "strong" | "moderate" | "limited";

export type Candidate = {
  id: string;
  type: "move" | "markdown";
  windowDays: number; // how many days the sales figures behind this action cover
  styleKey: string;
  label: string;
  units: number;
  maxUnits: number; // the most the owner may enter when editing a transfer
  from?: string;
  to?: string;
  markdownPct?: number;
  involved: StoreStock[]; // the store rows the numbers come from (moves: source first, destination second)
  chain?: { onHand: number; sold: number; coverWeeks: number | null }; // markdowns only
  headline: string; // sentence built by code, e.g. "Move 6 × Navy Kurta, size M, from Store A to Store C"
  facts: string; // numbers built by code
  templateReason: string; // used when the AI is unavailable or gives an unusable reason
  strength: Strength;
  calc: string[]; // the calculation, step by step, built by code
  limitations: string[]; // what the data can't tell us
  valueAtRisk: number; // units × days old, used for the rule-based order
  rulesRank: number; // 1 = most urgent by rules
};

export type RankedAction = {
  candidate: Candidate;
  aiRank: number | null; // null when the AI did not rank it
  reason: string;
  reasonSource: "ai" | "rules";
  numberWarning: boolean; // the AI's sentence contains a number code didn't produce
};

export type SkippedAction = { candidate: Candidate; why: string };

export type FileError = { file: string; message: string };

// What we learned about one uploaded file while checking it.
export type FileReport = {
  file: string;
  store: string;
  rows: number;
  errors: string[];
  warnings: string[];
  preview: Record<string, string>[]; // first few rows, for the preview table
};

export type Risk = "at_risk" | "watch" | "fast" | "ok" | "new";

// One store's stock of one style, with its risk. This is what the Inventory page lists.
export type InventoryLine = StoreStock & {
  id: string;
  styleKey: string;
  item: string;
  size: string;
  colour: string;
  label: string;
  risk: Risk;
};

export type AnalyzeResponse =
  | { ok: false; errors: FileError[] }
  | {
      ok: true;
      note: string;
      storeCount: number;
      rowCount: number;
      candidateCount: number;
      usedAi: boolean;
      aiProblem?: string;
      ignoredAiSuggestions: number;
      actions: RankedAction[];
      skipped: SkippedAction[];
      rows: StockRow[];
      candidates: Candidate[];
      warnings: FileError[];
      windowDays: number;
      processedAt: string;
    };
