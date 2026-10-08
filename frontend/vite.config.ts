import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.');
  return {
  plugins: [
    {
      name: 'html-public-url',
      // %VITE_PUBLIC_URL% in index.html: absolute base for og:/twitter:
      // preview URLs (WhatsApp requires absolute og:image). Empty in dev
      // -> relative paths; set VITE_PUBLIC_URL=https://<domain> at deploy.
      transformIndexHtml(html: string) {
        return html.replace(/%VITE_PUBLIC_URL%/g, env.VITE_PUBLIC_URL ?? '');
      },
    },
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'LeakDetector',
        short_name: 'LeakDetector',
        description: 'Report a water leak to your council',
        theme_color: '#0e7490',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
  server: { host: '0.0.0.0', port: 5173 },
  test: { environment: 'node', include: ['src/**/*.test.ts?(x)'] },
  };
});
