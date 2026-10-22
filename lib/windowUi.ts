"use client";

import { useSyncExternalStore } from "react";
import { isoOf } from "./window";

// Lets any button open the "Sales window" dialog that lives in the app shell.
let open = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const openWindowDialog = () => {
  open = true;
  emit();
};
export const closeWindowDialog = () => {
  open = false;
  emit();
};

export function useWindowDialogOpen() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => open,
    () => false
  );
}

// Today's date as YYYY-MM-DD, or "" while the page is still being prepared on the server. Reading it this way
// keeps the clock out of server rendering (Next.js doesn't allow that).
export function useTodayIso() {
  return useSyncExternalStore(
    () => () => {},
    () => isoOf(new Date()),
    () => ""
  );
}
