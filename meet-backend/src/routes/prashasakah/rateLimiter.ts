import rateLimit from 'express-rate-limit';

export const adminActionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 sensitive actions per hour per IP
  message: { error: 'Too many admin actions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});
