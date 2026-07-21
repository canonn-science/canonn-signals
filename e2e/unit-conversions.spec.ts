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
      'Centuries', 'Decades', 'Years', 'Weeks', 'Days', 'Hours', 'Minutes', 'Seconds', 'Milliseconds',
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
      'Centuries', 'Decades', 'Years', 'Weeks', 'Days', 'Hours', 'Minutes', 'Seconds Journal / unprecise', 'Milliseconds',
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

  test('surface pressure badges the Pa row "Journal / unprecise" (journal is Pa, data is atm)', async ({ page }) => {
    // Eden (body 10) has a surface pressure. The game journal records it in Pascals, but the
    // data source delivers atmospheres (journal Pa ÷ 101325), so the Pa row is a back-conversion
    // and is badged "Journal / unprecise" — the same treatment as radius (journal m, data km).
    await ensureBodyExpanded(page, 10);
    await bodyRowValue(page, 10, 'Surface pressure').locator('.convert-icon').click();

    const dialog = page.locator('app-unit-conversion-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Surface pressure');
    await expect(dialog.locator('.conversion-table tbody th')).toHaveText([
      'atm', 'psi', 'kPa', 'Pa Journal / unprecise',
    ]);
  });
});

/**
 * Millisecond pulsar: the body panel shows the rotational period in milliseconds, and the
 * conversion dialog must offer a matching Milliseconds row (with the tiny larger units shown
 * in scientific notation). Beta Sculptoris B is the nearest real neutron star to Sol with a
 * sub-2 ms spin (rotationalPeriod 2.2917e-8 days ≈ 1.98 ms), found via the Spansh API.
 */
test.describe('Unit-conversion dialog — millisecond pulsar (Beta Sculptoris fixture)', () => {
  const BS = { fixture: 'beta-sculptoris.json', systemName: 'Beta Sculptoris', id64: 1774711389 };
  const NEUTRON_STAR = 3; // Beta Sculptoris B

  test.beforeEach(async ({ page }) => {
    await loadFixtureSystem(page, BS);
  });

  test('the rotational period reads in milliseconds inline and is convertible to a Milliseconds row', async ({ page }) => {
    await ensureBodyExpanded(page, NEUTRON_STAR);

    // The body panel shows the spin period in ms, not a rounded-to-zero fraction of a second.
    const rotational = bodyRowValue(page, NEUTRON_STAR, 'Rotational period');
    await expect(rotational).toContainText('1.98 ms');

    await rotational.locator('.convert-icon').click();
    const dialog = page.locator('app-unit-conversion-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Rotational period');

    // The duration table now ends in a Milliseconds row (the app holds the period in days,
    // and the journal records seconds, so the Seconds row is a badged back-conversion).
    await expect(dialog.locator('.conversion-table tbody th')).toHaveText([
      'Centuries', 'Decades', 'Years', 'Weeks', 'Days', 'Hours', 'Minutes',
      'Seconds Journal / unprecise', 'Milliseconds',
    ]);

    // The inline unit (ms) is the accented row, and reads as a plain human-scale value.
    const msRow = dialog
      .locator('.conversion-table tbody tr.ui-unit')
      .filter({ has: page.getByRole('rowheader', { name: 'Milliseconds', exact: true }) });
    await expect(msRow).toHaveCount(1);
    await expect(msRow.locator('td.value')).toHaveText('1.98');

    // A sub-picosecond fraction of a century is unreadable as a decimal, so it falls back to
    // scientific notation (the same threshold used for very large millisecond counts).
    const centuriesValue = dialog
      .locator('.conversion-table tbody tr')
      .filter({ has: page.getByRole('rowheader', { name: 'Centuries', exact: true }) })
      .locator('td.value');
    await expect(centuriesValue).toHaveText(/\de-\d+/);
  });
});
