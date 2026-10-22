// One place for how numbers and dates look, in Indian formatting.
export const fmtInt = (n: number) => n.toLocaleString("en-IN");

export const fmtWeeks = (w: number | null) => (w === null ? "No sales" : `${Number(w.toFixed(1))} wks`);

export const fmtPct = (n: number | null) => (n === null ? "n/a" : `${Math.round(n * 100)}%`);

const dateTime = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const dateTimeSeconds = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export const fmtDateTime = (iso: string) => dateTime.format(new Date(iso));
export const fmtDateTimeSeconds = (iso: string) => dateTimeSeconds.format(new Date(iso));

// "just now", "5 min ago", "3 h ago", or the date
export function fmtAgo(iso: string, now = Date.now()) {
  const mins = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.floor(mins / 60)} h ago`;
  return fmtDateTime(iso);
}
