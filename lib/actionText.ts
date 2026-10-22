import type { Decision } from "./appState";
import type { Candidate } from "./types";
import { fmtDateTime } from "./format";

const round1 = (n: number) => Number(n.toFixed(1));

// The headline, using the owner's edited numbers if they changed them.
export function headlineFor(c: Candidate, d?: Decision): string {
  if (!d?.edited) return c.headline;
  if (c.type === "move") return c.headline.replace(`Move ${c.units} ×`, `Move ${d.units} ×`);
  return c.headline.replace(`by ${c.markdownPct}%`, `by ${d.markdownPct}%`);
}

// What happens to the two stores if this many units move. All plain arithmetic.
export function transferPreview(c: Candidate, units: number) {
  const [source, dest] = c.involved;
  const sourceLeft = source.onHand - units;
  const destAfter = dest.onHand + units;
  return {
    sourceLeft,
    sourceWeeks: source.weeklyRate > 0 ? round1(sourceLeft / source.weeklyRate) : null,
    destAfter,
    destWeeks: dest.weeklyRate > 0 ? round1(destAfter / dest.weeklyRate) : null,
  };
}

// A plain-text transfer note the owner can copy. Nothing is sent anywhere.
export function transferNote(c: Candidate, d: Decision, reason: string): string {
  const units = d.units ?? c.units;
  return [
    "TRANSFER NOTE (draft, not sent anywhere)",
    `${units} × ${c.label}`,
    `From: ${c.from}   To: ${c.to}`,
    `Before dispatch: count the stock at ${c.from} and confirm ${units} units are really there.`,
    `Why: ${reason}`,
    `Approved ${fmtDateTime(d.at)}${d.edited ? ` (edited from ${d.originalUnits} units)` : ""}`,
  ].join("\n");
}
