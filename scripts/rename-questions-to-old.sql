-- Rename the current questions table to questions_old to free up the name
-- for the new flat schema.
--
-- FKs from question_i18n.question_id continue to work (Postgres references
-- tables by OID, not name). Indexes keep their old names; rename for clarity.

begin;

alter table if exists questions rename to questions_old;

alter index if exists questions_pkey         rename to questions_old_pkey;
alter index if exists questions_set_id_idx   rename to questions_old_set_id_idx;
alter index if exists questions_group_id_idx rename to questions_old_group_id_idx;

notify pgrst, 'reload schema';

commit;
