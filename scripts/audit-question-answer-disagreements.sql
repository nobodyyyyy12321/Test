-- Pre-flight audit for "move answer from question_i18n up to questions".
-- Finds questions whose answer differs across language translations.
-- Run this BEFORE add-answer-to-questions.sql.
--
-- If this returns zero rows, the backfill in add-answer-to-questions.sql
-- is safe — every language agrees on the answer.
--
-- If it returns rows, review each one. The migration picks zh-TW when
-- present (otherwise alphabetical first lang), so disagreements get
-- resolved in zh-TW's favor by default.

with normalized as (
  select
    question_id,
    lang,
    nullif(trim(answer), '') as answer_norm
  from question_i18n
)
select
  question_id,
  count(distinct answer_norm) filter (where answer_norm is not null) as distinct_answers,
  array_agg(
    lang || ':' || coalesce(answer_norm, '<null>')
    order by lang
  ) as per_lang
from normalized
group by question_id
having count(distinct answer_norm) filter (where answer_norm is not null) > 1
order by question_id;
