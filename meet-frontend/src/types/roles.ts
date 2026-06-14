/**
 * Canonical role taxonomy for the meet-conference platform.
 *
 * DB user roles (users.role column):
 *   - 'admin'       — full system access (Prashasakah panel)
 *   - 'moderator'   — limited admin access
 *   - 'participant' — regular authenticated user (default)
 *
 * LiveKit token roles (assigned during token generation):
 *   - 'host'        — room creator, full control
 *   - 'cohost'      — elevated participant, can moderate
 *   - 'presenter'   — can publish but not moderate
 *   - 'attendee'    — standard participant (default for authenticated users)
 *   - 'viewer'      — observe only, hidden from participant list
 *
 * External API roles (external.ts, for Tuition Notebook):
 *   - 'moderator'   — maps to LiveKit 'host' (roomAdmin)
 *   - 'teacher'     — maps to LiveKit 'host' (roomAdmin)
 *   - 'attendee'    — standard participant
 *   - 'student'     — maps to LiveKit 'attendee'
 *   - 'observer'    — maps to LiveKit 'viewer' (hidden)
 *   - 'presenter'   — can publish but not moderate
 *
 * Guest roles:
 *   - Guests always get 'attendee' LiveKit role regardless of URL params.
 */

export type DbUserRole = 'admin' | 'moderator' | 'participant';
export type LiveKitRole = 'host' | 'cohost' | 'presenter' | 'attendee' | 'viewer';
export type ExternalRole = 'moderator' | 'attendee' | 'observer' | 'presenter' | 'teacher' | 'student';
