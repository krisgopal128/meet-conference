import { query, queryOne } from './database.js';
import logger from '../utils/logger.js';

// ============================================
// Types
// ============================================

export interface RoomRow {
  id: string;
  name: string;
  title: string | null;
  description: string | null;
  host_id: string;
  host_name?: string;
  host_email?: string;
  max_participants: number;
  status: string;
  created_at: Date;
  waiting_room_enabled?: boolean;
  settings?: Record<string, unknown> | null;
}

export interface EnrichedRoom extends RoomRow {
  isActive: boolean;
}

export interface RoomAccessCheck {
  room: RoomRow | null;
  allowed: boolean;
}

export interface RoomWithMetadata extends RoomRow {
  metadata: Record<string, unknown>;
}

// ============================================
// Room Database Operations (Core CRUD)
// ============================================

/**
 * Get room by name with optional user join for host info
 */
export async function getRoomByName(name: string, includeUserJoin = false): Promise<RoomRow | null> {
  if (includeUserJoin) {
    return await queryOne<RoomRow>(
      `SELECT r.*, u.name as host_name, u.email as host_email
       FROM rooms r
       LEFT JOIN users u ON r.host_id = u.id
       WHERE r.name = $1`,
      [name]
    );
  }

  return await queryOne<RoomRow>(
    'SELECT * FROM rooms WHERE name = $1',
    [name]
  );
}

/**
 * Get room by ID
 */
export async function getRoomById(id: string): Promise<RoomRow | null> {
  return await queryOne<RoomRow>(
    'SELECT * FROM rooms WHERE id = $1',
    [id]
  );
}

/**
 * Get host_id for a room (fast, used for permission checks)
 */
export async function getRoomHostId(name: string): Promise<string | null> {
  const result = await queryOne<{ host_id: string }>(
    'SELECT host_id FROM rooms WHERE name = $1',
    [name]
  );
  return result?.host_id ?? null;
}

/**
 * Get room existence check by name
 */
export async function roomExists(name: string): Promise<boolean> {
  const result = await queryOne<{ exists_check: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM rooms WHERE name = $1) as exists_check',
    [name]
  );
  return result?.exists_check ?? false;
}

/**
 * Create a new room in database
 * Returns the created room row
 */
export async function createRoom(
  name: string,
  hostId: string,
  title: string | null,
  description: string | null,
  maxParticipants: number,
  emptyTimeout: number,
  startsAt: Date | null,
  endsAt: Date | null,
  settings: Record<string, unknown> | null,
  waitingRoomEnabled: boolean
): Promise<RoomRow> {
  const [room] = await query<RoomRow>(
    `INSERT INTO rooms (name, title, description, host_id, max_participants, empty_timeout, starts_at, ends_at, settings, waiting_room_enabled)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      name,
      title,
      description,
      hostId,
      maxParticipants,
      emptyTimeout,
      startsAt,
      endsAt,
      settings ? JSON.stringify(settings) : null,
      waitingRoomEnabled,
    ]
  );
  return room;
}

/**
 * Update room fields
 * Only includes fields that are defined (not undefined).
 * If a field is explicitly null, sets it to NULL (allows clearing).
 */
export async function updateRoom(
  name: string,
  updates: {
    title?: string | null;
    description?: string | null;
    maxParticipants?: number;
    status?: string;
  }
): Promise<RoomRow> {
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (updates.title !== undefined) {
    setClauses.push(`title = $${paramIdx++}`);
    params.push(updates.title);
  }
  if (updates.description !== undefined) {
    setClauses.push(`description = $${paramIdx++}`);
    params.push(updates.description);
  }
  if (updates.maxParticipants !== undefined) {
    setClauses.push(`max_participants = $${paramIdx++}`);
    params.push(updates.maxParticipants);
  }
  if (updates.status !== undefined) {
    setClauses.push(`status = $${paramIdx++}`);
    params.push(updates.status);
  }

  params.push(name);
  const [room] = await query<RoomRow>(
    `UPDATE rooms SET ${setClauses.join(', ')} WHERE name = $${paramIdx} RETURNING *`,
    params
  );
  return room;
}

/**
 * Update room settings JSON
 */
export async function updateRoomSettings(
  id: string,
  settings: Record<string, unknown>
): Promise<void> {
  await query(
    'UPDATE rooms SET settings = $1 WHERE id = $2',
    [JSON.stringify(settings), id]
  );
}

/**
 * Delete room by name
 */
export async function deleteRoomByName(name: string): Promise<void> {
  const room = await getRoomByName(name);
  if (room) {
    await query('DELETE FROM rooms WHERE id = $1', [room.id]);
  }
}

/**
 * Set room status to active
 */
export async function setRoomActive(id: string): Promise<void> {
  await query("UPDATE rooms SET status = 'active' WHERE id = $1", [id]);
}

/**
 * Set room status to ended
 */
export async function setRoomEnded(id: string): Promise<void> {
  await query("UPDATE rooms SET status = 'ended' WHERE id = $1", [id]);
}

// ============================================
// Room Listing Queries
// ============================================

/**
 * Get all rooms (admin - up to 100)
 */
export async function getAllRooms(): Promise<RoomRow[]> {
  return await query<RoomRow>(
    `SELECT r.*, u.name as host_name, u.email as host_email
     FROM rooms r
     LEFT JOIN users u ON r.host_id = u.id
     ORDER BY r.created_at DESC
     LIMIT 100`
  );
}

/**
 * Get rooms owned by a user
 */
export async function getUserRooms(userId: string): Promise<RoomRow[]> {
  return await query<RoomRow>(
    `SELECT r.*, u.name as host_name, u.email as host_email
     FROM rooms r
     LEFT JOIN users u ON r.host_id = u.id
     WHERE r.host_id = $1
     ORDER BY r.created_at DESC
     LIMIT 50`,
    [userId]
  );
}

// ============================================
// Permission & Access Checks
// ============================================

/**
 * Check if user can moderate a room (host or has LiveKit moderator rights)
 * Returns room row and permission flag
 */
export async function checkRoomModeratorAccess(
  roomName: string,
  userId: string,
  participantCanModerateFn: (roomName: string, userId: string, hostId: string) => Promise<boolean>
): Promise<RoomAccessCheck> {
  const room = await getRoomByName(roomName);
  if (!room) {
    return { room: null, allowed: false };
  }

  const allowed = await participantCanModerateFn(roomName, userId, room.host_id);
  return { room, allowed };
}

/**
 * Get waiting_room_enabled flag for a room
 */
export async function getRoomWaitingEnabled(name: string): Promise<{ waiting_room_enabled: boolean } | null> {
  return await queryOne<{ waiting_room_enabled: boolean }>(
    'SELECT waiting_room_enabled FROM rooms WHERE name = $1',
    [name]
  );
}

// ============================================
// Meeting & Chat Integration
// ============================================

/**
 * Get or create virtual room for LiveKit‑only rooms (not in DB)
 */
export function createVirtualRoom(
  name: string,
  lkRoom: unknown,
  _isAuthenticated: boolean
): RoomWithMetadata {
  return {
    id: `lk-${name}`,
    name,
    title: null as string | null,
    description: null as string | null,
    host_id: 'livekit',
    host_name: undefined,
    host_email: undefined,
    max_participants: (lkRoom as { maxParticipants?: number })?.maxParticipants || 50,
    status: 'active',
    created_at: new Date(),
    metadata: (lkRoom as { metadata?: Record<string, unknown> })?.metadata || {},
  };
}

/**
 * Get latest meeting ID for a room (used for chat)
 */
export async function getLatestMeetingId(roomId: string): Promise<string | null> {
  const result = await queryOne<{ id: string }>(
    `SELECT id FROM meetings WHERE room_id = $1 ORDER BY started_at DESC LIMIT 1`,
    [roomId]
  );
  return result?.id ?? null;
}

/**
 * Check if there's an active meeting for a room
 */
export async function hasActiveMeeting(roomId: string): Promise<boolean> {
  const result = await queryOne<{ exists_check: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM meetings WHERE room_id = $1 AND ended_at IS NULL) as exists_check`,
    [roomId]
  );
  return result?.exists_check ?? false;
}

/**
 * Create a new meeting record for a room
 */
export async function createMeeting(roomId: string): Promise<string> {
  const [meeting] = await query<{ id: string }>(
    "INSERT INTO meetings (room_id, status) VALUES ($1, 'ongoing') RETURNING id",
    [roomId]
  );
  return meeting.id;
}

/**
 * End all meetings for a room
 */
export async function endRoomMeetings(roomId: string): Promise<void> {
  await query(
    "UPDATE meetings SET ended_at = NOW(), status = 'ended' WHERE room_id = $1 AND ended_at IS NULL",
    [roomId]
  );
}

// ============================================
// Error handling wrapper
// ============================================

export class RoomServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'RoomServiceError';
  }
}

/**
 * Safe query wrapper that logs errors
 */
export async function safeQuery<T>(
  fn: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logger.error(`RoomService [${context}]:`, error);
    throw new RoomServiceError(`Failed in ${context}`, 'INTERNAL_ERROR');
  }
}

// Export all service functions in a single namespace
export const roomService = {
  getRoomByName,
  getRoomById,
  getRoomHostId,
  roomExists,
  createRoom,
  updateRoom,
  updateRoomSettings,
  deleteRoomByName,
  setRoomActive,
  setRoomEnded,
  getAllRooms,
  getUserRooms,
  checkRoomModeratorAccess,
  getRoomWaitingEnabled,
  createVirtualRoom,
  getLatestMeetingId,
  hasActiveMeeting,
  createMeeting,
  endRoomMeetings,
  safeQuery,
};

export default roomService;
