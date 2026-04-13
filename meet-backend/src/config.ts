import dotenv from 'dotenv';
dotenv.config();

function getSSLConfig(): false | { rejectUnauthorized: boolean; ca?: string } {
  const dbUrl = process.env.DATABASE_URL || '';
  let hostname = '';
  try {
    hostname = new URL(dbUrl).hostname;
  } catch {
    // Invalid URL, will fail at connection time
  }
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

  if (isLocalhost) {
    return false;
  }

  if (process.env.NODE_ENV === 'production') {
    const caPath = process.env.DATABASE_CA_PATH;
    if (caPath) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fs = require('fs');
        if (fs.existsSync(caPath)) {
          return {
            ca: fs.readFileSync(caPath).toString(),
            rejectUnauthorized: true,
          };
        }
      } catch {
        // Fall through to default
      }
    }
    return {
      rejectUnauthorized: process.env.DATABASE_REJECT_UNAUTHORIZED !== 'false',
    };
  }

  if (process.env.DATABASE_SSL === 'true') {
    console.warn('⚠️  DATABASE_SSL=true: Using self-signed certificate (development only)');
    return { rejectUnauthorized: false };
  }

  return false;
}

export const config = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),

  // LiveKit
  livekit: {
    url: process.env.LIVEKIT_URL || 'ws://localhost:7880',
    apiKey: process.env.LIVEKIT_API_KEY || '',
    apiSecret: process.env.LIVEKIT_API_SECRET || '',
  },

  // Database
  database: {
    url: process.env.DATABASE_URL || '',
    ssl: getSSLConfig(),
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  // Auth - JWT_SECRET is required in all environments
  jwt: {
    secret: process.env.JWT_SECRET || '',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // CORS
  cors: {
    origins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  },

  // S3 (optional for recordings)
  s3: {
    bucket: process.env.S3_BUCKET,
    region: process.env.S3_REGION || 'ap-southeast-1',
    accessKey: process.env.S3_ACCESS_KEY,
    secretKey: process.env.S3_SECRET_KEY,
  },
};

// Validation - never log actual secret values
if (!config.livekit.apiKey || !config.livekit.apiSecret) {
  console.warn('⚠️  LiveKit credentials not configured');
}

// Critical validation - JWT_SECRET is required in all environments
if (!process.env.JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}

// Critical validation for production
if (config.nodeEnv === 'production') {
  if (!process.env.DATABASE_URL) {
    console.error('❌ FATAL: DATABASE_URL must be set');
    process.exit(1);
  }
}
