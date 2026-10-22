"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  CircleAlert,
  ClipboardCopy,
  Cpu,
  Pencil,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Undo2,
  X,
} from "lucide-react";
import { markVerified, recordDecision, undoDecision, type Decision } from "@/lib/appState";
import { headlineFor, transferNote, transferPreview } from "@/lib/actionText";
import { fmtDateTime, fmtPct, fmtWeeks } from "@/lib/format";
import { windowLabel } from "@/lib/window";
import { toast } from "@/lib/toast";
import type { Candidate } from "@/lib/types";
import { Badge, Button, Modal, Tip, cx } from "./ui";
import { priorityOf, StatusBadge, StrengthBadge, TypeBadge } from "./status";

type Props = {
  candidate: Candidate;
  index: number | null; // position in this week's list; null for items the AI left out
  reason: string;
  reasonKind: "ai" | "rules" | "left-out";
  numberWarning?: boolean;
  aiRank?: number | null;
  decision?: Decision;
};

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-line bg-paper/60 px-3 py-2">
      <p className="text-[11.5px] font-medium uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-0.5 font-display text-xl font-semibold tabular-nums text-ink">{value}</p>
      {sub && <p className="text-xs text-ink-soft">{sub}</p>}
    </div>
  );
}

function Evidence({ c }: { c: Candidate }) {
  return (
    <div className="mt-4 space-y-5 rounded-lg border border-line bg-paper/50 p-4">
      <div>
        <h4 className="mb-2 text-[13px] font-semibold text-ink">The numbers (sales over {windowLabel(c.windowDays)})</h4>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[13px]">
            <thead className="text-xs text-ink-soft">
              <tr>
                <th className="py-1.5 pr-3 font-medium">Store</th>
                <th className="px-2 py-1.5 text-right font-medium">On hand</th>
                <th className="px-2 py-1.5 text-right font-medium">Sold</th>
                <th className="px-2 py-1.5 text-right font-medium">Per week</th>
                <th className="px-2 py-1.5 text-right font-medium">Stock cover</th>
                <th className="px-2 py-1.5 text-right font-medium">Sell-through</th>
                <th className="py-1.5 pl-2 text-right font-medium">Days since receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {c.involved.map((s, i) => (
                <tr key={s.store}>
                  <td className="py-1.5 pr-3 font-medium text-ink">
                    {s.store}
                    {c.type === "move" && <span className="ml-1.5 text-xs font-normal text-ink-soft">{i === 0 ? "(from)" : "(to)"}</span>}
                  </td>
                  <td className="px-2 py-1.5 text-right">{s.onHand}</td>
                  <td className="px-2 py-1.5 text-right">{s.sold}</td>
                  <td className="px-2 py-1.5 text-right">{Number(s.weeklyRate.toFixed(2))}</td>
                  <td className="px-2 py-1.5 text-right">{fmtWeeks(s.coverWeeks)}</td>
                  <td className="px-2 py-1.5 text-right">{fmtPct(s.sellThrough)}</td>
                  <td className="py-1.5 pl-2 text-right">{s.daysOld}</td>
                </tr>
              ))}
              {c.chain && (
                <tr className="font-medium">
                  <td className="py-1.5 pr-3 text-ink">Whole chain</td>
                  <td className="px-2 py-1.5 text-right">{c.chain.onHand}</td>
                  <td className="px-2 py-1.5 text-right">{c.chain.sold}</td>
                  <td className="px-2 py-1.5 text-right">{Number((c.chain.sold / 4).toFixed(2))}</td>
                  <td className="px-2 py-1.5 text-right">{fmtWeeks(c.chain.coverWeeks)}</td>
                  <td className="px-2 py-1.5 text-right" />
                  <td className="py-1.5 pl-2 text-right" />
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-ink-soft">Stock cover = units on hand ÷ units sold per week. “No sales” means nothing sold, so cover can&rsquo;t be worked out.</p>
      </div>

      <div>
        <h4 className="mb-1.5 text-[13px] font-semibold text-ink">How the suggestion was worked out</h4>
        <ol className="list-decimal space-y-1 pl-5 text-[13px] leading-relaxed text-ink-soft marker:text-ink-faint">
          {c.calc.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>
        <p className="mt-1.5 text-xs text-ink-faint">Calculated by code from your files. The AI did not calculate any of these numbers.</p>
      </div>

      <div>
        <h4 className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
          <TriangleAlert className="size-3.5 text-amber" aria-hidden /> What this data can&rsquo;t tell you
        </h4>
        <ul className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-ink-soft marker:text-amber">
          {c.limitations.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function ActionCard({ candidate: c, index, reason, reasonKind, numberWarning, aiRank, decision }: Props) {
  const [evidence, setEvidence] = useState(false);
  const [dialog, setDialog] = useState<null | "approve" | "edit" | "reject">(null);
  const [editValue, setEditValue] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const wl = windowLabel(c.windowDays);
  const pr = index !== null ? priorityOf(index) : null;
  const headline = headlineFor(c, decision);
  const isMove = c.type === "move";
  const source = c.involved[0];
  const dest = c.involved[1];
  const oldest = Math.max(...c.involved.map((s) => s.daysOld));

  const editNumber = Number(editValue);
  const editMax = isMove ? c.maxUnits : 70;
  const editMin = isMove ? 1 : 5;
  const editValid = Number.isInteger(editNumber) && editNumber >= editMin && editNumber <= editMax;
  const preview = isMove && editValid ? transferPreview(c, editNumber) : null;

  function openEdit() {
    setEditValue(String(decision?.units ?? decision?.markdownPct ?? (isMove ? c.units : c.markdownPct)));
    setDialog("edit");
  }

  function approve(edited: boolean, value?: number) {
    const d: Decision = isMove
      ? { status: "approved", at: new Date().toISOString(), edited, units: value ?? c.units, originalUnits: c.units }
      : { status: "approved", at: new Date().toISOString(), edited, markdownPct: value ?? c.markdownPct, originalPct: c.markdownPct };
    const change = edited ? (isMove ? ` with an edit (${c.units} → ${value} units)` : ` with an edit (${c.markdownPct}% → ${value}%)`) : "";
    recordDecision(c.id, d, `Approved${change}: ${headlineFor(c, d)}`);
    toast(isMove ? "Approved. Verify the physical stock before dispatch." : "Approved. Enter the price change in your billing software yourself.");
    setDialog(null);
  }

  function reject() {
    const d: Decision = { status: "rejected", at: new Date().toISOString(), edited: false, reason: rejectReason.trim() || undefined };
    recordDecision(c.id, d, `Rejected: ${headline}${d.reason ? ` (reason: ${d.reason})` : ""}`);
    toast("Rejected and recorded.", "info");
    setRejectReason("");
    setDialog(null);
  }

  async function copyNote() {
    if (!decision) return;
    try {
      await navigator.clipboard.writeText(transferNote(c, decision, reason));
      toast("Transfer note copied. It has not been sent anywhere.", "info");
    } catch {
      toast("Couldn't copy automatically. Select the note and copy it.", "warn");
    }
  }

  return (
    <article id={c.id} className={cx("scroll-mt-24 rounded-xl border bg-card p-5 shadow-[0_1px_2px_rgba(18,26,43,0.04)]", decision?.status === "rejected" ? "border-line opacity-80" : "border-line")}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {index !== null && (
          <span className="flex size-7 items-center justify-center rounded-full bg-navy text-[13px] font-semibold text-white" aria-label={`Rank ${index + 1}`}>
            {index + 1}
          </span>
        )}
        <TypeBadge type={c.type} />
        {pr && <Badge tone={pr.tone}>{pr.label}</Badge>}
        <span className="inline-flex items-center gap-0.5">
          <StrengthBadge strength={c.strength} />
          <Tip
            text={
              isMove
                ? `Based on units sold at the destination in ${wl}: 10 or more is strong, 5 to 9 moderate, fewer is limited. This is a rule, not an AI confidence score.`
                : "Based on how much stock the whole chain holds against its sales. This is a rule, not an AI confidence score."
            }
          />
        </span>
        <span className="ml-auto">
          <StatusBadge decision={decision} type={c.type} />
        </span>
      </div>

      <h3 className="mt-3 font-display text-[22px] font-semibold leading-snug tracking-tight text-ink">{headline}</h3>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {isMove ? (
          <>
            <Fact label={`Sold at ${dest.store}`} value={`${dest.sold}`} sub={`units in ${wl}`} />
            <Fact label={`Sold at ${source.store}`} value={`${source.sold}`} sub={`units in ${wl}`} />
            <Fact label={`Age at ${source.store}`} value={`${source.daysOld}`} sub="days since receipt" />
          </>
        ) : (
          <>
            <Fact label="Units affected" value={`${c.units}`} sub={`in ${c.involved.length} store${c.involved.length > 1 ? "s" : ""}`} />
            <Fact label="Sold chain-wide" value={`${c.chain?.sold ?? 0}`} sub={`units in ${wl}`} />
            <Fact label="Oldest stock" value={`${oldest}`} sub="days since receipt" />
          </>
        )}
      </div>

      <div className={cx("mt-3 rounded-lg px-3.5 py-3 text-sm leading-relaxed", numberWarning ? "bg-risk-soft" : "bg-paper")}>
        <p className="mb-0.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
          {reasonKind === "ai" ? (
            <>
              <Sparkles className="size-3.5 text-accent" aria-hidden /> Why, written by the AI{aiRank ? ` (AI rank ${aiRank} · rules rank ${c.rulesRank})` : ""}
            </>
          ) : reasonKind === "rules" ? (
            <>
              <Cpu className="size-3.5" aria-hidden /> Why, from rules (not AI)
            </>
          ) : (
            <>
              <CircleAlert className="size-3.5 text-amber" aria-hidden /> Why the AI left this out
            </>
          )}
        </p>
        <p className="text-ink">{reason}</p>
        {numberWarning && (
          <p className="mt-1.5 flex items-start gap-1.5 text-[13px] text-risk">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden /> This sentence contains a number the calculations didn&rsquo;t produce. Trust the figures in the evidence panel, not the sentence.
          </p>
        )}
      </div>

      {/* Decision controls */}
      {!decision ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto">
            <Button variant="primary" onClick={() => setDialog("approve")}>
              <Check className="size-4" aria-hidden /> Approve
            </Button>
            <Button onClick={openEdit}>
              <Pencil className="size-4" aria-hidden /> Edit
            </Button>
            <Button variant="danger" onClick={() => setDialog("reject")}>
              <X className="size-4" aria-hidden /> Reject
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setEvidence((v) => !v)}
            aria-expanded={evidence}
            className="ml-auto inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-accent-strong hover:underline"
          >
            Evidence <ChevronDown className={cx("size-4 transition-transform", evidence && "rotate-180")} aria-hidden />
          </button>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-line bg-paper/60 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-ink">
              <span className="font-semibold">{decision.status === "approved" ? "Approved" : "Rejected"}</span> on {fmtDateTime(decision.at)}
              {decision.edited && decision.status === "approved" && (
                <span className="text-ink-soft">
                  {" "}
                  · edited from {isMove ? `${decision.originalUnits} units` : `${decision.originalPct}%`} to {isMove ? `${decision.units} units` : `${decision.markdownPct}%`}
                </span>
              )}
              {decision.reason && <span className="text-ink-soft"> · reason: {decision.reason}</span>}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setEvidence((v) => !v)}
                aria-expanded={evidence}
                className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[13px] font-medium text-accent-strong hover:underline"
              >
                Evidence <ChevronDown className={cx("size-4 transition-transform", evidence && "rotate-180")} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => undoDecision(c.id, `Undid the decision on: ${headline}`)}
                className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[13px] font-medium text-ink-soft hover:bg-paper hover:text-ink"
              >
                <Undo2 className="size-3.5" aria-hidden /> Undo
              </button>
            </div>
          </div>

          {decision.status === "approved" && isMove && (
            <div className="mt-3 border-t border-line pt-3">
              {decision.verifiedAt ? (
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-accent-strong">
                  <ShieldCheck className="size-4" aria-hidden /> Stock verified at {c.from} on {fmtDateTime(decision.verifiedAt)}
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="flex-1 text-[13px] leading-relaxed text-amber">
                    Awaiting stock verification: count the physical stock at {c.from} before anything is dispatched.
                  </p>
                  <Button size="sm" variant="accentSoft" onClick={() => markVerified(c.id, `Stock verified at ${c.from}: ${headline}`)}>
                    <ShieldCheck className="size-4" aria-hidden /> Mark stock verified
                  </Button>
                </div>
              )}
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg bg-card p-3 font-mono text-xs leading-relaxed text-ink-soft ring-1 ring-line">
                {transferNote(c, decision, reason)}
              </pre>
              <div className="mt-2">
                <Button size="sm" onClick={copyNote}>
                  <ClipboardCopy className="size-4" aria-hidden /> Copy transfer note
                </Button>
              </div>
            </div>
          )}
          {decision.status === "approved" && !isMove && (
            <p className="mt-3 border-t border-line pt-3 text-[13px] leading-relaxed text-ink-soft">
              Decision recorded. Rerack doesn&rsquo;t change prices: enter the {decision.markdownPct}% markdown in your billing software yourself.
            </p>
          )}
        </div>
      )}

      {evidence && <Evidence c={c} />}

      {/* Approve */}
      <Modal
        open={dialog === "approve"}
        onClose={() => setDialog(null)}
        title="Approve this action?"
        footer={
          <>
            <Button onClick={() => setDialog(null)}>Cancel</Button>
            <Button variant="primary" onClick={() => approve(false)}>
              <Check className="size-4" aria-hidden /> Approve and record
            </Button>
          </>
        }
      >
        <p className="font-display text-lg font-semibold leading-snug text-ink">{headline}</p>
        <div className="mt-3">
          <p className="rounded-lg bg-amber-soft px-3.5 py-3 text-sm leading-relaxed text-ink-soft">
            {isMove ? (
              <>
                <strong className="text-ink">Check the stock first.</strong> Confirm the physical count at {c.from} before anything is dispatched.{" "}
              </>
            ) : null}
            Approving records your decision here. <strong className="text-ink">It does not move stock or change prices</strong> in your billing software.
          </p>
        </div>
      </Modal>

      {/* Edit */}
      <Modal
        open={dialog === "edit"}
        onClose={() => setDialog(null)}
        title={isMove ? "Edit the transfer" : "Edit the markdown"}
        footer={
          <>
            <Button onClick={() => setDialog(null)}>Cancel</Button>
            <Button variant="primary" disabled={!editValid} onClick={() => approve(true, editNumber)}>
              <Check className="size-4" aria-hidden /> Save and approve
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">{c.label}</p>
        <label htmlFor={`edit-${c.id}`} className="mt-3 block text-sm font-medium text-ink">
          {isMove ? `Units to move from ${c.from} to ${c.to}` : "Markdown (% off)"}
        </label>
        <input
          id={`edit-${c.id}`}
          type="number"
          inputMode="numeric"
          min={editMin}
          max={editMax}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="mt-1 min-h-11 w-32 rounded-lg border border-line-strong bg-card px-3 text-base tabular-nums text-ink"
        />
        <span className="ml-2 text-xs text-ink-soft">
          Suggested {isMove ? c.units : `${c.markdownPct}%`} · allowed {editMin} to {editMax}
        </span>
        {!editValid && editValue !== "" && (
          <p className="mt-2 text-[13px] text-risk">
            Enter a whole number from {editMin} to {editMax}.
          </p>
        )}
        <div className="mt-4 rounded-lg bg-paper p-3.5 text-[13px] leading-relaxed text-ink-soft">
          {isMove && preview ? (
            <ul className="space-y-1">
              <li>
                {c.from} would keep <strong className="text-ink">{preview.sourceLeft}</strong> units ({preview.sourceWeeks === null ? "no sales, so no cover to work out" : `${preview.sourceWeeks} weeks of its own sales`}).
              </li>
              <li>
                {c.to} would hold <strong className="text-ink">{preview.destAfter}</strong> units ({preview.destWeeks === null ? "n/a" : `${preview.destWeeks} weeks of its sales`}).
              </li>
              {editNumber > c.units && <li className="text-amber">That is more than the suggested {c.units}: the extra units may sit unsold at {c.to}.</li>}
            </ul>
          ) : !isMove && editValid ? (
            <ul className="space-y-1">
              <li>
                A {editNumber}% markdown would apply to <strong className="text-ink">{c.units}</strong> units across {c.involved.length} store{c.involved.length > 1 ? "s" : ""}.
              </li>
              <li>Margin impact can&rsquo;t be shown: the CSV has no selling price or cost. This is a proposal for you to review, not a promise of a sale.</li>
            </ul>
          ) : (
            <p>Enter a valid number to see what it would do.</p>
          )}
        </div>
      </Modal>

      {/* Reject */}
      <Modal
        open={dialog === "reject"}
        onClose={() => setDialog(null)}
        title="Reject this action?"
        footer={
          <>
            <Button onClick={() => setDialog(null)}>Cancel</Button>
            <Button variant="danger" onClick={reject}>
              <X className="size-4" aria-hidden /> Reject and record
            </Button>
          </>
        }
      >
        <p className="font-display text-lg font-semibold leading-snug text-ink">{headline}</p>
        <label htmlFor={`reject-${c.id}`} className="mt-3 block text-sm font-medium text-ink">
          Reason (optional)
        </label>
        <textarea
          id={`reject-${c.id}`}
          rows={3}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          maxLength={300}
          placeholder="e.g. Wedding collection, we're holding it."
          className="mt-1 w-full rounded-lg border border-line-strong bg-card p-3 text-sm text-ink"
        />
      </Modal>
    </article>
  );
}
