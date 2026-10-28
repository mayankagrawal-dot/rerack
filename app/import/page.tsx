"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Loader2,
  Sparkles,
  Trash2,
  TriangleAlert,
  UploadCloud,
} from "lucide-react";
import { Badge, Button, Callout, Card, CardTitle, PageHeader, cx } from "@/components/ui";
import { loadDataset, saveSalesWindow, useAppState, useHydrated } from "@/lib/appState";
import { SalesWindowForm, WINDOW_EXPLAINER } from "@/components/SalesWindowControl";
import { analyze, DEMO_NOTE, demoImportFiles, describeWindow, resolveWindow, type ImportFile } from "@/lib/client";
import { DEMO_BUSINESS, templateCsv } from "@/lib/demoData";
import { fmtAgo } from "@/lib/format";
import { toast } from "@/lib/toast";
import { storeNameFromFile, validateFiles } from "@/lib/validate";
import type { FileError } from "@/lib/types";
import { ColumnMatcher } from "@/components/ColumnMatcher";
import {
  FIELDS,
  applyMapping,
  columnSignature,
  guessMapping,
  hasRerackColumns,
  isComplete,
  loadSavedMapping,
  readHeaders,
  saveMapping,
  type ColumnMapping,
  type FieldKey,
} from "@/lib/columnMap";

const COLUMNS = ["item", "size", "colour", "date_received", "units_on_hand", "units_sold"];

// A file with Rerack's own column names is used as it is. Any other file gets its columns matched:
// from a previous upload with the same columns if there is one, otherwise from a guess the owner checks.
function prepareFile(id: string, name: string, size: number, text: string): ImportFile {
  const file: ImportFile = { id, name, size, text, store: storeNameFromFile(name) };
  const { headers, sample } = readHeaders(text);
  if (headers.length === 0 || hasRerackColumns(headers)) return file;
  const saved = loadSavedMapping(headers);
  return withMapping({ ...file, columns: { raw: text, headers, sample, mapping: guessMapping(headers), saved: false } }, saved, !!saved);
}

function withMapping(f: ImportFile, mapping: ColumnMapping | null, saved = false): ImportFile {
  if (!f.columns) return f;
  const m = mapping ?? f.columns.mapping;
  return { ...f, text: isComplete(m) ? applyMapping(f.columns.raw, m) : f.columns.raw, columns: { ...f.columns, mapping: m, saved } };
}

export default function ImportPage() {
  const { dataset, thresholds, salesWindow } = useAppState();
  const hydrated = useHydrated();
  const [windowOk, setWindowOk] = useState(true);
  const [files, setFiles] = useState<ImportFile[]>([]);
  const [note, setNote] = useState("");
  const [business, setBusiness] = useState("My store chain");
  const [isDemo, setIsDemo] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [openPreview, setOpenPreview] = useState<string | null>(null);
  const [stage, setStage] = useState<"idle" | "processing" | "done">("idle");
  const [seconds, setSeconds] = useState(0);
  const [serverErrors, setServerErrors] = useState<FileError[]>([]);
  const [matcherOpen, setMatcherOpen] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  // Live checks in the browser, the same code the server runs again before anything is processed.
  const check = useMemo(
    () => validateFiles(files.map((f) => ({ name: f.name, size: f.size, text: f.text, store: f.store }))),
    [files]
  );
  const overall = check.errors.filter((e) => e.file === "");
  const fileProblems = check.errors.filter((e) => e.file !== "");
  const totalRows = check.reports.reduce((s, r) => s + r.rows, 0);
  const canProcess = files.length >= 2 && check.errors.length === 0 && windowOk && stage !== "processing";
  const stores = files.map((f) => f.store).filter(Boolean);

  async function addFiles(list: FileList | File[]) {
    const added: ImportFile[] = [];
    for (const f of Array.from(list)) {
      let text = "";
      try {
        text = await f.text();
      } catch {
        text = "";
      }
      added.push(prepareFile(`${f.name}-${Date.now()}-${added.length}`, f.name, f.size, text));
    }
    setStage("idle");
    setServerErrors([]);
    setFiles((cur) => [...cur, ...added]);
  }

  // One choice applies to every file with the same column names, since they come from the same billing software.
  function chooseColumn(id: string, key: FieldKey, header: string) {
    setStage("idle");
    setFiles((cur) => {
      const target = cur.find((x) => x.id === id)?.columns;
      if (!target) return cur;
      const mapping: ColumnMapping = { ...target.mapping, [key]: header };
      // A column can only hold one value, so take it away from any other field that had it.
      for (const f of FIELDS) if (f.key !== key && header && mapping[f.key] === header) mapping[f.key] = "";
      const sig = columnSignature(target.headers);
      return cur.map((x) => (x.columns && columnSignature(x.columns.headers) === sig ? withMapping(x, mapping) : x));
    });
  }

  function loadDemo() {
    setFiles(demoImportFiles());
    setNote(DEMO_NOTE);
    setBusiness(DEMO_BUSINESS);
    setIsDemo(true);
    setStage("idle");
    setServerErrors([]);
    toast("Demo files loaded. These are fictional.", "info");
  }

  function downloadTemplate() {
    const blob = new Blob([templateCsv()], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rerack-store-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function process() {
    setStage("processing");
    setServerErrors([]);
    setSeconds(0);
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    const win = resolveWindow(salesWindow);
    const res = await analyze(files, note, thresholds, win.days);
    clearInterval(timer);
    if (!res.ok) {
      setServerErrors(res.errors);
      setStage("idle");
      toast("We couldn't process these files. See the problems listed.", "warn");
      return;
    }
    for (const f of files) if (f.columns) saveMapping(f.columns.headers, f.columns.mapping);
    loadDataset(res, {
      source: isDemo ? "demo" : "upload",
      businessName: business.trim() || "My store chain",
      window: win,
      files: files.map((f, i) => ({ name: f.name, store: f.store, rows: check.reports[i]?.rows ?? 0 })),
    });
    setStage("done");
    toast(res.usedAi ? "Done. Your actions are ranked." : "Done. AI ranking was unavailable, so the rule-based order is shown.", res.usedAi ? "ok" : "warn");
  }

  const notePresets = [
    "Festival demand is expected in three weeks.",
    "Do not discount the wedding collection.",
    stores[0] ? `${stores[0]} is temporarily closed.` : "One store is temporarily closed.",
    stores[1] ? `${stores[1]} is running a promotion.` : "One store is running a promotion.",
  ];

  return (
    <>
      <PageHeader
        title="Data imports"
        subtitle="Upload one CSV file per store. Rerack checks every file, works out the numbers, and proposes up to 10 actions for you to approve."
        actions={
          <>
            <Button onClick={downloadTemplate}>
              <Download className="size-4" aria-hidden /> Sample CSV template
            </Button>
            <Button variant="accentSoft" onClick={loadDemo}>
              <Sparkles className="size-4" aria-hidden /> Load demo data
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          {/* 1. Upload */}
          <Card>
            <CardTitle
              title="1. Add your store files"
              hint={
                <>
                  CSV only, one file per store. Use these column names:{" "}
                  {COLUMNS.map((c) => (
                    <Fragment key={c}>
                      <code className="rounded bg-paper px-1 py-0.5 font-mono text-[11.5px] text-ink">{c}</code>{" "}
                    </Fragment>
                  ))}
                  or upload your billing software&rsquo;s export as it is and match its columns below.
                </>
              }
            />
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
              }}
              className={cx(
                "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-9 text-center transition-colors",
                dragging ? "border-accent bg-accent-soft" : "border-line-strong bg-paper/60"
              )}
            >
              <UploadCloud className="mb-2 size-8 text-accent" aria-hidden />
              <p className="text-sm font-medium text-ink">Drag and drop your store CSV files here</p>
              <p className="mt-0.5 text-xs text-ink-soft">The file name becomes the store name, and you can rename it below.</p>
              <div className="mt-4">
                <Button onClick={() => inputRef.current?.click()}>Browse files</Button>
              </div>
              <input
                ref={inputRef}
                type="file"
                multiple
                className="sr-only"
                aria-label="Choose store CSV files"
                onChange={(e) => {
                  if (e.target.files?.length) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>

            {files.length > 0 && (
              <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
                {files.map((f, i) => {
                  const rep = check.reports[i];
                  const errs = rep?.errors.length ?? 0;
                  const warns = rep?.warnings.length ?? 0;
                  const open = openPreview === f.id;
                  return (
                    <li key={f.id} className="p-3.5">
                      <div className="flex flex-wrap items-center gap-3">
                        <FileSpreadsheet className="size-5 shrink-0 text-ink-faint" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">{f.name}</p>
                          <p className="text-xs text-ink-soft">{rep ? `${rep.rows} rows` : "Not read yet"}</p>
                        </div>
                        <label className="flex items-center gap-2 text-xs text-ink-soft">
                          Store
                          <input
                            value={f.store}
                            onChange={(e) => {
                              const v = e.target.value;
                              setStage("idle");
                              setFiles((cur) => cur.map((x) => (x.id === f.id ? { ...x, store: v } : x)));
                            }}
                            className="min-h-9 w-36 rounded-lg border border-line-strong bg-card px-2.5 text-sm text-ink"
                          />
                        </label>
                        {errs > 0 ? (
                          <Badge tone="risk">
                            <TriangleAlert className="size-3" aria-hidden /> {errs} problem{errs > 1 ? "s" : ""}
                          </Badge>
                        ) : warns > 0 ? (
                          <Badge tone="amber">Ready, {warns} warning{warns > 1 ? "s" : ""}</Badge>
                        ) : (
                          <Badge tone="accent">
                            <CheckCircle2 className="size-3" aria-hidden /> Ready
                          </Badge>
                        )}
                        <button
                          type="button"
                          onClick={() => setFiles((cur) => cur.filter((x) => x.id !== f.id))}
                          aria-label={`Remove ${f.name}`}
                          className="inline-flex size-9 items-center justify-center rounded-lg text-ink-faint hover:bg-paper hover:text-risk"
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </div>

                      {f.columns && (
                        <ColumnMatcher
                          fileId={f.id}
                          columns={f.columns}
                          open={matcherOpen[f.id] ?? !f.columns.saved}
                          onToggle={() => setMatcherOpen((o) => ({ ...o, [f.id]: !(o[f.id] ?? !f.columns?.saved) }))}
                          onChange={(key, header) => chooseColumn(f.id, key, header)}
                        />
                      )}

                      {rep && (rep.errors.length > 0 || rep.warnings.length > 0) && !(f.columns && !isComplete(f.columns.mapping)) && (
                        <ul className="mt-2.5 space-y-1 pl-8 text-[13px]">
                          {rep.errors.map((m, k) => (
                            <li key={`e${k}`} className="text-risk">
                              {m}
                            </li>
                          ))}
                          {rep.warnings.map((m, k) => (
                            <li key={`w${k}`} className="text-amber">
                              {m}
                            </li>
                          ))}
                        </ul>
                      )}

                      {rep && rep.preview.length > 0 && (
                        <div className="mt-2 pl-8">
                          <button
                            type="button"
                            onClick={() => setOpenPreview(open ? null : f.id)}
                            aria-expanded={open}
                            className="inline-flex items-center gap-1 text-xs font-medium text-accent-strong hover:underline"
                          >
                            <ChevronDown className={cx("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
                            {open ? "Hide" : "Preview"} first {rep.preview.length} rows
                          </button>
                          {open && (
                            <div className="mt-2 overflow-x-auto rounded-lg border border-line">
                              <table className="w-full min-w-[520px] text-left text-xs">
                                <thead className="bg-paper text-ink-soft">
                                  <tr>
                                    {COLUMNS.map((c) => (
                                      <th key={c} className="px-2.5 py-1.5 font-medium">
                                        {c}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-line">
                                  {rep.preview.map((r, k) => (
                                    <tr key={k}>
                                      {COLUMNS.map((c) => (
                                        <td key={c} className="px-2.5 py-1.5 tabular-nums text-ink">
                                          {r[c] ?? ""}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* 2. Sales window */}
          <Card>
            <CardTitle title="2. Which dates do your sales figures cover?" hint={WINDOW_EXPLAINER} />
            {/* Wait until the saved window is loaded, or the form would start from the default and disagree with it. */}
            {hydrated ? (
              <SalesWindowForm
                initial={salesWindow}
                onChange={(w) => {
                  setWindowOk(w !== null);
                  if (w) saveSalesWindow(w);
                }}
              />
            ) : (
              <div className="h-24 animate-pulse rounded-lg bg-paper" aria-hidden />
            )}
            {!windowOk && <p className="mt-2 text-[13px] text-risk">Fix the dates above before processing.</p>}
            {dataset && (
              <p className="mt-2 text-xs leading-relaxed text-ink-faint">
                This is used the next time you process files. Your current data was processed with {describeWindow(dataset.window)}.
              </p>
            )}
          </Card>

          {/* 3. Context */}
          <Card>
            <CardTitle
              title="3. Tell Rerack what the data can't"
              hint="Optional. The AI reads this note when it ranks and can leave out actions it rules out, and it shows you what it left out."
            />
            <label htmlFor="business" className="mb-1 block text-xs font-medium text-ink-soft">
              Business name
            </label>
            <input
              id="business"
              value={business}
              onChange={(e) => setBusiness(e.target.value)}
              className="mb-4 min-h-11 w-full max-w-sm rounded-lg border border-line-strong bg-card px-3 text-sm text-ink"
            />
            <label htmlFor="note" className="mb-1 block text-xs font-medium text-ink-soft">
              Notes for this week
            </label>
            <textarea
              id="note"
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setStage("idle");
              }}
              rows={3}
              maxLength={2000}
              placeholder='e.g. "Diwali in 3 weeks. Store B is closed for repairs. Do not discount the wedding collection."'
              className="w-full rounded-lg border border-line-strong bg-card p-3 text-sm text-ink"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {notePresets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setNote((n) => (n.trim() ? `${n.trim()} ${p}` : p))}
                  className="min-h-8 rounded-full border border-line-strong bg-card px-3 text-xs text-ink-soft hover:border-accent hover:text-accent-strong"
                >
                  + {p}
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* 3. Review and process */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardTitle title="4. Review and process" />
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-soft">Store files</dt>
                <dd className="font-medium tabular-nums">{files.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">Stock lines</dt>
                <dd className="font-medium tabular-nums">{totalRows.toLocaleString("en-IN")}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">Problems to fix</dt>
                <dd className={cx("font-medium tabular-nums", check.errors.length > 0 && "text-risk")}>
                  {files.length === 0 ? 0 : check.errors.length}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">Warnings</dt>
                <dd className="font-medium tabular-nums">{check.warnings.length}</dd>
              </div>
            </dl>

            {files.length === 0 && (
              <p className="mt-4 text-[13px] leading-relaxed text-ink-soft">
                Add at least two store files, or load the demo, to continue.
              </p>
            )}
            {files.length > 0 && overall.length > 0 && (
              <div className="mt-4">
                <Callout tone="amber">{overall[0].message}</Callout>
              </div>
            )}
            {fileProblems.length > 0 && (
              <div className="mt-4">
                <Callout tone="risk" title="Fix these first">
                  The problems are listed under each file.
                </Callout>
              </div>
            )}
            {serverErrors.length > 0 && (
              <div className="mt-4">
                <Callout tone="risk" title="The server found problems">
                  <ul className="list-disc space-y-1 pl-4">
                    {serverErrors.slice(0, 5).map((e, i) => (
                      <li key={i}>{e.message}</li>
                    ))}
                  </ul>
                </Callout>
              </div>
            )}

            <div className="mt-5">
              <Button variant="primary" size="lg" className="w-full" disabled={!canProcess} onClick={process}>
                {stage === "processing" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden /> Processing... {seconds}s
                  </>
                ) : (
                  <>Process data</>
                )}
              </Button>
              {stage === "processing" && (
                <p role="status" className="mt-2 text-xs leading-relaxed text-ink-soft">
                  Checking the files, calculating stock cover, finding transfers and markdowns, then asking the AI to rank them.
                </p>
              )}
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-ink-faint">
              Your original files are never changed. If you matched columns, Rerack sends only those six columns. CSV upload is the only way
              data gets in. There is no billing-system connection.
            </p>
          </Card>

          {stage === "done" && dataset && (
            <div className="mt-4">
              <Card className="border-accent/30 bg-accent-soft/50">
                <p className="flex items-center gap-2 text-sm font-semibold text-accent-strong">
                  <CheckCircle2 className="size-4" aria-hidden /> Processed {fmtAgo(dataset.processedAt)}
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
                  {dataset.files.length} stores and {dataset.rows.length.toLocaleString("en-IN")} stock lines checked. {dataset.candidates.length} possible
                  actions found, {dataset.actions.length} shown.{" "}
                  {dataset.usedAi ? "The AI ranked them." : `AI ranking was unavailable (${dataset.aiProblem ?? "unknown"}), so the rule-based order is shown.`}
                  {dataset.warnings.length > 0 && ` ${dataset.warnings.length} data warning${dataset.warnings.length > 1 ? "s" : ""}, shown under the files.`}
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <Button variant="primary" href="/actions">
                    Review this week&rsquo;s actions <ArrowRight className="size-4" aria-hidden />
                  </Button>
                  <Button href="/">See the overview</Button>
                </div>
              </Card>
            </div>
          )}

          {stage !== "done" && dataset && (
            <p className="mt-4 text-center text-xs text-ink-soft">
              Current data: {dataset.businessName}, processed {fmtAgo(dataset.processedAt)}. Processing again replaces it and clears this week&rsquo;s decisions.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
