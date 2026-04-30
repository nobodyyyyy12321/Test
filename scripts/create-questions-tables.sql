-- Tables that back /admin/upload-collection and the GSAT read path in lib/questions.ts.
-- Run in the Supabase SQL editor of the project pointed to by NEXT_PUBLIC_TEST_SUPABASE_URL.

create table if not exists questions (
  exam_name text not null,
  number    int  not null,
  title     text not null,
  type      text not null,                 -- 'single_choice' | 'multiple_choice'
  options   jsonb not null default '{}'::jsonb,
  answer    text,
  primary key (exam_name, number)
);

create index if not exists questions_exam_name_idx on questions(exam_name);

create table if not exists question_groups (
  exam_name text not null,
  group_id  text not null,                 -- e.g. '1-3'
  content   text not null,
  primary key (exam_name, group_id)
);

create index if not exists question_groups_exam_name_idx on question_groups(exam_name);

-- After creating tables you may need to refresh PostgREST's schema cache.
-- In the SQL editor run:
--   notify pgrst, 'reload schema';
