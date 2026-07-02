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

    // Units are listed largest-unit-first (declared order, not sorted at runtime). The
    // journal records body radius in metres, but the data source delivers it in km, so the
    // metres row is a back-conversion and is badged "Journal / unprecise" (not "from journal").
    await expect(dialog.locator('.conversion-table tbody th')).toHaveText([
      'Light Years', 'AU', 'Solar Radii', 'Light seconds', 'km', 'm Journal / unprecise',
    ]);

    // Clicking a value copies it and flips the cell to "Copied!" (clipboard is
    // Chromium-grantable; other engines just exercise the no-throw path).
    if (browserName === 'chromium') {
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    }
    const kmValue = dialog
      .locator('.conversion-table tbody tr')
      .filter({ has: page.getByRole('rowheader', { name: 'km', exact: true }) })
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
      'Solar Masses from journal', 'Earth Masses', 'Megatonnes',
    ]);
    await expect(dialog.locator('.comparisons')).toContainText('African bush elephants');
  });
});

/**
 * Angle (degrees ⇄ radians) and duration ("Next apoapsis/periapsis") conversions, loaded
 * from Alpha Centauri whose primary star (body 2) carries an axial tilt and both apsis
 * day-counts. The clock is pinned by the loader so the day-counts are deterministic.
 */
test.describe('Unit-conversion dialog — angle & duration (Alpha Centauri fixture)', () => {
  const AC = { fixture: 'alpha-centauri.json', systemName: 'Alpha Centauri', id64: 1178708478315 };

  test.beforeEach(async ({ page }) => {
    await loadFixtureSystem(page, AC);
  });

  test('an axial tilt (degrees) is convertible to radians, radians badged from journal', async ({ page }) => {
    await ensureBodyExpanded(page, 2);
    await bodyRowValue(page, 2, 'Axial tilt').locator('.convert-icon').click();

    const dialog = page.locator('app-unit-conversion-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Axial tilt');
    // The journal records axial tilt in radians (the app shows degrees), so the Radians
    // row carries the "from journal" badge and is listed first (radians > degrees).
    await expect(dialog.locator('.conversion-table tbody th')).toHaveText([
      'Radians from journal', 'Degrees',
    ]);
  });

  test('the "Next apoapsis" day-count is convertible to other durations', async ({ page }) => {
    await ensureBodyExpanded(page, 2);
    await bodyRowValue(page, 2, 'Next apoapsis').locator('.convert-icon').click();

    const dialog = page.locator('app-unit-conversion-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Next apoapsis');
    await expect(dialog.locator('.conversion-table tbody th')).toHaveText([
      'Centuries', 'Decades', 'Years', 'Weeks', 'Days', 'Hours', 'Minutes', 'Seconds',
    ]);
  });

  test('an orbital period badges the Seconds row "Journal / unprecise" (journal is seconds, data is days)', async ({ page }) => {
    await ensureBodyExpanded(page, 2);
    await bodyRowValue(page, 2, 'Orbital period').locator('.convert-icon').click();

    const dialog = page.locator('app-unit-conversion-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Orbital period');
    // The game journal records the period in seconds, but the data source delivers days, so
    // the Seconds row is a back-conversion and is badged "Journal / unprecise".
    await expect(dialog.locator('.conversion-table tbody th')).toHaveText([
      'Centuries', 'Decades', 'Years', 'Weeks', 'Days', 'Hours', 'Minutes', 'Seconds Journal / unprecise',
    ]);
  });

  test('a surface temperature is convertible to °C / °F / °R, K badged from journal', async ({ page }) => {
    await ensureBodyExpanded(page, 2);
    await bodyRowValue(page, 2, 'Surface Temperature').locator('.convert-icon').click();

    const dialog = page.locator('app-unit-conversion-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Surface temperature');
    await expect(dialog.locator('.conversion-table tbody th')).toHaveText([
      'K from journal', '°C', '°F', '°R',
    ]);
  });

  test('surface pressure is badged "from journal" on the atm row (data source delivers atmospheres)', async ({ page }) => {
    // Eden (body 10) has a surface pressure. The data source delivers it in atmospheres
    // (the journal's Pascals ÷ 101325), so the atm row — not Pa — is the authoritative source.
    await ensureBodyExpanded(page, 10);
    await bodyRowValue(page, 10, 'Surface pressure').locator('.convert-icon').click();

    const dialog = page.locator('app-unit-conversion-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Surface pressure');
    await expect(dialog.locator('.conversion-table tbody th')).toHaveText([
      'atm from journal', 'psi', 'kPa', 'Pa',
    ]);
  });
});
