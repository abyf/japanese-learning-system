-- ============================================================================
-- Learning Platform - Row Level Security (RLS) Policies
-- Task 1.3 (spec: .kiro/specs/learning-platform)
--
-- Run AFTER db/schema.sql, in the Supabase SQL editor (Tokyo project).
--
-- Security model (defense in depth):
--   * The browser uses the ANON key + the signed-in user's JWT (role
--     'authenticated'). RLS below is what actually protects the data for that
--     path.
--   * The backend uses the SERVICE_ROLE key, which BYPASSES RLS. All writes to
--     entitlements and payment_events, and all reads of GATED content served to
--     entitled users, go through the backend/service role only.
--
-- Principle: clients can read public catalog + preview + their own rows, and
-- write only their own profile/progress. Clients can NEVER write entitlements
-- or payment_events, and can NEVER read gated content or other users' rows.
-- ============================================================================

-- Enable RLS on all application tables ---------------------------------------
alter table public.profiles       enable row level security;
alter table public.courses        enable row level security;
alter table public.prices         enable row level security;
alter table public.course_content enable row level security;
alter table public.entitlements   enable row level security;
alter table public.progress       enable row level security;
alter table public.payment_events enable row level security;

-- Idempotency: drop existing policies so this script can be re-run -----------
do $$
declare r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles','courses','prices','course_content',
                        'entitlements','progress','payment_events')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- profiles: a user can read/update only their own profile.
-- (Inserts happen via the signup trigger, which runs as security definer.)
-- ----------------------------------------------------------------------------
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ----------------------------------------------------------------------------
-- courses: anyone (even anonymous) may read PUBLISHED courses. No client writes.
-- ----------------------------------------------------------------------------
create policy courses_select_published on public.courses
  for select to anon, authenticated
  using (is_published = true);

-- ----------------------------------------------------------------------------
-- prices: anyone may read ACTIVE prices for PUBLISHED courses. No client writes.
-- ----------------------------------------------------------------------------
create policy prices_select_active on public.prices
  for select to anon, authenticated
  using (
    is_active = true
    and exists (
      select 1 from public.courses c
      where c.id = prices.course_id and c.is_published = true
    )
  );

-- ----------------------------------------------------------------------------
-- course_content: anyone may read PREVIEW rows of PUBLISHED courses only.
-- Gated (is_preview = false) rows are NOT readable via anon/authenticated keys;
-- the backend serves them with the service role after an entitlement check.
-- ----------------------------------------------------------------------------
create policy course_content_select_preview on public.course_content
  for select to anon, authenticated
  using (
    is_preview = true
    and exists (
      select 1 from public.courses c
      where c.id = course_content.course_id and c.is_published = true
    )
  );

-- ----------------------------------------------------------------------------
-- entitlements: a user may READ only their own entitlements.
-- No client INSERT/UPDATE/DELETE at all -> only the service role (backend,
-- via verified webhooks) may write. (No write policies are defined, so with
-- RLS enabled all client writes are denied.)
-- ----------------------------------------------------------------------------
create policy entitlements_select_own on public.entitlements
  for select to authenticated
  using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- progress: a user may read/insert/update/delete only their own progress.
-- ----------------------------------------------------------------------------
create policy progress_select_own on public.progress
  for select to authenticated
  using (user_id = auth.uid());

create policy progress_insert_own on public.progress
  for insert to authenticated
  with check (user_id = auth.uid());

create policy progress_update_own on public.progress
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy progress_delete_own on public.progress
  for delete to authenticated
  using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- payment_events: NO client access whatsoever. Service role only.
-- (RLS enabled + no policies => every client operation is denied.)
-- ----------------------------------------------------------------------------
-- (intentionally no policies)

-- ============================================================================
-- Verification queries (run these and paste the results back):
--
-- 1) Tables + RLS status:
--    select relname as table_name, relrowsecurity as rls_enabled
--    from pg_class
--    where relnamespace = 'public'::regnamespace and relkind = 'r'
--    order by relname;
--
-- 2) Policies installed:
--    select tablename, policyname, cmd, roles
--    from pg_policies where schemaname = 'public'
--    order by tablename, policyname;
--
-- Expected: RLS = true on all 7 tables; policies present for profiles(2),
-- courses(1), prices(1), course_content(1), entitlements(1), progress(4),
-- and NONE for payment_events.
-- ============================================================================
