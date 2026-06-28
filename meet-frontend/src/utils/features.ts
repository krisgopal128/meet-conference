import type { FeatureFlagKey, FeatureFlags, User } from '../types';

export const MODERATOR_FEATURES: { key: FeatureFlagKey; label: string; description: string }[] = [
  { key: 'whiteboard', label: 'Whiteboard', description: 'Open and control the shared whiteboard' },
  { key: 'recording', label: 'Recording', description: 'Start and stop meeting recordings' },
  { key: 'screen_share', label: 'Screen Share', description: 'Share their own screen' },
  { key: 'mute_all', label: 'Mute All', description: 'Mute all participants at once' },
  { key: 'kick', label: 'Remove Participants', description: 'Kick participants from the meeting' },
  { key: 'lock_meeting', label: 'Lock Meeting', description: 'Lock the room to prevent new joins' },
  { key: 'lobby_control', label: 'Lobby Control', description: 'Admit and deny lobby participants' },
];

/**
 * Returns true if the given user is allowed to use a moderator feature.
 *
 * Rules:
 * - Admins and non-moderators are never feature-locked (returns true).
 * - Room hosts always bypass locks (handled by the caller, which knows hostId).
 * - featureFlags is an allow-list: a key present and true = allowed.
 *   A null/undefined featureFlags means no lock applied (all features allowed).
 */
export function canUseFeature(user: Pick<User, 'role' | 'featureFlags'> | null | undefined, feature: FeatureFlagKey): boolean {
  if (!user) return true;
  if (user.role !== 'moderator') return true;
  const flags = user.featureFlags;
  if (!flags) return true; // no lock applied
  return flags[feature] === true;
}

/**
 * Whether any feature lock is active for this user (drives UI: show the section).
 */
export function hasFeatureLocks(user: Pick<User, 'role' | 'featureFlags'> | null | undefined): boolean {
  if (!user) return false;
  if (user.role !== 'moderator') return false;
  return user.featureFlags != null && Object.keys(user.featureFlags).length > 0;
}

/**
 * Build the default all-allowed flags object (used when admin opens the editor
 * for a moderator that has no lock set yet).
 */
export function allFeaturesAllowed(): FeatureFlags {
  const out: FeatureFlags = {};
  for (const f of MODERATOR_FEATURES) out[f.key] = true;
  return out;
}
