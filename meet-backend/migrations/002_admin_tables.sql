-- Migration: Admin Panel Tables
-- Created: 2026-03-23
-- Description: Adds role-based access control, audit logs, alerts, and system settings

-- ============================================
-- MODIFY USERS TABLE
-- ============================================

-- Add role column (values: 'admin', 'moderator', 'participant')
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'participant';

-- Add ban-related columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;

-- Add last login tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Create index for role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_banned ON users(is_banned) WHERE is_banned = TRUE;

-- ============================================
-- ADMIN AUDIT LOGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action_type VARCHAR(50) NOT NULL,  -- 'user_ban', 'user_unban', 'user_promote', 'settings_change', etc.
    target_type VARCHAR(50),            -- 'user', 'meeting', 'setting'
    target_id VARCHAR(255),
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON admin_audit_logs(action_type);

-- ============================================
-- ADMIN ALERTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS admin_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL,          -- 'server_load', 'recording_failed', 'user_report', 'unusual_activity'
    severity VARCHAR(20) DEFAULT 'info', -- 'info', 'warning', 'critical'
    title VARCHAR(255) NOT NULL,
    message TEXT,
    data JSONB,
    read_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for alert queries
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON admin_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_unread ON admin_alerts(read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON admin_alerts(severity);

-- ============================================
-- USER ACTIVITY TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS user_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL, -- 'login', 'meeting_joined', 'meeting_left', 'logout'
    metadata JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for activity queries
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON user_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_type ON user_activity(activity_type);

-- ============================================
-- SYSTEM SETTINGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- INSERT DEFAULT SETTINGS
-- ============================================

INSERT INTO system_settings (key, value, description) VALUES
    ('room_defaults', '{"maxParticipants": 50, "emptyTimeout": 300, "waitingRoomEnabled": false}', 'Default room configuration'),
    ('recording', '{"storageType": "local", "retentionDays": 30}', 'Recording settings'),
    ('alerts', '{"serverLoadThreshold": 80, "failedRecordingAlert": true, "userReportAlert": true, "unusualActivityAlert": true}', 'Alert thresholds')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE admin_audit_logs IS 'Stores audit trail of admin actions';
COMMENT ON TABLE admin_alerts IS 'System alerts and notifications for admins';
COMMENT ON TABLE user_activity IS 'Tracks user activity for analytics and security';
COMMENT ON TABLE system_settings IS 'System-wide configuration settings';
