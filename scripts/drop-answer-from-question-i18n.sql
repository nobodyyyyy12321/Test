-- Phase D of "move answer from question_i18n up to questions".
-- Run AFTER deploying the Phase D code changes (which stop writing
-- to question_i18n.answer). Otherwise live writes will fail.
--
-- This script:
--   1. Verifies questions.answer has no null rows
--   2. Enforces NOT NULL on questions.answer
--   3. Drops question_i18n.answer
--
-- Reloads PostgREST schema cache at the end.

do $$
declare
  null_count int;
begin
  select count(*) into null_count from questions where answer is null;
  if null_count > 0 then
    raise exception 'Refusing to enforce NOT NULL: % rows in questions.answer are null', null_count;
  end if;
end $$;

alter table questions alter column answer set not null;

alter table question_i18n drop column answer;

notify pgrst, 'reload schema';

-- Rollback (Phase D only):
--   alter table question_i18n add column answer text not null default '';
--   alter table questions alter column answer drop not null;
-- Note: rollback restores the column but NOT the data, since dropping the
-- column is destructive. Run only if Phase A backfill is intact and a
-- per-language answer was not actively edited after Phase C.
