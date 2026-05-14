-- Phase A of "move answer from question_i18n up to questions".
-- The answer key ('A', 'B', or JSON-encoded array for multi-select) is
-- language-invariant, so it belongs on the language-agnostic questions
-- row, not duplicated across question_i18n rows.
--
-- This script is additive and reversible:
--   * adds questions.answer (nullable for now)
--   * backfills from question_i18n, preferring zh-TW
--   * leaves question_i18n.answer in place
--
-- Run audit-question-answer-disagreements.sql first to confirm no
-- cross-language disagreements (or to consciously accept zh-TW wins).
--
-- Subsequent phases (handled in code/later migrations):
--   B. dual-write to both columns
--   C. switch reads to questions.answer
--   D. enforce NOT NULL on questions.answer; drop question_i18n.answer

alter table questions
  add column if not exists answer text;

-- Backfill: prefer zh-TW, otherwise the first non-empty answer by lang.
with picked as (
  select distinct on (question_id)
    question_id,
    answer
  from question_i18n
  where nullif(trim(answer), '') is not null
  order by question_id, (lang = 'zh-TW') desc, lang
)
update questions q
set answer = picked.answer
from picked
where picked.question_id = q.id
  and q.answer is null;

-- Reload PostgREST schema cache so the new column is queryable via REST.
notify pgrst, 'reload schema';

-- Rollback (Phase A only):
--   alter table questions drop column answer;
