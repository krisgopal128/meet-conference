import { z } from 'zod';

export const scheduleMeetingSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  scheduledStart: z.string().datetime(),
  scheduledEnd: z.string().datetime().optional(),
  participantEmails: z.array(z.string().email()).optional(),
  timezone: z.string().default('UTC'),
});

const diagnosticsEventSchema = z.object({
  at: z.string(),
  type: z.enum(['network', 'cpu', 'battery', 'recovery', 'manual']),
  message: z.string(),
});

export const diagnosticsSnapshotSchema = z.object({
  roomName: z.string().min(1).max(255),
  bytesSent: z.number().nullable(),
  bytesReceived: z.number().nullable(),
  packetsLost: z.number().nullable(),
  rttMs: z.number().nullable(),
  codec: z.string().max(50).nullable(),
  packetLossPct: z.number().min(0).max(100).nullable(),
  jitterMs: z.number().nullable(),
  availableBitrateKbps: z.number().nullable(),
  framesDropped: z.number().nullable(),
});

export const diagnosticsPayloadSchema = z.object({
  roomName: z.string().min(1).max(255).optional(),
  participantIdentity: z.string().min(1).max(255).optional(),
  selectedQualityMode: z.string().min(1).max(50),
  effectiveQualityMode: z.string().min(1).max(50),
  screenShareMode: z.string().min(1).max(50),
  autoFallbackActive: z.boolean(),
  qualityOverrideReason: z.enum(['network', 'cpu', 'battery']).nullable(),
  connectionQualityLabel: z.string().min(1).max(50),
  packetLossPercent: z.number().nullable(),
  rttMs: z.number().nullable(),
  jitterMs: z.number().nullable(),
  availableBitrateKbps: z.number().nullable(),
  renderFps: z.number().nullable(),
  cpuBusyPercent: z.number().nullable().optional(),
  batteryLevelPercent: z.number().nullable().optional(),
  batteryCharging: z.boolean().nullable().optional(),
  diagnosticsLog: z.array(diagnosticsEventSchema).max(100),
  userAgent: z.string().max(1000).optional(),
  capturedAt: z.string(),
});
