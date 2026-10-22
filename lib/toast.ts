"use client";

import { useSyncExternalStore } from "react";

// A tiny toast system: call toast("Saved") from anywhere; <Toaster /> shows it for a few seconds.
export type Toast = { id: number; text: string; tone: "ok" | "info" | "warn" };

const NO_TOASTS: Toast[] = []; // one shared empty list, so React sees the server value as unchanged
let toasts: Toast[] = NO_TOASTS;
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(text: string, tone: Toast["tone"] = "ok") {
  const t: Toast = { id: nextId++, text, tone };
  toasts = [...toasts, t].slice(-3);
  emit();
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    emit();
  }, 4200);
}

export function useToasts() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => toasts,
    () => NO_TOASTS
  );
}
