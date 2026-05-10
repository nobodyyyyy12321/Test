-- ── Multi-language quiz schema ──────────────────────────────────────────────
-- Four tables replacing the single-language quiz_questions_all approach:
--   quiz_sets      : language-agnostic quiz set metadata
--   quiz_set_i18n  : translated titles per language
--   questions      : language-agnostic question metadata
--   question_i18n  : translated content (problem, options, answer) per language

-- ── quiz_sets ────────────────────────────────────────────────────────────────
create table if not exists quiz_sets (
  id                uuid primary key default gen_random_uuid(),
  owner_id          text references users(id) on delete cascade,
  source_quiz_id    text not null,        -- original quiz_id from quiz_questions_all (migration aid)
  category_id       text references categories(id) on delete set null,
  problems_per_test int  not null default 10 check (problems_per_test > 0),
  shuffle_problems  boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Backward-compatible migration for existing deployments.
alter table quiz_sets
  add column if not exists owner_id text references users(id) on delete cascade,
  add column if not exists source_quiz_id text,
  add column if not exists category_id text;

alter table quiz_sets
  alter column category_id type text using category_id::text;

alter table quiz_sets
  drop constraint if exists quiz_sets_category_id_fkey;

alter table quiz_sets
  add constraint quiz_sets_category_id_fkey
  foreign key (category_id) references categories(id) on delete set null;

alter table quiz_sets
  drop constraint if exists quiz_sets_source_quiz_id_key;

-- owner_id is null: global sets (one source_quiz_id only once)
create unique index if not exists quiz_sets_global_source_uidx
  on quiz_sets(source_quiz_id)
  where owner_id is null;

-- owner_id is not null: personal sets (same source_quiz_id allowed across users)
create unique index if not exists quiz_sets_owner_source_uidx
  on quiz_sets(owner_id, source_quiz_id)
  where owner_id is not null;

create index if not exists quiz_sets_owner_id_idx on quiz_sets(owner_id);
create index if not exists quiz_sets_category_id_idx on quiz_sets(category_id);

-- ── quiz_set_i18n ─────────────────────────────────────────────────────────────
create table if not exists quiz_set_i18n (
  id        uuid primary key default gen_random_uuid(),
  set_id    uuid not null references quiz_sets(id) on delete cascade,
  lang      text not null,   -- e.g. 'zh-TW', 'zh-CN', 'en', 'ja', 'ko'
  title     text not null,
  unique (set_id, lang)
);

create index if not exists quiz_set_i18n_set_id_idx on quiz_set_i18n(set_id);
create index if not exists quiz_set_i18n_lang_idx   on quiz_set_i18n(lang);

-- ── questions ─────────────────────────────────────────────────────────────────
create table if not exists questions (
  id          uuid primary key default gen_random_uuid(),
  set_id      uuid not null references quiz_sets(id) on delete cascade,
  number      numeric not null,         -- question number within the set
  level       int,                      -- difficulty level
  group_id    uuid,                     -- optional: links questions in same passage/group
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (set_id, number)
);

create index if not exists questions_set_id_idx   on questions(set_id);
create index if not exists questions_group_id_idx on questions(group_id);

-- ── question_i18n ─────────────────────────────────────────────────────────────
-- One row per (question, language). Missing rows mean no translation yet.
create table if not exists question_i18n (
  id            uuid primary key default gen_random_uuid(),
  question_id   uuid not null references questions(id) on delete cascade,
  lang          text not null,   -- e.g. 'zh-TW', 'zh-CN', 'en', 'ja', 'ko'

  -- Shared passage/context for grouped questions (nullable)
  group_content text,

  -- Question stem
  content       text not null,

  -- Answer choices: [{"key":"A","text":"..."},{"key":"B","text":"..."},...]
  -- Use array to preserve order; supports 2–6 options
  options       jsonb not null default '[]',

  -- Correct answer key: 'A', 'B', 'C', 'D', ...
  answer        text not null,

  -- Optional explanation shown after answering
  explanation   text,

  -- Translation quality flags
  is_machine_translated boolean not null default true,
  is_reviewed           boolean not null default false,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (question_id, lang)
);

create index if not exists question_i18n_question_id_idx on question_i18n(question_id);
create index if not exists question_i18n_lang_idx        on question_i18n(lang);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table quiz_sets     enable row level security;
alter table quiz_set_i18n enable row level security;
alter table questions     enable row level security;
alter table question_i18n enable row level security;

grant select, insert, update, delete on quiz_sets     to anon, authenticated, service_role;
grant select, insert, update, delete on quiz_set_i18n to anon, authenticated, service_role;
grant select, insert, update, delete on questions     to anon, authenticated, service_role;
grant select, insert, update, delete on question_i18n to anon, authenticated, service_role;

do $$
begin
  -- quiz_sets
  if not exists (select 1 from pg_policies where tablename = 'quiz_sets'     and policyname = 'allow_public_read') then
    create policy allow_public_read on quiz_sets     for select to anon, authenticated using (true);
  end if;
  -- quiz_set_i18n
  if not exists (select 1 from pg_policies where tablename = 'quiz_set_i18n' and policyname = 'allow_public_read') then
    create policy allow_public_read on quiz_set_i18n for select to anon, authenticated using (true);
  end if;
  -- questions
  if not exists (select 1 from pg_policies where tablename = 'questions'     and policyname = 'allow_public_read') then
    create policy allow_public_read on questions     for select to anon, authenticated using (true);
  end if;
  -- question_i18n
  if not exists (select 1 from pg_policies where tablename = 'question_i18n' and policyname = 'allow_public_read') then
    create policy allow_public_read on question_i18n for select to anon, authenticated using (true);
  end if;
end $$;

-- ── Usage example ─────────────────────────────────────────────────────────────
-- Fetch all questions for a set in a given language, with zh-TW fallback:
--
-- SELECT DISTINCT ON (q.id)
--   q.id, q.number, qi.lang, qi.content, qi.options, qi.answer, qi.group_content
-- FROM questions q
-- JOIN question_i18n qi ON qi.question_id = q.id
-- WHERE q.set_id = '<set-uuid>'
--   AND qi.lang IN ('en', 'zh-TW')        -- put preferred lang first
-- ORDER BY q.number, (qi.lang = 'en') DESC;
