import { DEFAULT_THRESHOLDS, type Thresholds } from "./config";
import type { Candidate, Strength, Style, StoreStock } from "./types";
import { DEFAULT_WINDOW_DAYS, weeksOf, windowLabel } from "./window";

const round1 = (n: number) => Number(n.toFixed(1));
const pct = (n: number | null) => (n === null ? "n/a" : `${Math.round(n * 100)}%`);

function coverText(s: StoreStock) {
  return s.coverWeeks === null ? "no sales" : `${round1(s.coverWeeks)} weeks of stock left`;
}

function storeFacts(s: StoreStock, wl: string) {
  return `${s.store}: ${s.onHand} on hand, ${s.sold} sold in ${wl} (${coverText(s)}), ${pct(
    s.sellThrough
  )} sold through, ${s.daysOld} days since receipt`;
}

type NewCandidate = Omit<Candidate, "id" | "rulesRank">;

const AGE_NOTE =
  "Days since receipt comes from the date_received column. It may not equal the true age of the stock.";

// Find the stock worth moving or marking down. Pure rules, no AI.
// windowDays = how many days the "units sold" figures in the files cover.
export function findCandidates(
  styles: Style[],
  t: Thresholds = DEFAULT_THRESHOLDS,
  windowDays: number = DEFAULT_WINDOW_DAYS
): Candidate[] {
  const wl = windowLabel(windowDays);
  const found: NewCandidate[] = [];
  const movedFrom = new Set<string>(); // "styleKey@store" rows already being moved away

  for (const style of styles) {
    const sources = style.stores
      .filter(
        (s) =>
          s.onHand > 0 &&
          s.daysOld >= t.moveSourceMinDays &&
          (s.coverWeeks === null || s.coverWeeks >= t.moveSourceMinCoverWeeks)
      )
      .sort((a, b) => b.daysOld - a.daysOld);

    const dests = style.stores
      .filter((s) => s.sold > 0 && s.coverWeeks !== null && s.coverWeeks <= t.moveDestMaxCoverWeeks)
      .map((store) => {
        const need = Math.floor(store.weeklyRate * t.moveDestTargetWeeks - store.onHand);
        return { store, need, originalNeed: need };
      })
      .filter((d) => d.need >= t.moveMinUnits)
      .sort((a, b) => b.need - a.need);

    for (const source of sources) {
      let surplus = Math.floor(source.onHand - source.weeklyRate * t.moveSourceKeepWeeks);
      const originalSurplus = surplus;
      for (const dest of dests) {
        const units = Math.min(surplus, dest.need);
        if (units < t.moveMinUnits) continue;
        const surplusBefore = surplus;
        const needBefore = dest.need;
        surplus -= units;
        dest.need -= units;
        movedFrom.add(`${style.key}@${source.store}`);

        const strength: Strength = dest.store.sold >= 10 ? "strong" : dest.store.sold >= 5 ? "moderate" : "limited";
        const limitations = [
          `Verify the physical stock at ${source.store} before dispatch.`,
          AGE_NOTE,
        ];
        if (source.sold === 0)
          limitations.push(
            `No sales are recorded at ${source.store} in ${wl}. That is not proof there is no demand there.`
          );
        if (dest.store.sold < 5)
          limitations.push(`Demand at ${dest.store.store} rests on only ${dest.store.sold} units sold in ${wl}.`);

        found.push({
          type: "move",
          windowDays,
          styleKey: style.key,
          label: style.label,
          units,
          maxUnits: source.onHand,
          from: source.store,
          to: dest.store.store,
          involved: [source, dest.store],
          headline: `Move ${units} × ${style.label} from ${source.store} to ${dest.store.store}`,
          facts: `${storeFacts(source, wl)} · ${storeFacts(dest.store, wl)}`,
          templateReason: `${dest.store.store} sold ${dest.store.sold} in ${wl}; ${source.store} sold ${source.sold} and its stock is ${source.daysOld} days old.`,
          strength,
          calc: [
            `Spare stock at ${source.store}: ${source.onHand} on hand − ${round1(source.weeklyRate * t.moveSourceKeepWeeks)} (${t.moveSourceKeepWeeks} weeks of its own sales) = ${surplusBefore} units${
              surplusBefore !== originalSurplus ? ` (${originalSurplus} before the transfers listed above)` : ""
            }.`,
            `Room at ${dest.store.store}: ${round1(dest.store.weeklyRate * t.moveDestTargetWeeks)} (${t.moveDestTargetWeeks} weeks of its sales) − ${dest.store.onHand} on hand = ${needBefore} units${
              needBefore !== dest.originalNeed ? ` (${dest.originalNeed} before the transfers listed above)` : ""
            }.`,
            `Suggested transfer: the smaller of ${surplusBefore} and ${needBefore} = ${units} units.`,
          ],
          limitations,
          valueAtRisk: units * source.daysOld,
        });
      }
    }
  }

  for (const style of styles) {
    if (style.chainCoverWeeks !== null && style.chainCoverWeeks < t.markdownMinChainCoverWeeks) continue;
    const rows = style.stores.filter(
      (s) => s.onHand > 0 && s.daysOld >= t.markdownMinDays && !movedFrom.has(`${style.key}@${s.store}`)
    );
    if (rows.length === 0) continue;
    const units = rows.reduce((sum, s) => sum + s.onHand, 0);
    const oldest = Math.max(...rows.map((s) => s.daysOld));
    const strength: Strength =
      style.chainCoverWeeks === null || style.chainCoverWeeks >= t.markdownMinChainCoverWeeks * 2
        ? "strong"
        : style.chainCoverWeeks >= t.markdownMinChainCoverWeeks * 1.5
          ? "moderate"
          : "limited";
    const limitations = [
      "The CSV has no selling price or cost, so margin and recovery can't be calculated.",
      `The ${t.markdownPct}% discount is a starting point for the owner to review, not an optimised price.`,
      AGE_NOTE,
    ];
    if (style.chainSold === 0)
      limitations.push(`No sales are recorded anywhere in ${wl}. That is not proof there is no demand.`);

    found.push({
      type: "markdown",
      windowDays,
      styleKey: style.key,
      label: style.label,
      units,
      maxUnits: units,
      markdownPct: t.markdownPct,
      involved: rows,
      chain: { onHand: style.chainOnHand, sold: style.chainSold, coverWeeks: style.chainCoverWeeks },
      headline: `Mark down ${style.label} by ${t.markdownPct}% (${units} units ${rows.length > 2 ? `across ${rows.length} stores` : `in ${rows.map((s) => s.store).join(" and ")}`})`,
      facts: `${rows.map((r) => storeFacts(r, wl)).join(" · ")} · Whole chain: ${style.chainOnHand} on hand, ${style.chainSold} sold in ${wl}`,
      templateReason: `Only ${style.chainSold} sold chain-wide in ${wl} against ${style.chainOnHand} on hand; the oldest stock is ${oldest} days old.`,
      strength,
      calc: [
        `Flagged because the oldest stock is ${oldest} days old (rule: ${t.markdownMinDays} days or more).`,
        style.chainCoverWeeks === null
          ? `The chain holds ${style.chainOnHand} units and recorded no sales in ${wl}, so stock cover can't be worked out (rule: ${t.markdownMinChainCoverWeeks} weeks or more, or no sales).`
          : `Chain-wide cover: ${style.chainOnHand} on hand ÷ ${round1(style.chainSold / weeksOf(windowDays))} sold per week = ${round1(style.chainCoverWeeks)} weeks (rule: ${t.markdownMinChainCoverWeeks} weeks or more).`,
        `No store was suggested to receive these units, so a markdown is proposed instead of a transfer.`,
      ],
      limitations,
      valueAtRisk: rows.reduce((sum, s) => sum + s.onHand * s.daysOld, 0),
    });
  }

  return found
    .sort((a, b) => b.valueAtRisk - a.valueAtRisk || a.headline.localeCompare(b.headline))
    .map((c, i) => ({ ...c, id: `c${String(i + 1).padStart(2, "0")}`, rulesRank: i + 1 }));
}
