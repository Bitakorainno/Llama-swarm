import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	expect: {
		timeout: 5000
	},
	forbidOnly: !!process.env.CI,
	fullyParallel: true,
	projects: [
		{
			name: 'chromium',
			// system Chrome via PLAYWRIGHT_CHROMIUM_CHANNEL=chrome when the bundled browser is unavailable
			use: { ...devices['Desktop Chrome'], channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL }
		}
	],
	reporter: 'line',
	retries: process.env.CI ? 2 : 0,
	testDir: 'tests/e2e',
	testMatch: ['**/*.e2e.ts'],
	timeout: 30000,
	use: {
		baseURL: 'http://localhost:8181',
		trace: 'on-first-retry'
	},
	webServer: {
		command: 'npm run build && npx http-server ./dist -p 8181',
		port: 8181,
		reuseExistingServer: !process.env.CI,
		// the build alone takes minutes on slower machines; 120s was not enough
		timeout: 900000
	},
	workers: process.env.CI ? 1 : undefined
});
