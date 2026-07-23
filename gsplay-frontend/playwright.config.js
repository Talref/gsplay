import { defineConfig } from '@playwright/test';

const viewports = [[360, 800], [390, 844], [768, 1024], [900, 900], [1280, 900], [1440, 1000]];
export default defineConfig({
  testDir: './e2e', timeout: 30_000, fullyParallel: false, workers: 1, retries: 0,
  use: { baseURL: 'http://127.0.0.1:5174', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: viewports.map(([width, height]) => ({ name: `${width}x${height}`, use: { viewport: { width, height } } })),
  webServer: [
    { command: 'node ../scripts/e2e-v2-server.js', url: 'http://127.0.0.1:3100/health/live', reuseExistingServer: false, timeout: 60_000 },
    { command: 'VITE_API_PROXY_TARGET=http://127.0.0.1:3100 npm run dev -- --host 127.0.0.1 --port 5174', url: 'http://127.0.0.1:5174', reuseExistingServer: false, timeout: 60_000 }
  ]
});