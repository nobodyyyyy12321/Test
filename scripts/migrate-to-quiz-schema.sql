-- DEPRECATED (2026-05): quiz schema has been removed.
--
-- This project now stores all collection questions in:
--   public.quiz_questions_all
--
-- Do NOT run the old quiz-schema migration flow again.
-- Use scripts/migrate-consolidated-questions.sql for historical imports,
-- and scripts/supabase-schema.sql for baseline schema setup.

do $$
begin
  raise notice 'scripts/migrate-to-quiz-schema.sql is deprecated and intentionally no-op.';
end $$;
