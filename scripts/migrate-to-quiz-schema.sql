-- ════════════════════════════════════════════════════════════════════════════
-- Migrate dynamic quiz-collection tables out of the public schema
-- into a dedicated `quiz` schema, keeping users/lists/etc. cleanly in public.
--
-- HOW TO RUN:
--   1. Open Supabase Dashboard → SQL Editor and paste + run this entire file.
--   2. Then go to Dashboard → Project Settings → API → "Exposed schemas"
--      and add  quiz  to the list (comma-separated), then click Save.
--   3. Deploy (or restart) your app — no env-var changes required.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Create quiz schema & grant permissions ─────────────────────────────
create schema if not exists quiz;

grant usage on schema quiz to anon, authenticated, service_role;

alter default privileges in schema quiz
  grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema quiz
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema quiz
  grant all on functions to anon, authenticated, service_role;

-- ── 2. Replace create_collection_table_if_not_exists ─────────────────────
--    (creates new tables in quiz schema instead of public)
create or replace function public.create_collection_table_if_not_exists(p_table_name text)
returns void
language plpgsql
security definer
as $$
begin
  execute format(
    $sql$
    create table if not exists quiz.%I (
      number        numeric  primary key,
      title         text not null,
      type          text not null default 'single',
      options       jsonb,
      answer        jsonb,
      level         int,
      group_range   text
    )
    $sql$,
    p_table_name
  );

  -- Enable RLS
  execute format('alter table quiz.%I enable row level security', p_table_name);

  -- Allow anyone to read quiz questions (writes go through service_role which bypasses RLS)
  execute format(
    $sql$
    do $inner$
    begin
      if not exists (
        select 1 from pg_policies
        where schemaname = 'quiz'
          and tablename = %L
          and policyname = 'allow_public_read'
      ) then
        execute format(
          'create policy allow_public_read on quiz.%%I for select to anon, authenticated using (true)',
          %L
        );
      end if;
    end
    $inner$
    $sql$,
    p_table_name, p_table_name
  );

  perform pg_notify('pgrst', 'reload schema');
end
$$;

-- ── 3. Replace drop_collection_table_if_exists ────────────────────────────
create or replace function public.drop_collection_table_if_exists(p_table_name text)
returns void
language plpgsql
security definer
as $$
begin
  execute format('drop table if exists quiz.%I cascade', p_table_name);
  perform pg_notify('pgrst', 'reload schema');
end
$$;

-- ── 4. Migrate existing collection tables from public → quiz ──────────────
--    Reads collection_id from pcategories AND from href paths in cms.categories.
do $$
declare
  rec record;
begin
  for rec in
    -- source 1: pcategories (user-uploaded collections)
    select distinct collection_id
    from public.pcategories

    union

    -- source 2: public.categories hrefs of the form /test/<collectionId>
    --           and dropdown items with the same pattern
    select distinct
      substring(href from '^/test/([^?#/]+)') as collection_id
    from public.categories
    where href ~ '^/test/[^?#/]+'

    union

    select distinct
      substring(item->>'href' from '^/test/([^?#/]+)') as collection_id
    from public.categories,
         jsonb_array_elements(dropdown) as item
    where item->>'href' ~ '^/test/[^?#/]+'
  loop
    continue when rec.collection_id is null;
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public'
        and table_name = rec.collection_id
    ) then
      execute format('alter table public.%I set schema quiz', rec.collection_id);
      raise notice 'Moved table % to quiz schema', rec.collection_id;
    else
      raise notice 'Table % not found in public (skipped)', rec.collection_id;
    end if;
  end loop;

  -- grant permissions, enable RLS, and add public-read policy on all quiz tables
  for rec in
    select tablename from pg_tables where schemaname = 'quiz'
  loop
    execute format(
      'grant select, insert, update, delete on quiz.%I to anon, authenticated, service_role',
      rec.tablename
    );
    execute format('alter table quiz.%I enable row level security', rec.tablename);
    -- add SELECT policy only if it doesn't exist yet
    if not exists (
      select 1 from pg_policies
      where schemaname = 'quiz'
        and tablename = rec.tablename
        and policyname = 'allow_public_read'
    ) then
      execute format(
        'create policy allow_public_read on quiz.%I for select to anon, authenticated using (true)',
        rec.tablename
      );
    end if;

    -- ── Upgrade answer column from text → jsonb if needed ─────────────────
    -- Old public tables were created with `answer text`; quiz tables need `answer jsonb`
    -- so that multiple-choice answers (string arrays) can be stored and read correctly.
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'quiz'
        and table_name   = rec.tablename
        and column_name  = 'answer'
        and data_type    = 'text'
    ) then
      -- Convert: single-char strings stay as JSON strings "A",
      -- multi-char strings become JSON arrays ["A","B","C"] (each char = one label).
      execute format(
        $sql$
        alter table quiz.%I
          alter column answer type jsonb
          using case
            when answer is null then null
            when length(answer) <= 1 then to_jsonb(answer)
            else (
              select jsonb_agg(ch)
              from regexp_split_to_table(answer, '') ch
            )
          end
        $sql$,
        rec.tablename
      );
      raise notice 'Upgraded answer column to jsonb on quiz.%', rec.tablename;
    end if;

      -- ── Upgrade number column from int → numeric (to support group-header fractional numbers) ──
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'quiz'
          and table_name   = rec.tablename
          and column_name  = 'number'
          and data_type    = 'integer'
      ) then
        execute format('alter table quiz.%I alter column number type numeric', rec.tablename);
        raise notice 'Upgraded number column to numeric on quiz.%', rec.tablename;
      end if;

      -- ── Add group_range column if missing ─────────────────────────────────
      if not exists (
        select 1 from information_schema.columns
        where table_schema = 'quiz'
          and table_name   = rec.tablename
          and column_name  = 'group_range'
      ) then
        execute format('alter table quiz.%I add column group_range text', rec.tablename);
        raise notice 'Added group_range column to quiz.%', rec.tablename;
      end if;

      -- ── Migrate legacy group rows: answer -> group_range, then clear answer ──
      execute format(
        $sql$
        update quiz.%I
        set group_range = coalesce(group_range, answer #>> '{}')
        where type = 'group'
          and answer is not null
          and (group_range is null or group_range = '')
        $sql$,
        rec.tablename
      );
      execute format(
        $sql$
        update quiz.%I
        set answer = null
        where type = 'group'
          and answer is not null
        $sql$,
        rec.tablename
      );

      -- ── Drop group_content column if it still exists ──────────────────────
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'quiz'
          and table_name   = rec.tablename
          and column_name  = 'group_content'
      ) then
        execute format('alter table quiz.%I drop column group_content', rec.tablename);
        raise notice 'Dropped group_content column from quiz.%', rec.tablename;
      end if;
  end loop;

  perform pg_notify('pgrst', 'reload schema');
end
$$;
