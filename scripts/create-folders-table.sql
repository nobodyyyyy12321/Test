-- Folders for personal qsets and lists.
-- Run AFTER scripts/drop-personal-tree.sql.

begin;

create extension if not exists "pgcrypto";

create table if not exists folders (
  id          uuid primary key default gen_random_uuid(),
  owner_id    text not null references users(id) on delete cascade,
  parent_id   uuid references folders(id) on delete set null,
  name        text not null,
  position    int not null default 0,
  is_public   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists folders_owner_idx            on folders(owner_id);
create index if not exists folders_owner_parent_pos_idx on folders(owner_id, parent_id, position);
create index if not exists folders_parent_idx           on folders(parent_id);
create index if not exists folders_public_owner_idx     on folders(owner_id) where is_public;

alter table qsets add column if not exists folder_id uuid references folders(id) on delete set null;
alter table lists add column if not exists folder_id uuid references folders(id) on delete set null;

create index if not exists qsets_folder_idx on qsets(folder_id);
create index if not exists lists_folder_idx on lists(folder_id);

notify pgrst, 'reload schema';

commit;
