-- Phase D of "move answer from question_i18n up to questions".
-- Run AFTER deploying the Phase D code changes (which stop writing
-- to question_i18n.answer). Otherwise live writes will fail.
--
-- This script drops question_i18n.answer.
--
-- NOT NULL on questions.answer is intentionally NOT enforced: some rows
-- in the `questions` table are passage stubs (fractional numbers like
-- 5.5, 8.5, ...) that legitimately have no answer. Revisit once
-- passages are normalized into a separate question_groups table.

alter table question_i18n drop column answer;

notify pgrst, 'reload schema';

-- Rollback (Phase D only):
--   alter table question_i18n add column answer text not null default '';
-- Note: rollback restores the column but NOT the data, since dropping
-- the column is destructive. Run only if no live edits have touched
-- per-language answer state after Phase C.
