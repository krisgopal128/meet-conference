import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Request ID middleware - assigns a unique ID to each request for tracing.
 * Uses existing X-Request-ID header if provided (for distributed tracing),
 * otherwise generates a new UUID.
 */
const REQUEST_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;

export function requestIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const provided = req.headers['x-request-id'];
  if (typeof provided === 'string' && REQUEST_ID_RE.test(provided)) {
    req.headers['x-request-id'] = provided;
  } else {
    req.headers['x-request-id'] = crypto.randomUUID();
  }
  next();
}
