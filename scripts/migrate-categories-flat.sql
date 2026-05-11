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
  owner_id       text references users(id) on delete cascade,
  parent_id      text references categories(id) on delete cascade,
  position       int  not null default 0,
  href           text,
  name           text not null,
  language       text,                                  -- denormalized language for easier filtering
  language_code  text,                                  -- only set on language-root rows
  dropdown       jsonb not null default '[]'::jsonb,    -- [{ id, name, href }]
  dropdown_align text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- One root per language
create unique index categories_language_code_unique
  on categories(language_code) where language_code is not null;

create index categories_parent_position_idx on categories(parent_id, position);
create index categories_owner_id_idx on categories(owner_id);

alter table categories
  add column if not exists from_grid boolean not null default false;

alter table categories
  add column if not exists is_public boolean not null default false;

create index if not exists categories_owner_lang_created_idx
  on categories(owner_id, language, created_at);

create unique index if not exists categories_public_lang_href_uidx
  on categories(language, href)
  where owner_id is null and href is not null;

create unique index if not exists categories_owner_lang_href_uidx
  on categories(owner_id, language, href)
  where owner_id is not null and href is not null;
