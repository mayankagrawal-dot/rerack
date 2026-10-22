import { CONFIG } from "./config";
import type { Candidate, Style, StoreStock } from "./types";

const round1 = (n: number) => Number(n.toFixed(1));
const pct = (n: number | null) => (n === null ? "n/a" : `${Math.round(n * 100)}%`);

function coverText(s: StoreStock) {
  return s.coverWeeks === null ? "no sales" : `${round1(s.coverWeeks)} weeks of stock left`;
}

function storeFacts(s: StoreStock) {
  return `${s.store}: ${s.onHand} on hand, ${s.sold4w} sold in 4 weeks (${coverText(s)}), ${pct(
    s.sellThrough
  )} sold through, ${s.daysOld} days since receipt`;
}

type NewCandidate = Omit<Candidate, "id" | "rulesRank">;

// Find the stock worth moving or marking down. Pure rules, no AI.
export function findCandidates(styles: Style[]): Candidate[] {
  const found: NewCandidate[] = [];
  const movedFrom = new Set<string>(); // "styleKey@store" rows already being moved away

  const m = CONFIG.move;
  for (const style of styles) {
    const sources = style.stores
      .filter(
        (s) =>
          s.onHand > 0 &&
          s.daysOld >= m.sourceMinDays &&
          (s.coverWeeks === null || s.coverWeeks >= m.sourceMinCoverWeeks)
      )
      .sort((a, b) => b.daysOld - a.daysOld);

    const dests = style.stores
      .filter((s) => s.sold4w > 0 && s.coverWeeks !== null && s.coverWeeks <= m.destMaxCoverWeeks)
      .map((store) => ({ store, need: Math.floor(store.weeklyRate * m.destTargetWeeks - store.onHand) }))
      .filter((d) => d.need >= m.minUnits)
      .sort((a, b) => b.need - a.need);

    for (const source of sources) {
      let surplus = Math.floor(source.onHand - source.weeklyRate * m.sourceKeepWeeks);
      for (const dest of dests) {
        const units = Math.min(surplus, dest.need);
        if (units < m.minUnits) continue;
        surplus -= units;
        dest.need -= units;
        movedFrom.add(`${style.key}@${source.store}`);
        found.push({
          type: "move",
          label: style.label,
          units,
          from: source.store,
          to: dest.store.store,
          involved: [source, dest.store],
          headline: `Move ${units} × ${style.label} from ${source.store} to ${dest.store.store}`,
          facts: `${storeFacts(source)} · ${storeFacts(dest.store)}`,
          templateReason: `${dest.store.store} sold ${dest.store.sold4w} in the last 4 weeks; ${source.store} sold ${source.sold4w} and its stock is ${source.daysOld} days old.`,
          valueAtRisk: units * source.daysOld,
        });
      }
    }
  }

  const md = CONFIG.markdown;
  for (const style of styles) {
    if (style.chainCoverWeeks !== null && style.chainCoverWeeks < md.minChainCoverWeeks) continue;
    const rows = style.stores.filter(
      (s) => s.onHand > 0 && s.daysOld >= md.minDays && !movedFrom.has(`${style.key}@${s.store}`)
    );
    if (rows.length === 0) continue;
    const units = rows.reduce((sum, s) => sum + s.onHand, 0);
    const oldest = Math.max(...rows.map((s) => s.daysOld));
    found.push({
      type: "markdown",
      label: style.label,
      units,
      markdownPct: md.pct,
      involved: rows,
      chain: { onHand: style.chainOnHand, sold4w: style.chainSold4w, coverWeeks: style.chainCoverWeeks },
      headline: `Mark down ${style.label} by ${md.pct}% (${units} units in ${rows.map((s) => s.store).join(", ")})`,
      facts: `${rows.map(storeFacts).join(" · ")} · Whole chain: ${style.chainOnHand} on hand, ${style.chainSold4w} sold in 4 weeks`,
      templateReason: `Only ${style.chainSold4w} sold chain-wide in 4 weeks against ${style.chainOnHand} on hand; the oldest stock is ${oldest} days old.`,
      valueAtRisk: rows.reduce((sum, s) => sum + s.onHand * s.daysOld, 0),
    });
  }

  return found
    .sort((a, b) => b.valueAtRisk - a.valueAtRisk || a.headline.localeCompare(b.headline))
    .map((c, i) => ({ ...c, id: `c${String(i + 1).padStart(2, "0")}`, rulesRank: i + 1 }));
}
