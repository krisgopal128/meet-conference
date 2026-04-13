-- Migration 005: Admin Panel Schema
-- Created: 2026-03-23
-- Purpose: Add role-based access control and admin panel tables

-- ============================================================================
-- 1. Add role column to users table
-- ============================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'participant';

-- Add check constraint for valid roles
ALTER TABLE users ADD CONSTRAINT check_valid_role 
  CHECK (role IN ('admin', 'moderator', 'participant'));

-- Create index on role for faster filtering
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ============================================================================
-- 2. Admin Audit Logs Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action_type VARCHAR(50) NOT NULL,
  target_type VARCHAR(50), -- 'user', 'meeting', 'setting'
  target_id VARCHAR(255),
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON admin_audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON admin_audit_logs(target_type, target_id);

-- ============================================================================
-- 3. Admin Alerts Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL, -- 'server_load', 'recording_failed', 'user_report', 'unusual_activity'
  severity VARCHAR(20) DEFAULT 'info', -- 'info', 'warning', 'critical'
  title VARCHAR(255) NOT NULL,
  message TEXT,
  data JSONB,
  read_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add check constraint for valid severity
ALTER TABLE admin_alerts ADD CONSTRAINT check_valid_severity 
  CHECK (severity IN ('info', 'warning', 'critical'));

-- Add check constraint for valid alert types
ALTER TABLE admin_alerts ADD CONSTRAINT check_valid_alert_type 
  CHECK (type IN ('server_load', 'recording_failed', 'user_report', 'unusual_activity'));

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_alerts_type ON admin_alerts(type);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON admin_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_read_at ON admin_alerts(read_at);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON admin_alerts(created_at DESC);

-- ============================================================================
-- 4. User Activity Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL, -- 'login', 'meeting_joined', 'meeting_left', 'logout'
  metadata JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add check constraint for valid activity types
ALTER TABLE user_activity ADD CONSTRAINT check_valid_activity_type 
  CHECK (activity_type IN ('login', 'logout', 'meeting_joined', 'meeting_left', 'registration', 'password_reset'));

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_type ON user_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON user_activity(created_at DESC);

-- ============================================================================
-- 5. System Settings Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Index for key lookups (primary key already indexed)
CREATE INDEX IF NOT EXISTS idx_settings_updated_at ON system_settings(updated_at);

-- ============================================================================
-- 6. Insert Default System Settings
-- ============================================================================
INSERT INTO system_settings (key, value, description) VALUES
('room_defaults', '{"maxParticipants": 50, "emptyTimeout": 300, "waitingRoomEnabled": false}', 'Default room configuration'),
('recording', '{"storageType": "local", "retentionDays": 30}', 'Recording settings'),
('alerts', '{"serverLoadThreshold": 80, "failedRecordingAlert": true, "userReportAlert": true}', 'Alert configuration')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 7. Comments for Documentation
-- ============================================================================
COMMENT ON TABLE admin_audit_logs IS 'Stores all admin/moderator actions for auditing';
COMMENT ON TABLE admin_alerts IS 'System alerts and notifications for administrators';
COMMENT ON TABLE user_activity IS 'Tracks user activity for analytics and security';
COMMENT ON TABLE system_settings IS 'Key-value store for system configuration';

COMMENT ON COLUMN users.role IS 'User role: admin (full access), moderator (limited admin), participant (standard user)';
