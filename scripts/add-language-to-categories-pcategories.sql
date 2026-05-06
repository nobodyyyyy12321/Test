-- Add language columns to categories / pcategories so quiz IDs can coexist by language.
-- Run in Supabase SQL editor.

begin;

-- 1) pcategories: add language and update uniqueness
alter table public.pcategories
  add column if not exists language text;

update public.pcategories
set language = coalesce(language, 'zh-TW')
where language is null;

alter table public.pcategories
  alter column language set not null;

-- drop legacy unique(user_id, quiz_id) regardless of constraint name
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'pcategories'
      AND con.contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.pcategories DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

alter table public.pcategories
  add constraint pcategories_user_language_collection_unique
  unique (user_id, language, quiz_id);

create index if not exists pcategories_user_lang_idx
  on public.pcategories(user_id, language);

-- 2) categories: add denormalized language column for easier language-scoped querying
alter table public.categories
  add column if not exists language text;

-- Fill language by propagating from language-root rows (where language_code is set)
WITH RECURSIVE tree AS (
  SELECT id, parent_id, language_code::text AS lang
  FROM public.categories
  WHERE language_code is not null
  UNION ALL
  SELECT c.id, c.parent_id, t.lang
  FROM public.categories c
  JOIN tree t ON c.parent_id = t.id
)
UPDATE public.categories c
SET language = tree.lang
FROM tree
WHERE c.id = tree.id
  AND (c.language is null OR c.language = '');

create index if not exists categories_language_idx
  on public.categories(language);

commit;
