import { cacheGet, cacheSet, cacheDel, cacheTTL } from './redis.js';
import logger from '../utils/logger.js';

// ============================================
// ADMITTED PARTICIPANTS (Auto-admit on rejoin)
// ============================================

// Admitted participants stay valid for 4 hours (longer than a typical meeting)
const ADMITTED_TTL_SECONDS = 4 * 60 * 60;

interface AdmittedParticipant {
  identity: string;
  guestName?: string;
  admittedAt: number;
}

/**
 * Add a participant to the admitted list for a room.
 * They will be auto-admitted if they rejoin within the TTL.
 */
export async function addAdmittedParticipant(roomName: string, identity: string, guestName?: string): Promise<void> {
  await cacheSet(
    `admitted:${roomName}:${identity}`,
    { identity, guestName, admittedAt: Date.now() },
    ADMITTED_TTL_SECONDS
  );
  logger.info(`[ADMIT] Added ${identity} to admitted list for room ${roomName}, TTL: ${ADMITTED_TTL_SECONDS}s`);

  if (guestName) {
    const normalizedName = guestName.toLowerCase().trim();
    await cacheSet(`admitted_guest:${roomName}:${normalizedName}`, identity, ADMITTED_TTL_SECONDS);
    logger.info(`[ADMIT] Also tracking guest "${guestName}" for room ${roomName}`);
  }
}

/**
 * Check if a participant was previously admitted (by identity).
 * Returns the TTL remaining (0 if not admitted).
 */
export async function isParticipantAdmitted(roomName: string, identity: string): Promise<number> {
  return Math.max(0, await cacheTTL(`admitted:${roomName}:${identity}`));
}

/**
 * Check if a guest name was previously admitted.
 * Returns the TTL remaining (0 if not admitted).
 */
export async function isGuestNameAdmitted(roomName: string, guestName: string): Promise<number> {
  const normalizedName = guestName.toLowerCase().trim();
  return Math.max(0, await cacheTTL(`admitted_guest:${roomName}:${normalizedName}`));
}

/**
 * Get admitted participant info by identity.
 */
export async function getAdmittedParticipant(roomName: string, identity: string): Promise<AdmittedParticipant | null> {
  return cacheGet<AdmittedParticipant>(`admitted:${roomName}:${identity}`);
}

/**
 * Remove participant from admitted list (e.g., when kicked).
 */
export async function removeAdmittedParticipant(roomName: string, identity: string): Promise<void> {
  await cacheDel(`admitted:${roomName}:${identity}`);
}

// ============================================
// KICKED PARTICIPANTS (Cooldown)
// ============================================

const KICK_COOLDOWN_SECONDS = 10;

export async function addKickedParticipant(roomName: string, identity: string, guestName?: string): Promise<void> {
  // Clear admitted status so kicked participants must pass through the lobby on rejoin
  await cacheDel(`admitted:${roomName}:${identity}`);
  if (guestName) {
    const normalizedName = guestName.toLowerCase().trim();
    await cacheDel(`admitted_guest:${roomName}:${normalizedName}`);
  }

  await cacheSet(`kicked:${roomName}:${identity}`, Date.now(), KICK_COOLDOWN_SECONDS);
  logger.info(`[KICK] Added ${identity} to kicked list for room ${roomName}, cooldown: ${KICK_COOLDOWN_SECONDS}s`);

  if (guestName) {
    const normalizedName = guestName.toLowerCase().trim();
    await cacheSet(`kicked_guest:${roomName}:${normalizedName}`, identity, KICK_COOLDOWN_SECONDS);
    logger.info(`[KICK] Also tracking guest "${guestName}" for room ${roomName}`);
  }
}

export async function isParticipantKicked(roomName: string, identity: string): Promise<number> {
  return Math.max(0, await cacheTTL(`kicked:${roomName}:${identity}`));
}

export async function isGuestNameKicked(roomName: string, guestName: string): Promise<number> {
  const normalizedName = guestName.toLowerCase().trim();
  return Math.max(0, await cacheTTL(`kicked_guest:${roomName}:${normalizedName}`));
}

export async function removeKickedParticipant(roomName: string, identity: string): Promise<void> {
  await cacheDel(`kicked:${roomName}:${identity}`);
}
