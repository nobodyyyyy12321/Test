-- Cascade delete: when a category is removed, its questions go with it.
-- Drops any existing FK on questions.qsets_id (in case it was created without
-- cascade) and re-adds it with ON DELETE CASCADE.

begin;

alter table questions
  drop constraint if exists questions_qsets_id_fkey;

alter table questions
  add constraint questions_qsets_id_fkey
  foreign key (qsets_id) references categories(id) on delete cascade;

notify pgrst, 'reload schema';

commit;
