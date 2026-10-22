import { findCandidates } from "@/lib/candidates";
import { CONFIG } from "@/lib/config";
import { buildStyles } from "@/lib/metrics";
import { rankCandidates } from "@/lib/rank";
import type { AnalyzeResponse } from "@/lib/types";
import { validateFiles, type RawFile } from "@/lib/validate";

export const maxDuration = 60;

const reply = (body: AnalyzeResponse) => Response.json(body);

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
  const uploaded = form.getAll("files").filter((f): f is File => typeof f !== "string");

  const files: RawFile[] = [];
  const unreadable: { file: string; message: string }[] = [];
  for (const f of uploaded.slice(0, CONFIG.maxFiles + 1)) {
    try {
      // Don't read big or non-CSV files; validation will give the right message from name and size.
      const readable = /\.csv$/i.test(f.name) && f.size <= CONFIG.maxFileBytes;
      files.push({ name: f.name, size: f.size, text: readable ? await f.text() : "" });
    } catch {
      unreadable.push({ file: f.name, message: `We couldn't read ${f.name}. Re-export it as CSV.` });
    }
  }

  // STEP 1: plain-code checks. Any problem stops here, before the AI is called.
  const { errors, rows } = validateFiles(files);
  const allErrors = [...unreadable, ...errors];
  if (allErrors.length > 0) {
    return reply({ ok: false, errors: allErrors });
  }

  // STEP 2: plain-code arithmetic and rules.
  const styles = buildStyles(rows);
  const candidates = findCandidates(styles);
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
  });
}
