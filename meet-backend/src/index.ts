import dotenv from 'dotenv';
dotenv.config(); // MUST be before other imports that read process.env

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authRouter } from './routes/auth.js';
import { tokenRouter } from './routes/token.js';
import { roomsRouter } from './routes/rooms.js';
import { meetingsRouter } from './routes/meetings.js';
import { egressRouter } from './routes/egress.js';
import { webhookRouter, clearAllHostLeaveTimeouts } from './routes/webhook.js';
import { prashasakahRouter } from './routes/prashasakah/index.js';
import { apiKeysRouter } from './routes/apiKeys.js';
import externalRouter from './routes/external.js';
import { initDatabase, closeDatabase, query } from './services/database.js';
import { initRedis, closeRedis } from './services/redis.js';
import { config } from './config.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import logger from './utils/logger.js';

const app = express();
const PORT = config.port;

// Trust proxy (required for rate limiting behind Caddy)
app.set('trust proxy', 1);

// ============================================
// Request ID Middleware (for tracing)
// ============================================
app.use(requestIdMiddleware);

// ============================================
// Security Middleware
// ============================================
app.use(helmet({
  contentSecurityPolicy: config.nodeEnv === 'production',
  crossOriginEmbedderPolicy: false,
  frameguard: { action: 'deny' }, // X-Frame-Options: DENY
  hsts: config.nodeEnv === 'production' ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  } : false,
}));

// Additional security headers
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
  next();
});

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl)
    if (!origin) return callback(null, true);
    
    if (config.cors.origins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ============================================
// Body Parsing
// ============================================

// Raw body parser for webhook route (MUST come before express.json())
app.use('/webhook/livekit',
  express.raw({ type: '*/*', limit: '1mb' }),
  webhookRouter
);

// JSON parsing for all other routes
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ============================================
// Rate Limiting
// ============================================
app.use('/auth', apiLimiter);
app.use('/token', apiLimiter);
app.use('/rooms', apiLimiter);
app.use('/meetings', apiLimiter);
app.use('/egress', apiLimiter);
app.use('/prashasakah', apiLimiter);
app.use('/api-keys', apiLimiter);
app.use('/external', apiLimiter);

// ============================================
// Routes
// ============================================
app.use('/auth', authRouter);
app.use('/token', tokenRouter);
app.use('/rooms', roomsRouter);
app.use('/meetings', meetingsRouter);
app.use('/egress', egressRouter);
app.use('/webhook/livekit', express.raw({ type: '*/*', limit: '1mb' }), webhookRouter);
app.use('/prashasakah', prashasakahRouter);
app.use('/api-keys', apiKeysRouter);
app.use('/external', externalRouter);

// ============================================
// Health Check
// ============================================
app.get('/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    
    res.json({
      status: 'ok',
      time: new Date().toISOString(),
      env: config.nodeEnv,
      version: JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../package.json'), 'utf-8')).version,
    });
  } catch {
    res.status(503).json({
      status: 'error',
      message: 'Service unavailable',
      time: new Date().toISOString(),
    });
  }
});

// Simple ping endpoint
app.get('/ping', (_req, res) => {
  res.send('pong');
});

// ============================================
// Error Handling
// ============================================

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS policy violation' });
  }
  
  res.status(500).json({
    error: config.nodeEnv === 'production' ? 'Internal server error' : err.message,
  });
});

// ============================================
// Start Server
// ============================================
let server: ReturnType<typeof app.listen> | null = null;

async function start() {
  try {
    logger.info('🚀 Starting Meet Backend...');
    logger.info(`   Environment: ${config.nodeEnv}`);
    logger.info(`   Port: ${PORT}`);

    // Initialize database connection
    await initDatabase();

    // Initialize Redis connection
    await initRedis();

    // Start HTTP server
    server = app.listen(PORT, () => {
      logger.info(`✅ Server running on port ${PORT}`);
      logger.info(`   Health: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// ============================================
// Graceful Shutdown
// ============================================
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully...`);

  // Force-exit after 10 seconds if cleanup hangs
  const forceExitTimer = setTimeout(() => {
    logger.error('Forcing exit after 10s timeout');
    process.exit(1);
  }, 10_000);

  try {
    // Stop accepting new connections
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }

    // Clear webhook timeouts to prevent memory leaks during shutdown
    clearAllHostLeaveTimeouts();

    // Close services
    await closeRedis();
    await closeDatabase();

    logger.info('Cleanup complete');
    clearTimeout(forceExitTimer);
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    clearTimeout(forceExitTimer);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

start();
