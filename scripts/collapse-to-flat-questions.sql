-- Phase 1 of collapsing 4-table i18n schema into 2-table flat model.
-- Creates questions_new alongside the existing tables. Non-destructive.
--
-- After this:
--   1. Update upload script + readers/writers to use questions_new.
--   2. Re-upload all quizzes. This populates categories + questions_new.
--   3. Verify in app.
--   4. Run the cleanup script (separate file) to drop the old tables and
--      rename questions_new -> questions.

begin;

-- One row per question per language. The category it belongs to determines
-- language and ownership (via categories.language, categories.owner_id).
create table if not exists questions_new (
  id            uuid primary key default gen_random_uuid(),
  category_id   text not null references categories(id) on delete cascade,
  number        numeric not null,
  level         int,
  group_id      uuid,
  group_content text,
  content       text not null,
  options       jsonb not null default '[]',
  answer        text,                  -- nullable: group/passage rows have no answer
  explanation   text,
  is_machine_translated boolean not null default true,
  is_reviewed   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (category_id, number)
);

create index if not exists questions_new_category_id_idx on questions_new(category_id);
create index if not exists questions_new_group_id_idx    on questions_new(group_id);

alter table questions_new enable row level security;
grant select, insert, update, delete on questions_new to anon, authenticated, service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'questions_new' and policyname = 'allow_public_read'
  ) then
    create policy allow_public_read on questions_new
      for select to anon, authenticated using (true);
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
