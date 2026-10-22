"use client";

import { useState } from "react";
import { History, Trash2, Upload } from "lucide-react";
import { Badge, Button, Callout, Card, CardTitle, EmptyState, Modal, PageHeader, PageSkeleton } from "@/components/ui";
import { RiskBadge } from "@/components/status";
import { clearEverything, useAppState, useHydrated, type ActivityKind } from "@/lib/appState";
import { fmtDateTimeSeconds, fmtInt } from "@/lib/format";
import { describeWindow } from "@/lib/client";
import { toast } from "@/lib/toast";

const KIND: Record<ActivityKind, { label: string; tone: "accent" | "risk" | "amber" | "info" | "neutral" }> = {
  import: { label: "Import", tone: "info" },
  approved: { label: "Approved", tone: "accent" },
  rejected: { label: "Rejected", tone: "risk" },
  verified: { label: "Verified", tone: "accent" },
  undo: { label: "Undone", tone: "neutral" },
  rules: { label: "Rules", tone: "amber" },
  window: { label: "Window", tone: "info" },
  reset: { label: "Cleared", tone: "neutral" },
};

export default function ActivityPage() {
  const { dataset, decisions, activity, lines } = useAppState();
  const hydrated = useHydrated();
  const [confirmClear, setConfirmClear] = useState(false);

  if (!hydrated) return <PageSkeleton />;
  if (!dataset && activity.length === 0) {
    return (
      <>
        <PageHeader title="Activity & reports" subtitle="What was imported, what was proposed, and what you decided." />
        <EmptyState
          icon={<History className="size-6" aria-hidden />}
          title="Nothing to report yet"
          actions={
            <Button variant="primary" href="/import">
              <Upload className="size-4" aria-hidden /> Add store files
            </Button>
          }
        >
          Once you import data and make decisions, a time-stamped record appears here.
        </EmptyState>
      </>
    );
  }

  const shown = dataset?.actions ?? [];
  const approved = shown.filter((a) => decisions[a.candidate.id]?.status === "approved").length;
  const rejected = shown.filter((a) => decisions[a.candidate.id]?.status === "rejected").length;
  const edited = shown.filter((a) => decisions[a.candidate.id]?.edited).length;
  const awaiting = shown.length - approved - rejected;
  const topRisks = [...lines]
    .filter((l) => l.risk === "at_risk")
    .sort((a, b) => b.onHand * b.daysOld - a.onHand * a.daysOld)
    .slice(0, 6);

  return (
    <>
      <PageHeader
        title="Activity & reports"
        subtitle="A record of what was imported, what Rerack proposed and what you decided. It only reports what has actually been recorded."
        actions={
          <Button variant="danger" onClick={() => setConfirmClear(true)}>
            <Trash2 className="size-4" aria-hidden /> Clear data on this device
          </Button>
        }
      />

      {dataset && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              { label: "Files uploaded", value: dataset.files.length },
              { label: "Data warnings", value: dataset.warnings.length },
              { label: "Actions proposed", value: shown.length, sub: `of ${dataset.candidates.length} found` },
              { label: "Approved", value: approved, sub: edited ? `${edited} edited` : undefined },
              { label: "Rejected", value: rejected, sub: `${awaiting} awaiting` },
            ].map((s) => (
              <Card key={s.label} className="!p-4">
                <p className="text-xs font-medium text-ink-soft">{s.label}</p>
                <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-ink">{s.value}</p>
                {s.sub && <p className="text-xs text-ink-soft">{s.sub}</p>}
              </Card>
            ))}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardTitle title="Files in this import" hint={`${dataset.businessName}${dataset.source === "demo" ? " (demo data)" : ""}, processed ${fmtDateTimeSeconds(dataset.processedAt)}. Sales window: ${describeWindow(dataset.window)}.`} />
              <table className="w-full text-left text-[13px]">
                <thead className="text-xs text-ink-soft">
                  <tr>
                    <th className="py-1.5 pr-3 font-medium">Store</th>
                    <th className="px-3 py-1.5 font-medium">File</th>
                    <th className="py-1.5 pl-3 text-right font-medium">Rows</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {dataset.files.map((f) => (
                    <tr key={f.name}>
                      <td className="py-2 pr-3 font-medium text-ink">{f.store}</td>
                      <td className="px-3 py-2 text-ink-soft">{f.name}</td>
                      <td className="py-2 pl-3 text-right tabular-nums">{fmtInt(f.rows)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h3 className="mb-2 mt-5 text-[13px] font-semibold text-ink">Data quality</h3>
              {dataset.warnings.length === 0 ? (
                <Callout tone="accent">No data-quality issues were found in these files.</Callout>
              ) : (
                <ul className="space-y-1.5 text-[13px] text-ink-soft">
                  {dataset.warnings.map((w, i) => (
                    <li key={i}>
                      <span className="font-medium text-ink">{w.file}:</span> {w.message}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardTitle title="Biggest inventory risks" hint="Old stock that is barely selling, biggest first (units × days since receipt)." />
              {topRisks.length === 0 ? (
                <p className="text-sm text-ink-soft">Nothing is classified At risk under the current rules.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {topRisks.map((l) => (
                    <li key={l.id} className="flex items-start justify-between gap-3 py-2.5">
                      <div>
                        <p className="text-sm font-medium text-ink">
                          {l.colour} {l.item}, size {l.size}
                        </p>
                        <p className="text-xs text-ink-soft">
                          {l.store}: {l.onHand} on hand, sold {l.sold}, {l.daysOld} days since receipt
                        </p>
                      </div>
                      <RiskBadge risk={l.risk} />
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-xs leading-relaxed text-ink-faint">
                Rerack doesn&rsquo;t report savings, completed transfers or markdown results. It doesn&rsquo;t track outcomes yet, so it won&rsquo;t claim any.
              </p>
            </Card>
          </div>
        </>
      )}

      <Card className="mt-6" padded={false}>
        <div className="p-5 pb-3">
          <CardTitle title="Activity log" hint="Imports and every decision, newest first. Saved on this device only." />
        </div>
        {activity.length === 0 ? (
          <p className="border-t border-line px-5 py-8 text-center text-sm text-ink-soft">No activity yet.</p>
        ) : (
          <div className="overflow-x-auto border-t border-line">
            <table className="w-full min-w-[560px] text-left text-[13px]">
              <thead className="bg-paper/70 text-xs text-ink-soft">
                <tr>
                  <th className="whitespace-nowrap px-5 py-2.5 font-medium">When</th>
                  <th className="px-3 py-2.5 font-medium">Event</th>
                  <th className="px-3 py-2.5 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {activity.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap px-5 py-2.5 font-mono text-xs text-ink-soft">{fmtDateTimeSeconds(e.at)}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={KIND[e.kind].tone}>{KIND[e.kind].label}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-ink-soft">
                      {e.actionId && <span className="mr-1.5 font-mono text-xs text-ink-faint">{e.actionId}</span>}
                      {e.text}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear everything on this device?"
        footer={
          <>
            <Button onClick={() => setConfirmClear(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                clearEverything();
                setConfirmClear(false);
                toast("Cleared. Your original CSV files on your computer are untouched.", "info");
              }}
            >
              <Trash2 className="size-4" aria-hidden /> Clear everything
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-soft">
          This removes the imported data, your decisions and the activity log from this browser. Your CSV files on your computer are not touched, and your rules are kept.
        </p>
      </Modal>
    </>
  );
}
