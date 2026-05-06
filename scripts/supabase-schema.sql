-- Supabase schema for user account data
-- Run this in the Supabase SQL editor before running the migration script

-- ── users ──────────────────────────────────────────────────────────────────
create table if not exists users (
  id                  text primary key,  -- Firestore doc ID
  name                text unique not null,
  email               text unique,
  password_hash       text,
  email_verified      boolean default false,
  verification_token  text,
  verification_expires timestamptz,
  bio                 text,
  avatar_url          text,
  social_links        jsonb default '{}',
  recitations_public  boolean default false,
  email_public        boolean default false,
  pinned_cats         text[] default '{}',
  pinned_inbox_cats   text[] default '{}',
  pinned_collection_ids text[] default '{}',
  pinned_list_ids     text[] default '{}',
  pinned_profile_tabs jsonb default '[]',
  created_at          timestamptz default now()
);

-- Migration for existing databases:
-- alter table users add column if not exists pinned_collection_ids text[] default '{}';
-- alter table users add column if not exists pinned_list_ids text[] default '{}';
-- alter table users add column if not exists pinned_profile_tabs jsonb default '[]';

-- ── quiz_records ────────────────────────────────────────────────────────────
create table if not exists quiz_records (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null references users(id) on delete cascade,
  answered   int not null,
  correct    int not null,
  set        text not null,
  timestamp  timestamptz not null,
  category   text not null,
  answers    jsonb
);

create index if not exists quiz_records_user_id_idx on quiz_records(user_id);
create index if not exists quiz_records_timestamp_idx on quiz_records(user_id, timestamp desc);

-- ── recitations ─────────────────────────────────────────────────────────────
create table if not exists recitations (
  id             uuid primary key default gen_random_uuid(),
  user_id        text not null references users(id) on delete cascade,
  article_id     text not null,
  article_number int not null,
  title          text not null,
  success        boolean not null,
  timestamp      timestamptz not null
);

create index if not exists recitations_user_id_idx on recitations(user_id);

-- ── lists ────────────────────────────────────────────────────────────────────
create table if not exists lists (
  id             text primary key,  -- Firestore doc ID (UUID v4)
  title          text not null,
  owner_id       text not null references users(id) on delete cascade,
  is_public      boolean default false,
  created_at     timestamptz not null,
  shared_with    text[] default '{}',
  shared_results jsonb default '{}'
);

create index if not exists lists_owner_id_idx on lists(owner_id);

-- ── list_questions ───────────────────────────────────────────────────────────
create table if not exists list_questions (
  list_id       text not null references lists(id) on delete cascade,
  question_id   text not null,
  collection_id text not null,
  title         text not null,
  number        int not null,
  level         int,
  position      int not null default 0,
  primary key (list_id, question_id, collection_id)
);

create index if not exists list_questions_list_id_idx on list_questions(list_id);

-- -- quiz_questions_all -------------------------------------------------------
-- Unified storage for questions across all quiz collection tables.
create table if not exists quiz_questions_all (
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

create index if not exists quiz_questions_all_quiz_id_idx on quiz_questions_all(quiz_id);
create index if not exists quiz_questions_all_level_idx on quiz_questions_all(level);

grant select, insert, update, delete on quiz_questions_all to anon, authenticated, service_role;
alter table quiz_questions_all enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'quiz_questions_all'
      and policyname = 'allow_public_read'
  ) then
    create policy allow_public_read
      on quiz_questions_all
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;

-- ── follows ───────────────────────────────────────────────────────────────────
create table if not exists follows (
  id                  text primary key,  -- Firestore doc ID
  follower_id         text not null references users(id) on delete cascade,
  follower_name       text not null,
  follower_avatar_url text,
  following_id        text not null references users(id) on delete cascade,
  following_name      text not null,
  following_avatar_url text,
  created_at          timestamptz not null,
  unique (follower_id, following_id)
);

create index if not exists follows_follower_id_idx on follows(follower_id);
create index if not exists follows_following_id_idx on follows(following_id);

-- ── pcategories ─────────────────────────────────────────────────────────────
-- Tracks quiz collection tables uploaded by individual users.
create table if not exists pcategories (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null references users(id) on delete cascade,
  language      text not null default 'zh-TW',
  quiz_id       text not null,
  name          text not null,
  created_at    timestamptz default now(),
  unique(user_id, language, quiz_id)
);

create index if not exists pcategories_user_id_idx on pcategories(user_id);
create index if not exists pcategories_user_lang_idx on pcategories(user_id, language);

-- ── articles ──────────────────────────────────────────────────────────────────
create table if not exists articles (
  id            text primary key,
  title         text not null,
  category      text,
  author        text,
  content       jsonb not null default '[]',
  type          text,
  number        int,
  language      text not null default '中文',
  attempt_count int not null default 0,
  success_count int not null default 0,
  created_at    timestamptz,
  updated_at    timestamptz
);

create index if not exists articles_category_idx on articles(category);
create index if not exists articles_type_idx on articles(type);
create index if not exists articles_number_idx on articles(number);

-- ── groups ────────────────────────────────────────────────────────────────────
create table if not exists groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  owner_id   text not null references users(id) on delete cascade,
  created_at timestamptz default now()
);

create index if not exists groups_owner_id_idx on groups(owner_id);

-- ── group_members ─────────────────────────────────────────────────────────────
create table if not exists group_members (
  group_id   uuid not null references groups(id) on delete cascade,
  user_id    text not null references users(id) on delete cascade,
  status     text not null default 'pending',  -- 'pending' | 'accepted'
  invited_at timestamptz default now(),
  primary key (group_id, user_id)
);

create index if not exists group_members_user_id_idx on group_members(user_id);

-- ── blocks ────────────────────────────────────────────────────────────────────
create table if not exists blocks (
  blocker_id text not null references users(id) on delete cascade,
  blocked_id text not null references users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (blocker_id, blocked_id)
);

create index if not exists blocks_blocker_id_idx on blocks(blocker_id);

-- ── shared_categories ─────────────────────────────────────────────────────────
create table if not exists shared_categories (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  text not null references users(id) on delete cascade,
  category_key  text not null,
  category_name text not null,
  shared_by_id  text not null references users(id) on delete cascade,
  created_at    timestamptz default now(),
  unique(recipient_id, category_key, shared_by_id)
);

create index if not exists shared_categories_recipient_idx on shared_categories(recipient_id);

