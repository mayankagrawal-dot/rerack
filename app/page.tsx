"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  Boxes,
  CalendarRange,
  Check,
  ClipboardCheck,
  Flag,
  ListChecks,
  Loader2,
  Sparkles,
  Tag,
  TriangleAlert,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { AgeChart, ProductRiskChart, StoreCompareChart } from "@/components/charts";
import ChartDateFilter from "@/components/ChartDateFilter";
import { priorityOf, StatusBadge, TypeBadge } from "@/components/status";
import { Badge, Button, Callout, Card, CardTitle, PageSkeleton, Tip, cx } from "@/components/ui";
import { headlineFor } from "@/lib/actionText";
import { useAppState, useHydrated } from "@/lib/appState";
import { filterByReceived, useChartRange } from "@/lib/chartRange";
import { describeWindow, runDemo } from "@/lib/client";
import { ageDistribution, computeKpis, crossStoreInsights, productRisk, storeSummaries } from "@/lib/derive";
import { fmtAgo, fmtInt } from "@/lib/format";
import { toast } from "@/lib/toast";
import { windowDates, windowLabel } from "@/lib/window";
import { openWindowDialog } from "@/lib/windowUi";

const KPI_TONE = {
  risk: { text: "text-risk", chip: "bg-risk-soft text-risk" },
  amber: { text: "text-amber", chip: "bg-amber-soft text-amber" },
  accent: { text: "text-accent-strong", chip: "bg-accent-soft text-accent-strong" },
  info: { text: "text-ink", chip: "bg-info-soft text-info" },
  neutral: { text: "text-ink", chip: "bg-paper text-ink-soft" },
};

function Kpi({
  label,
  tip,
  value,
  caption,
  tone = "neutral",
  icon: Icon,
}: {
  label: string;
  tip: ReactNode;
  value: ReactNode;
  caption: ReactNode;
  tone?: keyof typeof KPI_TONE;
  icon: LucideIcon;
}) {
  const t = KPI_TONE[tone];
  return (
    <Card className="flex flex-col transition-shadow hover:shadow-lift">
      <div className="flex items-start justify-between gap-2">
        <span className={cx("flex size-9 items-center justify-center rounded-xl", t.chip)}>
          <Icon className="size-[18px]" aria-hidden />
        </span>
        <Tip text={tip} />
      </div>
      <p className="mt-4 text-[13px] font-medium text-ink-soft">{label}</p>
      <p className={cx("mt-1 font-display text-[34px] font-semibold leading-none tracking-tight tabular-nums", t.text)}>{value}</p>
      <p className="mt-2.5 text-xs leading-snug text-ink-soft">{caption}</p>
    </Card>
  );
}

// A sample of what an action looks like, for the welcome page. Its numbers come from the fictional demo chain.
function SamplePreview() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:mx-0" aria-hidden>
      <div className="absolute -inset-y-6 inset-x-0 rounded-[32px] bg-[radial-gradient(closest-side,rgba(11,122,99,0.16),transparent)] sm:-inset-x-6" />
      <div className="absolute left-6 right-6 top-6 h-full rotate-[3deg] rounded-2xl border border-line bg-card/70 shadow-card" />
      <div className="relative rounded-2xl border border-line bg-card p-5 shadow-lift">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">This week&rsquo;s list</span>
          <Badge tone="info">Transfer</Badge>
        </div>
        <p className="mt-3 font-display text-xl font-semibold leading-snug text-ink">Move 12 Navy Kurta, size M, from Jayanagar to Whitefield</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge tone="accent">Strong evidence</Badge>
          <Badge tone="neutral">Awaiting your decision</Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-paper px-3 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">Jayanagar</p>
            <p className="mt-0.5 text-sm font-semibold text-ink">12 on hand · 0 sold</p>
          </div>
          <div className="rounded-xl bg-accent-soft px-3 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-accent-strong">Whitefield</p>
            <p className="mt-0.5 text-sm font-semibold text-ink">3 on hand · 14 sold</p>
          </div>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
          <span className="font-medium text-ink">Why:</span> Whitefield sold 14 in 4 weeks; Jayanagar sold none, and its stock is 84 days old.
        </p>
        <div className="mt-4 flex gap-2">
          <span className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent text-[13px] font-medium text-white">
            <Check className="size-4" /> Approve
          </span>
          <span className="inline-flex min-h-9 flex-1 items-center justify-center rounded-lg border border-line-strong text-[13px] font-medium text-ink">Edit</span>
          <span className="inline-flex min-h-9 flex-1 items-center justify-center rounded-lg border border-line-strong text-[13px] font-medium text-ink">Reject</span>
        </div>
      </div>
      <p className="relative mt-3 text-center text-[11.5px] text-ink-faint lg:text-left">Example from the fictional demo chain, with 4 weeks of sales</p>
    </div>
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
    <div className="mx-auto max-w-6xl pt-2 sm:pt-6">
      <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
      <div>
      <Badge tone="accent">AI-assisted inventory decisions for multi-store fashion retailers</Badge>
      <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.06] tracking-tight text-ink sm:text-[56px]">
        Know what to move, what to mark down, and what to save{" "}
        <span className="bg-gradient-to-r from-accent to-[#2b9c82] bg-clip-text text-transparent">before the season ends.</span>
      </h1>
      <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
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
      </div>
      <SamplePreview />
      </div>

      <div className="mt-16 grid gap-4 sm:grid-cols-3">
        {[
          { icon: Upload, title: "Upload", text: "One CSV per store: item, size, colour, date received, units on hand, and units sold over a sales window you choose." },
          { icon: Boxes, title: "Code does the maths", text: "Days since receipt, weeks of stock left and sell-through are calculated by code, never by the AI." },
          { icon: ListChecks, title: "You decide", text: "Up to 10 ranked actions with evidence. Approve, edit or reject each one, from your phone if you like." },
        ].map((s, i) => (
          <Card key={s.title} className="relative overflow-hidden">
            <span className="absolute right-4 top-3 font-display text-5xl font-semibold text-line">{i + 1}</span>
            <span className="mb-4 flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <s.icon className="size-5" aria-hidden />
            </span>
            <h2 className="text-[15px] font-semibold text-ink">
              {i + 1}. {s.title}
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{s.text}</p>
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
      <section className="relative mb-7 overflow-hidden rounded-3xl bg-rail px-6 py-7 text-white shadow-lift sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_300px_at_100%_0%,rgba(95,211,179,0.22),transparent_70%),radial-gradient(400px_240px_at_0%_100%,rgba(43,95,176,0.25),transparent_70%)]" />
        <div className="relative flex flex-col gap-6 2xl:flex-row 2xl:items-end 2xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mint">Overview</p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-[40px] sm:leading-[1.1]">{dataset.businessName}</h1>
            <div className="mt-4 flex flex-wrap gap-2 text-[13px] text-[#d5dcea]">
              {[
                `${kpis.storeCount} stores`,
                `${fmtInt(kpis.lineCount)} stock lines`,
                `Sales ${describeWindow(dataset.window)}`,
                `Processed ${fmtAgo(dataset.processedAt)}`,
              ].map((t) => (
                <span key={t} className="rounded-full bg-white/[0.08] px-3 py-1 ring-1 ring-inset ring-white/10">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openWindowDialog}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/[0.08] px-4 text-sm font-medium text-white ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/[0.14]"
            >
              <CalendarRange className="size-4 text-mint" aria-hidden /> Change sales window
            </button>
            <Link
              href="/actions"
              className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-mint px-5 text-[15px] font-semibold text-rail shadow-[0_8px_24px_-8px_rgba(95,211,179,0.7)] transition-transform hover:-translate-y-px"
            >
              <ClipboardCheck className="size-4" aria-hidden /> Review this week&rsquo;s actions
              {open > 0 && <span className="rounded-full bg-rail/15 px-2 py-0.5 text-xs tabular-nums">{open}</span>}
            </Link>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        <Kpi
          icon={Boxes}
          tone="info"
          label="Units in stock"
          tip="Total units on hand across every store in the uploaded files."
          value={fmtInt(kpis.unitsInStock)}
          caption={`${kpis.storeCount} stores · from your uploaded files`}
        />
        <Kpi
          icon={TriangleAlert}
          label="Units at risk"
          tip={`Units that are ${dataset.thresholds.markdownMinDays}+ days since receipt and hold ${dataset.thresholds.markdownMinChainCoverWeeks}+ weeks of stock at that store (or have no sales). You can change these rules.`}
          value={fmtInt(kpis.unitsAtRisk)}
          tone={kpis.unitsAtRisk > 0 ? "risk" : undefined}
          caption="Old stock that is barely selling"
        />
        <Kpi
          icon={Flag}
          label="Lines flagged"
          tip="A line is one store's stock of one item, size and colour. Flagged = At risk or Watch."
          value={fmtInt(kpis.linesFlagged)}
          tone={kpis.linesFlagged > 0 ? "amber" : undefined}
          caption={`of ${fmtInt(kpis.lineCount)} lines need a look`}
        />
        <Kpi
          icon={ArrowLeftRight}
          label="Transfer opportunities"
          tip="Places where one store holds stock that isn't selling while another store is selling the same item and size and running low."
          value={fmtInt(kpis.moveOpportunities)}
          tone="accent"
          caption={`${fmtInt(kpis.movableUnits)} units could move between stores`}
        />
        <Kpi
          icon={Tag}
          label="Markdown candidates"
          tip="Styles that are old everywhere and selling slowly across the whole chain. Rupee exposure can't be shown because the CSV template has no price or cost."
          value={fmtInt(kpis.markdownStyles)}
          caption={`${fmtInt(kpis.markdownUnits)} units · ₹ value needs price and cost data`}
        />
        <Kpi
          icon={ClipboardCheck}
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
