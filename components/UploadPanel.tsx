"use client";

import { storeNameFromFile } from "@/lib/validate";

type Props = {
  files: File[];
  note: string;
  busy: boolean;
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
  onNoteChange: (note: string) => void;
  onAnalyze: () => void;
};

export default function UploadPanel({ files, note, busy, onAddFiles, onRemoveFile, onNoteChange, onAnalyze }: Props) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">1. Upload your store files</h2>
      <p className="mt-1 text-sm text-stone-600">
        One CSV per store, with the columns: item, size, colour, date_received, units_on_hand, units_sold_4w. The file
        name is the store name (store-a.csv becomes &ldquo;Store A&rdquo;).
      </p>

      <label className="mt-3 flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-stone-300 px-4 py-3 text-center font-medium text-stone-700 hover:bg-stone-50">
        Choose store files
        <input
          type="file"
          multiple
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            onAddFiles(Array.from(e.target.files ?? []));
            e.target.value = ""; // lets you pick the same file again later
          }}
        />
      </label>

      {files.length > 0 && (
        <ul className="mt-3 divide-y divide-stone-100 rounded-xl border border-stone-200">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="min-w-0 truncate">
                <span className="font-medium">{storeNameFromFile(f.name)}</span>{" "}
                <span className="text-stone-500">({f.name})</span>
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => onRemoveFile(i)}
                className="min-h-10 shrink-0 rounded-lg px-3 text-stone-600 hover:bg-stone-100"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-5 text-lg font-semibold">2. Anything the AI should know? (optional)</h2>
      <textarea
        value={note}
        disabled={busy}
        onChange={(e) => onNoteChange(e.target.value)}
        rows={3}
        placeholder='e.g. "Diwali in 3 weeks. Store B closed for repairs. Don&#39;t mark down Navy Kurta."'
        className="mt-2 w-full rounded-xl border border-stone-300 p-3 text-base"
      />

      <button
        type="button"
        disabled={busy}
        onClick={onAnalyze}
        className="mt-4 min-h-12 w-full rounded-xl bg-stone-900 px-4 text-base font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Working..." : "Analyze"}
      </button>
    </section>
  );
}
