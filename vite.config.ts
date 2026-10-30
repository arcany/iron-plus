import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';
import {ironPlusCloudflareBackendPlugin} from './server/cloudflareDeployPlugin';

export default defineConfig(() => {
  return {
    plugins: [
      ironPlusCloudflareBackendPlugin(),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'apple-touch-icon.png', 'IronPulse-iOS.mobileconfig'],
        manifest: {
          id: '/',
          name: 'IronPulse — نظام إدارة الجيم المتكامل',
          short_name: 'IronPulse',
          description: 'نظام احترافي شامل لإدارة الصالات الرياضية، الأعضاء، الاشتراكات، بوابة الباركود، والمدفوعات.',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          display_override: ['fullscreen', 'standalone', 'minimal-ui'],
          orientation: 'portrait',
          dir: 'rtl',
          lang: 'ar',
          start_url: '/?app=native',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          globIgnores: [
            '**/IronPulse-Gym-App.html',
            '**/assets/aistudio/**',
            '**/*.tar.gz',
            '**/*.zip',
            '**/iron-plus.git/**',
            '**/repo-files-bundle.json',
            '**/cloudflare-live-edge.json',
          ],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      allowedHosts: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/github-oauth': {
          target: 'https://github.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/github-oauth/, ''),
        },
        '/cloudflare-api': {
          target: 'https://api.cloudflare.com/client/v4',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/cloudflare-api/, ''),
        },
      },
    },
  };
});
