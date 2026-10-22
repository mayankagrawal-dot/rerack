import Papa from "papaparse";
import { CONFIG, REQUIRED_COLUMNS } from "./config";
import type { FileError, StockRow } from "./types";

export type RawFile = { name: string; size: number; text: string };

const MAX_MESSAGES_PER_FILE = 5;

// "store-a.csv" -> "Store A"
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

export function validateFiles(files: RawFile[], today = new Date()): { errors: FileError[]; rows: StockRow[] } {
  const errors: FileError[] = [];
  const rows: StockRow[] = [];
  const seenStores = new Map<string, string>();

  if (files.length < 2) {
    errors.push({
      file: "",
      message: "Upload at least 2 stores. Moving stock needs two stores to compare.",
    });
  }
  if (files.length > CONFIG.maxFiles) {
    errors.push({ file: "", message: `Too many files. Upload ${CONFIG.maxFiles} stores or fewer.` });
    return { errors, rows };
  }

  for (const file of files) {
    const fileErrors: string[] = [];
    const fail = (message: string) => fileErrors.push(message);
    const done = () => {
      const shown = fileErrors.slice(0, MAX_MESSAGES_PER_FILE);
      for (const message of shown) errors.push({ file: file.name, message });
      if (fileErrors.length > shown.length) {
        errors.push({ file: file.name, message: `...and ${fileErrors.length - shown.length} more problems.` });
      }
    };

    if (!/\.csv$/i.test(file.name)) {
      fail(`${file.name} isn't a CSV file.`);
      done();
      continue;
    }
    if (file.size > CONFIG.maxFileBytes) {
      fail(`${file.name} is too large (over 1 MB). Export one store's report only.`);
      done();
      continue;
    }
    const text = file.text.replace(/^﻿/, "");
    if (text.trim() === "") {
      fail(`${file.name} is empty.`);
      done();
      continue;
    }

    const store = storeNameFromFile(file.name);
    const clash = seenStores.get(store.toLowerCase());
    if (clash) {
      fail(`${file.name} has the same store name as ${clash}. Rename one of the files.`);
    }
    seenStores.set(store.toLowerCase(), file.name);

    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim().toLowerCase(),
    });

    if (parsed.errors.some((e) => e.type === "Quotes")) {
      fail(`We couldn't read ${file.name}. Re-export it as CSV.`);
      done();
      continue;
    }

    const columns = parsed.meta.fields ?? [];
    const missing = REQUIRED_COLUMNS.filter((c) => !columns.includes(c));
    if (missing.length > 0) {
      for (const c of missing) fail(`${file.name} is missing the '${c}' column.`);
      done();
      continue;
    }
    if (parsed.data.length === 0) {
      fail(`${file.name} has column names but no stock rows.`);
      done();
      continue;
    }

    const fileRows: StockRow[] = [];
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
      const sold4w = parseCount(raw.units_sold_4w);
      if (sold4w === null)
        return fail(
          `${file.name} row ${line}: units_sold_4w '${(raw.units_sold_4w ?? "").trim()}' isn't a whole number (0 or more).`
        );

      const daysOld = daysSince(raw.date_received ?? "", today);
      if (daysOld === null)
        return fail(
          `${file.name} row ${line}: date_received '${(raw.date_received ?? "").trim()}' isn't a date (use 2026-08-20 or 20/08/2026).`
        );
      if (daysOld < 0) return fail(`${file.name} row ${line}: date_received is in the future.`);

      fileRows.push({ store, item, size, colour, daysOld, onHand, sold4w });
    });

    if (fileErrors.length > 0) {
      done();
      continue;
    }
    rows.push(...fileRows);
  }

  return { errors, rows: errors.length > 0 ? [] : rows };
}
