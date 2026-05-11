-- Add owner-scoped personal collection metadata to categories so pcategories can
-- be retired safely after runtime cutover.
-- Run in Supabase SQL editor.

alter table public.categories
  add column if not exists owner_id text references public.users(id) on delete cascade;

alter table public.categories
  add column if not exists created_at timestamptz default now();

alter table public.categories
  add column if not exists from_grid boolean not null default false;

alter table public.categories
  add column if not exists is_public boolean not null default false;

create index if not exists categories_owner_id_idx
  on public.categories(owner_id);

create index if not exists categories_owner_lang_created_idx
  on public.categories(owner_id, language, created_at);

create index if not exists categories_owner_lang_href_idx
  on public.categories(owner_id, language, href);

-- Public categories remain unique per language + href.
create unique index if not exists categories_public_lang_href_uidx
  on public.categories(language, href)
  where owner_id is null and href is not null;

-- Personal collection refs are unique per owner + language + href.
create unique index if not exists categories_owner_lang_href_uidx
  on public.categories(owner_id, language, href)
  where owner_id is not null and href is not null;
