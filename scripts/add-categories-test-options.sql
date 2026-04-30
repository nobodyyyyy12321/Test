-- Add per-category test options: how many problems to show and whether to shuffle.
-- null in either column means "no override; use the default behavior".
-- Run in Supabase SQL editor.

alter table categories
  add column if not exists problems_per_test int,
  add column if not exists shuffle_problems  boolean;

-- Refresh PostgREST schema cache so the new columns are visible to the REST API.
notify pgrst, 'reload schema';
