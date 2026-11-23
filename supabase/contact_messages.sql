-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- It creates the table the landing-page contact form writes to, and locks it down with Row-Level Security.

create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),   -- primary key: a unique id for every row
  created_at  timestamptz not null default now(),
  name        text not null check (char_length(name)  between 2 and 80),
  email       text not null check (char_length(email) between 5 and 254 and email like '%_@_%._%'),
  stores      text check (stores is null or char_length(stores) <= 40),
  message     text not null check (char_length(message) between 10 and 2000)
);

-- Row-Level Security: with RLS on and no policy, nobody can touch the table through the API.
alter table public.contact_messages enable row level security;

-- The one thing we allow: anyone (the public "anon" key) may INSERT a new row.
-- There is deliberately NO select, update or delete policy, so the table can't be read or changed through
-- the public API. The owner reads submissions in the Supabase dashboard (Table Editor), which bypasses RLS.
drop policy if exists "Anyone can send a message" on public.contact_messages;
create policy "Anyone can send a message"
  on public.contact_messages
  for insert
  to anon
  with check (true);

-- Quick checks after running:
--   select * from public.contact_messages;                        -- works here in the SQL Editor (you are the owner)
--   Table Editor shows an "RLS enabled" badge on the table.
