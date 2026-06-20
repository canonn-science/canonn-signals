import { test, expect, type Page } from '@playwright/test';
import { loadFixtureSystem } from './support/system-fixture';

/**
 * E2E coverage for the tidal-lock dialog (`app-tidal-lock-dialog`).
 *
 * The dialog opens from the purple spin/lock badge in a body's header. It explains the
 * tidal-lock indicator and — only for a body that keeps a fixed face to its light-source star
 * — draws the day/night-cycling geometry as a tilted globe with the cycling band.
 *
 * Two bodies in the Alpha Centauri fixture exercise both branches:
 *  - Alpha Centauri B 1 (id 5): orbits a star directly and is ~1:1 synchronous, so it
 *    keeps a fixed face → the cycling globe is shown.
 *  - Eden (id 10): orbits a star but spins ~1.05 d while orbiting ~31 d (the tidal-lock
 *    indicator is set but it is NOT 1:1), so it does not keep a fixed face → no cycling globe.
 */

const FIXTURE = { fixture: 'alpha-centauri.json', systemName: 'Alpha Centauri', id64: 1178708478315 };

/** Opens the tidal-lock dialog from a body's header badge and returns the dialog locator. */
async function openTidalLockDialog(page: Page, bodyId: number) {
  // Scope to the body's OWN header (direct child) so a nested child body's badge can't match.
  await page.locator(`#body-${bodyId} > .body-title .badge-purple`).click();
  const dialog = page.locator('app-tidal-lock-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Tidal Locking & Synchronous Rotation' })).toBeVisible();
  return dialog;
}

test.describe('Tidal-lock dialog', () => {
  test('shows the day/night-cycling globe for a fixed-face star-lock (Alpha Centauri B 1)', async ({ page }) => {
    await loadFixtureSystem(page, FIXTURE);

    const dialog = await openTidalLockDialog(page, 5);

    // The general tidal-lock explanation and the 1:1-vs-3:2 schematic are always present.
    await expect(dialog).toContainText('What does the tidal-lock indicator mean?');
    await expect(dialog.locator('.scenario-diagram')).not.toHaveCount(0);

    // The fixed-face cycling section: text + the pseudo-3D globe with its cycling band.
    await expect(dialog).toContainText('day/night-cycling region');
    await expect(dialog).toContainText('keeps a fixed face toward');
    const globe = dialog.locator('.cycling-diagram');
    await expect(globe).toBeVisible();
    await expect(globe.locator('circle.globe')).toBeVisible();
    // The cycling band is drawn as at least one closed leaf path.
    await expect(globe.locator('path.leaf')).not.toHaveCount(0);

    // The dialog closes again.
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('app-tidal-lock-dialog')).toHaveCount(0);
  });

  test('omits the cycling globe for a non-synchronous star-orbiter (Eden)', async ({ page }) => {
    await loadFixtureSystem(page, FIXTURE);

    const dialog = await openTidalLockDialog(page, 10);

    // The dialog still explains the indicator and shows the spin-resonance schematic…
    await expect(dialog).toContainText('What does the tidal-lock indicator mean?');
    await expect(dialog.locator('.scenario-diagram')).not.toHaveCount(0);

    // …but Eden does not keep a fixed face to the star, so there is no cycling geometry.
    await expect(dialog.locator('.cycling-diagram')).toHaveCount(0);
    await expect(dialog).not.toContainText('day/night-cycling region');

    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('app-tidal-lock-dialog')).toHaveCount(0);
  });
});
