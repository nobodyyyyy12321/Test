-- Phase 2 cleanup — run AFTER:
--   1. collapse-to-flat-questions.sql has created questions_new
--   2. upload script + readers have been switched to questions_new
--   3. all data has been re-uploaded and verified in the app
--
-- DESTRUCTIVE. Drops the old 4 i18n tables, wipes stale categories rows
-- with no questions linked, and renames questions_new -> questions.

begin;

-- Drop the old i18n tables (CASCADE handles any leftover FK references).
drop table if exists question_i18n cascade;
drop table if exists questions     cascade;  -- the OLD questions table
drop table if exists quiz_set_i18n cascade;
drop table if exists quiz_sets     cascade;

-- Remove any pre-existing categories rows that no longer have questions.
-- (Folders without children also get wiped — re-upload regenerates structure.)
delete from categories
where not exists (
  select 1 from questions_new q where q.category_id = categories.id
)
and not exists (
  select 1 from categories child where child.parent_id = categories.id
);

-- Promote questions_new to the canonical name.
alter table questions_new rename to questions;
alter index questions_new_category_id_idx rename to questions_category_id_idx;
alter index questions_new_group_id_idx    rename to questions_group_id_idx;

notify pgrst, 'reload schema';

commit;
