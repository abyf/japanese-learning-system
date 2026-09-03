-- ============================================================================
-- Learning Platform - Database Schema (Supabase / PostgreSQL)
-- Task 1.2 (spec: .kiro/specs/learning-platform)
--
-- Provider-neutral, multi-course paid platform. Run this in the Supabase SQL
-- editor on the NEW Tokyo project, BEFORE db/policies.sql.
--
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE where possible.
-- ============================================================================

-- Extensions ----------------------------------------------------------------
create extension if not exists "pgcrypto";      -- gen_random_uuid(), etc.

-- ----------------------------------------------------------------------------
-- profiles: one row per auth user (linked to Supabase auth.users)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- courses: catalog entries (Course #1 = 'japanese-beginner')
-- ----------------------------------------------------------------------------
create table if not exists public.courses (
  id           text primary key,               -- slug, e.g. 'japanese-beginner'
  title        text not null,                  -- e.g. 'Japanese for Beginners'
  language     text not null,                  -- e.g. 'ja'
  level        text,                           -- e.g. 'beginner'
  description  text,
  sort_order   integer not null default 0,
  is_published boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- prices: three plans per course, provider-neutral
--   plan_type: 'monthly' | 'annual' | 'lifetime'
--   provider : 'paddle' (initial)   provider_price_id: provider's price id
-- ----------------------------------------------------------------------------
create table if not exists public.prices (
  id                bigint generated always as identity primary key,
  course_id         text not null references public.courses(id) on delete cascade,
  plan_type         text not null check (plan_type in ('monthly','annual','lifetime')),
  provider          text not null default 'paddle',
  provider_price_id text,                       -- filled in after creating prices in the provider
  amount_cents      integer not null,           -- e.g. 900 / 10000 / 30000
  currency          text not null default 'USD',
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  unique (course_id, plan_type, provider)
);

-- ----------------------------------------------------------------------------
-- course_content: content units; is_preview marks the free "Test before paying"
--   kind = section/type: 'hiragana','katakana','kanji','vocabulary','reading',
--                        'listening','dictation','grammar', ...
-- ----------------------------------------------------------------------------
create table if not exists public.course_content (
  id         bigint generated always as identity primary key,
  course_id  text not null references public.courses(id) on delete cascade,
  kind       text not null,
  ref        text not null,                     -- content reference/slug
  data       jsonb not null default '{}'::jsonb,
  is_preview boolean not null default false,
  sort_order integer not null default 0
);

-- ----------------------------------------------------------------------------
-- entitlements: per-user access to a course (or all-access), lifecycle-managed
--   status: 'active' | 'canceled' | 'expired' | 'refunded' | 'past_due'
--   current_period_end NULL => lifetime / non-expiring
-- ----------------------------------------------------------------------------
create table if not exists public.entitlements (
  id                       bigint generated always as identity primary key,
  user_id                  uuid not null references public.profiles(id) on delete cascade,
  course_id                text references public.courses(id) on delete cascade,  -- NULL when all_access
  all_access               boolean not null default false,
  status                   text not null default 'active'
                             check (status in ('active','canceled','expired','refunded','past_due')),
  source                   text not null default 'purchase'
                             check (source in ('purchase','grant','trial')),
  plan_type                text check (plan_type in ('monthly','annual','lifetime')),
  provider                 text not null default 'paddle',
  provider_customer_id     text,
  provider_subscription_id text,
  provider_price_id        text,
  current_period_end       timestamptz,         -- NULL = lifetime / non-expiring
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (user_id, course_id, provider)
);

create index if not exists idx_entitlements_user      on public.entitlements(user_id);
create index if not exists idx_entitlements_user_course on public.entitlements(user_id, course_id);
create index if not exists idx_entitlements_sub        on public.entitlements(provider_subscription_id);

-- ----------------------------------------------------------------------------
-- progress: per-user, per-course learning progress
-- ----------------------------------------------------------------------------
create table if not exists public.progress (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  course_id  text not null references public.courses(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

-- ----------------------------------------------------------------------------
-- payment_events: audited webhook log (idempotency by provider event id)
--   status: 'processed' | 'unmatched' | 'error'
-- ----------------------------------------------------------------------------
create table if not exists public.payment_events (
  id          text primary key,                 -- provider event id (idempotency key)
  provider    text not null default 'paddle',
  event_name  text,
  payload     jsonb,
  status      text not null default 'processed'
                check (status in ('processed','unmatched','error')),
  received_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Trigger: auto-create a profiles row when a new auth user signs up.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Trigger: keep entitlements.updated_at current on update.
-- ----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_entitlements_touch on public.entitlements;
create trigger trg_entitlements_touch
  before update on public.entitlements
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- Next: run db/policies.sql to enable RLS and install access policies.
-- ============================================================================
