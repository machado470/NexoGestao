if (!process.env.DATABASE_URL && process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/nexogestao?schema=public';
}

if (!process.env.REDIS_URL && process.env.TEST_REDIS_URL) {
  process.env.REDIS_URL = process.env.TEST_REDIS_URL;
}

if (!process.env.REDIS_URL) {
  process.env.REDIS_URL = 'redis://localhost:6379';
}

const redisUrl = new URL(process.env.REDIS_URL);
process.env.REDIS_HOST = process.env.REDIS_HOST || redisUrl.hostname;
process.env.REDIS_PORT = process.env.REDIS_PORT || redisUrl.port || '6379';

process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'test-google-client-secret';
process.env.GOOGLE_REDIRECT_URL = process.env.GOOGLE_REDIRECT_URL || 'http://localhost:3000/auth/google/callback';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 're_test_key';
