-- Run this in the Supabase Dashboard → SQL → New query, then execute.
-- Also enable Email auth: Authentication → Providers → Email (magic link).

create table if not exists public.expense_tracker_snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists expense_tracker_snapshots_updated_at_idx
  on public.expense_tracker_snapshots (updated_at desc);

alter table public.expense_tracker_snapshots enable row level security;

drop policy if exists "expense_snapshots_select_own" on public.expense_tracker_snapshots;
drop policy if exists "expense_snapshots_insert_own" on public.expense_tracker_snapshots;
drop policy if exists "expense_snapshots_update_own" on public.expense_tracker_snapshots;

create policy "expense_snapshots_select_own"
  on public.expense_tracker_snapshots for select
  using (auth.uid() = user_id);

create policy "expense_snapshots_insert_own"
  on public.expense_tracker_snapshots for insert
  with check (auth.uid() = user_id);

create policy "expense_snapshots_update_own"
  on public.expense_tracker_snapshots for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
