import { CONFIG } from "./config";
import { RESPONSE_SCHEMA, SYSTEM_PROMPT } from "./prompt";
import type { Candidate, RankedAction, SkippedAction } from "./types";

export type RankingOutcome = {
  actions: RankedAction[];
  skipped: SkippedAction[];
  usedAi: boolean;
  aiProblem?: string;
  ignoredAiSuggestions: number;
};

const round1 = (n: number) => Number(n.toFixed(1));
const MAX_REASON_CHARS = 200;

// What the AI is allowed to see about a candidate. Every number in here was calculated by code.
function payload(c: Candidate) {
  return {
    id: c.id,
    type: c.type,
    style: c.label,
    units: c.units,
    from_store: c.from,
    to_store: c.to,
    markdown_pct: c.markdownPct,
    rules_rank: c.rulesRank,
    value_at_risk: c.valueAtRisk,
    stores: c.involved.map((s) => ({
      store: s.store,
      units_on_hand: s.onHand,
      units_sold_last_4_weeks: s.sold4w,
      days_since_receipt: s.daysOld,
      weeks_since_receipt: Math.floor(s.daysOld / 7),
      weeks_of_stock_left: s.coverWeeks === null ? "no sales" : round1(s.coverWeeks),
    })),
    whole_chain: c.chain && { units_on_hand: c.chain.onHand, units_sold_last_4_weeks: c.chain.sold4w },
  };
}

function numbersIn(text: string): number[] {
  return (text.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
}

// Numbers a reason may quote: the candidate's data, its name, and anything the owner typed in the note.
function allowedNumbers(c: Candidate, note: string): Set<number> {
  const allowed = new Set<number>([
    ...numbersIn(JSON.stringify(payload(c))),
    ...numbersIn(c.label),
    ...numbersIn(note),
  ]);
  for (const s of c.involved) allowed.add(Math.round(s.daysOld / 7)); // "about 9 weeks" for 63 days
  return allowed;
}

function hasUnknownNumber(reason: string, c: Candidate, note: string): boolean {
  const allowed = allowedNumbers(c, note);
  return numbersIn(reason).some((n) => !allowed.has(n));
}

function ruleBasedActions(candidates: Candidate[]): RankedAction[] {
  return candidates.slice(0, CONFIG.topShown).map((c) => ({
    candidate: c,
    aiRank: null,
    reason: c.templateReason,
    reasonSource: "rules",
    numberWarning: false,
  }));
}

function friendlyProblem(err: unknown): string {
  const msg = err instanceof Error ? err.message : "";
  if (msg === "NO_API_KEY") return "no OpenRouter API key is set";
  if (msg === "HTTP_401" || msg === "HTTP_403") return "OpenRouter rejected the API key";
  if (msg === "HTTP_402") return "the OpenRouter account is out of credit";
  if (msg === "HTTP_429") return "OpenRouter's rate limit was hit, try again in a minute";
  if (msg === "HTTP_400" || msg === "HTTP_404") return "OpenRouter rejected the request or model name";
  if (/timed? ?out|timeout|abort/i.test(msg)) return "the AI took too long to answer";
  if (msg === "UNUSABLE_ANSWER") return "the AI's answer couldn't be used";
  return "the AI couldn't be reached";
}

type RawRanking = { ranked?: unknown; skipped?: unknown };

async function askAi(shortlist: Candidate[], note: string): Promise<RawRanking> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key || key.startsWith("PASTE_")) throw new Error("NO_API_KEY"); // empty or still the placeholder
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, // key goes in a header, server side only
    signal: AbortSignal.timeout(CONFIG.aiTimeoutMs),
    body: JSON.stringify({
      model: CONFIG.model,
      temperature: 0.2,
      max_tokens: 3000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Owner's note:\n<note>\n${note.trim() || "(none)"}\n</note>\n\nCandidates (JSON):\n${JSON.stringify(
            shortlist.map(payload)
          )}`,
        },
      ],
      response_format: { type: "json_schema", json_schema: { name: "ranking", strict: true, schema: RESPONSE_SCHEMA } },
    }),
  });
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content?.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  if (!text) throw new Error("UNUSABLE_ANSWER");
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) throw new Error("UNUSABLE_ANSWER");
    return parsed as RawRanking;
  } catch {
    throw new Error("UNUSABLE_ANSWER");
  }
}

// Rank with the AI, then check its answer in plain code. If anything goes wrong, fall back to rule order.
export async function rankCandidates(candidates: Candidate[], note: string): Promise<RankingOutcome> {
  const shortlist = candidates.slice(0, CONFIG.topForAi);
  if (shortlist.length === 0) {
    return { actions: [], skipped: [], usedAi: false, ignoredAiSuggestions: 0 };
  }
  const byId = new Map(shortlist.map((c) => [c.id, c]));

  let raw: RawRanking;
  try {
    raw = await askAi(shortlist, note);
  } catch (err) {
    console.error("AI ranking failed:", err instanceof Error ? err.message : err);
    return {
      actions: ruleBasedActions(candidates),
      skipped: [],
      usedAi: false,
      aiProblem: friendlyProblem(err),
      ignoredAiSuggestions: 0,
    };
  }

  let ignored = 0;
  const seen = new Set<string>();
  const rankedRaw = (Array.isArray(raw.ranked) ? raw.ranked : []).flatMap((item, index) => {
    const r = item as { id?: unknown; rank?: unknown; reason?: unknown };
    if (typeof r?.id !== "string" || !byId.has(r.id) || seen.has(r.id)) {
      ignored++;
      return [];
    }
    seen.add(r.id);
    return [
      {
        id: r.id,
        order: typeof r.rank === "number" && Number.isFinite(r.rank) ? r.rank : index + 1,
        reason: typeof r.reason === "string" ? r.reason.trim().slice(0, MAX_REASON_CHARS) : "",
      },
    ];
  });
  rankedRaw.sort((a, b) => a.order - b.order);

  if (rankedRaw.length === 0) {
    console.error("AI ranking failed: no valid ranked ids");
    return {
      actions: ruleBasedActions(candidates),
      skipped: [],
      usedAi: false,
      aiProblem: friendlyProblem(new Error("UNUSABLE_ANSWER")),
      ignoredAiSuggestions: ignored,
    };
  }

  const actions: RankedAction[] = rankedRaw.slice(0, CONFIG.topShown).map((r, i) => {
    const candidate = byId.get(r.id)!;
    const hasReason = r.reason.length > 0;
    return {
      candidate,
      aiRank: i + 1,
      reason: hasReason ? r.reason : candidate.templateReason,
      reasonSource: hasReason ? "ai" : "rules",
      numberWarning: hasReason && hasUnknownNumber(r.reason, candidate, note),
    };
  });

  const shown = new Set(actions.map((a) => a.candidate.id));

  const skippedSeen = new Set<string>();
  const skipped: SkippedAction[] = (Array.isArray(raw.skipped) ? raw.skipped : []).flatMap((item) => {
    const s = item as { id?: unknown; why?: unknown };
    if (typeof s?.id !== "string" || !byId.has(s.id) || skippedSeen.has(s.id)) {
      ignored++;
      return [];
    }
    skippedSeen.add(s.id);
    if (shown.has(s.id)) return []; // ranked and skipped: keep it ranked
    return [
      {
        candidate: byId.get(s.id)!,
        why: typeof s.why === "string" && s.why.trim() ? s.why.trim().slice(0, MAX_REASON_CHARS) : "Left out because of your note.",
      },
    ];
  });

  // If the AI ranked fewer than the cards we want, top up in rule order (and label them as rule-based).
  for (const c of shortlist) {
    if (actions.length >= CONFIG.topShown) break;
    if (shown.has(c.id) || skippedSeen.has(c.id)) continue;
    actions.push({ candidate: c, aiRank: null, reason: c.templateReason, reasonSource: "rules", numberWarning: false });
    shown.add(c.id);
  }

  return { actions, skipped, usedAi: true, ignoredAiSuggestions: ignored };
}
