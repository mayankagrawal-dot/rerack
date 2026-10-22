# Rerack

A weekly action list for clothing chains: upload each store's stock CSV and get a short, ranked list of what to **move** between stores or **mark down**, with a one-line reason for each. The owner approves or rejects every action; nothing is applied automatically.

**Code does every number. The AI only ranks and explains.** Days since receipt, sales rate, weeks of stock left and sell-through are plain arithmetic in `lib/metrics.ts`, and the move/markdown rules live in `lib/candidates.ts` and `lib/config.ts`. One AI call (`lib/rank.ts`) ranks those candidates, writes a reason for each, and reads the owner's free-text note (for example "Diwali in 3 weeks" or "Store B closed"). Code then checks the AI's answer, and if the AI is unavailable the rule-based list is shown with a banner.

## Run it

```bash
npm install
```

Create `.env.local` in the project root with your OpenRouter key (never commit this file):

```
OPENROUTER_API_KEY=sk-or-v1-...
```

```bash
npm run dev
```

Open http://localhost:3000, choose the five files in `sample-data/` (`store-a.csv` ... `store-e.csv`), add a note, and press **Analyze**. The `bad-*` files in the same folder show how bad input is handled.

## CSV template

`item, size, colour, date_received, units_on_hand, units_sold_4w` (one file per store; the file name is the store name).

## Not built yet (MVP scope)

Automatic nightly pull from billing software, AI matching of inconsistent item names, transfer notes to store managers, a price-change export, and results tracking. The approvals log is kept in the browser only.

## Deploy

Push to GitHub, import the repo on Vercel, and add `OPENROUTER_API_KEY` under Project Settings, Environment Variables.
