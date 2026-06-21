import { test, expect } from '@playwright/test';
import { ensureBodyExpanded, loadFixtureSystem } from './support/system-fixture';

/**
 * Deterministic test for the Hertzsprung–Russell dialog reached from a star's "Age" row.
 * Uses the Alpha Centauri fixture (network stubbed, clock pinned) — body 2 is Alpha
 * Centauri A, a G2 V main-sequence star, so the dialog plots it on the main-sequence band
 * and shows the age bar.
 */
const FIXTURE = { fixture: 'alpha-centauri.json', systemName: 'Alpha Centauri', id64: 1178708478315 };

test.describe('H-R diagram dialog (Alpha Centauri fixture)', () => {
  test.beforeEach(async ({ page }) => {
    await loadFixtureSystem(page, FIXTURE);
  });

  test('opens from a main-sequence star and renders the diagram + age bar', async ({ page }) => {
    await ensureBodyExpanded(page, 2); // Alpha Centauri A (G2 V)
    const content = page.locator('#body-2 > .system-body-grow');
    const row = content.locator('.body-data-entry.clickable').filter({ has: page.getByText('Age', { exact: true }) });
    await row.first().scrollIntoViewIfNeeded();
    await row.first().click();

    const dialog = page.locator('app-hr-diagram-dialog');
    const svg = dialog.locator('svg.hr-diagram');
    await expect(svg).toBeVisible();
    // The diagram draws the main-sequence band, the three luminosity regions and the star.
    await expect(svg.locator('path.main-sequence')).toBeVisible();
    await expect(svg.locator('ellipse.hr-region')).toHaveCount(3);
    await expect(svg.locator('circle.star')).toBeVisible();
    // A main-sequence star gets an age bar.
    await expect(dialog.locator('.age-bar')).toBeVisible();

    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toHaveCount(0);
  });
});
