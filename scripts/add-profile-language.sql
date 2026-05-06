-- Add profile_language column to users table
-- Stores the user's preferred language for the profile page UI (independent of site language)

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS profile_language TEXT DEFAULT NULL;
