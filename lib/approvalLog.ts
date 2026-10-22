// The approvals log lives in the browser's localStorage, so it survives a page refresh.
// (Vercel has no permanent disk, and for this MVP the log only needs to outlive a refresh.)
export type LogEntry = { headline: string; choice: "approved" | "rejected"; iso: string };

const KEY = "rerack-approvals";
const MAX_ENTRIES = 200;
const listeners = new Set<() => void>();

function read(): LogEntry[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as LogEntry[]) : [];
  } catch {
    return []; // storage blocked or corrupted: start with an empty log
  }
}

function write(entries: LogEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // storage blocked (private window): the log just won't persist
  }
  listeners.forEach((l) => l());
}

export function addLogEntry(entry: LogEntry) {
  write([entry, ...read()]);
}

export function clearLog() {
  write([]);
}

// These three are what React's useSyncExternalStore needs.
export function subscribeToLog(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback); // another tab changed the log
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

export function getLogSnapshot(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

export const getServerLogSnapshot = () => "[]";

export function parseLog(snapshot: string): LogEntry[] {
  try {
    const parsed: unknown = JSON.parse(snapshot);
    return Array.isArray(parsed) ? (parsed as LogEntry[]) : [];
  } catch {
    return [];
  }
}
