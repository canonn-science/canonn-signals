import { test, expect } from '@playwright/test';
import { loadFixtureSystem, expectSystemRow } from './support/system-fixture';

/**
 * Deterministic tests for the system info panel's society/governance rows and the
 * all-systems metadata rows (permit, info updated). Sol is a populated, permit-locked
 * fixture, so it exercises every populated-only row plus "Permit required: Yes".
 *
 * Station counts are intentionally not shown: the biostats API only returns surface
 * stations, so an orbital/surface split would be misleading (see the project plan).
 */

test.describe('System info — Society & metadata (Sol)', () => {
  test.beforeEach(async ({ page }) => {
    await loadFixtureSystem(page, { fixture: 'sol.json', systemName: 'Sol', id64: 10477373803 });
  });

  test('shows the Society section for a populated system', async ({ page }) => {
    await expect(
      page.locator('.system-data-section-header').filter({ hasText: 'Society' }),
    ).toBeVisible();

    await expectSystemRow(page, 'Economy', 'Refinery / Service');
    await expectSystemRow(page, 'Government', 'Democracy');
    await expectSystemRow(page, 'Allegiance', 'Federation');
    await expectSystemRow(page, 'Controlling faction', 'Mother Gaia');
    await expectSystemRow(page, 'Security', 'High');
  });

  test('flags Sol as permit-locked and shows when its data was updated', async ({ page }) => {
    await expectSystemRow(page, 'Permit required', 'Yes');
    // Shown in the viewer's local zone; the suite pins timezoneId to UTC, so this is the UTC wall-clock.
    await expectSystemRow(page, 'Info updated', '2026-06-19 16:46');
  });
});
