-- Backfill personal collection refs from pcategories into categories.
-- Run after scripts/add-owner-id-to-categories.sql.
-- Safe to re-run: existing owner/language/href rows are updated in place.

do $$
declare
  has_from_grid boolean;
  has_is_public boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pcategories'
      and column_name = 'from_grid'
  ) into has_from_grid;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pcategories'
      and column_name = 'is_public'
  ) into has_is_public;

  if has_from_grid and has_is_public then
    execute $sql$
      with src as (
        select
          p.user_id as owner_id,
          coalesce(p.language, 'zh-TW') as language,
          '/test/' || p.quiz_id as href,
          p.name,
          coalesce(p.created_at, now()) as created_at,
          coalesce(p.from_grid, false) as from_grid,
          coalesce(p.is_public, false) as is_public,
          row_number() over (
            partition by p.user_id, coalesce(p.language, 'zh-TW')
            order by coalesce(p.created_at, now()), p.quiz_id
          ) - 1 as position
        from public.pcategories p
      ),
      updated as (
        update public.categories c
        set
          name = src.name,
          created_at = src.created_at,
          from_grid = src.from_grid,
          is_public = src.is_public,
          updated_at = now()
        from src
        where c.owner_id = src.owner_id
          and c.language = src.language
          and c.href = src.href
        returning c.owner_id, c.language, c.href
      )
      insert into public.categories (
        id,
        owner_id,
        parent_id,
        position,
        href,
        name,
        language,
        dropdown,
        dropdown_align,
        created_at,
        updated_at,
        from_grid,
        is_public
      )
      select
        gen_random_uuid()::text,
        src.owner_id,
        null,
        src.position,
        src.href,
        src.name,
        src.language,
        '[]'::jsonb,
        null,
        src.created_at,
        now(),
        src.from_grid,
        src.is_public
      from src
      where not exists (
        select 1
        from public.categories c
        where c.owner_id = src.owner_id
          and c.language = src.language
          and c.href = src.href
      );
    $sql$;
  elsif has_from_grid then
    execute $sql$
      with src as (
        select
          p.user_id as owner_id,
          coalesce(p.language, 'zh-TW') as language,
          '/test/' || p.quiz_id as href,
          p.name,
          coalesce(p.created_at, now()) as created_at,
          coalesce(p.from_grid, false) as from_grid,
          false as is_public,
          row_number() over (
            partition by p.user_id, coalesce(p.language, 'zh-TW')
            order by coalesce(p.created_at, now()), p.quiz_id
          ) - 1 as position
        from public.pcategories p
      ),
      updated as (
        update public.categories c
        set
          name = src.name,
          created_at = src.created_at,
          from_grid = src.from_grid,
          is_public = src.is_public,
          updated_at = now()
        from src
        where c.owner_id = src.owner_id
          and c.language = src.language
          and c.href = src.href
        returning c.owner_id, c.language, c.href
      )
      insert into public.categories (
        id,
        owner_id,
        parent_id,
        position,
        href,
        name,
        language,
        dropdown,
        dropdown_align,
        created_at,
        updated_at,
        from_grid,
        is_public
      )
      select
        gen_random_uuid()::text,
        src.owner_id,
        null,
        src.position,
        src.href,
        src.name,
        src.language,
        '[]'::jsonb,
        null,
        src.created_at,
        now(),
        src.from_grid,
        src.is_public
      from src
      where not exists (
        select 1
        from public.categories c
        where c.owner_id = src.owner_id
          and c.language = src.language
          and c.href = src.href
      );
    $sql$;
  else
    execute $sql$
      with src as (
        select
          p.user_id as owner_id,
          coalesce(p.language, 'zh-TW') as language,
          '/test/' || p.quiz_id as href,
          p.name,
          coalesce(p.created_at, now()) as created_at,
          false as from_grid,
          false as is_public,
          row_number() over (
            partition by p.user_id, coalesce(p.language, 'zh-TW')
            order by coalesce(p.created_at, now()), p.quiz_id
          ) - 1 as position
        from public.pcategories p
      ),
      updated as (
        update public.categories c
        set
          name = src.name,
          created_at = src.created_at,
          from_grid = src.from_grid,
          is_public = src.is_public,
          updated_at = now()
        from src
        where c.owner_id = src.owner_id
          and c.language = src.language
          and c.href = src.href
        returning c.owner_id, c.language, c.href
      )
      insert into public.categories (
        id,
        owner_id,
        parent_id,
        position,
        href,
        name,
        language,
        dropdown,
        dropdown_align,
        created_at,
        updated_at,
        from_grid,
        is_public
      )
      select
        gen_random_uuid()::text,
        src.owner_id,
        null,
        src.position,
        src.href,
        src.name,
        src.language,
        '[]'::jsonb,
        null,
        src.created_at,
        now(),
        src.from_grid,
        src.is_public
      from src
      where not exists (
        select 1
        from public.categories c
        where c.owner_id = src.owner_id
          and c.language = src.language
          and c.href = src.href
      );
    $sql$;
  end if;
end $$;