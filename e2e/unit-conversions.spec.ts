import { test, expect } from '@playwright/test';
import { bodyRowValue, ensureBodyExpanded, loadFixtureSystem } from './support/system-fixture';

/**
 * Deterministic tests for the click-to-convert dialog: a small "⇄" icon after a value
 * opens a popup listing it in every scale unit (largest-first), each copyable. Loaded
 * from the Merope fixture so the values are stable and offline.
 */

const FIXTURE = { fixture: 'merope.json', systemName: 'Merope', id64: 224644818084 };

test.describe('Unit-conversion dialog (fixture)', () => {
  test.beforeEach(async ({ page }) => {
    await loadFixtureSystem(page, FIXTURE);
  });

  test('a length value opens a conversion dialog listing every scale unit, largest-first', async ({ page, browserName }) => {
    await ensureBodyExpanded(page, 15);
    await bodyRowValue(page, 15, 'Radius').locator('.convert-icon').click();

    const dialog = page.locator('app-unit-conversion-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Radius');

    // Units are listed largest-unit-first (declared order, not sorted at runtime).
    await expect(dialog.locator('.conversion-table tbody th')).toHaveText([
      'Light Years', 'AU', 'Solar Radii', 'Light seconds', 'km', 'm',
    ]);

    // Clicking a value copies it and flips the cell to "Copied!" (clipboard is
    // Chromium-grantable; other engines just exercise the no-throw path).
    if (browserName === 'chromium') {
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    }
    const kmValue = dialog
      .locator('.conversion-table tbody tr', { has: page.getByText('km', { exact: true }) })
      .locator('td.value');
    await kmValue.click();
    if (browserName === 'chromium') {
      await expect(kmValue).toHaveText('Copied!');
    }

    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('a mass value lists mass units plus the silly comparisons', async ({ page }) => {
    await ensureBodyExpanded(page, 0);
    await bodyRowValue(page, 0, 'Mass').locator('.convert-icon').click();

    const dialog = page.locator('app-unit-conversion-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.conversion-table tbody th')).toHaveText([
      'Solar Masses', 'Earth Masses', 'Megatonnes',
    ]);
    await expect(dialog.locator('.comparisons')).toContainText('African bush elephants');
  });
});
