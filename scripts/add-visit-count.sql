-- ── visit_count columns + increment_visit RPC ──────────────────────────────
-- Idempotent migration. Safe to run multiple times.
-- Required by /api/visits and /api/popular.

alter table qsets add column if not exists visit_count bigint not null default 0;
alter table lists add column if not exists visit_count bigint not null default 0;

create index if not exists qsets_visit_count_idx on qsets(visit_count desc);
create index if not exists lists_visit_count_idx on lists(visit_count desc);

-- Drop any pre-existing overloads so PostgREST always resolves to ours.
do $$
declare
  r record;
begin
  for r in
    select n.nspname as schema_name, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'increment_visit' and n.nspname = 'public'
  loop
    execute format('drop function if exists %I.%I(%s) cascade', r.schema_name, r.proname, r.args);
  end loop;
end$$;

-- Atomically bumps visit_count for the target row. Returns the new count, or null if no row matched.
create or replace function public.increment_visit(target_type text, target_id text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  result bigint;
begin
  if target_type = 'qset' then
    update qsets set visit_count = visit_count + 1 where id = target_id
      returning visit_count into result;
  elsif target_type = 'list' then
    update lists set visit_count = visit_count + 1 where id = target_id
      returning visit_count into result;
  else
    raise exception 'invalid target_type: %', target_type;
  end if;
  return result;
end;
$$;

grant execute on function public.increment_visit(text, text) to anon, authenticated, service_role;
