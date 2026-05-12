-- Add approval_status column to categories for admin review workflow
-- Run this in Supabase SQL editor

alter table categories
  add column if not exists approval_status text not null default 'approved';

-- Create index for filtering pending approvals
create index if not exists categories_approval_status_idx
  on categories(approval_status);

-- Existing categories (owner_id IS NULL) are pre-approved
-- New personal categories (owner_id IS NOT NULL) start as pending by default

-- Add a trigger to set created_at on new rows if not already set
alter table categories
  add column if not exists reviewed_by text references users(id);

alter table categories
  add column if not exists reviewed_at timestamptz;
