import { expect, test } from '@playwright/test';

test.describe('Custom agent profiles', () => {
	test('create a custom profile in settings and select it in chat', async ({ page }) => {
		const profileLabel = 'E2E Audit Bot';
		const profileId = 'e2e-audit-bot';

		// no llama-server backend in the static build: stand in a minimal MODEL-mode props payload
		await page.route(/\/props(\?|$)/, async (route) => {
			await route.fulfill({
				body: JSON.stringify({
					default_generation_settings: { n_ctx: 4096, params: {} },
					modalities: { audio: false, vision: false },
					role: 'model',
					ui_settings: {}
				}),
				contentType: 'application/json',
				status: 200
			});
		});

		await page.goto('/');

		// open Settings from the sidebar
		await page.getByRole('button', { name: 'Settings' }).click();

		// switch to the Agentic section
		await page.getByRole('button', { name: 'Agentic' }).click();

		// fill the new-profile form
		await page.locator('#custom-profile-id').fill(profileId);
		await page.locator('#custom-profile-label').fill(profileLabel);
		await page.locator('#custom-profile-prompt').fill('# MODO E2E\nEres un agente de prueba.');

		// save the profile
		await page.getByRole('button', { name: 'Guardar perfil' }).click();
		await expect(page.getByText(profileLabel).first()).toBeVisible();

		// close the settings dialog
		await page.keyboard.press('Escape');

		// open the mode picker in the chat form and select the new profile
		await page.getByRole('button', { name: 'Modo' }).click();
		await page.getByRole('menuitem', { name: profileLabel }).click();

		// the picker now shows the selected profile
		await expect(page.getByRole('button', { name: profileLabel }).first()).toBeVisible();
	});
});
