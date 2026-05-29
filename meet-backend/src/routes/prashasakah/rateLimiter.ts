import rateLimit from 'express-rate-limit';

// express-rate-limit v8+ throws ERR_ERL_KEY_GEN_IPV6 with custom keyGenerator
// behind a proxy. Since Caddy handles IPv4/IPv6 normalization, we disable
// IP validation entirely.
const sharedConfig = {
  standardHeaders: true,
  legacyHeaders: false,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validate: false as any,
};

export const adminActionLimiter = rateLimit({
  ...sharedConfig,
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 sensitive actions per hour per IP
  message: { error: 'Too many admin actions. Please try again later.' },
  skipSuccessfulRequests: false,
});
