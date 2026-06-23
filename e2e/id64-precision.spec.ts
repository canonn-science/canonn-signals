import { test, expect } from '@playwright/test';
import { loadFixtureSystem } from './support/system-fixture';

/**
 * Regression test for the 64-bit id64 precision bug: a body's id64 is a ~60-bit
 * integer that cannot be represented exactly as a JavaScript number (float64).
 * The biostats response must be parsed BigInt-aware so the "Body JSON Data" dialog
 * shows the exact value, not the float64-rounded one.
 *
 * Fixture body `Phraa Eaec ER-I c11-1 11` has id64 1080864266413281122, which a
 * plain JSON.parse rounds to 1080864266413281200.
 */
const FIXTURE = {
  fixture: 'id64-precision.json',
  systemName: 'Phraa Eaec ER-I c11-1',
  id64: 355844362082,
};

test.describe('id64 64-bit precision', () => {
  test('Body JSON Data shows the full-precision id64 (no float64 rounding)', async ({ page }) => {
    await loadFixtureSystem(page, FIXTURE);

    // The JSON button sits in the body header (always visible, no expand needed).
    await page.locator('#body-30')
      .getByLabel('View body JSON (right-click to copy)')
      .first()
      .click();

    const json = page.locator('.json-dialog pre');
    await expect(json).toBeVisible();

    // Web-first assertions auto-retry until the dialog's signal-rendered text settles.
    // The exact 60-bit id64 must be preserved…
    await expect(json).toContainText('1080864266413281122');
    // …and must NOT be the float64-rounded value the bug produced.
    await expect(json).not.toContainText('1080864266413281200');
  });
});
