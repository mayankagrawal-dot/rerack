"use client";

import type { Candidate } from "@/lib/types";

export type Decision = { choice: "approved" | "rejected"; at: string };

type Props = {
  candidate: Candidate;
  rankLine?: string; // "AI rank 2 · rules rank 5"
  reasonLabel: string; // "AI's reason" or "Why (rule-based)" or "Left out because"
  reason: string;
  warn?: boolean;
  decision?: Decision;
  onDecide: (choice: "approved" | "rejected") => void;
};

export default function ActionCard({ candidate, rankLine, reasonLabel, reason, warn, decision, onDecide }: Props) {
  const isMove = candidate.type === "move";
  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide ${
            isMove ? "bg-sky-100 text-sky-800" : "bg-amber-100 text-amber-900"
          }`}
        >
          {isMove ? "MOVE" : "MARK DOWN"}
        </span>
        {rankLine && <span className="text-xs text-stone-500">{rankLine}</span>}
        {warn && (
          <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
            ⚠ check numbers
          </span>
        )}
      </div>

      <h3 className="mt-2 text-base font-semibold leading-snug">{candidate.headline}</h3>

      <p className="mt-2 text-sm text-stone-700">
        <span className="font-semibold">Facts (calculated): </span>
        {candidate.facts}
      </p>

      <div className={`mt-2 rounded-xl p-3 text-sm ${warn ? "bg-red-50" : "bg-stone-100"}`}>
        <span className="font-semibold">{reasonLabel}: </span>
        {reason}
        {warn && (
          <span className="mt-1 block text-red-800">
            This sentence has a number that code did not calculate. Trust the facts above, not the sentence.
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onDecide("approved")}
          className={`min-h-12 rounded-xl text-base font-semibold ${
            decision?.choice === "approved" ? "bg-emerald-700 text-white" : "bg-emerald-100 text-emerald-900"
          }`}
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => onDecide("rejected")}
          className={`min-h-12 rounded-xl text-base font-semibold ${
            decision?.choice === "rejected" ? "bg-rose-700 text-white" : "bg-rose-100 text-rose-900"
          }`}
        >
          Reject
        </button>
      </div>
      {decision && (
        <p className="mt-2 text-center text-sm font-medium text-stone-700">
          {decision.choice === "approved" ? "Approved" : "Rejected"} at {decision.at}
        </p>
      )}
    </article>
  );
}
