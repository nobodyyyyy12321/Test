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

-- ── qsets ────────────────────────────────────────────────────────────
create table if not exists qsets (
  id             text primary key,
  owner_id       text references users(id) on delete cascade,
  position       int  not null default 0,
  name           text not null,
  shuffle_problems  boolean;
  problems_per_test int,
  language       text,                                  -- denormalized language for easier filtering
  --language_code  text,                                  -- only set on language-root rows
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- ── folders ────────────────────────────────────────────────────────────────
-- See scripts/create-folders-table.sql for the equivalent standalone migration.
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
create index if not exists qsets_folder_idx on qsets(folder_id);

-- ── questions ────────────────────────────────────────────────────────────
-- 1. 建立擴充功能（確保支援 UUID 產生）
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. 定義題目類型列舉 (更安全，避免輸入錯誤字串)
CREATE TYPE qtype AS ENUM ('single', 'multiple', 'true_false', 'fill');

-- 3. 建立題目表 (Questions)
CREATE TABLE if not exists questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    qsets_id text,
    number numeric not null,
    content TEXT NOT NULL,                -- 題目本文 (支援 Markdown/LaTeX)
    q_type qtype NOT NULL,                -- 題目類型
    options jsonb,                        -- 選項，例如: [{"id": "A", "text": "Mars"}, {"id": "B", "text": "Venus"}]
    answer jsonb,                -- 正確答案，例如: {"id": "A"}
    explanation text,                     -- 解析
    level int,
    points  int default 1,                -- 配分
    scoring text,                         -- 計分策略 (null = all-or-nothing, 'partial' = 部分給分)
    created_at     timestamptz default now(),
    updated_at     timestamptz default now()
);

-- migration for existing databases:
-- alter table questions add column if not exists points  int default 1;
-- alter table questions add column if not exists scoring text;

-- ── assignments ──────────────────────────────────────────────────────────────
create table if not exists assignments (
  id              uuid primary key default gen_random_uuid(),
  assigner_id     text not null references users(id) on delete cascade,
  assignee_id     text not null references users(id) on delete cascade,
  assign_type     text not null default 'exam',
  source_resource_type  text not null,
  source_resource_id    text not null,
  title           text not null,
  start_at        timestamptz not null,
  end_at          timestamptz not null,
  created_at      timestamptz not null default now(),
  answers         jsonb,
  submitted_at    timestamptz,
  score           int,
  total           int,
  graded_at       timestamptz,
  check (assign_type = 'exam'),
  check (source_resource_type = 'qset'),
  check (end_at - start_at >= interval '1 minute'),
  check ((answers is null) = (submitted_at is null)),
  check ((score is null) = (graded_at is null)),
  check ((total is null) = (graded_at is null)),
  check (graded_at is null or submitted_at is not null)
);
create index if not exists assignments_assignee_idx on assignments(assignee_id);
create index if not exists assignments_assigner_idx on assignments(assigner_id);
create index if not exists assignments_window_idx   on assignments(end_at);

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
  created_at     timestamptz not null
);

create index if not exists lists_owner_id_idx on lists(owner_id);

alter table lists add column if not exists folder_id uuid references folders(id) on delete set null;
create index if not exists lists_folder_idx on lists(folder_id);

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

-- shared_categories table, lists.shared_with column, and lists.shared_results
-- column were dropped as part of the share-system rewrite. Run
-- scripts/drop-share-tables.sql against the production DB to remove them.

