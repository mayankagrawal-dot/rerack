"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import ActionCard, { type Decision } from "@/components/ActionCard";
import UploadPanel from "@/components/UploadPanel";
import {
  addLogEntry,
  clearLog,
  getLogSnapshot,
  getServerLogSnapshot,
  parseLog,
  subscribeToLog,
} from "@/lib/approvalLog";
import type { AnalyzeResponse } from "@/lib/types";

const timeNow = () => new Date().toLocaleTimeString("en-GB"); // 11:42:07
const stamp = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }); // 22 Oct, 11:42:07

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [requestError, setRequestError] = useState("");
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const statusRef = useRef<HTMLDivElement>(null);

  // The approvals log is saved in the browser, so it survives a refresh.
  const logSnapshot = useSyncExternalStore(subscribeToLog, getLogSnapshot, getServerLogSnapshot);
  const log = useMemo(() => parseLog(logSnapshot), [logSnapshot]);

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  // On a phone the results sit below the form, so bring the progress, error or list into view.
  useEffect(() => {
    if (busy || result || requestError) statusRef.current?.scrollIntoView({ block: "start" });
  }, [busy, result, requestError]);

  async function analyze() {
    setSeconds(0);
    setBusy(true);
    setResult(null);
    setRequestError("");
    setDecisions({});
    try {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      form.append("note", note);
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      setResult((await res.json()) as AnalyzeResponse);
    } catch {
      setRequestError("Something went wrong talking to the app. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function decide(id: string, headline: string, choice: "approved" | "rejected") {
    setDecisions((d) => ({ ...d, [id]: { choice, at: timeNow() } }));
    addLogEntry({ headline, choice, iso: new Date().toISOString() });
  }

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6">
      <header>
        <h1 className="text-2xl font-bold">Rerack</h1>
        <p className="text-sm text-stone-600">
          Upload your stores&rsquo; stock files. Get a short list of what to move or mark down.
        </p>
      </header>

      <UploadPanel
        files={files}
        note={note}
        busy={busy}
        onAddFiles={(added) => setFiles((f) => [...f, ...added])}
        onRemoveFile={(i) => setFiles((f) => f.filter((_, n) => n !== i))}
        onNoteChange={setNote}
        onAnalyze={analyze}
      />

      <div ref={statusRef} className="scroll-mt-4 space-y-4 empty:hidden">
      {busy && (
        <p className="rounded-xl bg-stone-200 p-3 text-center text-sm" role="status">
          Checking files, crunching numbers, asking the AI to rank... {seconds}s
        </p>
      )}

      {requestError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{requestError}</p>}

      {result && !result.ok && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <h2 className="font-semibold text-red-900">We couldn&rsquo;t analyze these files</h2>
          <p className="mt-1 text-sm text-red-900">Fix the problems below and press Analyze again.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-900">
            {result.errors.map((e, i) => (
              <li key={i}>{e.message}</li>
            ))}
          </ul>
        </section>
      )}

      {result && result.ok && (
        <>
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Your action list</h2>
            <p className="text-sm text-stone-600">
              {result.storeCount} stores, {result.rowCount} stock lines, {result.candidateCount} possible actions found
              by rules.
            </p>
            <p className="rounded-xl bg-stone-100 p-3 text-sm">
              <span className="font-semibold">The AI was told: </span>
              {result.note.trim() ? `“${result.note.trim()}”` : "no note"}
            </p>
            {!result.usedAi && (
              <p className="rounded-xl bg-amber-100 p-3 text-sm text-amber-900" role="alert">
                AI ranking unavailable ({result.aiProblem ?? "unknown problem"}). Showing the rule-based order, without
                note-based reasons.
              </p>
            )}
            {result.ignoredAiSuggestions > 0 && (
              <p className="text-sm text-stone-600">
                {result.ignoredAiSuggestions} AI suggestion{result.ignoredAiSuggestions > 1 ? "s were" : " was"} ignored
                because {result.ignoredAiSuggestions > 1 ? "they weren't" : "it wasn't"} a valid candidate.
              </p>
            )}
            {result.actions.length === 0 && (
              <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
                Nothing needs moving or marking down right now.
              </p>
            )}
          </section>

          {result.actions.map((a) => (
            <ActionCard
              key={a.candidate.id}
              candidate={a.candidate}
              rankLine={
                a.aiRank !== null
                  ? `AI rank ${a.aiRank} · rules rank ${a.candidate.rulesRank}`
                  : `Rules rank ${a.candidate.rulesRank}`
              }
              reasonLabel={a.reasonSource === "ai" ? "AI's reason" : "Why (from rules, not AI)"}
              reason={a.reason}
              warn={a.numberWarning}
              decision={decisions[a.candidate.id]}
              onDecide={(c) => decide(a.candidate.id, a.candidate.headline, c)}
            />
          ))}

          {result.skipped.length > 0 && (
            <details className="rounded-2xl border border-stone-200 bg-white p-4">
              <summary className="min-h-10 cursor-pointer font-semibold">
                Left out by the AI, mostly because of your note ({result.skipped.length})
              </summary>
              <div className="mt-3 space-y-3">
                {result.skipped.map((s) => (
                  <ActionCard
                    key={s.candidate.id}
                    candidate={s.candidate}
                    rankLine={`Rules rank ${s.candidate.rulesRank}`}
                    reasonLabel="AI left this out because"
                    reason={s.why}
                    decision={decisions[s.candidate.id]}
                    onDecide={(c) => decide(s.candidate.id, s.candidate.headline, c)}
                  />
                ))}
              </div>
            </details>
          )}
        </>
      )}
      </div>

      {(result?.ok || log.length > 0) && (
        <section className="rounded-2xl border border-stone-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Approvals log</h2>
            {log.length > 0 && (
              <button
                type="button"
                onClick={clearLog}
                className="min-h-10 rounded-lg px-3 text-sm text-stone-600 hover:bg-stone-100"
              >
                Clear log
              </button>
            )}
          </div>
          {log.length === 0 ? (
            <p className="mt-1 text-sm text-stone-600">Nothing approved or rejected yet.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {log.map((l, i) => (
                <li key={`${l.iso}-${i}`}>
                  <span className="font-mono text-stone-500">{stamp(l.iso)}</span>{" "}
                  <span className={l.choice === "approved" ? "font-semibold text-emerald-800" : "font-semibold text-rose-800"}>
                    {l.choice === "approved" ? "Approved" : "Rejected"}
                  </span>{" "}
                  {l.headline}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
