-- ============================================================================
-- Learning Platform - Seed Data
-- Task 1.5 (spec: .kiro/specs/learning-platform)
--
-- Run AFTER db/schema.sql (+ db/policies.sql). Seeds Course #1 and its three
-- placeholder prices. provider_price_id is left NULL and filled in later
-- (Task 7.5) once the Paddle sandbox prices exist.
--
-- Safe to re-run (upserts).
-- ============================================================================

-- Course #1: Japanese for Beginners -----------------------------------------
insert into public.courses (id, title, language, level, description, sort_order, is_published)
values (
  'japanese-beginner',
  'Japanese for Beginners',
  'ja',
  'beginner',
  'From your very first hiragana to lower-intermediate (JLPT N5~N4): kana, kanji, vocabulary, grammar, reading, listening and dictation — with human-quality audio, stroke order, and a guided 52-week plan.',
  1,
  true
)
on conflict (id) do update
  set title = excluded.title,
      language = excluded.language,
      level = excluded.level,
      description = excluded.description,
      sort_order = excluded.sort_order,
      is_published = excluded.is_published;

-- Placeholder prices (USD): monthly $9, annual $100, lifetime $300 -----------
-- provider_price_id filled in after creating the prices in Paddle (Task 7.5).
insert into public.prices (course_id, plan_type, provider, provider_price_id, amount_cents, currency, is_active)
values
  ('japanese-beginner', 'monthly',  'paddle', null,   900, 'USD', true),
  ('japanese-beginner', 'annual',   'paddle', null, 10000, 'USD', true),
  ('japanese-beginner', 'lifetime', 'paddle', null, 30000, 'USD', true)
on conflict (course_id, plan_type, provider) do update
  set amount_cents = excluded.amount_cents,
      currency = excluded.currency,
      is_active = excluded.is_active;

-- ============================================================================
-- Note: course_content preview rows (one per section) are seeded during
-- Task 10 (Course #1 integration), once we map the Japanese content sections.
-- ============================================================================
