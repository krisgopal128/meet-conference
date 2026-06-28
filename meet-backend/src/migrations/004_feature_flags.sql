-- Migration: Per-moderator feature flags
-- Created: 2026-06-28
-- Description: Adds feature_flags column to users table.
--   Allows admins to control which moderator powers each moderator account has.
--   Allow-list model: keys present and true = allowed; absent or false = blocked.
--   NULL (default) = no lock applied (user behaves per their role).
--   Only meaningful for role = 'moderator'. Admins and participants ignore it.
--   Room hosts (room.host_id = user.id) ALWAYS bypass feature locks.

ALTER TABLE users ADD COLUMN IF NOT EXISTS feature_flags JSONB DEFAULT NULL;

-- Add an index for fast filtering (e.g. "show all locked moderators")
CREATE INDEX IF NOT EXISTS idx_users_feature_flags ON users(feature_flags) WHERE feature_flags IS NOT NULL;
