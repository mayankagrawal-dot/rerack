# Rerack architecture

A technical reference for anyone reading or changing the code. The product idea and the three acceptance tests are in the [README](../README.md); how an owner uses it is in the [user guide](USER-GUIDE.md).

## The one rule

**Code does every number. The AI only ranks and explains.** Anything numeric (days since receipt, weekly sales, stock cover, sell-through, which stock is a candidate, how many units to move) is plain TypeScript in `lib/`. The AI is handed candidates that code already found and may only order them, write a one-line reason, and drop ones the owner's note rules out. Its answer is then checked by code.

## Stack

Next.js 16 (App Router) and React 19, TypeScript, Tailwind CSS 4, Recharts (charts), Lucide (icons), papaparse (CSV). No database. The AI is called through OpenRouter (`google/gemini-3.1-flash-lite`), server side only.

> This is a recent Next.js with changed conventions. `AGENTS.md` points at the bundled docs in `node_modules/next/dist/docs/`. Read them before changing routing or rendering.

## Data flow

```
Browser                                   Server (app/api/analyze/route.ts)
-------                                   ---------------------------------
CSV files + note + sales window  ──POST──►  validate files            (lib/validate.ts)
  ▲ live checks and preview                  merge by style            (lib/metrics.ts)
  │ (the same validate.ts runs here too)     find candidates           (lib/candidates.ts)
  │                                          rank + explain            (lib/rank.ts → OpenRouter)
  │                                          check the AI's answer     (lib/rank.ts)
result  ◄──────────────JSON──────────────   return rows, candidates, actions, left-out list
  │
  ▼ saved in the browser (lib/appState.ts, localStorage)
Overview · Action Centre · Inventory · Stores · Activity · Rules
(every page derives its numbers from the same saved rows: lib/derive.ts, lib/risk.ts)
```

Changing the sales window sends the **saved rows** back to the same route (the `rows` field) instead of the files, so the files don't need uploading again.

## File map

### `app/` (pages and the API)

| File | Role |
|---|---|
| `layout.tsx` | Fonts, page title, wraps everything in the app shell. |
| `page.tsx` | **Overview**: KPIs, charts, top priorities; empty state with the demo button. |
| `actions/page.tsx` | **Action Centre**: filter tabs, status counts, the cards, "left out by the AI", recent decisions. |
| `inventory/page.tsx` | **Inventory**: search, filters, sorting, pagination, detail sheet. |
| `stores/page.tsx` | **Stores**: summaries, charts, product-by-store matrix, cross-store gaps. |
| `import/page.tsx` | **Data Imports**: drop zone, per-file checks, sales window, notes, review, process. |
| `activity/page.tsx` | **Activity & Reports**: summary, data quality, biggest risks, the log, clear data. |
| `rules/page.tsx` | **Rules**: edit the thresholds. |
| `api/analyze/route.ts` | The only server endpoint (see below). |
| `globals.css` | Design tokens (colours, fonts) and base styles. |

### `components/`

| File | Role |
|---|---|
| `AppShell.tsx` | Sidebar, header (data freshness, sales window button), phone menu and bottom bar, toasts. |
| `ActionCard.tsx` | One action: evidence panel, approve / edit / reject dialogs, verification, transfer note. |
| `SalesWindowControl.tsx` | The sales-window form and the dialog that re-runs the analysis. |
| `ColumnMatcher.tsx` | The "match this file's columns" panel on Data Imports. |
| `ChartDateFilter.tsx` | The "Chart dates" bar. |
| `charts.tsx` | The four Recharts charts. |
| `status.tsx` | Status, type, priority, evidence-strength and risk badges. |
| `ui.tsx` | Cards, buttons, badges, tooltip, dialog (native `<dialog>`), tabs, skeleton. |

### `lib/` (all the logic)

| File | Role |
|---|---|
| `config.ts` | Fixed settings (limits, model), the adjustable `Thresholds` with defaults and allowed ranges. |
| `types.ts` | Shared types (`StockRow`, `Candidate`, `RankedAction`, `AnalyzeResponse`, ...). |
| `validate.ts` | CSV checks: columns, whole numbers, dates, duplicates. Returns errors, warnings, rows, per-file reports. |
| `columnMap.ts` | Column matching for billing exports: guesses which column is which, rewrites the file with Rerack's six columns in the browser, and remembers the choice per set of column names (`localStorage` key `rerack-column-maps-v1`). The server only ever sees Rerack's column names. |
| `metrics.ts` | Weekly sales, stock cover, sell-through, and merging rows into styles. |
| `candidates.ts` | The transfer and markdown rules, each with its step-by-step calculation and limitations. |
| `risk.ts` | Classifies each line: at risk, watch, fast seller, healthy, too new. |
| `rank.ts` | The AI call, the checks on its answer, the balanced-list rule, and the fallback. |
| `prompt.ts` | The AI's instructions and its required JSON answer shape. |
| `window.ts` | Sales-window rules: validation, presets, wording ("4 weeks"). |
| `chartRange.ts` | The chart date filter's shared state and received-date arithmetic. |
| `derive.ts` | KPI, chart and matrix numbers derived from the lines. |
| `appState.ts` | Everything the app remembers (dataset, decisions, activity, rules, window). |
| `client.ts` | Browser helpers: send files, re-analyse, run the demo. |
| `actionText.ts` | Edited headlines, transfer preview, transfer note text. |
| `demoData.ts` | Generates the fictional demo chain and the CSV template. |
| `format.ts`, `toast.ts`, `windowUi.ts` | Number and date formatting, toasts, small UI stores. |

### `sample-data/`

`indiranagar.csv`, `koramangala.csv`, `whitefield.csv`, `jayanagar.csv`, `hsr-layout.csv` are the five demo stores. `bad-*` files are deliberately broken inputs for testing the error messages. `bad-not-a-number.csv` uses the older `units_sold_4w` column name on purpose.

## The calculations

For a window of `D` days, `weeks = D / 7`.

- **Weekly sales** = `sold / weeks`
- **Stock cover (weeks)** = `on hand / weekly sales`, or `null` ("No sales") when `sold = 0`. Never a division by zero.
- **Sell-through** = `sold / (sold + on hand)`, or `null` when both are 0.
- **Days since receipt** = days between `date_received` and the day the data was processed.

### Risk classification (`lib/risk.ts`), first match wins

1. Nothing on hand: **fast seller** if it sold, otherwise **healthy**.
2. Received fewer than `newStockDays` ago: **too new to judge**.
3. At least `markdownMinDays` old and cover is `null` or at least `markdownMinChainCoverWeeks`: **at risk**.
4. At least `moveSourceMinDays` old and cover is `null` or at least `moveSourceMinCoverWeeks`: **watch**.
5. Sold something and cover is at most `moveDestMaxCoverWeeks`: **fast seller**.
6. Otherwise **healthy**.

### Transfer candidates (`lib/candidates.ts`)

For each style, for each *source* store (old enough, plenty of cover or no sales) and each *destination* store (selling, running low):

```
spare units at the source   = floor(on hand − weekly sales × moveSourceKeepWeeks)
room at the destination     = floor(weekly sales × moveDestTargetWeeks − on hand)
units to move               = min(spare, room)         (skipped if below moveMinUnits)
```

A source's spare units are shared out between destinations, biggest need first, so the same unit is never promised twice.

### Markdown candidates

A style is a markdown candidate when, across the whole chain, its cover is at least `markdownMinChainCoverWeeks` (or there are no sales), and some of its stock is at least `markdownMinDays` old and **not already being moved away**. One candidate per style, listing the old stores.

### Ranking and the balanced list

Candidates are ordered by **value at risk** = units × days since receipt. A weekly list is capped at `topShown` (10) and includes at least `minPerType` (4) transfers and 4 markdowns when available, because markdowns add up stock across stores and would otherwise always outrank transfers.

## The AI contract (`lib/rank.ts`, `lib/prompt.ts`)

- **Sent:** a shortlist (the best 12 of each type), each with code-calculated figures and the sales window, plus the owner's note.
- **Required reply:** JSON matching a schema: `ranked` (id, rank, reason) and `skipped` (id, why).
- **Checks on the reply:**
  - ids that aren't real candidates, or are duplicated, are thrown away (and counted on screen);
  - a reason quoting a number that isn't in that candidate's data gets a ⚠ tag;
  - if the AI under-represents transfers or markdowns, rule-ranked ones are swapped in and labelled "from rules";
  - if the call fails, times out, or returns nothing usable, the rule-based list is shown with a banner saying why.
- **Known limit:** the ⚠ check can't catch a *real* number paired with the wrong meaning (for example a sales count attached to the wrong period). The evidence panel shows the truth beside it.

## The API: `POST /api/analyze`

Form data, one of two ways in:

| Field | Meaning |
|---|---|
| `files` (repeated) and `stores` (repeated, same order) | Uploaded CSVs and their store names. |
| `rows` | Instead of files: JSON of already-checked rows, to re-analyse. Every field is re-checked. At most 5,000 rows. |
| `note` | Owner's note, up to 2,000 characters. |
| `thresholds` | JSON of the rules; each value is clamped to its allowed range. |
| `windowDays` | Sales window length, clamped to 7 to 366. Anything else becomes 28. |

Limits: 30 files, 1 MB each. Function time limit 60 s; the AI call times out at 45 s.

Replies are always HTTP 200 with JSON: `{ ok: false, errors }` for problems with the input (the AI is **not** called), or `{ ok: true, actions, skipped, candidates, rows, warnings, usedAi, aiProblem, windowDays, ... }`.

## State and storage

Everything the app remembers is one object in the browser's `localStorage` under the key `rerack-state-v3`: the processed dataset, decisions, activity log, the rules and the chosen sales window. There is no database, so:

- it survives a refresh but is **per browser and per device**;
- clearing browser data removes it ("Clear data on this device" does it on purpose);
- the chart date filter is held in memory only and resets on a refresh.

If the saved shape changes, bump the key (it is currently `v3`) so old saved data can't confuse new code.

## Rendering notes

Pages are client components that read saved state with `useSyncExternalStore`. Until the browser has loaded it they show a skeleton (`useHydrated`), which avoids a flash of "no data". Code that reads the clock (`new Date()`) must not run while Next.js pre-renders, or the production build fails; the codebase reads the date only inside event handlers or through `useTodayIso`.

## Testing status

There are **no automated tests**. Verification so far has been manual and scripted against the running app:

- type check (`npx tsc --noEmit`), lint (`npm run lint`) and a production build (`npm run build`) all pass;
- the three acceptance tests, bad-input cases, approval flow, sales window and chart dates were exercised in a browser at phone and desktop widths, with figures checked against independent counts from the saved data.

Adding unit tests for `lib/metrics.ts`, `lib/candidates.ts`, `lib/validate.ts` and `lib/window.ts` is the most valuable next step, since they are pure functions.
