"use client";

import type { Decision } from "@/lib/appState";
import type { Candidate, Risk, Strength } from "@/lib/types";
import { RISK_LABEL } from "@/lib/risk";
import { Badge } from "./ui";

export function StatusBadge({ decision, type }: { decision?: Decision; type: Candidate["type"] }) {
  if (!decision) return <Badge tone="neutral">Awaiting your decision</Badge>;
  if (decision.status === "rejected") return <Badge tone="risk">Rejected</Badge>;
  if (type === "move") {
    return decision.verifiedAt ? <Badge tone="accent">Approved · stock verified</Badge> : <Badge tone="amber">Approved · awaiting stock verification</Badge>;
  }
  return <Badge tone="accent">Approved{decision.edited ? " · edited" : ""}</Badge>;
}

// Priority is the position in this week's list: the first three are High.
export function priorityOf(index: number): { label: string; tone: "risk" | "amber" | "neutral" } {
  if (index < 3) return { label: "High priority", tone: "risk" };
  if (index < 7) return { label: "Medium", tone: "amber" };
  return { label: "Normal", tone: "neutral" };
}

export function TypeBadge({ type }: { type: Candidate["type"] }) {
  return type === "move" ? <Badge tone="info">Transfer</Badge> : <Badge tone="amber">Markdown review</Badge>;
}

const STRENGTH: Record<Strength, { label: string; tone: "accent" | "amber" | "neutral" }> = {
  strong: { label: "Strong evidence", tone: "accent" },
  moderate: { label: "Moderate evidence", tone: "amber" },
  limited: { label: "Limited evidence", tone: "neutral" },
};

export function StrengthBadge({ strength }: { strength: Strength }) {
  const s = STRENGTH[strength];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function RiskBadge({ risk }: { risk: Risk }) {
  const tone = { at_risk: "risk", watch: "amber", fast: "accent", ok: "neutral", new: "info" }[risk] as "risk" | "amber" | "accent" | "neutral" | "info";
  return <Badge tone={tone}>{RISK_LABEL[risk]}</Badge>;
}
