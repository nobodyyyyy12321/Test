-- ── visit_count columns + increment_visit RPC ──────────────────────────────
-- Idempotent migration. Safe to run multiple times.
-- Required by /api/visits and /api/popular.

alter table qsets add column if not exists visit_count bigint not null default 0;
alter table lists add column if not exists visit_count bigint not null default 0;

create index if not exists qsets_visit_count_idx on qsets(visit_count desc);
create index if not exists lists_visit_count_idx on lists(visit_count desc);

-- Atomically bumps visit_count for the target row. Used by /api/visits.
create or replace function increment_visit(target_type text, target_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_type = 'qset' then
    update qsets set visit_count = visit_count + 1 where id = target_id;
  elsif target_type = 'list' then
    update lists set visit_count = visit_count + 1 where id = target_id;
  else
    raise exception 'invalid target_type: %', target_type;
  end if;
end;
$$;

grant execute on function increment_visit(text, text) to anon, authenticated, service_role;
