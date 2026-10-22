"use client";

import { useMemo, useState } from "react";
import { Store, Upload } from "lucide-react";
import { StoreAgeChart, StoreCompareChart } from "@/components/charts";
import ChartDateFilter from "@/components/ChartDateFilter";
import { Button, Callout, Card, CardTitle, EmptyState, PageHeader, PageSkeleton, Segmented, Tip } from "@/components/ui";
import { useAppState, useHydrated } from "@/lib/appState";
import { filterByReceived, useChartRange } from "@/lib/chartRange";
import { crossStoreInsights, storeAgeStack, storeMatrix, storeSummaries, type MatrixMetric } from "@/lib/derive";
import { fmtInt } from "@/lib/format";
import { windowLabel, windowShort } from "@/lib/window";

const METRICS: { value: MatrixMetric; label: string; explain: string }[] = [
  { value: "sold", label: "Sold in the window", explain: "Units sold in the sales window. Where is this product selling?" },
  { value: "onHand", label: "On hand", explain: "Units currently held. Where is the stock sitting?" },
  { value: "ageing", label: "Held 60+ days", explain: "Units that are 60 or more days since receipt. Where is it getting stuck?" },
];

export default function StoresPage() {
  const { dataset, lines, styles } = useAppState();
  const hydrated = useHydrated();
  const [metric, setMetric] = useState<MatrixMetric>("sold");
  const range = useChartRange();

  const view = useMemo(() => {
    // The store cards always cover all stock. The charts and the matrix follow the date filter.
    const chartLines = dataset ? filterByReceived(lines, range, dataset.processedAt) : lines;
    const allStores = [...new Set(lines.map((l) => l.store))].sort();
    return {
      summaries: storeSummaries(lines),
      chartSummaries: storeSummaries(chartLines, allStores),
      chartLines,
      chartUnits: chartLines.reduce((s, l) => s + l.onHand, 0),
      stack: storeAgeStack(chartLines, allStores),
      matrix: storeMatrix(chartLines, metric, allStores),
      insights: crossStoreInsights(styles, 12),
    };
  }, [dataset, lines, styles, metric, range]);

  if (!hydrated) return <PageSkeleton />;
  if (!dataset) {
    return (
      <>
        <PageHeader title="Stores" subtitle="Where each product sells, and where it gets stuck." />
        <EmptyState
          icon={<Store className="size-6" aria-hidden />}
          title="No store data yet"
          actions={
            <Button variant="primary" href="/import">
              <Upload className="size-4" aria-hidden /> Add store files
            </Button>
          }
        >
          Upload at least two stores&rsquo; files and Rerack will compare them side by side.
        </EmptyState>
      </>
    );
  }

  const ws = windowShort(dataset.window.days);
  const wl = windowLabel(dataset.window.days);
  const { matrix } = view;
  const current = METRICS.find((m) => m.value === metric)!;

  return (
    <>
      <PageHeader title="Stores" subtitle="Where is each product selling, and where is it getting stuck? Everything here is calculated from your uploaded files." />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {view.summaries.map((s) => (
          <Card key={s.store} className="!p-4">
            <p className="text-sm font-semibold text-ink">{s.store}</p>
            <dl className="mt-3 space-y-1.5 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-ink-soft">On hand</dt>
                <dd className="font-medium tabular-nums">{fmtInt(s.onHand)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">Sold ({ws})</dt>
                <dd className="font-medium tabular-nums text-accent-strong">{fmtInt(s.sold)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">Held 60+ days</dt>
                <dd className="font-medium tabular-nums text-amber">{fmtInt(s.ageing)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">At risk</dt>
                <dd className="font-medium tabular-nums text-risk">{fmtInt(s.atRisk)}</dd>
              </div>
            </dl>
          </Card>
        ))}
      </div>

      <div className="mt-6">
        <ChartDateFilter processedAt={dataset.processedAt} totalLines={lines.length} shownLines={view.chartLines.length} shownUnits={view.chartUnits} />
      </div>

      <div className="mt-4 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardTitle title="Stock held against sales" hint={`Units on hand beside units sold in ${wl}.`} />
          <StoreCompareChart data={view.chartSummaries} soldLabel={`Sold in ${wl}`} />
        </Card>
        <Card>
          <CardTitle title="Ageing stock by store" hint="Units on hand, split by days since receipt." />
          <StoreAgeChart data={view.stack} />
        </Card>
      </div>

      <Card className="mt-6">
        <CardTitle
          title="Product by store"
          hint={current.explain}
          right={<Segmented label="Choose a measure" value={metric} onChange={setMetric} options={METRICS.map((m) => ({ value: m.value, label: m.label }))} />}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-separate border-spacing-1 text-sm">
            <caption className="sr-only">{current.label} by product and store</caption>
            <thead>
              <tr className="text-xs text-ink-soft">
                <th scope="col" className="px-2 py-1.5 text-left font-medium">
                  Product
                </th>
                {matrix.stores.map((s) => (
                  <th key={s} scope="col" className="px-2 py-1.5 text-right font-medium">
                    {s}
                  </th>
                ))}
                <th scope="col" className="px-2 py-1.5 text-right font-medium">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {matrix.rows.map((r) => (
                <tr key={r.item}>
                  <th scope="row" className="px-2 py-1.5 text-left font-medium text-ink">
                    {r.item}
                  </th>
                  {r.values.map((v, i) => {
                    const alpha = v === 0 ? 0 : 0.12 + (v / matrix.max) * 0.7;
                    const colour = metric === "sold" ? "11,122,99" : metric === "onHand" ? "26,39,72" : "154,82,8";
                    return (
                      <td
                        key={matrix.stores[i]}
                        className="rounded-md px-2 py-2 text-right text-ink"
                        style={{ background: v === 0 ? "transparent" : `rgba(${colour},${alpha.toFixed(2)})`, color: alpha > 0.55 ? "#fff" : undefined }}
                      >
                        {v === 0 ? <span className="text-ink-faint">0</span> : v}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-right font-semibold text-ink">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-ink-faint">A 0 means nothing was recorded. For sales, that is not proof that nobody wants the product there.</p>
      </Card>

      <Card className="mt-6">
        <CardTitle
          title="Selling well in one store, stuck in another"
          hint="Same item, size and colour, with a big difference between stores."
          right={<Tip text={`Shown when one store sold 5 or more in ${wl} and another holds 3 or more, sold at most 1, and received the stock over 30 days ago.`} />}
        />
        {view.insights.length === 0 ? (
          <Callout tone="info">No clear gaps between stores in this data.</Callout>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead className="text-xs text-ink-soft">
                <tr>
                  <th className="py-2 pr-3 font-medium">Variant</th>
                  <th className="px-3 py-2 font-medium">Selling well at</th>
                  <th className="px-3 py-2 font-medium">Stuck at</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {view.insights.map((s) => (
                  <tr key={s.styleKey}>
                    <td className="py-2.5 pr-3 font-medium text-ink">{s.label}</td>
                    <td className="px-3 py-2.5 text-ink-soft">
                      <span className="font-medium text-accent-strong">{s.strongStore}</span>: sold {s.strongSold} in {wl}
                    </td>
                    <td className="px-3 py-2.5 text-ink-soft">
                      <span className="font-medium text-amber">{s.stuckStore}</span>: {s.stuckOnHand} on hand, sold {s.stuckSold}, {s.stuckDays} days since receipt
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
