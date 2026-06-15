import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

function commandOutput(command: string): string {
  try {
    return execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

const buildCommit = commandOutput('git rev-parse --short HEAD');
const buildTimestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __APP_COMMIT__: JSON.stringify(buildCommit),
    __APP_BUILT_AT__: JSON.stringify(buildTimestamp),
  },
  plugins: [
    svelte(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false, // using public/manifest.json
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
  },
});
