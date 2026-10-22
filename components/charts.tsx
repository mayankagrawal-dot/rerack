"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { StoreSummary } from "@/lib/derive";

const INK = "#121a2b";
const NAVY = "#1a2748";
const ACCENT = "#0b7a63";
const AMBER = "#d9892b";
const RISK = "#c2412d";
const GRID = "#ece7dc";

function ChartTip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-ink">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-ink-soft">
          <span className="inline-block size-2 rounded-sm" style={{ background: p.color }} />
          {p.name}: <span className="font-medium tabular-nums text-ink">{p.value.toLocaleString("en-IN")}</span>
        </p>
      ))}
    </div>
  );
}

// Units held next to units sold in the sales window, per store: where stock sits against where it sells.
export function StoreCompareChart({ data, soldLabel = "Units sold", height = 280 }: { data: StoreSummary[]; soldLabel?: string; height?: number }) {
  return (
    <div role="img" aria-label={`Bar chart of units held and ${soldLabel.toLowerCase()}, for each store`}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barGap={4}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="store" tickLine={false} axisLine={{ stroke: GRID }} interval={0} />
          <YAxis tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(18,26,43,0.04)" }} />
          <Legend iconType="square" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Bar dataKey="onHand" name="Units on hand" fill={NAVY} radius={[4, 4, 0, 0]} maxBarSize={36} />
          <Bar dataKey="sold" name={soldLabel} fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const AGE_COLOURS = [ACCENT, "#7aa89a", AMBER, RISK];

export function AgeChart({ data, height = 240 }: { data: { bucket: string; units: number }[]; height?: number }) {
  return (
    <div role="img" aria-label="Bar chart of units on hand by days since receipt">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="bucket" tickLine={false} axisLine={{ stroke: GRID }} interval={0} />
          <YAxis tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(18,26,43,0.04)" }} />
          <Bar dataKey="units" name="Units on hand" radius={[4, 4, 0, 0]} maxBarSize={56}>
            {data.map((_, i) => (
              <Cell key={i} fill={AGE_COLOURS[i]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StoreAgeChart({
  data,
  height = 280,
}: {
  data: { store: string; b0: number; b1: number; b2: number; b3: number }[];
  height?: number;
}) {
  return (
    <div role="img" aria-label="Stacked bar chart of units on hand by days since receipt, for each store">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="store" tickLine={false} axisLine={{ stroke: GRID }} interval={0} />
          <YAxis tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(18,26,43,0.04)" }} />
          <Legend iconType="square" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Bar dataKey="b0" name="0-30 days" stackId="a" fill={AGE_COLOURS[0]} maxBarSize={44} />
          <Bar dataKey="b1" name="31-60 days" stackId="a" fill={AGE_COLOURS[1]} maxBarSize={44} />
          <Bar dataKey="b2" name="61-90 days" stackId="a" fill={AGE_COLOURS[2]} maxBarSize={44} />
          <Bar dataKey="b3" name="Over 90 days" stackId="a" fill={AGE_COLOURS[3]} radius={[4, 4, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProductRiskChart({
  data,
  height = 280,
}: {
  data: { item: string; atRisk: number; watch: number }[];
  height?: number;
}) {
  return (
    <div role="img" aria-label="Bar chart of units at risk and on watch, by product">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 24, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke={GRID} />
          <XAxis type="number" tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="item" tickLine={false} axisLine={false} width={96} style={{ fill: INK }} />
          <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(18,26,43,0.04)" }} />
          <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="atRisk" name="At risk" stackId="r" fill={RISK} maxBarSize={22} />
          <Bar dataKey="watch" name="Watch" stackId="r" fill={AMBER} radius={[0, 4, 4, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
