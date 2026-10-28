"use client";

import { DEMO_BUSINESS, demoFiles } from "./demoData";
import { loadDataset, type Dataset } from "./appState";
import type { Thresholds } from "./config";
import type { ColumnMapping } from "./columnMap";
import type { AnalyzeResponse, FileError } from "./types";
import { DEFAULT_WINDOW_DAYS, daysInWindow, isoOf, presetWindow, windowDates, windowLabel, type SalesWindow, type WindowInfo } from "./window";

export type ImportFile = {
  id: string;
  name: string;
  size: number;
  text: string; // what is checked and sent: the file itself, or its columns renamed to Rerack's
  store: string;
  // Only for a file whose column names differ from Rerack's: the file as uploaded, and which column is which.
  columns?: {
    raw: string;
    headers: string[];
    sample: Record<string, string>;
    mapping: ColumnMapping;
    saved: boolean; // the matching came from a previous upload with the same columns
  };
};

export const DEMO_NOTE = "Diwali in 3 weeks. Don't mark down Navy Kurta.";

// The window the owner chose, or "the last 4 weeks ending today" if they haven't chosen one.
// Reads the clock, so call it from a click handler, never while a page renders.
export function resolveWindow(pref: SalesWindow | null): WindowInfo {
  if (pref) {
    const days = daysInWindow(pref.start, pref.end);
    if (days !== null && days >= 1) return { days, start: pref.start, end: pref.end };
  }
  const w = presetWindow(DEFAULT_WINDOW_DAYS / 7, new Date());
  return { days: DEFAULT_WINDOW_DAYS, start: w.start, end: w.end };
}

export function describeWindow(w: WindowInfo): string {
  const dates = windowDates(w.start, w.end);
  return dates ? `${dates} (${windowLabel(w.days)})` : windowLabel(w.days);
}

export const todayIso = () => isoOf(new Date());

// Sends the files to the server (which re-checks them, runs the rules and asks the AI) and returns the result.
export async function analyze(files: ImportFile[], note: string, thresholds: Thresholds, windowDays: number): Promise<AnalyzeResponse> {
  const form = new FormData();
  for (const f of files) {
    form.append("files", new File([f.text], f.name, { type: "text/csv" }));
    form.append("stores", f.store);
  }
  form.append("note", note);
  form.append("thresholds", JSON.stringify(thresholds));
  form.append("windowDays", String(windowDays));
  return post(form);
}

// Re-runs the analysis on data that was already checked, for example after the sales window changed.
export async function reanalyze(dataset: Dataset, thresholds: Thresholds, window: WindowInfo): Promise<AnalyzeResponse> {
  const form = new FormData();
  form.append("rows", JSON.stringify(dataset.rows));
  form.append("note", dataset.note);
  form.append("thresholds", JSON.stringify(thresholds));
  form.append("windowDays", String(window.days));
  return post(form);
}

async function post(form: FormData): Promise<AnalyzeResponse> {
  try {
    const res = await fetch("/api/analyze", { method: "POST", body: form });
    return (await res.json()) as AnalyzeResponse;
  } catch {
    return { ok: false, errors: [{ file: "", message: "Something went wrong talking to the app. Please try again." }] };
  }
}

export function demoImportFiles(): ImportFile[] {
  return demoFiles().map((f) => ({
    id: `demo-${f.name}`,
    name: f.name,
    size: f.text.length,
    text: f.text,
    store: f.store,
  }));
}

// Process the Northstar demo files through exactly the same path as an upload.
export async function runDemo(thresholds: Thresholds, pref: SalesWindow | null): Promise<{ ok: true } | { ok: false; errors: FileError[] }> {
  const files = demoImportFiles();
  const window = resolveWindow(pref);
  const res = await analyze(files, DEMO_NOTE, thresholds, window.days);
  if (!res.ok) return res;
  loadDataset(res, {
    source: "demo",
    businessName: DEMO_BUSINESS,
    window,
    files: files.map((f) => ({ name: f.name, store: f.store, rows: f.text.trim().split("\n").length - 1 })),
  });
  return { ok: true };
}
