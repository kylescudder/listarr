import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'artifacts/full-e2e/results.json' }]
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:33211',
    screenshot: 'on',
    trace: 'retain-on-failure'
  },
  projects: [
    {
      name: 'desktop',
      use: {
        viewport: { width: 1440, height: 1000 },
        video: {
          mode: process.env.E2E_EVIDENCE ? 'on' : 'retain-on-failure',
          size: { width: 1440, height: 1000 }
        }
      }
    },
    {
      name: 'mobile',
      testIgnore: '**/lists.spec.ts',
      use: {
        viewport: { width: 390, height: 844 },
        video: {
          mode: process.env.E2E_EVIDENCE ? 'on' : 'retain-on-failure',
          size: { width: 390, height: 844 }
        }
      }
    }
  ],
  webServer: {
    command: 'bun e2e/serve.ts',
    url: `${process.env.E2E_BASE_URL || 'http://127.0.0.1:33211'}/api/health`,
    reuseExistingServer: false
  }
})
