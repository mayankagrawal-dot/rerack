// One row of a store's CSV, after it has been checked.
export type StockRow = {
  store: string;
  item: string;
  size: string;
  colour: string;
  daysOld: number;
  onHand: number;
  sold4w: number;
};

// A store's stock of one style (item + size + colour), with the arithmetic done by code.
export type StoreStock = {
  store: string;
  daysOld: number;
  onHand: number;
  sold4w: number;
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
  chainSold4w: number;
  chainCoverWeeks: number | null;
  chainSellThrough: number | null;
};

export type Candidate = {
  id: string;
  type: "move" | "markdown";
  label: string;
  units: number;
  from?: string;
  to?: string;
  markdownPct?: number;
  involved: StoreStock[]; // the store rows the numbers come from
  chain?: { onHand: number; sold4w: number; coverWeeks: number | null }; // markdowns only
  headline: string; // sentence built by code, e.g. "Move 6 × Navy Kurta, size M, from Store A to Store C"
  facts: string; // numbers built by code
  templateReason: string; // used when the AI is unavailable or gives an unusable reason
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
    };
