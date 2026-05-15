-- Per-user hierarchy for folders, qset placement, and list placement.
-- Folders are stored in users.personal_tree; qsets/lists tables stay flat (content only).

begin;

alter table users
  add column if not exists personal_tree jsonb not null default '{"folders":[],"qsets":{},"lists":{}}'::jsonb;

-- One-time migration when qsets still has folder rows (parent_id + is_folder).
do $$
declare
  u record;
  tree jsonb;
  folder_rows jsonb;
  qset_map jsonb;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'qsets' and column_name = 'is_folder'
  ) then
    return;
  end if;

  for u in
    select distinct owner_id as user_id from qsets where owner_id is not null
  loop
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'name', name,
          'parentId', parent_id,
          'position', position,
          'isPublic', coalesce(is_public, false)
        )
        order by position
      ),
      '[]'::jsonb
    )
    into folder_rows
    from qsets
    where owner_id = u.user_id and is_folder = true;

    select coalesce(
      jsonb_object_agg(id, parent_id) filter (where parent_id is not null),
      '{}'::jsonb
    )
    into qset_map
    from qsets
    where owner_id = u.user_id and coalesce(is_folder, false) = false;

    tree := jsonb_build_object(
      'folders', coalesce(folder_rows, '[]'::jsonb),
      'qsets', coalesce(qset_map, '{}'::jsonb),
      'lists', '{}'::jsonb
    );

    update users set personal_tree = tree where id = u.user_id;
  end loop;

  alter table qsets drop constraint if exists qsets_parent_id_fkey;
  alter table qsets drop column if exists parent_id;
  alter table qsets drop column if exists is_folder;
end $$;

-- If an older migration added users.folders, fold it into personal_tree.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'folders'
  ) then
    update users
    set personal_tree = jsonb_build_object(
      'folders', coalesce(folders, '[]'::jsonb),
      'qsets', coalesce(personal_tree->'qsets', '{}'::jsonb),
      'lists', coalesce(personal_tree->'lists', '{}'::jsonb)
    )
    where folders is not null and folders != '[]'::jsonb;

    alter table users drop column if exists folders;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
