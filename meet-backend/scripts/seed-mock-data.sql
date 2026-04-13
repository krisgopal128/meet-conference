-- Mock Data Seed Script for Meet Conference
-- Generated: 2026-03-13

-- ============================================
-- 1. CREATE DEMO USER
-- Password: demo123 (bcrypt hashed)
-- ============================================
INSERT INTO users (id, email, password_hash, name, avatar_url, role, created_at, updated_at) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 'kris@phuket-tourist.com',
 '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.qJ.YzKX5.QUaGq',
 'Kris Demo',
 'https://api.dicebear.com/7.x/avataaars/svg?seed=kris',
 'user',
 NOW() - INTERVAL '30 days',
 NOW());

-- ============================================
-- 2. CREATE ROOMS
-- ============================================
INSERT INTO rooms (id, name, title, description, host_id, status, max_participants, waiting_room_enabled, created_at) VALUES
('11111111-1111-1111-1111-111111111111', 'daily-standup', 'Daily Standup', 'Morning standup with the team', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'active', 10, false, NOW() - INTERVAL '25 days'),
('22222222-2222-2222-2222-222222222222', 'product-demo', 'Product Demo', 'Product demonstrations for clients', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'active', 50, true, NOW() - INTERVAL '20 days'),
('33333333-3333-3333-3333-333333333333', 'team-sync', 'Team Sync', 'Weekly team synchronization', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'active', 15, false, NOW() - INTERVAL '15 days'),
('44444444-4444-4444-4444-444444444444', 'client-meeting', 'Client Meeting', 'Client discussions and reviews', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'active', 25, true, NOW() - INTERVAL '10 days'),
('55555555-5555-5555-5555-555555555555', 'sprint-review', 'Sprint Review', 'End of sprint reviews', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'active', 30, false, NOW() - INTERVAL '5 days');

-- ============================================
-- 3. CREATE PAST MEETINGS (20 meetings)
-- ============================================
INSERT INTO meetings (id, room_id, participant_count, max_participants, started_at, ended_at) VALUES
-- Week 1
('10000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 3, 10, NOW() - INTERVAL '12 days 9:00', NOW() - INTERVAL '12 days 9:15'),
('10000002-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 4, 50, NOW() - INTERVAL '11 days 14:00', NOW() - INTERVAL '11 days 14:45'),
('10000003-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 5, 15, NOW() - INTERVAL '10 days 10:00', NOW() - INTERVAL '10 days 11:00'),
('10000004-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 3, 10, NOW() - INTERVAL '9 days 9:00', NOW() - INTERVAL '9 days 9:20'),
('10000005-0000-0000-0000-000000000005', '44444444-4444-4444-4444-444444444444', 5, 25, NOW() - INTERVAL '8 days 16:00', NOW() - INTERVAL '8 days 17:00'),
-- Week 2
('10000006-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 4, 10, NOW() - INTERVAL '7 days 9:00', NOW() - INTERVAL '7 days 9:12'),
('10000007-0000-0000-0000-000000000007', '55555555-5555-5555-5555-555555555555', 6, 30, NOW() - INTERVAL '7 days 15:00', NOW() - INTERVAL '7 days 16:30'),
('10000008-0000-0000-0000-000000000008', '22222222-2222-2222-2222-222222222222', 3, 50, NOW() - INTERVAL '6 days 14:00', NOW() - INTERVAL '6 days 14:45'),
('10000009-0000-0000-0000-000000000009', '33333333-3333-3333-3333-333333333333', 4, 15, NOW() - INTERVAL '6 days 10:00', NOW() - INTERVAL '6 days 10:45'),
('10000010-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', 3, 10, NOW() - INTERVAL '5 days 9:00', NOW() - INTERVAL '5 days 9:18'),
-- Week 3
('10000011-0000-0000-0000-000000000011', '44444444-4444-4444-4444-444444444444', 4, 25, NOW() - INTERVAL '4 days 11:00', NOW() - INTERVAL '4 days 12:00'),
('10000012-0000-0000-0000-000000000012', '22222222-2222-2222-2222-222222222222', 5, 50, NOW() - INTERVAL '3 days 14:00', NOW() - INTERVAL '3 days 15:00'),
('10000013-0000-0000-0000-000000000013', '33333333-3333-3333-3333-333333333333', 4, 15, NOW() - INTERVAL '3 days 10:00', NOW() - INTERVAL '3 days 11:15'),
('10000014-0000-0000-0000-000000000014', '11111111-1111-1111-1111-111111111111', 3, 10, NOW() - INTERVAL '2 days 9:00', NOW() - INTERVAL '2 days 9:10'),
('10000015-0000-0000-0000-000000000015', '55555555-5555-5555-5555-555555555555', 5, 30, NOW() - INTERVAL '2 days 15:00', NOW() - INTERVAL '2 days 16:00'),
-- Recent
('10000016-0000-0000-0000-000000000016', '44444444-4444-4444-4444-444444444444', 3, 25, NOW() - INTERVAL '1 day 16:00', NOW() - INTERVAL '1 day 16:45'),
('10000017-0000-0000-0000-000000000017', '11111111-1111-1111-1111-111111111111', 4, 10, NOW() - INTERVAL '1 day 9:00', NOW() - INTERVAL '1 day 9:15'),
('10000018-0000-0000-0000-000000000018', '22222222-2222-2222-2222-222222222222', 4, 50, NOW() - INTERVAL '1 day 14:00', NOW() - INTERVAL '1 day 15:30'),
('10000019-0000-0000-0000-000000000019', '33333333-3333-3333-3333-333333333333', 3, 15, NOW() - INTERVAL '1 day 10:30', NOW() - INTERVAL '1 day 11:30'),
('10000020-0000-0000-0000-000000000020', '11111111-1111-1111-1111-111111111111', 3, 10, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 hours 45 min');

-- ============================================
-- 4. CREATE SCHEDULED (FUTURE) MEETINGS
-- ============================================
INSERT INTO scheduled_meetings (id, room_name, title, description, host_id, scheduled_start, scheduled_end, timezone, participant_emails, status, created_at)
VALUES
('20000001-0000-0000-0000-000000000001', 'daily-standup', 'Daily Standup - Tomorrow', 'Morning standup with the team', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NOW() + INTERVAL '1 day 9 hours', NOW() + INTERVAL '1 day 9:20 hours', 'Asia/Dubai', ARRAY['guest1@demo.com', 'guest2@demo.com'], 'scheduled', NOW()),
('20000002-0000-0000-0000-000000000002', 'product-demo', 'Product Demo - New Features', 'Demo of v2.0 features to stakeholders', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NOW() + INTERVAL '1 day 14 hours', NOW() + INTERVAL '1 day 15 hours', 'Asia/Dubai', ARRAY['client@acme.com', 'manager@acme.com', 'tech@acme.com'], 'scheduled', NOW()),
('20000003-0000-0000-0000-000000000003', 'team-sync', 'Team Sync - Weekly', 'Weekly team sync and planning', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NOW() + INTERVAL '2 days 10 hours', NOW() + INTERVAL '2 days 11 hours', 'Asia/Dubai', ARRAY['team1@demo.com', 'team2@demo.com', 'team3@demo.com'], 'scheduled', NOW()),
('20000004-0000-0000-0000-000000000004', 'client-meeting', 'Client Meeting - Proposal Review', 'Review proposal with new client', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NOW() + INTERVAL '3 days 15 hours', NOW() + INTERVAL '3 days 16 hours', 'Asia/Dubai', ARRAY['newclient@company.com'], 'scheduled', NOW()),
('20000005-0000-0000-0000-000000000005', 'sprint-review', 'Sprint Review - End of Sprint', 'Review sprint deliverables', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', NOW() + INTERVAL '5 days 15 hours', NOW() + INTERVAL '5 days 16:30 hours', 'Asia/Dubai', ARRAY['pm@demo.com', 'dev@demo.com', 'qa@demo.com', 'designer@demo.com'], 'scheduled', NOW());

-- ============================================
-- 5. CREATE MEETING PARTICIPANTS (Guests)
-- ============================================
INSERT INTO meeting_participants (id, meeting_id, user_id, identity, role, joined_at, left_at)
VALUES
-- Meeting 1 participants
('30000001-0000-0000-0000-000000000001', '10000001-0000-0000-0000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Kris Demo', 'moderator', NOW() - INTERVAL '12 days 9:00', NOW() - INTERVAL '12 days 9:15'),
('30000002-0000-0000-0000-000000000002', '10000001-0000-0000-0000-000000000001', NULL, 'Alice Guest', 'attendee', NOW() - INTERVAL '12 days 9:02', NOW() - INTERVAL '12 days 9:14'),
('30000003-0000-0000-0000-000000000003', '10000001-0000-0000-0000-000000000001', NULL, 'Bob Guest', 'attendee', NOW() - INTERVAL '12 days 9:03', NOW() - INTERVAL '12 days 9:15'),

-- Meeting 2 participants (bigger meeting)
('30000004-0000-0000-0000-000000000004', '10000002-0000-0000-0000-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Kris Demo', 'moderator', NOW() - INTERVAL '11 days 14:00', NOW() - INTERVAL '11 days 14:45'),
('30000005-0000-0000-0000-000000000005', '10000002-0000-0000-0000-000000000002', NULL, 'Client John', 'attendee', NOW() - INTERVAL '11 days 14:02', NOW() - INTERVAL '11 days 14:45'),
('30000006-0000-0000-0000-000000000006', '10000002-0000-0000-0000-000000000002', NULL, 'Sarah PM', 'attendee', NOW() - INTERVAL '11 days 14:05', NOW() - INTERVAL '11 days 14:40'),
('30000007-0000-0000-0000-000000000007', '10000002-0000-0000-0000-000000000002', NULL, 'Mike Dev', 'attendee', NOW() - INTERVAL '11 days 14:01', NOW() - INTERVAL '11 days 14:45'),

-- Meeting 5 (Client meeting - many participants)
('30000008-0000-0000-0000-000000000008', '10000005-0000-0000-0000-000000000005', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Kris Demo', 'moderator', NOW() - INTERVAL '8 days 16:00', NOW() - INTERVAL '8 days 17:00'),
('30000009-0000-0000-0000-000000000009', '10000005-0000-0000-0000-000000000005', NULL, 'Acme CEO', 'attendee', NOW() - INTERVAL '8 days 16:02', NOW() - INTERVAL '8 days 17:00'),
('30000010-0000-0000-0000-000000000010', '10000005-0000-0000-0000-000000000005', NULL, 'Acme CTO', 'attendee', NOW() - INTERVAL '8 days 16:00', NOW() - INTERVAL '8 days 17:00'),
('30000011-0000-0000-0000-000000000011', '10000005-0000-0000-0000-000000000005', NULL, 'Acme PM', 'attendee', NOW() - INTERVAL '8 days 16:01', NOW() - INTERVAL '8 days 16:55'),
('30000012-0000-0000-0000-000000000012', '10000005-0000-0000-0000-000000000005', NULL, 'Tech Lead', 'attendee', NOW() - INTERVAL '8 days 16:03', NOW() - INTERVAL '8 days 17:00'),

-- Meeting 7 (Sprint review)
('30000013-0000-0000-0000-000000000013', '10000007-0000-0000-0000-000000000007', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Kris Demo', 'moderator', NOW() - INTERVAL '7 days 15:00', NOW() - INTERVAL '7 days 16:30'),
('30000014-0000-0000-0000-000000000014', '10000007-0000-0000-0000-000000000007', NULL, 'Dev Team 1', 'attendee', NOW() - INTERVAL '7 days 15:00', NOW() - INTERVAL '7 days 16:30'),
('30000015-0000-0000-0000-000000000015', '10000007-0000-0000-0000-000000000007', NULL, 'Dev Team 2', 'attendee', NOW() - INTERVAL '7 days 15:02', NOW() - INTERVAL '7 days 16:28'),
('30000016-0000-0000-0000-000000000016', '10000007-0000-0000-0000-000000000007', NULL, 'QA Lead', 'attendee', NOW() - INTERVAL '7 days 15:00', NOW() - INTERVAL '7 days 16:30'),
('30000017-0000-0000-0000-000000000017', '10000007-0000-0000-0000-000000000007', NULL, 'Designer', 'attendee', NOW() - INTERVAL '7 days 15:05', NOW() - INTERVAL '7 days 16:20'),
('30000018-0000-0000-0000-000000000018', '10000007-0000-0000-0000-000000000007', NULL, 'Product Owner', 'attendee', NOW() - INTERVAL '7 days 15:00', NOW() - INTERVAL '7 days 16:30'),

-- Meeting 20 (Today's standup)
('30000019-0000-0000-0000-000000000019', '10000020-0000-0000-0000-000000000020', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Kris Demo', 'moderator', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 hours 45 min'),
('30000020-0000-0000-0000-000000000020', '10000020-0000-0000-0000-000000000020', NULL, 'Team Member A', 'attendee', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 hours 45 min'),
('30000021-0000-0000-0000-000000000021', '10000020-0000-0000-0000-000000000020', NULL, 'Team Member B', 'attendee', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 hours 50 min');

-- ============================================
-- 6. CREATE CHAT MESSAGES
-- ============================================
INSERT INTO chat_messages (id, meeting_id, user_id, content, message_type, created_at)
VALUES
-- Meeting 1 chat
('40000001-0000-0000-0000-000000000001', '10000001-0000-0000-0000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Good morning everyone!', 'text', NOW() - INTERVAL '12 days 9:01'),
('40000002-0000-0000-0000-000000000002', '10000001-0000-0000-0000-000000000001', NULL, 'Morning! Ready to start', 'text', NOW() - INTERVAL '12 days 9:02'),
('40000003-0000-0000-0000-000000000003', '10000001-0000-0000-0000-000000000001', NULL, 'Lets go!', 'text', NOW() - INTERVAL '12 days 9:03'),

-- Meeting 2 chat (Product Demo)
('40000004-0000-0000-0000-000000000004', '10000002-0000-0000-0000-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Welcome to the product demo!', 'text', NOW() - INTERVAL '11 days 14:01'),
('40000005-0000-0000-0000-000000000005', '10000002-0000-0000-0000-000000000002', NULL, 'Excited to see the new features', 'text', NOW() - INTERVAL '11 days 14:02'),
('40000006-0000-0000-0000-000000000006', '10000002-0000-0000-0000-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Let me share my screen', 'text', NOW() - INTERVAL '11 days 14:05'),
('40000007-0000-0000-0000-000000000007', '10000002-0000-0000-0000-000000000002', NULL, 'Can you make the font bigger?', 'text', NOW() - INTERVAL '11 days 14:15'),
('40000008-0000-0000-0000-000000000008', '10000002-0000-0000-0000-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Sure, let me adjust that', 'text', NOW() - INTERVAL '11 days 14:16'),
('40000009-0000-0000-0000-000000000009', '10000002-0000-0000-0000-000000000002', NULL, 'Perfect, thanks!', 'text', NOW() - INTERVAL '11 days 14:17'),
('40000010-0000-0000-0000-000000000010', '10000002-0000-0000-0000-000000000002', NULL, 'This looks great', 'text', NOW() - INTERVAL '11 days 14:25'),
('40000011-0000-0000-0000-000000000011', '10000002-0000-0000-0000-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Any questions so far?', 'text', NOW() - INTERVAL '11 days 14:28'),
('40000012-0000-0000-0000-000000000012', '10000002-0000-0000-0000-000000000002', NULL, 'When will this be released?', 'text', NOW() - INTERVAL '11 days 14:30'),
('40000013-0000-0000-0000-000000000013', '10000002-0000-0000-0000-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Targeting end of next month', 'text', NOW() - INTERVAL '11 days 14:31'),
('40000014-0000-0000-0000-000000000014', '10000002-0000-0000-0000-000000000002', NULL, 'Sounds good!', 'text', NOW() - INTERVAL '11 days 14:32'),
('40000015-0000-0000-0000-000000000015', '10000002-0000-0000-0000-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Thanks for attending!', 'text', NOW() - INTERVAL '11 days 14:44'),

-- Meeting 5 chat (Client Meeting)
('40000016-0000-0000-0000-000000000016', '10000005-0000-0000-0000-000000000005', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Welcome Acme Corp team!', 'text', NOW() - INTERVAL '8 days 16:00:30'),
('40000017-0000-0000-0000-000000000017', '10000005-0000-0000-0000-000000000005', NULL, 'Thanks for having us', 'text', NOW() - INTERVAL '8 days 16:01:00'),
('40000018-0000-0000-0000-000000000018', '10000005-0000-0000-0000-000000000005', NULL, 'Looking forward to this discussion', 'text', NOW() - INTERVAL '8 days 16:02:00'),
('40000019-0000-0000-0000-000000000019', '10000005-0000-0000-0000-000000000005', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Here is the project timeline', 'text', NOW() - INTERVAL '8 days 16:10:00'),
('40000020-0000-0000-0000-000000000020', '10000005-0000-0000-0000-000000000005', NULL, 'Can we extend phase 2?', 'text', NOW() - INTERVAL '8 days 16:25:00'),
('40000021-0000-0000-0000-000000000021', '10000005-0000-0000-0000-000000000005', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'We can discuss that offline', 'text', NOW() - INTERVAL '8 days 16:26:00'),
('40000022-0000-0000-0000-000000000022', '10000005-0000-0000-0000-000000000005', NULL, 'Agreed', 'text', NOW() - INTERVAL '8 days 16:26:30'),
('40000023-0000-0000-0000-000000000023', '10000005-0000-0000-0000-000000000005', NULL, 'Great presentation!', 'text', NOW() - INTERVAL '8 days 16:55:00'),
('40000024-0000-0000-0000-000000000024', '10000005-0000-0000-0000-000000000005', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Thank you all for your time', 'text', NOW() - INTERVAL '8 days 16:58:00'),

-- Meeting 7 chat (Sprint Review)
('40000025-0000-0000-0000-000000000025', '10000007-0000-0000-0000-000000000007', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Sprint Review starting now', 'text', NOW() - INTERVAL '7 days 15:00:30'),
('40000026-0000-0000-0000-000000000026', '10000007-0000-0000-0000-000000000007', NULL, 'We completed 15 story points', 'text', NOW() - INTERVAL '7 days 15:10:00'),
('40000027-0000-0000-0000-000000000027', '10000007-0000-0000-0000-000000000007', NULL, 'QA passed on all tickets', 'text', NOW() - INTERVAL '7 days 15:20:00'),
('40000028-0000-0000-0000-000000000028', '10000007-0000-0000-0000-000000000007', NULL, 'Design review looks good', 'text', NOW() - INTERVAL '7 days 15:30:00'),
('40000029-0000-0000-0000-000000000029', '10000007-0000-0000-0000-000000000007', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Great work team!', 'text', NOW() - INTERVAL '7 days 15:45:00'),
('40000030-0000-0000-0000-000000000030', '10000007-0000-0000-0000-000000000007', NULL, 'Thanks!', 'text', NOW() - INTERVAL '7 days 15:46:00'),
('40000031-0000-0000-0000-000000000031', '10000007-0000-0000-0000-000000000007', NULL, 'Awesome sprint!', 'text', NOW() - INTERVAL '7 days 15:47:00'),

-- Meeting 20 chat (today's standup)
('40000032-0000-0000-0000-000000000032', '10000020-0000-0000-0000-000000000020', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Good morning team!', 'text', NOW() - INTERVAL '3 hours'),
('40000033-0000-0000-0000-000000000033', '10000020-0000-0000-0000-000000000020', NULL, 'Morning Kris!', 'text', NOW() - INTERVAL '2 hours 59 min'),
('40000034-0000-0000-0000-000000000034', '10000020-0000-0000-0000-000000000020', NULL, 'Ready for standup', 'text', NOW() - INTERVAL '2 hours 58 min');

-- Done! Check counts:
SELECT 'users' as table_name, COUNT(*) FROM users
UNION ALL SELECT 'rooms', COUNT(*) FROM rooms
UNION ALL SELECT 'meetings', COUNT(*) FROM meetings
UNION ALL SELECT 'meeting_participants', COUNT(*) FROM meeting_participants
UNION ALL SELECT 'chat_messages', COUNT(*) FROM chat_messages
UNION ALL SELECT 'scheduled_meetings', COUNT(*) FROM scheduled_meetings;
