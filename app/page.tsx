"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowRight, ArrowLeftRight, Boxes, CalendarRange, ClipboardCheck, ListChecks, Loader2, Sparkles, Upload } from "lucide-react";
import { AgeChart, ProductRiskChart, StoreCompareChart } from "@/components/charts";
import ChartDateFilter from "@/components/ChartDateFilter";
import { priorityOf, StatusBadge, TypeBadge } from "@/components/status";
import { Badge, Button, Callout, Card, CardTitle, PageHeader, PageSkeleton, Tip, cx } from "@/components/ui";
import { headlineFor } from "@/lib/actionText";
import { useAppState, useHydrated } from "@/lib/appState";
import { filterByReceived, useChartRange } from "@/lib/chartRange";
import { describeWindow, runDemo } from "@/lib/client";
import { ageDistribution, computeKpis, crossStoreInsights, productRisk, storeSummaries } from "@/lib/derive";
import { fmtAgo, fmtInt } from "@/lib/format";
import { toast } from "@/lib/toast";
import { windowDates, windowLabel } from "@/lib/window";
import { openWindowDialog } from "@/lib/windowUi";

function Kpi({
  label,
  tip,
  value,
  caption,
  tone,
}: {
  label: string;
  tip: ReactNode;
  value: ReactNode;
  caption: ReactNode;
  tone?: "risk" | "amber" | "accent";
}) {
  return (
    <Card className="flex flex-col">
      <p className="flex items-center gap-1 text-[13px] font-medium text-ink-soft">
        {label}
        <Tip text={tip} />
      </p>
      <p
        className={cx(
          "mt-2 font-display text-[34px] font-semibold leading-none tracking-tight tabular-nums",
          tone === "risk" ? "text-risk" : tone === "amber" ? "text-amber" : tone === "accent" ? "text-accent-strong" : "text-ink"
        )}
      >
        {value}
      </p>
      <p className="mt-2 text-xs leading-snug text-ink-soft">{caption}</p>
    </Card>
  );
}

function EmptyHome() {
  const { thresholds, salesWindow } = useAppState();
  const [loading, setLoading] = useState(false);

  async function explore() {
    setLoading(true);
    const res = await runDemo(thresholds, salesWindow);
    setLoading(false);
    if (!res.ok) toast(res.errors[0]?.message ?? "Couldn't load the demo.", "warn");
    else toast("Demo loaded. This is a fictional retailer.", "info");
  }

  return (
    <div className="mx-auto max-w-3xl pt-4 sm:pt-10">
      <Badge tone="accent">AI-assisted inventory decisions for multi-store fashion retailers</Badge>
      <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-6xl">
        Know what to move, what to mark down, and what to save before the season ends.
      </h1>
      <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-soft sm:text-lg">
        Upload each store&rsquo;s stock file. Rerack calculates how long every item has sat and how fast it sells, then hands you a short list of
        transfers and markdowns, each with the numbers behind it. You approve, edit or reject.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button variant="primary" size="lg" onClick={explore} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
          {loading ? "Loading the demo..." : "Explore the demo"}
        </Button>
        <Button size="lg" href="/import">
          <Upload className="size-4" aria-hidden /> Upload your store files
        </Button>
      </div>
      <p className="mt-3 text-xs text-ink-faint">
        The demo is a fictional chain, Northstar Apparel, and goes through exactly the same checks as a real upload.
      </p>
      <button
        type="button"
        onClick={openWindowDialog}
        className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-line-strong bg-card px-3.5 text-sm font-medium text-ink hover:border-accent"
      >
        <CalendarRange className="size-4 text-accent" aria-hidden />
        Sales window: {salesWindow ? (windowDates(salesWindow.start, salesWindow.end) ?? "custom dates") : "last 4 weeks"}
        <span className="text-accent-strong">Change</span>
      </button>

      <div className="mt-14 grid gap-4 sm:grid-cols-3">
        {[
          { icon: Upload, title: "1. Upload", text: "One CSV per store: item, size, colour, date received, units on hand, and units sold over a sales window you choose." },
          { icon: Boxes, title: "2. Code does the maths", text: "Days since receipt, weeks of stock left and sell-through are calculated by code, never by the AI." },
          { icon: ListChecks, title: "3. You decide", text: "Up to 10 ranked actions with evidence. Approve, edit or reject each one, from your phone if you like." },
        ].map((s) => (
          <Card key={s.title}>
            <s.icon className="mb-3 size-5 text-accent" aria-hidden />
            <h2 className="text-sm font-semibold text-ink">{s.title}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{s.text}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6">
        <Callout tone="info" title="What this first version does and doesn't do">
          It works from the CSV files you upload. It doesn&rsquo;t connect to billing software, send messages to store managers, move stock or change
          prices. Approving an action records your decision.
        </Callout>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const { dataset, decisions, lines, styles } = useAppState();
  const hydrated = useHydrated();
  const range = useChartRange();

  const view = useMemo(() => {
    if (!dataset) return null;
    // The charts follow the date filter; the KPI numbers always cover all stock.
    const chartLines = filterByReceived(lines, range, dataset.processedAt);
    const allStores = [...new Set(lines.map((l) => l.store))].sort();
    return {
      kpis: computeKpis(lines, dataset.candidates),
      chartLines,
      chartUnits: chartLines.reduce((s, l) => s + l.onHand, 0),
      stores: storeSummaries(chartLines, allStores),
      age: ageDistribution(chartLines),
      products: productRisk(chartLines).filter((p) => p.atRisk + p.watch > 0),
      insights: crossStoreInsights(styles, 5),
    };
  }, [dataset, lines, styles, range]);

  if (!hydrated) return <PageSkeleton />;
  if (!dataset || !view) return <EmptyHome />;

  const { kpis } = view;
  const wl = windowLabel(dataset.window.days);
  const open = dataset.actions.filter((a) => !decisions[a.candidate.id]).length;

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle={
          <>
            {dataset.businessName} · {kpis.storeCount} stores · {fmtInt(kpis.lineCount)} stock lines · sales {describeWindow(dataset.window)} · data processed{" "}
            {fmtAgo(dataset.processedAt)}
          </>
        }
        actions={
          <>
            <Button onClick={openWindowDialog}>
              <CalendarRange className="size-4 text-accent" aria-hidden /> Sales window: {describeWindow(dataset.window)}
            </Button>
            <Button variant="primary" size="lg" href="/actions">
              <ClipboardCheck className="size-4" aria-hidden /> Review this week&rsquo;s actions
              {open > 0 && <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs tabular-nums">{open}</span>}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi
          label="Units in stock"
          tip="Total units on hand across every store in the uploaded files."
          value={fmtInt(kpis.unitsInStock)}
          caption={`${kpis.storeCount} stores · from your uploaded files`}
        />
        <Kpi
          label="Units at risk"
          tip={`Units that are ${dataset.thresholds.markdownMinDays}+ days since receipt and hold ${dataset.thresholds.markdownMinChainCoverWeeks}+ weeks of stock at that store (or have no sales). You can change these rules.`}
          value={fmtInt(kpis.unitsAtRisk)}
          tone={kpis.unitsAtRisk > 0 ? "risk" : undefined}
          caption="Old stock that is barely selling"
        />
        <Kpi
          label="Lines flagged"
          tip="A line is one store's stock of one item, size and colour. Flagged = At risk or Watch."
          value={fmtInt(kpis.linesFlagged)}
          tone={kpis.linesFlagged > 0 ? "amber" : undefined}
          caption={`of ${fmtInt(kpis.lineCount)} lines need a look`}
        />
        <Kpi
          label="Transfer opportunities"
          tip="Places where one store holds stock that isn't selling while another store is selling the same item and size and running low."
          value={fmtInt(kpis.moveOpportunities)}
          tone="accent"
          caption={`${fmtInt(kpis.movableUnits)} units could move between stores`}
        />
        <Kpi
          label="Markdown candidates"
          tip="Styles that are old everywhere and selling slowly across the whole chain. Rupee exposure can't be shown because the CSV template has no price or cost."
          value={fmtInt(kpis.markdownStyles)}
          caption={`${fmtInt(kpis.markdownUnits)} units · ₹ value needs price and cost data`}
        />
        <Kpi
          label="Awaiting your decision"
          tip="Actions in this week's list that you haven't approved or rejected yet."
          value={`${open} of ${dataset.actions.length}`}
          caption={open === 0 ? "All reviewed" : "Open the Action Centre to decide"}
        />
      </div>

      {dataset.warnings.length > 0 && (
        <div className="mt-4">
          <Callout tone="amber" title={`${dataset.warnings.length} data warning${dataset.warnings.length > 1 ? "s" : ""} from the import`}>
            {dataset.warnings[0].file}: {dataset.warnings[0].message}{" "}
            <Link href="/activity" className="font-medium text-accent-strong underline">
              See the full report
            </Link>
          </Callout>
        </div>
      )}

      <div className="mt-6">
        <ChartDateFilter processedAt={dataset.processedAt} totalLines={lines.length} shownLines={view.chartLines.length} shownUnits={view.chartUnits} />
      </div>

      <div className="mt-4 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardTitle title="Where stock sits and where it sells" hint={`Units on hand beside units sold in ${wl}, for each store.`} />
          <StoreCompareChart data={view.stores} soldLabel={`Sold in ${wl}`} />
        </Card>

        <Card padded={false}>
          <div className="p-5 pb-3">
            <CardTitle
              title="Top priorities this week"
              hint={dataset.usedAi ? "Ranked by the AI from candidates found by code." : "Rule-based order. The AI ranking was unavailable."}
              right={
                <Link href="/actions" className="inline-flex items-center gap-1 text-[13px] font-medium text-accent-strong hover:underline">
                  All {dataset.actions.length} <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              }
            />
          </div>
          <ol className="divide-y divide-line border-t border-line">
            {dataset.actions.slice(0, 5).map((a, i) => (
              <li key={a.candidate.id}>
                <Link href="/actions" className="flex gap-3 px-5 py-3 hover:bg-paper/70">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-snug text-ink">{headlineFor(a.candidate, decisions[a.candidate.id])}</span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <TypeBadge type={a.candidate.type} />
                      <Badge tone={priorityOf(i).tone}>{priorityOf(i).label}</Badge>
                      <StatusBadge decision={decisions[a.candidate.id]} type={a.candidate.type} />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle
            title="How old is the stock?"
            hint="Units on hand by days since receipt (from the date_received column)."
            right={<Tip text="Days since receipt is not always the true age of stock: a restock can reset the date." />}
          />
          <AgeChart data={view.age} />
        </Card>
        <Card>
          <CardTitle title="Where the risk is, by product" hint="Units at risk or on watch for each product type." />
          {view.products.length > 0 ? (
            <ProductRiskChart data={view.products} />
          ) : (
            <p className="py-10 text-center text-sm text-ink-soft">
              {view.chartLines.length === 0 ? "No stock was received in the chosen dates." : "Nothing in these dates is flagged at risk or on watch under the current rules."}
            </p>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardTitle
          title="Selling well in one store, stuck in another"
          hint="The same item and size, moving fast in one store and barely moving in another. Zero recorded sales is not proof that no one wants it."
          right={<ArrowLeftRight className="size-4 text-ink-faint" aria-hidden />}
        />
        {view.insights.length === 0 ? (
          <p className="text-sm text-ink-soft">No clear gaps between stores in this data.</p>
        ) : (
          <ul className="divide-y divide-line">
            {view.insights.map((s) => (
              <li key={s.styleKey} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                <span className="text-sm font-medium text-ink">{s.label}</span>
                <span className="text-[13px] leading-relaxed text-ink-soft">
                  <span className="font-medium text-accent-strong">{s.strongStore}</span> sold {s.strongSold} in {wl} ·{" "}
                  <span className="font-medium text-amber">{s.stuckStore}</span> holds {s.stuckOnHand}, sold {s.stuckSold}, {s.stuckDays} days since receipt
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
