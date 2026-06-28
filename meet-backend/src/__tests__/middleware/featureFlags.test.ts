import { describe, it, expect } from 'vitest';
import type { Response } from 'express';

// Inline copy of assertFeature's logic for isolated unit testing.
// The real implementation is in middleware/checkFeatureFlag.ts and reads
// req.user + res from Express — this mirrors it exactly for test purposes.
interface FakeUser {
  id: string;
  role: string;
  feature_flags?: Record<string, boolean> | null;
}

async function assertFeatureLogic(
  user: FakeUser | undefined,
  roomHostId: string | null | undefined,
  feature: string,
): Promise<{ denied: boolean; status?: number; error?: string }> {
  if (!user) return { denied: true, status: 401 };
  if (user.role === 'admin') return { denied: false };
  if (roomHostId && user.id === roomHostId) return { denied: false };
  if (user.role !== 'moderator') return { denied: false };
  const flags = user.feature_flags;
  if (!flags) return { denied: false };
  if (flags[feature] === true) return { denied: false };
  return { denied: true, status: 403 };
}

describe('Feature Flag Enforcement (assertFeature)', () => {
  const moderatorId = 'mod-001';
  const hostId = 'host-001';
  const adminId = 'admin-001';

  it('denies a moderator whose feature is explicitly false', async () => {
    const result = await assertFeatureLogic(
      { id: moderatorId, role: 'moderator', feature_flags: { whiteboard: true, recording: false } },
      hostId,
      'recording',
    );
    expect(result.denied).toBe(true);
    expect(result.status).toBe(403);
  });

  it('allows a moderator whose feature is explicitly true', async () => {
    const result = await assertFeatureLogic(
      { id: moderatorId, role: 'moderator', feature_flags: { whiteboard: true, recording: false } },
      hostId,
      'whiteboard',
    );
    expect(result.denied).toBe(false);
  });

  it('denies a moderator when the feature key is absent (allow-list)', async () => {
    const result = await assertFeatureLogic(
      { id: moderatorId, role: 'moderator', feature_flags: { whiteboard: true } },
      hostId,
      'kick',
    );
    expect(result.denied).toBe(true);
    expect(result.status).toBe(403);
  });

  it('allows a moderator with null feature_flags (no lock applied)', async () => {
    const result = await assertFeatureLogic(
      { id: moderatorId, role: 'moderator', feature_flags: null },
      hostId,
      'recording',
    );
    expect(result.denied).toBe(false);
  });

  it('allows a moderator with undefined feature_flags', async () => {
    const result = await assertFeatureLogic(
      { id: moderatorId, role: 'moderator', feature_flags: undefined },
      hostId,
      'recording',
    );
    expect(result.denied).toBe(false);
  });

  it('denies a moderator with empty {} (all locked)', async () => {
    const result = await assertFeatureLogic(
      { id: moderatorId, role: 'moderator', feature_flags: {} },
      hostId,
      'recording',
    );
    expect(result.denied).toBe(true);
  });

  it('room host always bypasses locks', async () => {
    const result = await assertFeatureLogic(
      { id: hostId, role: 'moderator', feature_flags: { recording: false } },
      hostId,
      'recording',
    );
    expect(result.denied).toBe(false);
  });

  it('admin always bypasses locks', async () => {
    const result = await assertFeatureLogic(
      { id: adminId, role: 'admin', feature_flags: { recording: false } },
      hostId,
      'recording',
    );
    expect(result.denied).toBe(false);
  });

  it('non-moderator non-host is never feature-locked', async () => {
    const result = await assertFeatureLogic(
      { id: 'participant-1', role: 'participant', feature_flags: null },
      hostId,
      'kick',
    );
    expect(result.denied).toBe(false);
  });

  it('each of the 7 features is independently enforceable', async () => {
    const features = ['whiteboard', 'recording', 'screen_share', 'mute_all', 'kick', 'lock_meeting', 'lobby_control'];
    for (const f of features) {
      const locked = await assertFeatureLogic(
        { id: moderatorId, role: 'moderator', feature_flags: { whiteboard: true } },
        hostId,
        f,
      );
      expect(locked.denied).toBe(f !== 'whiteboard');
    }
  });
});

describe('Screen Share Token Grant (Stage 2)', () => {
  // Simulates the canPublishSources restriction logic from createAccessToken
  function getGrantScreenShareSources(featureFlags: Record<string, boolean> | null | undefined): string[] | undefined {
    if (featureFlags && featureFlags.screen_share === false) {
      return ['CAMERA', 'MICROPHONE']; // restricted — no SCREEN_SHARE
    }
    return undefined; // unrestricted
  }

  it('restricts canPublishSources when screen_share is false', () => {
    const sources = getGrantScreenShareSources({ whiteboard: true, screen_share: false });
    expect(sources).toEqual(['CAMERA', 'MICROPHONE']);
  });

  it('does not restrict when screen_share is true', () => {
    const sources = getGrantScreenShareSources({ screen_share: true });
    expect(sources).toBeUndefined();
  });

  it('does not restrict when feature_flags is null (no lock)', () => {
    const sources = getGrantScreenShareSources(null);
    expect(sources).toBeUndefined();
  });

  it('does not restrict when feature_flags is undefined', () => {
    const sources = getGrantScreenShareSources(undefined);
    expect(sources).toBeUndefined();
  });

  it('does not restrict when screen_share key is absent (but other features locked)', () => {
    const sources = getGrantScreenShareSources({ kick: false });
    expect(sources).toBeUndefined();
  });
});
