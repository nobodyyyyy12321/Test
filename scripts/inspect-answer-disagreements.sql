-- For each question where languages disagree on the answer,
-- dump per-language options + answer so we can decide whether the
-- English options just need reordering (or the answer key needs fixing).
--
-- Run after audit-question-answer-disagreements.sql identified ~10 rows.

with normalized as (
  select question_id, lang, nullif(trim(answer), '') as answer_norm
  from question_i18n
),
disagreeing as (
  select question_id
  from normalized
  group by question_id
  having count(distinct answer_norm) filter (where answer_norm is not null) > 1
)
select
  qi.question_id,
  qi.lang,
  qi.answer,
  qi.options,
  qi.content
from question_i18n qi
join disagreeing d on d.question_id = qi.question_id
order by qi.question_id, qi.lang;
