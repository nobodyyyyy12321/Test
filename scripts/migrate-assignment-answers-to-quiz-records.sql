-- Move assignment answers into quiz_records, add mode + assignment_id columns.
-- Hard-switch migration. Run once. Coordinated with the matching code deploy.

begin;

-- 1. Add new columns to quiz_records
alter table quiz_records
  add column if not exists mode text not null default 'practice',
  add column if not exists assignment_id uuid references assignments(id) on delete cascade;

alter table quiz_records
  drop constraint if exists quiz_records_mode_check;
alter table quiz_records
  add constraint quiz_records_mode_check check (mode in ('practice','assignment'));

-- correct may be null for assignments that are submitted but not yet graded
alter table quiz_records alter column correct drop not null;

create index if not exists quiz_records_assignment_id_idx on quiz_records(assignment_id);

-- 2. Backfill: for each submitted assignment, create a quiz_records row.
-- Converts answers object {[n]: u} → array [{n, u}].
insert into quiz_records (
  user_id, answered, correct, "set", timestamp, category, answers, mode, assignment_id
)
select
  a.assignee_id,
  coalesce((
    select count(*)::int
    from jsonb_each(a.answers)
    where value::text <> 'null'
  ), 0) as answered,
  a.score as correct,
  a.title || '@@' || a.source_resource_id as "set",
  a.submitted_at as timestamp,
  '指派' as category,
  (
    select coalesce(
      jsonb_agg(jsonb_build_object('n', (key)::int, 'u', value) order by (key)::int),
      '[]'::jsonb
    )
    from jsonb_each(a.answers)
  ) as answers,
  'assignment' as mode,
  a.id as assignment_id
from assignments a
where a.submitted_at is not null and a.answers is not null;

-- 3. Drop assignments.answers (and the check constraint that ties it to submitted_at)
alter table assignments drop column if exists answers cascade;

commit;
