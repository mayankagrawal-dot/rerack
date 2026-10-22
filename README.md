# Rerack

**A weekly action list for clothing chains: which stock is ageing, and should it be moved to another store or marked down now.**

Upload one stock CSV per store and get a short, ranked list of actions, each with its numbers and a one-line reason. The owner approves or rejects every action. Nothing is applied automatically.

> **The rule that shapes everything: code does every number. The AI only ranks and explains.**

Built as a hackathon MVP on sample data for a fictional 5-store chain (no real chain data exists yet).

---

## Job to be done

> **When** my stores' weekly sales and stock reports sit in separate files,
> **I want to** upload them and get a short ranked list of what to move between stores or mark down,
> **so I can** approve the right actions in minutes and stop ageing stock reaching the end-of-season sale.

**User:** the owner of a regional clothing chain with 3-30 stores (mainly India), who runs billing software or a retail ERP plus Excel, and who approves from a phone.

**The problem:** these owners spend hours a week merging store-wise sales and stock reports, because sales split across stores, sizes and colours hides which stock is ageing, so most of it ends up in the end-of-season sale. *The "6 hours a week" figure is an assumption from the problem statement; no research source confirms it.*

## The 3 tests the MVP must pass

| # | Test | How it is checked |
|---|---|---|
| 1 | Upload the 5 sample store CSVs plus a note, press **Analyze**, and **within 60 seconds** see a ranked top-10 list. Each card shows the action, its numbers and a one-line reason. | Timed in the browser. Measured 2.2 to 3.2 seconds. Numbers hand-checked against the CSVs. |
| 2 | On a phone-width screen, tap **Approve** or **Reject** and instantly see it **stamped with a time** and added to an approvals log. | Real taps at 375 px wide. The log also survives a page refresh. |
| 3 | **Bad input** (empty file, wrong file type, missing column, a non-number in a units field, fewer than 2 stores) gives a plain message naming the file and the problem. Nothing crashes, no half-made list appears, and the AI is not called. | 8 bad cases tried. Bad input returns in about 20 ms on the server, against 2 to 3 seconds when the AI runs. |

## Current workflow → future workflow

**Today (before Rerack)**

1. Plan and buy the season months ahead.
2. Record sales and stock per store in billing software or Excel.
3. **Export reports and merge them by hand in Excel.** Exports download by full period and need double-checking.
4. **Decide what to discount or move between stores.** How this is done today is a research gap.
5. Clear what's left at season end through deep markdowns.

**With Rerack**

1. Upload one CSV per store (in the full product this arrives automatically every night).
2. All stores merge into one view by style, size, colour and store.
3. Ageing stock is flagged: days since receipt, weeks of stock left at the current sales rate, and sell-through against the same style in other stores.
4. Actions are proposed, such as "Move 8 × Navy Kurta, size M, from Store A to Store C", or "Mark down 15% now instead of 50% at season end". Each shows its numbers and a one-line reason.
5. **The owner approves or rejects** each action on their phone. This step stays human, but it is much shorter.
6. The season-end sale remains, with less stock reaching it.

Rerack removes steps 3 and most of 4. The MVP covers steps 1 to 5 of the new workflow; the rest is listed under "Not built yet".

## Architecture: Input → AI → Logic → Action → Output

```
INPUT            LOGIC (before)         AI                    LOGIC (after)          ACTION            OUTPUT
store CSVs  →    validate files    →    rank the candidates → check the answer →     owner approves →  ranked cards
+ owner's note   merge by style         write one-line        drop unknown ids       or rejects        + facts + reason
                 ageing metrics         reasons               flag odd numbers       (timestamped)     + "left out" list
                 move/markdown rules    read the note         fall back to rules                       + approvals log
```

Logic runs **twice, before and after the AI**: the AI can only rank candidates that code has already found and calculated, and its answer must pass code checks.

| Stage | What happens | Where |
|---|---|---|
| **Input** | One CSV per store (`item, size, colour, date_received, units_on_hand, units_sold_4w`) and an optional free-text note. The file name is the store name. | `components/UploadPanel.tsx`, `app/page.tsx` |
| **Logic (before)** | Validate every file. Merge stores by style. Calculate days since receipt, weekly sales rate, weeks of stock left and sell-through. Find *move* and *mark down* candidates using thresholds in one config file. | `lib/validate.ts`, `lib/metrics.ts`, `lib/candidates.ts`, `lib/config.ts` |
| **AI** | One call. It receives the candidates (with code-calculated numbers) and the owner's note. It returns a ranking, a one-line reason per action, and the candidates it left out because of the note. | `lib/rank.ts`, `lib/prompt.ts` |
| **Logic (after)** | Throw away unknown or duplicate ids. Flag any reason that quotes a number code did not produce. If the AI fails or times out, show the rule-based order with a visible banner. | `lib/rank.ts` |
| **Action** | The owner taps Approve or Reject on each card. Each decision is stamped with a time and saved in an approvals log. | `components/ActionCard.tsx`, `lib/approvalLog.ts` |
| **Output** | Up to 10 cards. Each has the action, a **"Facts (calculated)"** line from code, the **"AI's reason"** in a separate box, and *AI rank vs rules rank* so any disagreement is visible. A collapsed section lists what the AI left out, and why. | `app/page.tsx` |

### The rules code uses (all in `lib/config.ts`)

- **Weekly sales rate** = units sold in the last 4 weeks / 4. **Weeks of stock left** = units on hand / weekly rate.
- **Move:** the same style has a surplus in one store (at least 45 days old, and 8 or more weeks of stock or no sales) and a shortage in another (3 or fewer weeks of stock and selling). Units moved = the smaller of the surplus and what the destination sells in about 6 weeks.
- **Mark down (15%):** at least 60 days old, 12 or more weeks of stock across the whole chain, and not already being moved.
- Candidates are sorted by **value at risk** (units × days the stock has sat).

## Where AI is used, and what stays human

**AI does one narrow job:** rank the candidates, write the one-line reasons, and read the owner's free-text note ("Diwali in 3 weeks", "Store B closed for repairs") to decide what to drop. A rule can't read that note without endless keyword lists.

**Plain code does everything else:** reading files, every number, the rules that find candidates, and checking the AI's answer. AI would add cost and risk to arithmetic with no gain. With an empty note the AI adds little beyond wording the reason.

**What stays human:**
- The owner chooses which files to upload and writes the note.
- The owner **approves or rejects every action**. Nothing is applied automatically.
- The owner carries out the transfer or the price change. The MVP sends no messages and changes no billing system.
- The thresholds (45 days, 8 weeks, 15%) are set in the config file, not by the owner.

## Why these tools

| Tool | Why |
|---|---|
| **Next.js** | One web app, one screen, with the API route in the same project. Deploys to Vercel with no extra setup. This replaces the separate n8n workflow in the original scope doc, so there is one system to learn and host. |
| **Vercel** | Hosts the app and deploys from GitHub on each push. |
| **GitHub** | Holds the app code, the AI prompt (`lib/prompt.ts`), the rules config (`lib/config.ts`) and the sample CSVs. |
| **OpenRouter + a Google Gemini model** | One API key for the AI call, kept on the server only. The original plan named Claude; this account's OpenRouter settings block Anthropic models, so the app uses `google/gemini-3.1-flash-lite`. The model name is one line in `lib/config.ts`. |
| **papaparse** | Reliable CSV parsing. |

## Failure cases, and what the screen does

| What goes wrong | What the user sees |
|---|---|
| **Bad file** (empty, not a CSV, missing column, a non-number, a bad date, fewer than 2 stores) | A plain message naming the file, the row and the problem. No list is shown, and the AI is not called. |
| **The AI invents or alters a number** | Every number on a card comes from code, in a separate "Facts (calculated)" line. A reason that quotes a number code did not produce gets a ⚠ tag. |
| **The AI pairs real numbers wrongly** (for example a sales count with the wrong time period) | The ⚠ check **cannot** catch this, because every number is real. The Facts line beside the reason shows the truth. The prompt forbids it, but it is a known limit. |
| **The AI misreads the note and drops an action** | Anything it leaves out appears in a collapsed "Left out by the AI" section with its reason, and can still be approved. |
| **The AI ranks differently from the rules** | Each card shows "AI rank 2 · rules rank 5", so disagreement is visible. |
| **The AI suggests something that isn't a real candidate** | Code discards it and the screen says how many were ignored. |
| **The AI is down, slow, out of credit or rate-limited** | The rule-based list still appears with a banner saying why the AI ranking is unavailable. |
| **Stock data is wrong** (a store's file is late, or billing differs from the shelf) | Rerack is only as good as the data it receives. Every action that moves goods or money needs the owner's approval, and a store manager should confirm the physical count before dispatch. |
| **A style held back on purpose** (a wedding or festival range) | The owner's note can protect it. Markdowns are never applied without approval. |

## How to run it locally

You need Node.js (LTS) and an [OpenRouter](https://openrouter.ai) API key.

```bash
git clone https://github.com/mayankagrawal-dot/rerack.git
cd rerack
npm install
```

Create a file named `.env.local` in the project root. It is ignored by git, so your key is never committed:

```
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Then start the app:

```bash
npm run dev
```

Open http://localhost:3000, choose the five files in `sample-data/` (`store-a.csv` to `store-e.csv`), type a note such as `Diwali in 3 weeks. Don't mark down Navy Kurta.`, and press **Analyze**. The `bad-*` files in the same folder show how bad input is handled.

Without a key the app still works: you get the rule-based list and a banner saying the AI ranking is unavailable.

To deploy on Vercel, import the GitHub repo and add `OPENROUTER_API_KEY` under Project Settings, Environment Variables.

## Not built yet

Out of scope for the MVP, listed in the scope doc as "mention, don't build":
- An automatic nightly pull from billing software (manual upload instead)
- AI matching of inconsistent item names (the template assumes clean, shared item codes)
- Transfer notes to store managers by WhatsApp or email
- A price-change export for the billing software
- Tracking whether approved actions worked

Later (v2): connectors for Ginesys, Zoho Inventory and Tally exports; name matching with owner confirmation; messages to store managers and parsing their replies; results tracking and a weekly summary; next-season buying suggestions from what didn't sell.

The approvals log is kept in the browser only (it survives a refresh, but doesn't follow the owner to another device).

## Sample data

`sample-data/store-a.csv` to `store-e.csv` describe a fictional 5-store chain with a mix of stale stock, fast sellers, and a few styles that are old everywhere. Dates are relative to the day the files were generated, so stock ages as time passes. The `bad-*` files are deliberately broken inputs for testing.
