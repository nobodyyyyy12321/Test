-- Rename the categories table to qsets.
-- Run this BEFORE deploying the code changes (which switch every string
-- reference from "categories" to "qsets"). FKs and policies follow the rename
-- automatically since Postgres references tables by OID, not name.

begin;

alter table if exists categories rename to qsets;

-- Rename common indexes for clarity (skipped silently if they don't exist).
alter index if exists categories_pkey                       rename to qsets_pkey;
alter index if exists categories_owner_id_idx               rename to qsets_owner_id_idx;
alter index if exists categories_parent_position_idx        rename to qsets_parent_position_idx;
alter index if exists categories_owner_lang_href_idx        rename to qsets_owner_lang_href_idx;
alter index if exists categories_owner_lang_href_uidx       rename to qsets_owner_lang_href_uidx;
alter index if exists categories_public_lang_href_uidx      rename to qsets_public_lang_href_uidx;
alter index if exists categories_owner_lang_created_idx     rename to qsets_owner_lang_created_idx;
alter index if exists categories_language_code_unique       rename to qsets_language_code_unique;

notify pgrst, 'reload schema';

commit;
