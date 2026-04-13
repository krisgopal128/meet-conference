-- Performance Optimization Indexes
-- Run: psql -d meetdb -f 002_add_performance_indexes.sql
-- Created: 2026-03-09

-- ============================================
-- COMPOSITE INDEXES FOR COMMON QUERIES
-- ============================================

-- Chat messages: Fast retrieval by meeting with chronological order
CREATE INDEX IF NOT EXISTS idx_chat_messages_meeting_created 
  ON chat_messages(meeting_id, created_at);

-- Meeting participants: Fast lookup by user (user's meeting history)
CREATE INDEX IF NOT EXISTS idx_meeting_participants_user 
  ON meeting_participants(user_id);

-- Meeting participants: Active participants in a meeting
CREATE INDEX IF NOT EXISTS idx_meeting_participants_meeting_joined 
  ON meeting_participants(meeting_id, joined_at) 
  WHERE left_at IS NULL;

-- Meetings: Room sessions listing with recent first
CREATE INDEX IF NOT EXISTS idx_meetings_room_started 
  ON meetings(room_id, started_at DESC);

-- Rooms: Active rooms filtering with recent first
CREATE INDEX IF NOT EXISTS idx_rooms_status_created 
  ON rooms(status, created_at DESC);

-- Rooms: Host's rooms with recent first
CREATE INDEX IF NOT EXISTS idx_rooms_host_created 
  ON rooms(host_id, created_at DESC) 
  WHERE status IN ('waiting', 'active');

-- Scheduled meetings: Upcoming meetings for a host
CREATE INDEX IF NOT EXISTS idx_scheduled_meetings_upcoming 
  ON scheduled_meetings(host_id, scheduled_start ASC) 
  WHERE status = 'scheduled';

-- Refresh tokens: Active tokens by user
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active 
  ON refresh_tokens(user_id, expires_at) 
  WHERE revoked = FALSE;

-- ============================================
-- PARTIAL INDEXES FOR COMMON FILTERS
-- ============================================

-- Only index active meetings (most queries filter by this)
CREATE INDEX IF NOT EXISTS idx_meetings_active 
  ON meetings(room_id, started_at DESC) 
  WHERE ended_at IS NULL;

-- Only index active participants
CREATE INDEX IF NOT EXISTS idx_participants_active 
  ON meeting_participants(meeting_id) 
  WHERE left_at IS NULL;

-- ============================================
-- COVERING INDEXES (Include frequently accessed columns)
-- ============================================

-- Chat messages: Include user info to avoid table lookup
CREATE INDEX IF NOT EXISTS idx_chat_messages_covering 
  ON chat_messages(meeting_id, created_at) 
  INCLUDE (user_id, content);

-- ============================================
-- VERIFY INDEXES
-- ============================================

-- Run this to verify indexes were created:
-- SELECT indexname, indexdef FROM pg_indexes 
-- WHERE tablename IN ('chat_messages', 'meeting_participants', 'meetings', 'rooms', 'scheduled_meetings', 'refresh_tokens')
-- ORDER BY indexname;

-- ============================================
-- ANALYZE TABLES (Update statistics)
-- ============================================

ANALYZE users;
ANALYZE rooms;
ANALYZE meetings;
ANALYZE meeting_participants;
ANALYZE scheduled_meetings;
ANALYZE refresh_tokens;
ANALYZE chat_messages;
