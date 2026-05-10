-- Add owner_id to categories so personal categories can live in the same table.
-- Run in Supabase SQL editor.

alter table public.categories
  add column if not exists owner_id text references public.users(id) on delete cascade;

create index if not exists categories_owner_id_idx
  on public.categories(owner_id);

-- Optional: improve lookup speed for owner + language + href queries.
create index if not exists categories_owner_lang_href_idx
  on public.categories(owner_id, language, href);
