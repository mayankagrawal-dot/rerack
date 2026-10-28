# Running and deploying Rerack

## What you need

- **Node.js** (current LTS) and npm.
- An **OpenRouter API key** (starts with `sk-or-v1-`) from [openrouter.ai](https://openrouter.ai). Without a key the app still works; it shows the rule-based list and a banner saying the AI ranking is unavailable.
- For hosting: a free [Vercel](https://vercel.com) account and this repository on GitHub.

## Run it on your computer

```bash
git clone https://github.com/mayankagrawal-dot/rerack.git
cd rerack
npm install
```

Create a file named `.env.local` in the project's top folder with one line:

```
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

No quotes, no spaces. The file is ignored by git (`.gitignore` covers `.env*`), so the key is never committed.

```bash
npm run dev
```

Open http://localhost:3000. Restart `npm run dev` after changing `.env.local`.

Other commands: `npm run build` (production build, the real test that it can deploy), `npm run lint`, and `npx tsc --noEmit` (type check).

## Deploy on Vercel

Rerack is a standard Next.js app, so Vercel needs no special settings.

1. **Import the repo.** On vercel.com choose Add New, Project, then import the GitHub repository. Leave the framework as Next.js.
2. **Add the key before the first deploy.** Project Settings, Environment Variables, add `OPENROUTER_API_KEY` for **Production**.
3. **Deploy.** From then on every push to the `main` branch deploys automatically.

You can also deploy from the command line after `npm install --global vercel` and `vercel login`: `vercel deploy --prod`.

### Important: changing a variable does not change a running site

Vercel gives each deployment a copy of the variables as they were at that moment. **After adding or changing `OPENROUTER_API_KEY` you must deploy again** (push a commit, press Redeploy in the dashboard, or run `vercel deploy --prod`).

### How to tell whether the live AI works

Open the site, load the demo and go to the **Action Centre**.

- No banner, and cards labelled "Why, written by the AI": the AI is working.
- An amber **"AI ranking unavailable"** banner: the AI wasn't used. The banner says why; see the table below.

You can also test the live server directly. This sends two sample stores and prints whether the AI was used:

```bash
curl -s -X POST https://YOUR-SITE.vercel.app/api/analyze \
  -F files=@sample-data/indiranagar.csv -F stores=A \
  -F files=@sample-data/koramangala.csv -F stores=B \
  -F windowDays=28 | head -c 400
```

Look for `"usedAi":true` (and for `"aiProblem"`, which names the cause when it is `false`).

## Troubleshooting

The banner's reason comes straight from the server. Find it here:

| The banner says | What it means | Fix |
|---|---|---|
| `no OpenRouter API key is set (missing)` | The variable doesn't exist in this deployment. | Add `OPENROUTER_API_KEY` for Production, then redeploy. |
| `no OpenRouter API key is set (empty)` | The variable exists but its value is empty. A paste that didn't register is the usual cause. | Remove the variable and add it again, checking the value box shows text before saving. Then redeploy. |
| `no OpenRouter API key is set (placeholder)` | The value still starts with `PASTE_`. | Replace it with the real key and redeploy. |
| `OpenRouter rejected the API key` | The key is wrong, revoked, or has a stray character. | Create a new key at openrouter.ai and set it again. |
| `the OpenRouter account is out of credit` | No credit left. | Add credit on OpenRouter. |
| `OpenRouter's rate limit was hit` | Too many requests too fast. | Wait a minute and try again. |
| `OpenRouter rejected the request or model name` | The model isn't allowed. OpenRouter accounts can block some models through their guardrail settings. | Allow the model in OpenRouter's settings, or change `model` in `lib/config.ts` to one your account allows. |
| `the AI took too long to answer` | No answer within 45 seconds. | Try again; if it keeps happening, choose a faster model in `lib/config.ts`. |
| `the AI's answer couldn't be used` | The reply wasn't in the required format. | Try again. The rule-based list is shown meanwhile. |
| `the AI couldn't be reached` | Network problem between the server and OpenRouter. | Check OpenRouter's status and try again. |

### Other problems

| Symptom | Cause and fix |
|---|---|
| The page flashes "no data" or shows an old dataset after an update | Saved data from an older version is in the browser. The storage key changes when the saved shape changes, so open **Explore the demo** again, or clear site data. |
| "Process data" is greyed out | At least two valid files and valid sales-window dates are required. The reasons are listed under each file. |
| A file is rejected as "missing the 'units_sold' column" | The column name is wrong. `units_sold` is the name; `units_sold_4w` and `units_sold_last_4_weeks` also work. |
| The production build fails with an error about the current time | Something reads `new Date()` while Next.js pre-renders. Read the date only inside an event handler, or use `useTodayIso` (`lib/windowUi.ts`). |
| Everything is gone after clearing browser data | Expected: there is no database. Data lives in the browser only. |

## Security notes

- The API key is read **only on the server** (`process.env.OPENROUTER_API_KEY` in `lib/rank.ts`). It is never sent to the browser. You can confirm by searching the page's downloaded files for `sk-or-v1`; there is none.
- Never put the key in code, in a commit, in a screenshot or in a chat. If a key was ever exposed, revoke it on OpenRouter and create a new one.
- Vercel's **Sensitive** variables are write-only: once saved, the dashboard won't show the value again. That is normal. To check one was saved, test the live site as above.
- The analysis endpoint spends your OpenRouter credit each time it calls the AI, and the site is public. For anything beyond a demo, add rate limiting or sign-in in front of `/api/analyze`.
- `.env.local` may also contain a `VERCEL_OIDC_TOKEN` written by the Vercel CLI. It is git-ignored; keep it that way.
