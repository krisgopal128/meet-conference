/**
 * API Keys Routes - Manage API keys for external integrations
 * 
 * Only moderators and admins can manage API keys.
 */

 import { Router, Request, Response } from 'express';
 import crypto from 'crypto';
 import { z } from 'zod';
 import { query, queryOne } from '../services/database.js';
 import { authenticate, AuthRequest } from '../middleware/authenticate.js';
 import { requireRole } from '../middleware/requireRole.js';
 import logger from '../utils/logger.js';

const router = Router();

// All routes require authentication and moderator role
router.use(authenticate);
router.use(requireRole('admin', 'moderator'));

// ==================== Validation Schemas ====================

const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.object({
    rooms: z.object({
      create: z.boolean().optional(),
      read: z.boolean().optional(),
      update: z.boolean().optional(),
      delete: z.boolean().optional(),
      end: z.boolean().optional(),
    }).optional(),
    meetings: z.object({
      create: z.boolean().optional(),
      read: z.boolean().optional(),
      update: z.boolean().optional(),
      delete: z.boolean().optional(),
    }).optional(),
    token: z.object({
      generate: z.boolean().optional(),
    }).optional(),
  }).optional(),
  expires_in_days: z.number().int().min(1).max(365).optional(),
});

const updateApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  permissions: z.record(z.unknown()).optional(),
  is_active: z.boolean().optional(),
});

// ==================== Helper Functions ====================

/**
 * Generate a secure API key
 */
function generateApiKey(): { key: string; hash: string; prefix: string } {
  // Generate 32 bytes of random data
  const bytes = crypto.randomBytes(32);
  const key = `tn_${bytes.toString('hex')}`;
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  const prefix = key.substring(0, 12);
  
  return { key, hash, prefix };
}

// ==================== Routes ====================

/**
 * List all API keys for current user
 * GET /api-keys
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user?.id;
    
     const keys = await query<{
       id: string;
       name: string;
       prefix: string;
       permissions: Record<string, unknown>;
       last_used_at: Date | null;
       expires_at: Date | null;
       is_active: boolean;
       created_at: Date;
     }>(
      `SELECT id, name, prefix, permissions, last_used_at, expires_at, is_active, created_at 
       FROM api_keys 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [userId]
    );
    
    res.json({ keys });
    
  } catch (error) {
    logger.error('[API Keys] Error listing keys:', error);
    res.status(500).json({ error: 'Failed to list API keys' });
  }
});

/**
 * Create a new API key
 * POST /api-keys
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user?.id;
    
    // Validate input
    const validationResult = createApiKeySchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid request body', 
        details: validationResult.error.issues 
      });
    }
    
    const { name, permissions, expires_in_days } = validationResult.data;
    
    // Check if user already has max keys (limit to 10)
    const existingCount = await queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM api_keys WHERE user_id = $1 AND is_active = true',
      [userId]
    );
    
    if (existingCount && parseInt(existingCount.count) >= 10) {
      return res.status(400).json({ error: 'Maximum of 10 active API keys allowed' });
    }
    
    // Generate API key
    const { key, hash, prefix } = generateApiKey();
    
    // Calculate expiry date if specified
    let expiresAt: Date | null = null;
    if (expires_in_days) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expires_in_days);
    }
    
    // Save to database
    const [newKey] = await query<{ id: string }>(
      `INSERT INTO api_keys (user_id, name, key_hash, prefix, permissions, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        userId,
        name.trim(),
        hash,
        prefix,
        JSON.stringify(permissions || { rooms: { create: true, read: true, update: true, delete: true } }),
        expiresAt
      ]
    );
    
    logger.info(`[API Keys] User ${userId} created API key: ${name}`);
    
    // Return the key ONLY on creation (can't be retrieved later)
    res.status(201).json({
      id: newKey.id,
      name: name.trim(),
      key, // Full key - only shown once!
      prefix,
      expires_at: expiresAt,
      created_at: new Date()
    });
    
  } catch (error) {
    logger.error('[API Keys] Error creating key:', error);
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

/**
 * Get a single API key by ID
 * GET /api-keys/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user?.id;
    const { id } = req.params;
    
     const key = await queryOne<{
       id: string;
       name: string;
       prefix: string;
       permissions: Record<string, unknown>;
       last_used_at: Date | null;
       expires_at: Date | null;
       is_active: boolean;
       created_at: Date;
     }>(
      `SELECT id, name, prefix, permissions, last_used_at, expires_at, is_active, created_at 
       FROM api_keys 
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    
    if (!key) {
      return res.status(404).json({ error: 'API key not found' });
    }
    
    res.json({ key });
    
  } catch (error) {
    logger.error('[API Keys] Error getting key:', error);
    res.status(500).json({ error: 'Failed to get API key' });
  }
});

/**
 * Update an API key (name, permissions, active status)
 * PATCH /api-keys/:id
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user?.id;
    const { id } = req.params;
    
    // Validate input
    const validationResult = updateApiKeySchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid request body', 
        details: validationResult.error.issues 
      });
    }
    
    const { name, permissions, is_active } = validationResult.data;
    
    // Check if key exists and belongs to user
    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM api_keys WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    
    if (!existing) {
      return res.status(404).json({ error: 'API key not found' });
    }
    
    // Build update query
    const updates: string[] = [];
     const values: unknown[] = [];
    let paramCount = 1;
    
    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name.trim());
    }
    
    if (permissions !== undefined) {
      updates.push(`permissions = $${paramCount++}`);
      values.push(JSON.stringify(permissions));
    }
    
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(id, userId);
    
    await query(
      `UPDATE api_keys SET ${updates.join(', ')} WHERE id = $${paramCount++} AND user_id = $${paramCount}`,
      values
    );
    
    logger.info(`[API Keys] User ${userId} updated API key: ${id}`);
    
    res.json({ success: true, message: 'API key updated' });
    
  } catch (error) {
    logger.error('[API Keys] Error updating key:', error);
    res.status(500).json({ error: 'Failed to update API key' });
  }
});

/**
 * Revoke/Delete an API key
 * DELETE /api-keys/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user?.id;
    const { id } = req.params;
    
    // Check if key exists and belongs to user
    const existing = await queryOne<{ name: string }>(
      'SELECT name FROM api_keys WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    
    if (!existing) {
      return res.status(404).json({ error: 'API key not found' });
    }
    
    // Delete the key
    await query('DELETE FROM api_keys WHERE id = $1 AND user_id = $2', [id, userId]);
    
    logger.info(`[API Keys] User ${userId} deleted API key: ${existing.name}`);
    
    res.json({ success: true, message: 'API key deleted' });
    
  } catch (error) {
    logger.error('[API Keys] Error deleting key:', error);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});

/**
 * Regenerate an API key (creates new key, invalidates old one)
 * POST /api-keys/:id/regenerate
 */
router.post('/:id/regenerate', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user?.id;
    const { id } = req.params;
    
    // Check if key exists and belongs to user
     const existing = await queryOne<{ name: string; permissions: Record<string, unknown>; expires_at: Date | null }>(
      'SELECT name, permissions, expires_at FROM api_keys WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    
    if (!existing) {
      return res.status(404).json({ error: 'API key not found' });
    }
    
    // Generate new key
    const { key, hash, prefix } = generateApiKey();
    
    // Update the key in database
    await query(
      `UPDATE api_keys SET key_hash = $1, prefix = $2, last_used_at = NULL, updated_at = NOW()
       WHERE id = $3 AND user_id = $4`,
      [hash, prefix, id, userId]
    );
    
    logger.info(`[API Keys] User ${userId} regenerated API key: ${existing.name}`);
    
    // Return the new key (only shown once!)
    res.json({
      id,
      name: existing.name,
      key, // Full key - only shown once!
      prefix,
      expires_at: existing.expires_at,
      message: 'API key regenerated. The old key is no longer valid.'
    });
    
  } catch (error) {
    logger.error('[API Keys] Error regenerating key:', error);
    res.status(500).json({ error: 'Failed to regenerate API key' });
  }
});

export const apiKeysRouter = router;
