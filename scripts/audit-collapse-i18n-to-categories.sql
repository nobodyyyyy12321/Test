-- Phase 0 audit for collapsing 4-table i18n schema into categories + questions.
--
-- Read-only. Run each section in the Supabase SQL editor and inspect output.
-- A "clean" result means the planned Phase 2 backfill will not lose data.
--
-- The target backfill joins:
--   question_i18n qi
--     join questions  q on q.id = qi.question_id
--     join quiz_sets  s on s.id = q.set_id
--     join categories c on c.href = '/test/' || s.source_quiz_id
--                      and c.language = qi.lang
--                      and (   (s.owner_id is null and c.owner_id is null)
--                           or  s.owner_id = c.owner_id)
--
-- Anything that fails to match on that join is what we need to know about here.


-- ────────────────────────────────────────────────────────────────────────────
-- 1. Row counts per table (sanity baseline)
-- ────────────────────────────────────────────────────────────────────────────
select 'quiz_sets'     as table_name, count(*) from quiz_sets
union all select 'quiz_set_i18n', count(*) from quiz_set_i18n
union all select 'questions',     count(*) from questions
union all select 'question_i18n', count(*) from question_i18n
union all select 'categories',                     count(*) from categories
union all select 'categories (collections only)',  count(*) from categories where href is not null
union all select 'categories (folders only)',      count(*) from categories where href is null;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Expected backfill row count (what Phase 2 will insert)
--    Compare against question_i18n total. Gap = orphans dropped by the join.
-- ────────────────────────────────────────────────────────────────────────────
with joined as (
  select qi.id as qi_id
  from question_i18n qi
  join questions  q on q.id = qi.question_id
  join quiz_sets  s on s.id = q.set_id
  join categories c on c.href = '/test/' || s.source_quiz_id
                   and c.language = qi.lang
                   and (   (s.owner_id is null and c.owner_id is null)
                        or  s.owner_id = c.owner_id)
)
select
  (select count(*) from question_i18n) as total_question_i18n,
  (select count(*) from joined)         as would_migrate,
  (select count(*) from question_i18n)
    - (select count(*) from joined)     as orphans_dropped;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. Quiz_sets that have NO category at all for any language.
--    Each such set: every question and every translation will be orphaned.
-- ────────────────────────────────────────────────────────────────────────────
select s.id, s.owner_id, s.source_quiz_id, s.category_id
from quiz_sets s
where not exists (
  select 1 from categories c
  where c.href = '/test/' || s.source_quiz_id
    and (   (s.owner_id is null and c.owner_id is null)
         or  s.owner_id = c.owner_id)
)
order by s.owner_id nulls first, s.source_quiz_id;


-- ────────────────────────────────────────────────────────────────────────────
-- 4. Quiz_set_i18n rows whose language has no matching category for that set.
--    The set exists in some language(s) but not THIS language's tree.
--    Each row dropped: that language's question translations have no home.
-- ────────────────────────────────────────────────────────────────────────────
select si.set_id, si.lang, s.owner_id, s.source_quiz_id, si.title
from quiz_set_i18n si
join quiz_sets s on s.id = si.set_id
where not exists (
  select 1 from categories c
  where c.href = '/test/' || s.source_quiz_id
    and c.language = si.lang
    and (   (s.owner_id is null and c.owner_id is null)
         or  s.owner_id = c.owner_id)
)
order by s.owner_id nulls first, s.source_quiz_id, si.lang;


-- ────────────────────────────────────────────────────────────────────────────
-- 5. Categories that look like collections (href set) but no quiz_set behind them.
--    These are empty collections — survive the migration unchanged, but worth
--    confirming the count matches expectation.
-- ────────────────────────────────────────────────────────────────────────────
select c.id, c.owner_id, c.language, c.href, c.name
from categories c
where c.href is not null
  and not exists (
    select 1 from quiz_sets s
    where '/test/' || s.source_quiz_id = c.href
      and (   (s.owner_id is null and c.owner_id is null)
           or  s.owner_id = c.owner_id)
  )
order by c.owner_id nulls first, c.language, c.href;


-- ────────────────────────────────────────────────────────────────────────────
-- 6. Per-language coverage breakdown.
--    For each language that appears in question_i18n, how many rows have/lack a category.
-- ────────────────────────────────────────────────────────────────────────────
select
  qi.lang,
  count(*) as total_translations,
  count(*) filter (
    where exists (
      select 1
      from questions q
      join quiz_sets s on s.id = q.set_id
      join categories c on c.href = '/test/' || s.source_quiz_id
                       and c.language = qi.lang
                       and (   (s.owner_id is null and c.owner_id is null)
                            or  s.owner_id = c.owner_id)
      where q.id = qi.question_id
    )
  ) as with_category,
  count(*) filter (
    where not exists (
      select 1
      from questions q
      join quiz_sets s on s.id = q.set_id
      join categories c on c.href = '/test/' || s.source_quiz_id
                       and c.language = qi.lang
                       and (   (s.owner_id is null and c.owner_id is null)
                            or  s.owner_id = c.owner_id)
      where q.id = qi.question_id
    )
  ) as orphan
from question_i18n qi
group by qi.lang
order by qi.lang;


-- ────────────────────────────────────────────────────────────────────────────
-- 7. Questions whose answer is NULL on the language-agnostic row.
--    Group/passage rows legitimately have no answer (they hold shared context
--    for a set of child questions), so a non-zero count here is expected.
--    questions_v2.answer must be nullable to accommodate these.
-- ────────────────────────────────────────────────────────────────────────────
select count(*) as questions_missing_answer
from questions
where answer is null;


-- ────────────────────────────────────────────────────────────────────────────
-- 8. Sanity: quiz_sets whose stored category_id (the FK column) doesn't agree
--    with what the href-based lookup would produce. Mostly informational —
--    quiz_sets.category_id is rarely populated today.
-- ────────────────────────────────────────────────────────────────────────────
select s.id, s.owner_id, s.source_quiz_id,
       s.category_id as stored_category_id,
       array_agg(distinct c.id) as href_matched_category_ids
from quiz_sets s
left join categories c
  on c.href = '/test/' || s.source_quiz_id
 and (   (s.owner_id is null and c.owner_id is null)
      or  s.owner_id = c.owner_id)
where s.category_id is not null
group by s.id, s.owner_id, s.source_quiz_id, s.category_id
having s.category_id <> all(coalesce(array_agg(distinct c.id) filter (where c.id is not null), '{}'::text[]))
order by s.owner_id nulls first, s.source_quiz_id;
