// backend/src/index.ts — API entry point.
import { createApp } from './app.js';
import { config } from './config.js';

if (config.jwtSecret === 'dev-insecure-secret') {
  console.warn('[config] JWT_SECRET unset — using the dev default. Set it in production.');
}

createApp().listen(config.port, () => {
  console.log(`leakdetector api on :${config.port}`);
});
