-- Run this once in Supabase: Project → SQL Editor → New query → paste → Run.

create table if not exists kv_store (
  user_id uuid references auth.users not null,
  key text not null,
  value jsonb not null,
  updated_at timestamptz default now(),
  primary key (user_id, key)
);

alter table kv_store enable row level security;

-- Each logged-in user can only read/write their own rows — this is what keeps
-- your project data private even though the app itself is deployed publicly.
create policy "Users manage their own data"
on kv_store
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
