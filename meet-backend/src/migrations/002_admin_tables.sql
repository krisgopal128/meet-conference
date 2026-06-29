-- Migration: Admin Panel Tables
-- Created: 2026-03-23
-- Description: Adds role system, audit logs, alerts, user activity, and settings

-- ============================================
-- 1. Add role and ban columns to users table
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'participant';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- Create index for role queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_banned ON users(is_banned);

-- ============================================
-- 2. Admin Audit Logs
-- ============================================

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action_type VARCHAR(50) NOT NULL,
  target_type VARCHAR(50),
  target_id VARCHAR(255),
  details JSONB,
  ip_address VARCHAR(45),
  user_agent VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Ensure user_agent column exists on pre-existing tables (added in a later revision)
ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS user_agent VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON admin_audit_logs(action_type);

-- ============================================
-- 3. Admin Alerts
-- ============================================

CREATE TABLE IF NOT EXISTS admin_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'info',
  title VARCHAR(255) NOT NULL,
  message TEXT,
  data JSONB,
  read_at TIMESTAMP,
  read_by UUID REFERENCES users(id),
  resolved_at TIMESTAMP,
  resolved_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON admin_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON admin_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_unread ON admin_alerts(read_at) WHERE read_at IS NULL;

-- ============================================
-- 4. User Activity Tracking
-- ============================================

CREATE TABLE IF NOT EXISTS user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL,
  metadata JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON user_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_type ON user_activity(activity_type);

-- ============================================
-- 5. System Settings
-- ============================================

CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- ============================================
-- 6. Insert Default Settings
-- ============================================

INSERT INTO system_settings (key, value, description) VALUES
('room_defaults', '{"maxParticipants": 50, "emptyTimeout": 300, "waitingRoomEnabled": false}', 'Default room configuration'),
('recording', '{"storageType": "local", "retentionDays": 30}', 'Recording settings'),
('alerts', '{"serverLoadThreshold": 80, "failedRecordingAlert": true, "userReportAlert": true, "unusualActivityAlert": true}', 'Alert thresholds'),
('email', '{"fromAddress": "noreply@meet.local", "fromName": "Meet Conference"}', 'Email configuration')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 7. Add comment for documentation
-- ============================================

COMMENT ON TABLE admin_audit_logs IS 'Logs all admin actions for audit purposes';
COMMENT ON TABLE admin_alerts IS 'System alerts for admins (server load, failed recordings, user reports, unusual activity)';
COMMENT ON TABLE user_activity IS 'Tracks user activities (login, meeting joins, etc.)';
COMMENT ON TABLE system_settings IS 'System-wide configuration settings';
