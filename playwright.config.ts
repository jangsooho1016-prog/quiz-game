import { defineConfig, devices } from '@playwright/test'

const PORT = 4174

// 실제 브라우저 점검 (npm run test:e2e). 빌드한 결과물을 vite preview로 띄워 배포본과 같은 조건에서 확인한다.
// 브라우저는 내려받지 않고 설치된 Chrome을 쓴다. 없으면 `npx playwright install chromium` 후 PW_CHANNEL=chromium.
export default defineConfig({
  testDir: './e2e',
  testMatch: '*.e2e.ts', // Vitest(*.test.ts)와 섞이지 않게 이름을 구분한다
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: process.env.PW_CHANNEL ?? 'chrome',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 780 }, hasTouch: true } },
  ],
  webServer: {
    command: `npx vite build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
