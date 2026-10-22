// The sales window: the dates that the "units sold" column in the uploaded files covers.
// The CSV holds one total per line, so Rerack can't re-cut sales for another period. It can be told which
// dates the totals cover, and then work out weekly sales, stock cover and risk from that.
export const DEFAULT_WINDOW_DAYS = 28;
export const MIN_WINDOW_DAYS = 7;
export const MAX_WINDOW_DAYS = 366;

export type SalesWindow = { start: string; end: string }; // ISO dates, both inclusive
export type WindowInfo = { days: number; start?: string; end?: string };

const DAY = 86_400_000;
const toUtc = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(t);
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]) ? t : null;
};

export const isoOf = (d: Date) => d.toISOString().slice(0, 10);

// Both ends count, so 1 Oct to 28 Oct is 28 days.
export function daysInWindow(start: string, end: string): number | null {
  const a = toUtc(start);
  const b = toUtc(end);
  if (a === null || b === null) return null;
  return Math.round((b - a) / DAY) + 1;
}

export const weeksOf = (days: number) => days / 7;

// "4 weeks" when it is a whole number of weeks, otherwise "30 days".
export function windowLabel(days: number): string {
  if (days % 7 === 0) {
    const w = days / 7;
    return `${w} week${w === 1 ? "" : "s"}`;
  }
  return `${days} days`;
}

export function windowShort(days: number): string {
  return days % 7 === 0 ? `${days / 7} wks` : `${days} d`;
}

const fmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
export function windowDates(start?: string, end?: string): string | null {
  const a = start ? toUtc(start) : null;
  const b = end ? toUtc(end) : null;
  if (a === null || b === null) return null;
  return `${fmt.format(new Date(a))} to ${fmt.format(new Date(b))}`;
}

export function presetWindow(weeks: number, today: Date): SalesWindow {
  const end = isoOf(today);
  const start = isoOf(new Date(today.getTime() - (weeks * 7 - 1) * DAY));
  return { start, end };
}

// An ISO date moved by a number of days (negative = earlier).
export function shiftIso(iso: string, days: number): string {
  const t = toUtc(iso);
  return t === null ? iso : isoOf(new Date(t + days * DAY));
}

// The same, from an ISO date string, so a page can use it without reading the clock while it renders.
export function presetFromIso(todayIso: string, weeks: number): SalesWindow | null {
  const t = toUtc(todayIso);
  if (t === null) return null;
  return { start: isoOf(new Date(t - (weeks * 7 - 1) * DAY)), end: todayIso };
}

export type WindowCheck = { ok: boolean; days: number | null; error?: string; warning?: string };

export function checkWindow(start: string, end: string, todayIso: string): WindowCheck {
  const days = daysInWindow(start, end);
  if (days === null) return { ok: false, days: null, error: "Pick a start and an end date." };
  if (start < "2000-01-01") return { ok: false, days, error: "That start date is too far back." };
  if (end > todayIso) return { ok: false, days, error: "The end date can't be in the future." };
  if (days < 1) return { ok: false, days, error: "The end date must be on or after the start date." };
  if (days < MIN_WINDOW_DAYS)
    return { ok: false, days, error: `The window must cover at least ${MIN_WINDOW_DAYS} days. Shorter periods make weekly sales too noisy to trust.` };
  if (days > MAX_WINDOW_DAYS) return { ok: false, days, error: `The window can't be longer than ${MAX_WINDOW_DAYS} days.` };
  if (days < 14) return { ok: true, days, warning: "Under two weeks of sales can swing a lot from one busy day. Treat the results with care." };
  return { ok: true, days };
}

// Whatever the browser sends, return a safe whole number of days.
export function sanitizeWindowDays(input: unknown): number {
  const n = typeof input === "string" ? Number(input) : typeof input === "number" ? input : NaN;
  if (!Number.isFinite(n)) return DEFAULT_WINDOW_DAYS;
  return Math.min(MAX_WINDOW_DAYS, Math.max(MIN_WINDOW_DAYS, Math.round(n)));
}
