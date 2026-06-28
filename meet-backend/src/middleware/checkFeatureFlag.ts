import type { AuthRequest } from './authenticate.js';

/**
 * Per-moderator feature-lock enforcement.
 *
 * The allow-list lives in users.feature_flags (JSONB).
 * Rules:
 *   - Admins are never feature-locked.
 *   - Room hosts always bypass (the room creator is sovereign).
 *   - feature_flags null/undefined = no lock applied (all allowed).
 *   - feature_flags {key: true} = that feature allowed; absent/false = blocked.
 *
 * Usage in a route handler (after authenticate + room context is loaded):
 *
 *   const blocked = await assertFeature(req, res, room.host_id, 'kick');
 *   if (blocked) return;
 *
 * Returns true if the request was denied (response already sent).
 * Returns false if the request is allowed to proceed.
 */
export async function assertFeature(
  req: AuthRequest,
  res: import('express').Response,
  roomHostId: string | null | undefined,
  feature: string,
): Promise<boolean> {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return true;
  }

  // Admins bypass all feature locks
  if (user.role === 'admin') return false;

  // Room host bypasses all feature locks
  if (roomHostId && user.id === roomHostId) return false;

  // Non-moderators are never feature-locked (their access is controlled by
  // role-level permissions elsewhere)
  if (user.role !== 'moderator') return false;

  // feature_flags null = no lock applied
  const flags = user.feature_flags;
  if (!flags) return false;

  // Allow-list: must be explicitly true
  if (flags[feature] === true) return false;

  res.status(403).json({
    error: `This feature (${feature}) has been locked by an administrator`,
    lockedFeature: feature,
  });
  return true;
}
