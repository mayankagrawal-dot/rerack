import { findCandidates } from "@/lib/candidates";
import { CONFIG, sanitizeThresholds } from "@/lib/config";
import { buildStyles } from "@/lib/metrics";
import { rankCandidates } from "@/lib/rank";
import type { AnalyzeResponse, FileError, StockRow } from "@/lib/types";
import { validateFiles, type RawFile } from "@/lib/validate";
import { sanitizeWindowDays } from "@/lib/window";

export const maxDuration = 60;

const reply = (body: AnalyzeResponse) => Response.json(body);

const MAX_ROWS = 5000;

// Rows that were already checked once and are sent back to be re-analysed (for example with a new sales
// window). Never trust the browser: check every field again.
function cleanRows(input: unknown): StockRow[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_ROWS) return null;
  const out: StockRow[] = [];
  for (const r of input) {
    if (typeof r !== "object" || r === null) return null;
    const o = r as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" && v.trim() !== "" && v.length <= 80 ? v.trim() : null);
    const int = (v: unknown, max: number) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max ? v : null);
    const store = str(o.store);
    const item = str(o.item);
    const size = str(o.size);
    const colour = str(o.colour);
    const daysOld = int(o.daysOld, 36_500);
    const onHand = int(o.onHand, 1_000_000);
    const sold = int(o.sold, 1_000_000);
    if (store === null || item === null || size === null || colour === null || daysOld === null || onHand === null || sold === null) return null;
    out.push({ store, item, size, colour, daysOld, onHand, sold });
  }
  return out;
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return reply({
      ok: false,
      errors: [{ file: "", message: "We couldn't read the upload. Please choose the files again." }],
    });
  }

  const note = String(form.get("note") ?? "").slice(0, 2000);
  let thresholdsInput: unknown = null;
  try {
    thresholdsInput = JSON.parse(String(form.get("thresholds") ?? "null"));
  } catch {
    // bad JSON: fall back to the default rules
  }
  const thresholds = sanitizeThresholds(thresholdsInput);
  const windowDays = sanitizeWindowDays(form.get("windowDays"));

  let rows: StockRow[];
  let warnings: FileError[] = [];

  const rowsField = form.get("rows");
  if (typeof rowsField === "string") {
    // Re-analysing data that was already checked (for example after the sales window changed).
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(rowsField);
    } catch {
      // handled below
    }
    const cleaned = cleanRows(parsed);
    if (!cleaned) {
      return reply({ ok: false, errors: [{ file: "", message: "The saved data couldn't be read. Please process your files again." }] });
    }
    rows = cleaned;
  } else {
    const uploaded = form.getAll("files").filter((f): f is File => typeof f !== "string");
    const storeNames = form.getAll("stores").map((s) => String(s));

    const files: RawFile[] = [];
    const unreadable: FileError[] = [];
    const limited = uploaded.slice(0, CONFIG.maxFiles + 1);
    for (let i = 0; i < limited.length; i++) {
      const f = limited[i];
      try {
        // Don't read big or non-CSV files; validation will give the right message from name and size.
        const readable = /\.csv$/i.test(f.name) && f.size <= CONFIG.maxFileBytes;
        files.push({ name: f.name, size: f.size, text: readable ? await f.text() : "", store: storeNames[i] });
      } catch {
        unreadable.push({ file: f.name, message: `We couldn't read ${f.name}. Re-export it as CSV.` });
      }
    }

    // STEP 1: plain-code checks. Any problem stops here, before the AI is called.
    const checked = validateFiles(files);
    const allErrors = [...unreadable, ...checked.errors];
    if (allErrors.length > 0) {
      return reply({ ok: false, errors: allErrors });
    }
    rows = checked.rows;
    warnings = checked.warnings;
  }

  // STEP 2: plain-code arithmetic and rules, using the sales window the owner set.
  const styles = buildStyles(rows, windowDays);
  const candidates = findCandidates(styles, thresholds, windowDays);
  const storeCount = new Set(rows.map((r) => r.store)).size;

  // STEP 3 and 4: the AI ranks and explains, then code checks its answer.
  const outcome = await rankCandidates(candidates, note);

  return reply({
    ok: true,
    note,
    storeCount,
    rowCount: rows.length,
    candidateCount: candidates.length,
    usedAi: outcome.usedAi,
    aiProblem: outcome.aiProblem,
    ignoredAiSuggestions: outcome.ignoredAiSuggestions,
    actions: outcome.actions,
    skipped: outcome.skipped,
    rows,
    candidates,
    warnings,
    windowDays,
    processedAt: new Date().toISOString(),
  });
}
