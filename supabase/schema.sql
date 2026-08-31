-- Live by Friday: leads table, RLS policies and storage bucket.
-- Run this once in the Supabase SQL editor for a fresh project.

-- 1. The leads table
create table if not exists public.leads (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),

  -- from the intake form
  business_name  text not null,
  trade          text,
  one_liner      text,
  area           text,
  services       jsonb not null default '[]'::jsonb,
  contact_name   text,
  phone          text,
  email          text not null,
  address        text,
  hours          text,
  domain_wanted  text,
  domain_existing text,
  style          text,
  palette        text,
  photo_paths    jsonb not null default '[]'::jsonb,
  notes          text,
  plan           text not null default 'site',
  route          text not null default 'preview_first',
  promo_code     text,

  -- set by the build function
  brief          jsonb,
  site_html      text,
  built_at       timestamptz,

  -- set by the Stripe webhook
  status         text not null default 'new',
  stripe_session_id text,
  amount_paid    integer,
  paid_at        timestamptz,

  -- set when the site goes live
  live_url       text
);

-- 2. Row level security: the anon key can insert and nothing else.
--    The service role key bypasses RLS, so the functions can read and write.
alter table public.leads enable row level security;

create policy "Anyone can insert a lead"
  on public.leads for insert
  to anon
  with check (true);

-- 3. Storage bucket for intake photos.
insert into storage.buckets (id, name, public)
values ('intake', 'intake', false)
on conflict (id) do nothing;

-- Allow anonymous uploads into the intake bucket (the form uses the anon key).
create policy "Anon can upload intake photos"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'intake');
