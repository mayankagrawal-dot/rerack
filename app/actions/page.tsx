"use client";

import Link from "next/link";
import { useState } from "react";
import { Boxes, ChevronDown, ListChecks, Upload } from "lucide-react";
import ActionCard from "@/components/ActionCard";
import { Badge, Button, Callout, Card, CardTitle, EmptyState, PageHeader, PageSkeleton, Segmented, cx } from "@/components/ui";
import { useAppState, useHydrated } from "@/lib/appState";
import { fmtDateTimeSeconds } from "@/lib/format";
import type { Candidate } from "@/lib/types";

type Tab = "all" | "move" | "markdown";

export default function ActionsPage() {
  const { dataset, decisions, activity } = useAppState();
  const hydrated = useHydrated();
  const [tab, setTab] = useState<Tab>("all");
  const [openSkipped, setOpenSkipped] = useState<string | null>(null);

  if (!hydrated) return <PageSkeleton />;
  if (!dataset) {
    return (
      <>
        <PageHeader title="Action Centre" subtitle="Your ranked weekly list of transfers and markdowns." />
        <EmptyState
          icon={<ListChecks className="size-6" aria-hidden />}
          title="No actions yet"
          actions={
            <>
              <Button variant="primary" href="/import">
                <Upload className="size-4" aria-hidden /> Add store files
              </Button>
              <Button href="/">Explore the demo</Button>
            </>
          }
        >
          Upload one CSV per store (or load the demo) and Rerack will propose up to 10 actions, each with the numbers behind it.
        </EmptyState>
      </>
    );
  }

  const shownIds = new Set(dataset.actions.map((a) => a.candidate.id));
  const skippedIds = new Set(dataset.skipped.map((s) => s.candidate.id));
  const notShown = dataset.candidates.filter((c: Candidate) => !shownIds.has(c.id) && !skippedIds.has(c.id)).length;

  const decided = dataset.actions.filter((a) => decisions[a.candidate.id]);
  const approved = decided.filter((a) => decisions[a.candidate.id].status === "approved").length;
  const rejected = decided.length - approved;
  const awaiting = dataset.actions.length - decided.length;
  const awaitingVerify = dataset.actions.filter((a) => {
    const d = decisions[a.candidate.id];
    return d?.status === "approved" && a.candidate.type === "move" && !d.verifiedAt;
  }).length;

  const visible = dataset.actions
    .map((a, index) => ({ a, index }))
    .filter(({ a }) => tab === "all" || a.candidate.type === tab);
  const counts = {
    all: dataset.actions.length,
    move: dataset.actions.filter((a) => a.candidate.type === "move").length,
    markdown: dataset.actions.filter((a) => a.candidate.type === "markdown").length,
  };
  const recent = activity.filter((e) => ["approved", "rejected", "verified", "undo"].includes(e.kind)).slice(0, 6);

  return (
    <>
      <PageHeader
        title="Action Centre"
        subtitle="This week's ranked transfers and markdowns. Each one shows the numbers behind it. You decide; nothing happens automatically."
        actions={<Segmented label="Filter actions" value={tab} onChange={setTab} options={[
          { value: "all", label: "All", count: counts.all },
          { value: "move", label: "Transfers", count: counts.move },
          { value: "markdown", label: "Markdowns", count: counts.markdown },
        ]} />}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Awaiting you", value: awaiting, tone: awaiting > 0 ? "text-ink" : "text-accent-strong" },
          { label: "Approved", value: approved, tone: "text-accent-strong" },
          { label: "Rejected", value: rejected, tone: "text-ink-soft" },
          { label: "Transfers to verify", value: awaitingVerify, tone: awaitingVerify > 0 ? "text-amber" : "text-ink-soft" },
        ].map((s) => (
          <Card key={s.label} className="!p-4 sm:!p-5">
            <p className="text-xs font-medium text-ink-soft">{s.label}</p>
            <p className={cx("mt-1 font-display text-3xl font-semibold tabular-nums", s.tone)}>{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="mb-5 space-y-3">
        {!dataset.usedAi && (
          <Callout tone="amber" title="AI ranking unavailable">
            {dataset.aiProblem ? `Reason: ${dataset.aiProblem}. ` : ""}These actions are in the rule-based order, with reasons written by rules instead of the AI. Everything else works as normal.
          </Callout>
        )}
        {dataset.note.trim() && (
          <Callout tone="info" title="The AI was told">
            &ldquo;{dataset.note.trim()}&rdquo;
            {dataset.skipped.length > 0 && <> It left {dataset.skipped.length} action{dataset.skipped.length > 1 ? "s" : ""} out because of this. See the list below the actions.</>}
          </Callout>
        )}
        {dataset.ignoredAiSuggestions > 0 && (
          <p className="text-xs text-ink-soft">
            {dataset.ignoredAiSuggestions} AI suggestion{dataset.ignoredAiSuggestions > 1 ? "s were" : " was"} ignored because {dataset.ignoredAiSuggestions > 1 ? "they weren't" : "it wasn't"} a valid candidate found by the rules.
          </p>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          {visible.map(({ a, index }) => (
            <ActionCard
              key={a.candidate.id}
              candidate={a.candidate}
              index={index}
              reason={a.reason}
              reasonKind={a.reasonSource}
              numberWarning={a.numberWarning}
              aiRank={a.aiRank}
              decision={decisions[a.candidate.id]}
            />
          ))}
          {visible.length === 0 && (
            <Card>
              <p className="text-sm text-ink-soft">No {tab === "move" ? "transfers" : "markdowns"} in this week&rsquo;s list.</p>
            </Card>
          )}

          {dataset.skipped.length > 0 && (
            <Card padded={false}>
              <div className="p-5 pb-3">
                <CardTitle
                  title={`Left out by the AI (${dataset.skipped.length})`}
                  hint="Found by the rules but left out of your list, mostly because of your note. Review any of them if you disagree."
                />
              </div>
              <ul className="divide-y divide-line border-t border-line">
                {dataset.skipped.map((s) => (
                  <li key={s.candidate.id} className="px-5 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">{s.candidate.headline}</p>
                        <p className="mt-0.5 text-[13px] text-ink-soft">The AI&rsquo;s reason: {s.why}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setOpenSkipped(openSkipped === s.candidate.id ? null : s.candidate.id)}
                      >
                        {openSkipped === s.candidate.id ? "Hide" : "Review anyway"}
                        <ChevronDown className={cx("size-4 transition-transform", openSkipped === s.candidate.id && "rotate-180")} aria-hidden />
                      </Button>
                    </div>
                    {openSkipped === s.candidate.id && (
                      <div className="mt-3">
                        <ActionCard
                          candidate={s.candidate}
                          index={null}
                          reason={s.why}
                          reasonKind="left-out"
                          decision={decisions[s.candidate.id]}
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {notShown > 0 && (
            <p className="px-1 text-xs leading-relaxed text-ink-soft">
              {notShown} more possible action{notShown > 1 ? "s were" : " was"} found by the rules but didn&rsquo;t make this week&rsquo;s top {dataset.actions.length}. The list is capped
              so it stays short enough to act on.
            </p>
          )}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <Card>
            <CardTitle title="Recent decisions" hint="Every approval, rejection and edit is time-stamped." />
            {recent.length === 0 ? (
              <p className="text-[13px] text-ink-soft">Nothing decided yet.</p>
            ) : (
              <ul className="space-y-3">
                {recent.map((e) => (
                  <li key={e.id} className="text-[13px] leading-snug">
                    <span className="font-mono text-xs text-ink-faint">{fmtDateTimeSeconds(e.at)}</span>
                    <p className="mt-0.5 text-ink-soft">{e.text}</p>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/activity" className="mt-3 inline-block text-[13px] font-medium text-accent-strong hover:underline">
              Full activity log
            </Link>
          </Card>

          <Card>
            <CardTitle title="How statuses work" />
            <ul className="space-y-2 text-[13px] leading-relaxed text-ink-soft">
              <li>
                <Badge tone="neutral">Awaiting your decision</Badge> Suggested by Rerack. Nothing is decided.
              </li>
              <li>
                <Badge tone="amber">Approved · awaiting stock verification</Badge> You approved a transfer. Count the stock, then mark it verified.
              </li>
              <li>
                <Badge tone="accent">Approved</Badge> Your decision is recorded here.
              </li>
              <li>
                <Badge tone="risk">Rejected</Badge> Recorded, with your reason if you gave one.
              </li>
            </ul>
            <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-faint">
              <Boxes className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Approving never moves stock or changes a price.
            </p>
          </Card>
        </aside>
      </div>
    </>
  );
}
