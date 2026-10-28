"use client";

import { ChevronDown, Columns3 } from "lucide-react";
import { Badge, cx } from "@/components/ui";
import { FIELDS, isComplete, type FieldKey } from "@/lib/columnMap";
import type { ImportFile } from "@/lib/client";

// Under a file whose column names aren't Rerack's: one dropdown per Rerack field, listing the file's own columns.
export function ColumnMatcher({
  fileId,
  columns,
  open,
  onToggle,
  onChange,
}: {
  fileId: string;
  columns: NonNullable<ImportFile["columns"]>;
  open: boolean;
  onToggle: () => void;
  onChange: (key: FieldKey, header: string) => void;
}) {
  const { headers, sample, mapping, saved } = columns;
  const done = isComplete(mapping);
  const missing = FIELDS.filter((f) => !mapping[f.key]);

  return (
    <div className={cx("mt-2.5 ml-8 rounded-lg border p-3", done ? "border-line bg-paper/60" : "border-amber/30 bg-amber-soft/60")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-2 text-left text-[13px] font-medium text-ink"
      >
        <Columns3 className="size-4 text-accent" aria-hidden />
        <span className="flex-1">
          {done
            ? saved
              ? "Columns matched, using your choices from last time"
              : "Columns matched automatically. Check they are right."
            : `Match this file's columns: ${missing.map((f) => f.label).join(", ")} still to choose`}
        </span>
        {done ? <Badge tone="accent">Matched</Badge> : <Badge tone="amber">Needs you</Badge>}
        <ChevronDown className={cx("size-4 text-ink-soft transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <>
          <p className="mt-2 text-xs leading-relaxed text-ink-soft">
            This file uses its own column names. Pick which column holds each value. Your choice is used for every file with the same
            columns, and remembered on this device for next time.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {FIELDS.map((f) => {
              const chosen = mapping[f.key];
              const id = `map-${fileId}-${f.key}`;
              return (
                <div key={f.key} className="min-w-0">
                  <label htmlFor={id} className="mb-1 block text-xs font-medium text-ink-soft">
                    {f.label} <span className="font-normal text-ink-faint">· {f.help}</span>
                  </label>
                  <select
                    id={id}
                    value={chosen}
                    onChange={(e) => onChange(f.key, e.target.value)}
                    className={cx(
                      "min-h-10 w-full rounded-lg border bg-card px-2.5 text-sm text-ink",
                      chosen ? "border-line-strong" : "border-amber"
                    )}
                  >
                    <option value="">Choose a column…</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                        {sample[h] ? ` (e.g. ${sample[h].slice(0, 24)})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
