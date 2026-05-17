-- One-shot drop of legacy share columns and tables.
-- Run after deploying the share-system rewrite (no production usage to migrate).

begin;

alter table if exists lists drop column if exists shared_with;
alter table if exists lists drop column if exists shared_results;

drop index if exists shared_categories_recipient_idx;
drop table if exists shared_categories;

alter table if exists users drop column if exists pinned_inbox_cats;

notify pgrst, 'reload schema';

commit;
