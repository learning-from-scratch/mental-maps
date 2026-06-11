-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query).

create table if not exists public.maps (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  document    jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists maps_owner_id_idx on public.maps (owner_id);
create index if not exists maps_updated_at_idx on public.maps (updated_at desc);

alter table public.maps enable row level security;

create policy "owners read own maps"
  on public.maps for select
  using (auth.uid() = owner_id);

create policy "owners insert own maps"
  on public.maps for insert
  with check (auth.uid() = owner_id);

create policy "owners update own maps"
  on public.maps for update
  using (auth.uid() = owner_id);

create policy "owners delete own maps"
  on public.maps for delete
  using (auth.uid() = owner_id);
