"use client";

import { useMemo, useSyncExternalStore } from "react";
import { DEFAULT_THRESHOLDS, type Thresholds } from "./config";
import { buildLines } from "./risk";
import { buildStyles } from "./metrics";
import type { SalesWindow, WindowInfo } from "./window";
import type {
  AnalyzeResponse,
  Candidate,
  FileError,
  InventoryLine,
  RankedAction,
  SkippedAction,
  StockRow,
  Style,
} from "./types";

// Everything the app remembers. It lives in the browser's localStorage, so it survives a refresh.
// (Vercel has no permanent disk and the MVP has no database, so this is per browser, per device.)
export type Dataset = {
  source: "demo" | "upload";
  businessName: string;
  processedAt: string;
  note: string;
  files: { name: string; store: string; rows: number }[];
  warnings: FileError[];
  rows: StockRow[];
  candidates: Candidate[];
  actions: RankedAction[];
  skipped: SkippedAction[];
  usedAi: boolean;
  aiProblem?: string;
  ignoredAiSuggestions: number;
  thresholds: Thresholds;
  window: WindowInfo; // the sales window these numbers were calculated with
};

export type Decision = {
  status: "approved" | "rejected";
  at: string;
  edited: boolean;
  units?: number; // the transfer size the owner approved
  markdownPct?: number; // the markdown the owner approved
  originalUnits?: number;
  originalPct?: number;
  reason?: string; // why it was rejected
  verifiedAt?: string; // transfers: the owner confirmed the physical count
};

export type ActivityKind = "import" | "approved" | "rejected" | "verified" | "undo" | "rules" | "window" | "reset";

export type ActivityEntry = { id: string; at: string; kind: ActivityKind; text: string; actionId?: string };

export type AppState = {
  dataset: Dataset | null;
  decisions: Record<string, Decision>;
  activity: ActivityEntry[];
  thresholds: Thresholds;
  salesWindow: SalesWindow | null; // the owner's chosen sales window; null = the last 4 weeks
};

const KEY = "rerack-state-v3";
const MAX_ACTIVITY = 300;
const EMPTY: AppState = { dataset: null, decisions: {}, activity: [], thresholds: DEFAULT_THRESHOLDS, salesWindow: null };

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedState: AppState = EMPTY;

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null; // storage blocked: the app still works, it just won't remember
  }
}

function parse(raw: string | null): AppState {
  if (!raw) return EMPTY;
  try {
    const p = JSON.parse(raw) as Partial<AppState>;
    return {
      dataset: p.dataset ?? null,
      decisions: p.decisions ?? {},
      activity: p.activity ?? [],
      thresholds: { ...DEFAULT_THRESHOLDS, ...(p.thresholds ?? {}) },
      salesWindow: p.salesWindow ?? null,
    };
  } catch {
    return EMPTY;
  }
}

// If storage is blocked, keep the state in memory for this tab.
let memoryOnly = false;

function getSnapshot(): AppState {
  if (memoryOnly) return cachedState;
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedState = parse(raw);
  }
  return cachedState;
}

function setState(next: AppState) {
  cachedState = next;
  try {
    const raw = JSON.stringify(next);
    localStorage.setItem(KEY, raw);
    cachedRaw = raw;
    memoryOnly = false;
  } catch {
    memoryOnly = true;
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

const uid = () => Math.random().toString(36).slice(2, 10);
const entry = (kind: ActivityKind, text: string, actionId?: string): ActivityEntry => ({
  id: uid(),
  at: new Date().toISOString(),
  kind,
  text,
  actionId,
});
const withActivity = (s: AppState, e: ActivityEntry): ActivityEntry[] => [e, ...s.activity].slice(0, MAX_ACTIVITY);

// ---- actions the pages can call ----

export function loadDataset(res: Extract<AnalyzeResponse, { ok: true }>, opts: { source: "demo" | "upload"; businessName: string; files: Dataset["files"]; window: WindowInfo; activityText?: string }) {
  const s = getSnapshot();
  const dataset: Dataset = {
    source: opts.source,
    businessName: opts.businessName,
    processedAt: res.processedAt,
    note: res.note,
    files: opts.files,
    warnings: res.warnings,
    rows: res.rows,
    candidates: res.candidates,
    actions: res.actions,
    skipped: res.skipped,
    usedAi: res.usedAi,
    aiProblem: res.aiProblem,
    ignoredAiSuggestions: res.ignoredAiSuggestions,
    thresholds: s.thresholds,
    window: opts.window,
  };
  const text = opts.activityText ?? `${opts.source === "demo" ? "Loaded demo data" : "Imported"}: ${res.storeCount} stores, ${res.rowCount} stock lines. ${res.actions.length} actions proposed${res.usedAi ? " (AI-ranked)" : " (rule-based order, AI unavailable)"}.`;
  setState({ ...s, dataset, decisions: {}, activity: withActivity(s, entry("import", text)) });
}

export function recordDecision(actionId: string, decision: Decision, text: string) {
  const s = getSnapshot();
  setState({
    ...s,
    decisions: { ...s.decisions, [actionId]: decision },
    activity: withActivity(s, entry(decision.status, text, actionId)),
  });
}

export function markVerified(actionId: string, text: string) {
  const s = getSnapshot();
  const d = s.decisions[actionId];
  if (!d) return;
  setState({
    ...s,
    decisions: { ...s.decisions, [actionId]: { ...d, verifiedAt: new Date().toISOString() } },
    activity: withActivity(s, entry("verified", text, actionId)),
  });
}

export function undoDecision(actionId: string, text: string) {
  const s = getSnapshot();
  const { [actionId]: _removed, ...rest } = s.decisions;
  void _removed;
  setState({ ...s, decisions: rest, activity: withActivity(s, entry("undo", text, actionId)) });
}

export function saveThresholds(t: Thresholds, text: string) {
  const s = getSnapshot();
  setState({ ...s, thresholds: t, activity: withActivity(s, entry("rules", text)) });
}

export function saveSalesWindow(w: SalesWindow | null, text?: string) {
  const s = getSnapshot();
  setState({ ...s, salesWindow: w, activity: text ? withActivity(s, entry("window", text)) : s.activity });
}

export function clearEverything() {
  const s = getSnapshot();
  setState({ dataset: null, decisions: {}, activity: [entry("reset", "Cleared the data, decisions and activity on this device.")], thresholds: s.thresholds, salesWindow: s.salesWindow });
}

// ---- reading state ----

const noopSubscribe = () => () => {};

// false while the page is still loading in the browser, true afterwards. It stops pages flashing "no data"
// for a moment before the saved data is read.
export function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function useAppState() {
  const state = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  const derived = useMemo(() => {
    const ds = state.dataset;
    if (!ds) return { styles: [] as Style[], lines: [] as InventoryLine[] };
    const styles = buildStyles(ds.rows, ds.window.days);
    return { styles, lines: buildLines(styles, ds.thresholds) };
  }, [state.dataset]);
  return { ...state, ...derived };
}
