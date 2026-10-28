import Papa from "papaparse";
import { REQUIRED_COLUMNS, SOLD_COLUMN_ALIASES } from "./config";

// Lets an owner upload their billing software's export as it is, and say which of its columns is which.

export type FieldKey = "item" | "size" | "colour" | "date_received" | "units_on_hand" | "units_sold";

// Which of the file's own columns holds each Rerack field. "" means not chosen yet.
export type ColumnMapping = Record<FieldKey, string>;

// Aliases are compared after lower-casing and dropping everything but letters and digits ("Closing Stock" -> "closingstock").
export const FIELDS: { key: FieldKey; label: string; help: string; aliases: string[] }[] = [
  {
    key: "item",
    label: "Product",
    help: "The product name, for example Kurta",
    aliases: ["item", "itemname", "product", "productname", "article", "articlename", "style", "stylename", "description", "name", "sku"],
  },
  { key: "size", label: "Size", help: "For example M or 32", aliases: ["size", "sizename", "sizecode"] },
  { key: "colour", label: "Colour", help: "For example Navy", aliases: ["colour", "color", "colourname", "colorname", "shade"] },
  {
    key: "date_received",
    label: "Date received",
    help: "When this stock arrived in the store",
    aliases: ["datereceived", "receiveddate", "receivedon", "grndate", "inwarddate", "arrivaldate", "purchasedate", "stockdate", "date"],
  },
  {
    key: "units_sold",
    label: "Units sold",
    help: "Units sold in the sales window",
    aliases: ["unitssold", "unitssold4w", "unitssoldlast4weeks", "sold", "soldqty", "qtysold", "salesqty", "quantitysold", "sales", "netsales"],
  },
  {
    key: "units_on_hand",
    label: "Units in stock",
    help: "Units in the store now",
    aliases: ["unitsonhand", "onhand", "qtyonhand", "soh", "closingstock", "closingqty", "stockqty", "balanceqty", "stock", "inventory", "balance", "qty", "quantity"],
  },
];

export const EMPTY_MAPPING: ColumnMapping = { item: "", size: "", colour: "", date_received: "", units_on_hand: "", units_sold: "" };

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

// The column names in the first row, and the first row of values under them.
export function readHeaders(text: string): { headers: string[]; sample: Record<string, string> } {
  const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ""), { preview: 2, skipEmptyLines: "greedy" });
  const [head = [], first = []] = parsed.data;
  const headers: string[] = [];
  const sample: Record<string, string> = {};
  head.forEach((raw, i) => {
    const h = raw.trim();
    if (!h || headers.includes(h)) return;
    headers.push(h);
    sample[h] = (first[i] ?? "").trim();
  });
  return { headers, sample };
}

// True when the file already uses Rerack's own column names, so nothing needs matching.
export function hasRerackColumns(headers: string[]): boolean {
  const cols = headers.map((h) => h.toLowerCase());
  return REQUIRED_COLUMNS.every((c) => cols.includes(c)) && SOLD_COLUMN_ALIASES.some((a) => cols.includes(a));
}

// A best guess from the column names. Exact names win; then a column whose name contains a longer alias.
export function guessMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = { ...EMPTY_MAPPING };
  const used = new Set<string>();
  const pick = (key: FieldKey, test: (h: string, alias: string) => boolean) => {
    if (mapping[key]) return;
    const field = FIELDS.find((f) => f.key === key)!;
    for (const alias of field.aliases) {
      const hit = headers.find((h) => !used.has(h) && test(norm(h), alias));
      if (hit) {
        mapping[key] = hit;
        used.add(hit);
        return;
      }
    }
  };
  for (const f of FIELDS) pick(f.key, (h, a) => h === a);
  for (const f of FIELDS) pick(f.key, (h, a) => a.length >= 5 && h.includes(a));
  return mapping;
}

export function isComplete(m: ColumnMapping): boolean {
  const chosen = FIELDS.map((f) => m[f.key]);
  return chosen.every(Boolean) && new Set(chosen).size === chosen.length;
}

// Rewrites the file with Rerack's six columns, taken from the columns the owner chose. Other columns are left out.
export function applyMapping(text: string, m: ColumnMapping): string {
  const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: "greedy" });
  const [head = [], ...rows] = parsed.data;
  const index = new Map<string, number>();
  head.forEach((h, i) => {
    const k = h.trim();
    if (k && !index.has(k)) index.set(k, i);
  });
  const fields = FIELDS.map((f) => f.key);
  const data = rows.map((r) => FIELDS.map((f) => r[index.get(m[f.key]) ?? -1] ?? ""));
  return Papa.unparse({ fields, data });
}

// Files exported by the same software share their column names, so a choice made once is reused.
const STORAGE_KEY = "rerack-column-maps-v1";

export const columnSignature = (headers: string[]) => headers.map(norm).filter(Boolean).sort().join("|");

export function loadSavedMapping(headers: string[]): ColumnMapping | null {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, ColumnMapping>;
    const saved = all[columnSignature(headers)];
    if (!saved) return null;
    const m: ColumnMapping = { ...EMPTY_MAPPING };
    for (const f of FIELDS) m[f.key] = headers.includes(saved[f.key]) ? saved[f.key] : "";
    return isComplete(m) ? m : null;
  } catch {
    return null;
  }
}

export function saveMapping(headers: string[], m: ColumnMapping) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, ColumnMapping>;
    all[columnSignature(headers)] = m;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Storage blocked or full: the owner just matches the columns again next time.
  }
}
