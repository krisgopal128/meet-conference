-- Seed Admin Account
-- Created: 2026-03-23
-- Purpose: Create the initial admin user for the admin panel
-- Usage: psql -d <database> -f scripts/seed-admin.sql

-- ============================================================================
-- Admin Account Details
-- Email: admin@meet.local
-- Password: Admin123!ChangeMe
-- ============================================================================

-- Check if admin already exists
DO $$
DECLARE
  admin_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO admin_count FROM users WHERE role = 'admin';
  
  IF admin_count = 0 THEN
    -- Insert admin user
    -- Password hash is for: Admin123!ChangeMe
    -- Generated with bcrypt cost factor 12
    INSERT INTO users (
      id,
      email,
      password,
      name,
      role,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      'admin@meet.local',
      '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYA/7.J6LlZq',
      'System Admin',
      'admin',
      NOW(),
      NOW()
    );
    
    RAISE NOTICE 'Admin user created successfully';
  ELSE
    RAISE NOTICE 'Admin user already exists, skipping seed';
  END IF;
END $$;

-- ============================================================================
-- Verification Query
-- ============================================================================
-- Run this to verify the admin was created:
-- SELECT id, email, name, role, created_at FROM users WHERE role = 'admin';
