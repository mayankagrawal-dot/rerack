import Papa from "papaparse";
import { CONFIG, REQUIRED_COLUMNS, SOLD_COLUMN, SOLD_COLUMN_ALIASES } from "./config";
import type { FileError, FileReport, StockRow } from "./types";

export type RawFile = { name: string; size: number; text: string; store?: string };

const MAX_MESSAGES_PER_FILE = 5;

// "indiranagar.csv" -> "Indiranagar", "store-a.csv" -> "Store A"
export function storeNameFromFile(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  return base
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Accepts 2026-08-20, 20/08/2026 and 20-08-2026. Returns days between that date and today (UTC), or null.
function daysSince(value: string, today: Date): number | null {
  const v = value.trim();
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(v))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    return null;
  }
  const then = Date.UTC(y, m - 1, d);
  const check = new Date(then);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.floor((todayUtc - then) / 86_400_000);
}

function parseCount(value: string | undefined): number | null {
  const v = (value ?? "").trim();
  return /^\d+$/.test(v) ? Number(v) : null;
}

export type ValidationResult = {
  errors: FileError[]; // anything that blocks processing
  warnings: FileError[]; // worth knowing, but not blocking
  rows: StockRow[]; // empty when there are errors
  reports: FileReport[]; // one per file, for the import screen
};

export function validateFiles(files: RawFile[], todayOverride?: Date): ValidationResult {
  // Read the clock only when there is a file to check. (Next.js doesn't allow reading it while pre-rendering.)
  let clock: Date | undefined = todayOverride;
  const today = () => (clock ??= new Date());
  const errors: FileError[] = [];
  const warnings: FileError[] = [];
  const reports: FileReport[] = [];
  const rows: StockRow[] = [];
  const seenStores = new Map<string, string>();
  const seenContent = new Map<string, string>();

  if (files.length < 2) {
    errors.push({
      file: "",
      message: "Upload at least 2 stores. Moving stock needs two stores to compare.",
    });
  }
  if (files.length > CONFIG.maxFiles) {
    errors.push({ file: "", message: `Too many files. Upload ${CONFIG.maxFiles} stores or fewer.` });
    return { errors, warnings, rows, reports };
  }

  for (const file of files) {
    const store = file.store?.trim() || storeNameFromFile(file.name);
    const fileErrors: string[] = [];
    const fileWarnings: string[] = [];
    let preview: Record<string, string>[] = [];
    let rowCount = 0;
    const fail = (message: string) => fileErrors.push(message);
    const finish = () => {
      const shown = fileErrors.slice(0, MAX_MESSAGES_PER_FILE);
      const shownErrors = [...shown];
      if (fileErrors.length > shown.length) shownErrors.push(`...and ${fileErrors.length - shown.length} more problems.`);
      for (const message of shownErrors) errors.push({ file: file.name, message });
      for (const message of fileWarnings) warnings.push({ file: file.name, message });
      reports.push({ file: file.name, store, rows: rowCount, errors: shownErrors, warnings: fileWarnings, preview });
    };

    if (!/\.csv$/i.test(file.name)) {
      fail(`${file.name} isn't a CSV file.`);
      finish();
      continue;
    }
    if (file.size > CONFIG.maxFileBytes) {
      fail(`${file.name} is too large (over 1 MB). Export one store's report only.`);
      finish();
      continue;
    }
    const text = file.text.replace(/^﻿/, "");
    if (text.trim() === "") {
      fail(`${file.name} is empty.`);
      finish();
      continue;
    }

    const clash = seenStores.get(store.toLowerCase());
    if (clash) {
      fail(`${file.name} has the same store name as ${clash}. Give each file its own store name.`);
    }
    seenStores.set(store.toLowerCase(), file.name);

    const content = text.replace(/\s+/g, "");
    const sameContent = seenContent.get(content);
    if (sameContent) fileWarnings.push(`This file has exactly the same contents as ${sameContent}. Is it a duplicate upload?`);
    else seenContent.set(content, file.name);

    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim().toLowerCase(),
    });

    if (parsed.errors.some((e) => e.type === "Quotes")) {
      fail(`We couldn't read ${file.name}. Re-export it as CSV.`);
      finish();
      continue;
    }

    const columns = parsed.meta.fields ?? [];
    const missing: string[] = REQUIRED_COLUMNS.filter((c) => !columns.includes(c));
    const soldCol = SOLD_COLUMN_ALIASES.find((a) => columns.includes(a));
    if (missing.length > 0 || !soldCol) {
      for (const c of missing) fail(`${file.name} is missing the '${c}' column.`);
      if (!soldCol) fail(`${file.name} is missing the '${SOLD_COLUMN}' column (the older name 'units_sold_4w' also works).`);
      finish();
      continue;
    }
    const soldKey = soldCol as string;
    rowCount = parsed.data.length;
    preview = parsed.data.slice(0, 5);
    if (parsed.data.length === 0) {
      fail(`${file.name} has column names but no stock rows.`);
      finish();
      continue;
    }

    const fileRows: StockRow[] = [];
    const seenStyles = new Set<string>();
    let duplicateStyles = 0;
    parsed.data.forEach((raw, i) => {
      const line = i + 2; // line 1 is the header
      const item = (raw.item ?? "").trim();
      const size = (raw.size ?? "").trim();
      const colour = (raw.colour ?? "").trim();
      if (!item) return fail(`${file.name} row ${line}: 'item' is blank.`);
      if (!size) return fail(`${file.name} row ${line}: 'size' is blank.`);
      if (!colour) return fail(`${file.name} row ${line}: 'colour' is blank.`);

      const onHand = parseCount(raw.units_on_hand);
      if (onHand === null)
        return fail(
          `${file.name} row ${line}: units_on_hand '${(raw.units_on_hand ?? "").trim()}' isn't a whole number (0 or more).`
        );
      const sold = parseCount(raw[soldKey]);
      if (sold === null)
        return fail(
          `${file.name} row ${line}: ${soldKey} '${(raw[soldKey] ?? "").trim()}' isn't a whole number (0 or more).`
        );

      const daysOld = daysSince(raw.date_received ?? "", today());
      if (daysOld === null)
        return fail(
          `${file.name} row ${line}: date_received '${(raw.date_received ?? "").trim()}' isn't a date (use 2026-08-20 or 20/08/2026).`
        );
      if (daysOld < 0) return fail(`${file.name} row ${line}: date_received is in the future.`);

      const key = `${item}|${size}|${colour}`.toLowerCase();
      if (seenStyles.has(key)) duplicateStyles++;
      seenStyles.add(key);
      fileRows.push({ store, item, size, colour, daysOld, onHand, sold });
    });

    if (fileErrors.length === 0) {
      if (duplicateStyles > 0)
        fileWarnings.push(
          `${duplicateStyles} row${duplicateStyles > 1 ? "s repeat" : " repeats"} an item, size and colour already listed. Their units will be added together.`
        );
      if (fileRows.every((r) => r.sold === 0))
        fileWarnings.push(`No sales are recorded in this file. Check that ${soldKey} was exported correctly.`);
      if (fileRows.every((r) => r.onHand === 0))
        fileWarnings.push("No stock is recorded in this file. Check that units_on_hand was exported correctly.");
    }

    finish();
    if (fileErrors.length === 0) rows.push(...fileRows);
  }

  return { errors, warnings, rows: errors.length > 0 ? [] : rows, reports };
}
