-- ============================================================================
-- Learning Platform - Task 10.1: "Test before paying" preview seed
--
-- Inserts one representative preview row per section/type for the Japanese
-- course, so the course landing taster shows the full range of the experience.
-- Each row's `ref` points at an existing in-app exercise/lesson; the taster UI
-- lists these, and (wired in code) opens them in preview mode.
--
-- Run in the Supabase SQL editor (Tokyo project). Safe to re-run.
-- ============================================================================

-- Clear existing preview rows for this course so re-runs stay clean.
delete from public.course_content
where course_id = 'japanese-beginner' and is_preview = true;

insert into public.course_content (course_id, kind, ref, data, is_preview, sort_order)
values
  ('japanese-beginner', 'hiragana',   'hiragana:vowels',        '{"title":"Hiragana: vowels あ-お","route":"#/kana/hiragana?groups=vowels"}'::jsonb, true, 1),
  ('japanese-beginner', 'katakana',   'katakana:vowels',        '{"title":"Katakana: vowels ア-オ","route":"#/kana/katakana?groups=vowels"}'::jsonb, true, 2),
  ('japanese-beginner', 'kanji',      'kanji:numbers',          '{"title":"Kanji: numbers 一-十","route":"#/kana/kanji?groups=numbers"}'::jsonb, true, 3),
  ('japanese-beginner', 'vocabulary', 'vocab:v001',             '{"title":"Vocabulary: everyday verbs","route":"#/vocab/beginner/v001"}'::jsonb, true, 4),
  ('japanese-beginner', 'reading',    'reading:r001',           '{"title":"Reading: a short passage","route":"#/reading/beginner/r001"}'::jsonb, true, 5),
  ('japanese-beginner', 'listening',  'listening:l001',         '{"title":"Listening: a short clip","route":"#/listening/beginner/l001"}'::jsonb, true, 6),
  ('japanese-beginner', 'dictation',  'dictation:d001',         '{"title":"Dictation: type what you hear","route":"#/dictation/beginner/d001"}'::jsonb, true, 7),
  ('japanese-beginner', 'grammar',    'grammar:g001',           '{"title":"Grammar: は (topic marker)","route":"#/grammar/beginner/g001"}'::jsonb, true, 8);

-- Verify:
--   select kind, ref, is_preview, sort_order from course_content
--   where course_id='japanese-beginner' order by sort_order;
