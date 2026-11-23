# Contact form setup (Supabase + Gmail)

The landing page at `/landing` has a contact form. When someone submits it:

1. The browser checks the fields and sends JSON to `POST /api/contact`.
2. The server checks them again, then **inserts a row** into the Supabase table `contact_messages` (Row-Level Security on).
3. The server sends two emails through Gmail: a **notification to the owner** and an **automatic acknowledgement** to the visitor.

```
Visitor's browser ──JSON──▶ /api/contact (server) ──INSERT──▶ Supabase (RLS: insert only)
                                   └──SMTP──▶ Gmail ──▶ owner's inbox + visitor's inbox
```

The secrets (Supabase key, Gmail app password) live only on the server, in `.env.local`. The browser never sees them.

## 1. Supabase (about 5 minutes)

1. Create a free project at [supabase.com](https://supabase.com) (Dashboard → New project).
2. Open **SQL Editor → New query**, paste the whole of [`supabase/contact_messages.sql`](../supabase/contact_messages.sql), and press **Run**. This creates the table and turns on RLS.
3. Open **Table Editor**: `contact_messages` should show an **RLS enabled** badge.
4. Open **Project Settings → API** and copy the **Project URL** and the **anon public** key.

**Why RLS matters.** The anon key can be extracted by anyone who finds it, so the database must not trust it. With RLS on, the only thing the anon key may do is `INSERT` a row (the single policy in the SQL file). It cannot read, change or delete anything, so nobody can pull other people's names and emails out of the table. You read submissions in the dashboard, which bypasses RLS because you are the owner. Never put the `service_role` key in this app.

## 2. Gmail app password (about 3 minutes)

1. On the Gmail account that will send the emails, turn on **2-Step Verification** (myaccount.google.com → Security).
2. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords), create an app password named "Rerack", and copy the 16 characters Google shows.
3. This is not your normal Gmail password. If it leaks, delete it on the same page and make a new one.

## 3. Add the keys

Copy `.env.example` to `.env.local` (git-ignored) and fill in:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=...
GMAIL_USER=you@gmail.com
GMAIL_APP_PASSWORD=abcd efgh ijkl mnop
OWNER_EMAIL=you@gmail.com
```

Then **restart `npm run dev`**. Next.js reads `.env.local` only at startup.

For the live site, add the same variables in Vercel → Project → Settings → Environment Variables, then redeploy.

## 4. Test it (the "done when" checklist)

1. Open http://localhost:3000/landing (or the deployed URL) and scroll to the form.
2. Have a friend or classmate submit a real question using **their own email address**.
3. Show three things:
   - **The row:** Supabase → Table Editor → `contact_messages`.
   - **The notification:** an email "New Rerack enquiry from …" in the owner's inbox. Pressing Reply answers the visitor.
   - **The reply:** an email "We got your message - Rerack" in the classmate's inbox. Check Spam if it doesn't appear in a minute.
4. Optional proof that RLS works: in the SQL Editor, run `select * from contact_messages;` (works, you're the owner). Then try reading the table with the anon key from outside, for example `curl "$SUPABASE_URL/rest/v1/contact_messages?select=*" -H "apikey: $SUPABASE_ANON_KEY"`. It returns an empty list, not the messages.

## If something doesn't work

| What you see | Likely cause |
|---|---|
| "The contact form isn't connected to its database yet" | `SUPABASE_URL` or `SUPABASE_ANON_KEY` missing, or the server wasn't restarted. |
| "We couldn't save your message just now" | The SQL wasn't run, or the table name differs. The terminal shows the Supabase error code (`42501` means a missing insert policy; `42P01` means the table doesn't exist). |
| Success message says the confirmation email didn't go out | Row saved, Gmail refused. Check `GMAIL_USER`, the app password (spaces are fine), and that 2-Step Verification is on. The terminal prints the reason. |
| Emails land in Spam | Normal for a new sender. Mark "Not spam" once. A verified domain with Resend avoids this. |

## What the server checks

Name 2 to 80 characters, a plausible email, an optional store-count from a fixed list, and a message of 10 to 2000 characters. Line breaks are removed from names and emails so they can't inject email headers, anything shown in an email is HTML-escaped, a hidden "honeypot" field catches simple bots, and there's a small per-IP rate limit (5 per 10 minutes). The database repeats the length checks as constraints.
