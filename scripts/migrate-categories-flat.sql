-- Migrate categories from one-row-per-language JSONB tree to one-row-per-node.
-- The language is itself a top-level folder; everything else nests under it via parent_id.
-- Run in Supabase SQL editor BEFORE running scripts/migrate-categories-flat.ts.

-- Preserve old data as backup (only renames if it still exists with the original shape)
alter table if exists categories rename to categories_old;

-- One row per folder/item. parent_id chains all the way to a language-root row.
-- A language root is a top-level row (parent_id is null) with language_code set;
-- ordinary folders/items have language_code null.
create table categories (
  id             text primary key,
  parent_id      text references categories(id) on delete cascade,
  position       int  not null default 0,
  href           text,
  name           text not null,
  language_code  text,                                  -- only set on language-root rows
  dropdown       jsonb not null default '[]'::jsonb,    -- [{ id, name, href }]
  dropdown_align text,
  updated_at     timestamptz default now()
);

-- One root per language
create unique index categories_language_code_unique
  on categories(language_code) where language_code is not null;

create index categories_parent_position_idx on categories(parent_id, position);
