import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

// Shared config to normalize IPv6-mapped IPv4 addresses (fixes ERR_ERL_KEY_GEN_IPV6)
const sharedConfig = {
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const ip = req.ip || 'unknown';
    return ip.replace(/^::ffff:/, '');
  },
};

export const adminActionLimiter = rateLimit({
  ...sharedConfig,
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 sensitive actions per hour per IP
  message: { error: 'Too many admin actions. Please try again later.' },
  skipSuccessfulRequests: false,
});
