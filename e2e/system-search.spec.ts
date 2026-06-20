import { test, expect } from '@playwright/test';

/**
 * These tests exercise the app end-to-end against the built-in `test` system,
 * which the app loads from a local fixture (`assets/test-system.json`) without
 * hitting any external API. This keeps the suite deterministic and offline.
 */
test.describe('System signals search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders the search landing page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'System Signals' })).toBeVisible();
    await expect(
      page.getByText('Search to review system signals recorded by Canonn field researchers.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();
  });

  test('loads the built-in test system and shows its bodies', async ({ page }) => {
    const searchBox = page.getByRole('combobox');
    await searchBox.fill('test');
    await page.getByRole('button', { name: 'Search' }).click();

    // The system title renders the loaded system name once data arrives.
    await expect(page.getByText('Test System', { exact: true })).toBeVisible({ timeout: 30_000 });

    // The top-level main star from the fixture should be rendered.
    await expect(page.getByText('Test System Primary').first()).toBeVisible();
  });

  test('loads the test system via the Enter key', async ({ page }) => {
    const searchBox = page.getByRole('combobox');
    await searchBox.fill('test');
    await searchBox.press('Enter');

    await expect(page.getByText('Test System', { exact: true })).toBeVisible({ timeout: 30_000 });
  });
});
