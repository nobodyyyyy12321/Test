-- Drop the legacy JSONB folder storage on users.
-- Run after deploying the code that no longer references personal_tree / folders.
-- A fresh folders schema will be added later as a separate migration.

begin;

alter table users drop column if exists personal_tree;
alter table users drop column if exists folders;

notify pgrst, 'reload schema';

commit;
