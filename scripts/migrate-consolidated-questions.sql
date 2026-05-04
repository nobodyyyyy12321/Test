-- Consolidate per-quiz question tables into one public table.
-- This script does three things:
-- 1) Creates public.quiz_questions_all if it does not exist.
-- 2) If schema quiz still exists, adds quiz_id to each legacy table and backfills it.
-- 3) If schema quiz still exists, upserts quiz.* rows into public.quiz_questions_all.

begin;

create table if not exists public.quiz_questions_all (
  id            bigserial primary key,
  quiz_id       text not null,
  number        numeric not null,
  title         text not null,
  type          text not null,
  options       jsonb,
  answer        jsonb,
  level         int,
  group_range   text,
  group_content text,
  source_schema text not null default 'public',
  source_table  text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (quiz_id, number)
);

create index if not exists quiz_questions_all_quiz_id_idx on public.quiz_questions_all(quiz_id);
create index if not exists quiz_questions_all_level_idx on public.quiz_questions_all(level);

-- Keep grants aligned with existing app access pattern.
grant select, insert, update, delete on public.quiz_questions_all to anon, authenticated, service_role;
alter table public.quiz_questions_all enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'quiz_questions_all'
      and policyname = 'allow_public_read'
  ) then
    create policy allow_public_read
      on public.quiz_questions_all
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;

do $$
declare
  rec record;
  has_options boolean;
  has_answer boolean;
  has_level boolean;
  has_group_range boolean;
  has_group_content boolean;
  has_content boolean;
  options_expr text;
  answer_expr text;
  level_expr text;
  group_range_expr text;
  group_content_expr text;
begin
  for rec in
    select tablename
    from pg_tables
    where schemaname = 'quiz'
  loop
    -- Add quiz_id to each source table and backfill from table name.
    execute format('alter table quiz.%I add column if not exists quiz_id text', rec.tablename);
    execute format(
      'update quiz.%I set quiz_id = %L where quiz_id is null or quiz_id = ''''',
      rec.tablename,
      rec.tablename
    );

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'quiz' and table_name = rec.tablename and column_name = 'options'
    ) into has_options;

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'quiz' and table_name = rec.tablename and column_name = 'answer'
    ) into has_answer;

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'quiz' and table_name = rec.tablename and column_name = 'level'
    ) into has_level;

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'quiz' and table_name = rec.tablename and column_name = 'group_range'
    ) into has_group_range;

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'quiz' and table_name = rec.tablename and column_name = 'group_content'
    ) into has_group_content;

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'quiz' and table_name = rec.tablename and column_name = 'content'
    ) into has_content;

    options_expr := case when has_options then 'options' else 'null::jsonb' end;
    answer_expr := case when has_answer then 'to_jsonb(answer)' else 'null::jsonb' end;
    level_expr := case when has_level then 'level' else 'null::int' end;
    group_range_expr := case when has_group_range then 'group_range' else 'null::text' end;

    if has_group_content then
      group_content_expr := 'group_content';
    elsif has_content then
      group_content_expr := 'content';
    else
      group_content_expr := 'null::text';
    end if;

    execute format(
      'insert into public.quiz_questions_all (
        quiz_id, number, title, type, options, answer, level, group_range, group_content, source_schema, source_table, updated_at
      )
      select
        coalesce(quiz_id, %L) as quiz_id,
        number,
        title,
        type,
        %s as options,
        %s as answer,
        %s as level,
        %s as group_range,
        %s as group_content,
        ''public'' as source_schema,
        ''quiz_questions_all'' as source_table,
        now() as updated_at
      from quiz.%I
      on conflict (quiz_id, number)
      do update
      set
        title = excluded.title,
        type = excluded.type,
        options = excluded.options,
        answer = excluded.answer,
        level = excluded.level,
        group_range = excluded.group_range,
        group_content = excluded.group_content,
        source_schema = excluded.source_schema,
        source_table = excluded.source_table,
        updated_at = now()',
      rec.tablename,
      options_expr,
      answer_expr,
      level_expr,
      group_range_expr,
      group_content_expr,
      rec.tablename
    );
  end loop;

  perform pg_notify('pgrst', 'reload schema');
end $$;

commit;
