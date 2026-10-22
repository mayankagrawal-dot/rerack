"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Boxes, ChevronLeft, ChevronRight, Search, Upload, X } from "lucide-react";
import { RiskBadge, StatusBadge } from "@/components/status";
import { Badge, Button, Card, EmptyState, Modal, PageHeader, PageSkeleton, Tip, cx } from "@/components/ui";
import { headlineFor } from "@/lib/actionText";
import { useAppState, useHydrated } from "@/lib/appState";
import { ageBucketIndex, AGE_BUCKETS } from "@/lib/derive";
import { fmtInt, fmtPct, fmtWeeks } from "@/lib/format";
import { windowShort } from "@/lib/window";
import { RISK_LABEL, RISK_RULE } from "@/lib/risk";
import type { InventoryLine, Risk } from "@/lib/types";

type SortKey = "label" | "size" | "store" | "onHand" | "sold" | "daysOld" | "coverWeeks" | "sellThrough" | "risk";
const RISK_ORDER: Record<Risk, number> = { at_risk: 0, watch: 1, new: 2, ok: 3, fast: 4 };
const PAGE_SIZE = 25;

function sortValue(l: InventoryLine, key: SortKey): number | string {
  switch (key) {
    case "label":
      return `${l.item} ${l.colour}`.toLowerCase();
    case "size":
      return l.size;
    case "store":
      return l.store;
    case "coverWeeks":
      return l.coverWeeks === null ? Number.POSITIVE_INFINITY : l.coverWeeks;
    case "sellThrough":
      return l.sellThrough ?? -1;
    case "risk":
      return RISK_ORDER[l.risk];
    default:
      return l[key];
  }
}

function SortHead({
  k,
  label,
  right,
  sort,
  onSort,
}: {
  k: SortKey;
  label: string;
  right?: boolean;
  sort: { key: SortKey; dir: 1 | -1 };
  onSort: (k: SortKey) => void;
}) {
  const active = sort.key === k;
  return (
    <th scope="col" aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"} className={cx("whitespace-nowrap px-2.5 py-2.5 font-medium", right && "text-right")}>
      <button type="button" onClick={() => onSort(k)} className={cx("inline-flex items-center gap-1 hover:text-ink", right && "flex-row-reverse", active && "text-ink")}>
        {label}
        {active ? sort.dir === 1 ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden /> : <ArrowUpDown className="size-3 opacity-40" aria-hidden />}
      </button>
    </th>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-10 rounded-lg border border-line-strong bg-card px-2.5 text-sm font-normal text-ink"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function InventoryPage() {
  const { dataset, decisions, lines, styles } = useAppState();
  const hydrated = useHydrated();
  const [q, setQ] = useState("");
  const [store, setStore] = useState("");
  const [item, setItem] = useState("");
  const [size, setSize] = useState("");
  const [colour, setColour] = useState("");
  const [age, setAge] = useState("");
  const [risk, setRisk] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "risk", dir: 1 });
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<InventoryLine | null>(null);

  const opts = useMemo(() => {
    const uniq = (f: (l: InventoryLine) => string) => [...new Set(lines.map(f))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return { stores: uniq((l) => l.store), items: uniq((l) => l.item), sizes: uniq((l) => l.size), colours: uniq((l) => l.colour) };
  }, [lines]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return lines
      .filter((l) => (store ? l.store === store : true))
      .filter((l) => (item ? l.item === item : true))
      .filter((l) => (size ? l.size === size : true))
      .filter((l) => (colour ? l.colour === colour : true))
      .filter((l) => (age ? AGE_BUCKETS[ageBucketIndex(l.daysOld)] === age : true))
      .filter((l) => (risk ? l.risk === risk : true))
      .filter((l) => (needle ? `${l.item} ${l.colour} ${l.size} ${l.store}`.toLowerCase().includes(needle) : true))
      .sort((a, b) => {
        const x = sortValue(a, sort.key);
        const y = sortValue(b, sort.key);
        const cmp = typeof x === "string" && typeof y === "string" ? x.localeCompare(y, undefined, { numeric: true }) : (x as number) - (y as number);
        return (cmp || b.onHand - a.onHand) * sort.dir;
      });
  }, [lines, q, store, item, size, colour, age, risk, sort]);

  const filtersActive = Boolean(q || store || item || size || colour || age || risk);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const unitsShown = filtered.reduce((s, l) => s + l.onHand, 0);

  function resetFilters() {
    setQ("");
    setStore("");
    setItem("");
    setSize("");
    setColour("");
    setAge("");
    setRisk("");
    setPage(0);
  }

  function setFilter(fn: (v: string) => void) {
    return (v: string) => {
      fn(v);
      setPage(0);
    };
  }

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }));
  }

  if (!hydrated) return <PageSkeleton />;
  if (!dataset) {
    return (
      <>
        <PageHeader title="Inventory" subtitle="Every store's stock by item, size and colour." />
        <EmptyState
          icon={<Boxes className="size-6" aria-hidden />}
          title="No inventory loaded"
          actions={
            <Button variant="primary" href="/import">
              <Upload className="size-4" aria-hidden /> Add store files
            </Button>
          }
        >
          Upload your store files or load the demo to explore stock by store, size, colour and age.
        </EmptyState>
      </>
    );
  }

  const ws = windowShort(dataset.window.days);
  const head = (k: SortKey, label: string, right?: boolean) => (
    <SortHead key={k} k={k} label={label} right={right} sort={sort} onSort={toggleSort} />
  );

  const selectedStyle = selected ? styles.find((s) => s.key === selected.styleKey) : null;
  const related = selected ? dataset.candidates.filter((c) => c.styleKey === selected.styleKey) : [];

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Every store's stock by item, size and colour, with its age, sales pace and risk. Select a row for the full picture."
      />

      <Card className="mb-4">
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="Search item, colour, size or store"
            aria-label="Search inventory"
            className="min-h-11 w-full rounded-lg border border-line-strong bg-card pl-9 pr-3 text-sm text-ink"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Select label="Store" value={store} onChange={setFilter(setStore)} options={opts.stores} />
          <Select label="Product" value={item} onChange={setFilter(setItem)} options={opts.items} />
          <Select label="Size" value={size} onChange={setFilter(setSize)} options={opts.sizes} />
          <Select label="Colour" value={colour} onChange={setFilter(setColour)} options={opts.colours} />
          <Select label="Days since receipt" value={age} onChange={setFilter(setAge)} options={[...AGE_BUCKETS]} />
        </div>
        <RiskFilter value={risk} onChange={setFilter(setRisk)} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[13px] text-ink-soft">
          <span>
            Showing <strong className="text-ink tabular-nums">{fmtInt(filtered.length)}</strong> of {fmtInt(lines.length)} lines ·{" "}
            <strong className="text-ink tabular-nums">{fmtInt(unitsShown)}</strong> units
          </span>
          {filtersActive && (
            <button type="button" onClick={resetFilters} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 font-medium text-accent-strong hover:bg-accent-soft">
              <X className="size-3.5" aria-hidden /> Reset filters
            </button>
          )}
        </div>
      </Card>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <caption className="sr-only">Inventory by store, item, size and colour</caption>
            <thead className="border-b border-line bg-paper/70 text-xs text-ink-soft">
              <tr>
                {head("label", "Product")}
                {head("size", "Size")}
                {head("store", "Store")}
                {head("onHand", "On hand", true)}
                {head("sold", `Sold (${ws})`, true)}
                {head("daysOld", "Days since receipt", true)}
                {head("coverWeeks", "Stock cover", true)}
                {head("sellThrough", "Sell-through", true)}
                {head("risk", "Risk")}
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {pageRows.map((l) => (
                <tr key={l.id} className="cursor-pointer hover:bg-paper/60" onClick={() => setSelected(l)}>
                  <td className="whitespace-nowrap px-2.5 py-2.5 font-medium text-ink">
                    <button type="button" onClick={() => setSelected(l)} className="text-left hover:underline focus-visible:underline">
                      {l.colour} {l.item}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2.5">{l.size}</td>
                  <td className="whitespace-nowrap px-2.5 py-2.5">{l.store}</td>
                  <td className="px-2.5 py-2.5 text-right">{l.onHand}</td>
                  <td className="px-2.5 py-2.5 text-right">{l.sold}</td>
                  <td className="px-2.5 py-2.5 text-right">{l.daysOld}</td>
                  <td className="px-2.5 py-2.5 text-right">{fmtWeeks(l.coverWeeks)}</td>
                  <td className="px-2.5 py-2.5 text-right">{fmtPct(l.sellThrough)}</td>
                  <td className="px-2.5 py-2.5">
                    <RiskBadge risk={l.risk} />
                  </td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-12 text-center text-sm text-ink-soft">
                    No lines match these filters.{" "}
                    <button type="button" onClick={resetFilters} className="font-medium text-accent-strong underline">
                      Reset filters
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-[13px] text-ink-soft">
          <span className="tabular-nums">
            {filtered.length === 0 ? "0" : `${safePage * PAGE_SIZE + 1}–${Math.min(filtered.length, (safePage + 1) * PAGE_SIZE)}`} of {fmtInt(filtered.length)}
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} ariaLabel="Previous page">
              <ChevronLeft className="size-4" aria-hidden /> Prev
            </Button>
            <span className="tabular-nums">
              Page {safePage + 1} of {pages}
            </span>
            <Button size="sm" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)} ariaLabel="Next page">
              Next <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </Card>

      <p className="mt-3 text-xs leading-relaxed text-ink-faint">
        Stock value and margin aren&rsquo;t shown: the CSV template has no unit cost or price. Category and SKU code aren&rsquo;t in the template either, so products are
        grouped by the <code className="font-mono">item</code> column. Sell-through = units sold in the sales window ÷ (sold + on hand).
      </p>

      <Modal open={selected !== null} onClose={() => setSelected(null)} title={selected ? `${selected.colour} ${selected.item}, size ${selected.size}` : ""} variant="side">
        {selected && selectedStyle && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <RiskBadge risk={selected.risk} />
              <span className="text-[13px] text-ink-soft">at {selected.store}</span>
              <Tip text={`${RISK_LABEL[selected.risk]}: ${RISK_RULE[selected.risk](dataset.thresholds)}`} />
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">Store by store</h3>
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full min-w-[520px] text-left text-[13px]">
                  <thead className="bg-paper text-xs text-ink-soft">
                    <tr>
                      <th className="px-3 py-2 font-medium">Store</th>
                      <th className="px-3 py-2 text-right font-medium">On hand</th>
                      <th className="px-3 py-2 text-right font-medium">Sold ({ws})</th>
                      <th className="px-3 py-2 text-right font-medium">Stock cover</th>
                      <th className="px-3 py-2 text-right font-medium">Sell-through</th>
                      <th className="px-3 py-2 text-right font-medium">Days</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line tabular-nums">
                    {selectedStyle.stores.map((s) => (
                      <tr key={s.store} className={cx(s.store === selected.store && "bg-accent-soft/50")}>
                        <td className="px-3 py-2 font-medium text-ink">{s.store}</td>
                        <td className="px-3 py-2 text-right">{s.onHand}</td>
                        <td className="px-3 py-2 text-right">{s.sold}</td>
                        <td className="px-3 py-2 text-right">{fmtWeeks(s.coverWeeks)}</td>
                        <td className="px-3 py-2 text-right">{fmtPct(s.sellThrough)}</td>
                        <td className="px-3 py-2 text-right">{s.daysOld}</td>
                      </tr>
                    ))}
                    <tr className="bg-paper font-medium">
                      <td className="px-3 py-2 text-ink">Whole chain</td>
                      <td className="px-3 py-2 text-right">{selectedStyle.chainOnHand}</td>
                      <td className="px-3 py-2 text-right">{selectedStyle.chainSold}</td>
                      <td className="px-3 py-2 text-right">{fmtWeeks(selectedStyle.chainCoverWeeks)}</td>
                      <td className="px-3 py-2 text-right">{fmtPct(selectedStyle.chainSellThrough)}</td>
                      <td className="px-3 py-2" />
                    </tr>
                  </tbody>
                </table>
              </div>
              {selectedStyle.stores.length === 1 && (
                <p className="mt-2 text-xs text-amber">Only one store carries this item, so there is nowhere to transfer it to.</p>
              )}
              <p className="mt-2 text-xs text-ink-faint">No recorded sales is not proof that nobody wants it, and days since receipt may not be the true age of the stock.</p>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">Related actions</h3>
              {related.length === 0 ? (
                <p className="text-[13px] text-ink-soft">No transfer or markdown was suggested for this item.</p>
              ) : (
                <ul className="space-y-2">
                  {related.map((c) => {
                    const inList = dataset.actions.some((a) => a.candidate.id === c.id);
                    return (
                      <li key={c.id} className="rounded-lg border border-line p-3">
                        <p className="text-sm font-medium text-ink">{headlineFor(c, decisions[c.id])}</p>
                        <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {inList ? (
                            <>
                              <StatusBadge decision={decisions[c.id]} type={c.type} />
                              <Link href="/actions" className="text-xs font-medium text-accent-strong hover:underline">
                                Open in Action Centre
                              </Link>
                            </>
                          ) : (
                            <Badge tone="neutral">Found by rules, not in this week&rsquo;s top list</Badge>
                          )}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function RiskFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Filter by risk">
      <span className="text-xs font-medium text-ink-soft">Risk:</span>
      {([["", "All"], ...Object.entries(RISK_LABEL)] as [string, string][]).map(([k, label]) => (
        <button
          key={k || "all"}
          type="button"
          aria-pressed={value === k}
          onClick={() => onChange(k)}
          className={cx(
            "min-h-8 rounded-full border px-3 text-xs font-medium transition-colors",
            value === k ? "border-navy bg-navy text-white" : "border-line-strong bg-card text-ink-soft hover:border-ink-soft"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
