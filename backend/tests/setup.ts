// backend/tests/setup.ts — runs in each test worker BEFORE app imports.
// Point the app at the test database built by globalSetup.
process.env.DATABASE_URL =
  (process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5433/leakdetector')
    .replace(/\/[^/?]+(\?|$)/, '/leakdetector_test$1');
process.env.JWT_SECRET = 'test-secret';
process.env.PUBLIC_BASE_URL = 'http://127.0.0.1:5173';
process.env.UPLOAD_DIR = '/tmp/leakdetector-test-uploads';
process.env.DISABLE_RATE_LIMIT = '1';
