import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Request ID middleware - assigns a unique ID to each request for tracing.
 * Uses existing X-Request-ID header if provided (for distributed tracing),
 * otherwise generates a new UUID.
 */
export function requestIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  req.headers['x-request-id'] = req.headers['x-request-id'] || crypto.randomUUID();
  next();
}
