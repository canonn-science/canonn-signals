import { test, expect, type Page } from '@playwright/test';

/**
 * End-to-end coverage for the export enhancements: the per-body JSON now carries a `calculated`
 * block, and the system header offers a full-system JSON download (Spansh shape + enriched bodies).
 * Runs against the built-in `test` fixture (`assets/test-system.json`) so the data is deterministic.
 *
 *   #body-1 → Test Neutron Star (13.48 M☉ → super-massive, Schwarzschild radius + danger alert)
 *   #body-2 → Venus (High metal content world, orbits the primary → orbit extents + temperature)
 */

async function loadTestSystem(page: Page) {
  await page.goto('/');
  await page.getByRole('combobox').fill('test');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByText('Test System', { exact: true })).toBeVisible({ timeout: 30_000 });
}

test.describe('Export with calculated values', () => {
  test.beforeEach(async ({ page }) => {
    await loadTestSystem(page);
  });

  test('downloads the whole system as enriched Spansh JSON', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export system JSON with calculated values' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('Test-System.json');

    const path = await download.path();
    const fs = await import('node:fs/promises');
    const parsed = JSON.parse(await fs.readFile(path, 'utf8'));

    // Spansh shape is preserved, with generation metadata alongside it.
    expect(parsed.system.name).toBe('Test System');
    expect(parsed._generated.generator).toBe('canonn-signals');
    expect(Array.isArray(parsed.system.bodies)).toBe(true);

    // Every body carries a calculated block.
    for (const body of parsed.system.bodies) {
      expect(body.calculated).toBeTruthy();
      expect(typeof body.calculated.computedAt).toBe('string');
    }

    // The super-massive neutron star reports its collapse geometry and a stability danger.
    const neutronStar = parsed.system.bodies.find((b: { bodyId: number }) => b.bodyId === 1);
    expect(neutronStar.calculated.schwarzschildRadiusKm).toBeGreaterThan(0);
    expect(neutronStar.calculated.massStability.severity).toBe('danger');

    // A planet in orbit reports its orbit extents (apoapsis ≥ periapsis) and a temperature range.
    const planet = parsed.system.bodies.find((b: { bodyId: number }) => b.bodyId === 2);
    expect(planet.calculated.orbit.apoapsisKm).toBeGreaterThanOrEqual(planet.calculated.orbit.periapsisKm);
    expect(planet.calculated.temperature).not.toBeNull();
  });

  test('shows the calculated block in a body JSON dialog', async ({ page }) => {
    await page.locator('#body-2').getByRole('button', { name: 'View body JSON (right-click to copy)' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Body JSON Data')).toBeVisible();
    const json = await dialog.locator('pre').innerText();
    const parsed = JSON.parse(json);
    // Raw Spansh fields remain, plus the new calculated block.
    expect(parsed.subType).toBe('High metal content world');
    expect(parsed.calculated).toBeTruthy();
    expect(parsed.calculated.orbit).not.toBeNull();
  });
});
