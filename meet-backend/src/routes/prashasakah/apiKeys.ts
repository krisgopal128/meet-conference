/**
 * Prashasakah API Keys Routes
 *
 * Admin API key management: list, update, delete.
 */

import { Router, Response } from 'express';
import { requireAdmin } from '../../middleware/requireRole.js';
import type { AuthRequest } from '../../middleware/authenticate.js';
import { query, queryOne } from '../../services/database.js';
import logger from '../../utils/logger.js';
import { adminActionLimiter } from './rateLimiter.js';

interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  permissions: string[];
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_role: string;
}

const router = Router();

router.get('/api-keys/admin', requireAdmin(), async (req: AuthRequest, res: Response) => {
  try {
    const search = req.query.search as string | undefined;
    const isActive = req.query.is_active as string | undefined;
    // role filter will be used when implementing role-based API key filtering
    void req.query.role;

    let whereClause = 'WHERE 1=1';
     const params: unknown[] = [];
    let paramIndex = 1;

    if (search) {
      whereClause += ` AND ak.name ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (isActive !== undefined) {
      whereClause += ` AND ak.is_active = $${paramIndex}`;
      params.push(isActive === 'true');
      paramIndex++;
    }

    const apiKeys = await query<ApiKeyRow>(`
      SELECT ak.id, ak.name, ak.prefix, ak.permissions, ak.last_used_at, ak.expires_at,
        ak.is_active, ak.created_at, ak.updated_at, ak.user_id,
        u.name as user_name, u.email as user_email, u.role as user_role
      FROM api_keys ak
      LEFT JOIN users u ON u.id = ak.user_id
      ${whereClause}
      ORDER BY ak.created_at DESC
    `, params);

     res.json({
       keys: apiKeys.map((ak) => ({
         id: ak.id,
         name: ak.name,
         prefix: ak.prefix,
         permissions: ak.permissions,
         lastUsedAt: ak.last_used_at,
         expiresAt: ak.expires_at,
         isActive: ak.is_active,
         createdAt: ak.created_at,
         updatedAt: ak.updated_at,
         user: {
           id: ak.user_id,
           name: ak.user_name,
           email: ak.user_email,
           role: ak.user_role,
         },
       })),
      total: apiKeys.length,
    });
  } catch (error) {
    logger.error('[Admin API Keys] Error fetching keys:', error);
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

router.patch('/api-keys/admin/:id', adminActionLimiter, requireAdmin(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { is_active: isActive, reason } = req.body;

    const existing = await queryOne<{ id: string }>('SELECT id FROM api_keys WHERE id = $1', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'API key not found' });
    }

    const updateFields: string[] = [];
    const params: (string | boolean)[] = [];
    let paramIndex = 1;

    if (typeof isActive === 'boolean') {
      updateFields.push(`is_active = $${paramIndex}`);
      params.push(isActive);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id);

    await query(`UPDATE api_keys SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`, params);
    
    logger.info(`[Admin API Keys] Admin ${req.user?.id} updated key ${id}: is_active=${isActive}${reason ? `, reason: ${reason}` : ''}`);

    res.json({ 
      success: true, 
      message: 'API key updated',
      key: { id, isActive: isActive ?? true }
    });
  } catch (error) {
    logger.error('[Admin API Keys] Error updating key:', error);
    res.status(500).json({ error: 'Failed to update API key' });
  }
});

router.delete('/api-keys/admin/:id', adminActionLimiter, requireAdmin(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;

    const existing = await queryOne<{ id: string; user_id: string }>('SELECT id, user_id FROM api_keys WHERE id = $1', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'API key not found' });
    }

    await query('DELETE FROM api_keys WHERE id = $1', [id]);
    
    logger.info(`[Admin API Keys] Admin ${adminId} deleted API key ${id} (owner: ${existing.user_id})`);
    
    res.json({ success: true, message: 'API key deleted' });
    
  } catch (error) {
    logger.error('[Admin API Keys] Error deleting key:', error);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});

export default router;
