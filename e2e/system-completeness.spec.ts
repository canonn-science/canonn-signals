import { test, expect, type Locator } from '@playwright/test';
import { loadFixtureSystem } from './support/system-fixture';

/** Parses a `rgb(r, g, b)` computed colour into its channels. */
async function fillRgb(fill: Locator): Promise<{ r: number; g: number; b: number }> {
  const colour = await fill.evaluate((el) => getComputedStyle(el).backgroundColor);
  const [r, g, b] = colour.match(/\d+/g)!.map(Number);
  return { r, g, b };
}

/**
 * Deterministic tests for the "System Completeness" bar shown above the bodies list.
 *
 * The percentage is the known body count (the real bodies the JSON's `bodies` array
 * lists — stars/planets/moons, excluding belts/rings/barycentres) over the system's
 * `bodyCount`, capped at 100%. When the JSON has no `bodyCount`, the bar reads
 * "Unknown" / "?%". Each system below is a saved fixture:
 *   - Sol                  → 40 known / 40 reported  → 100% (41 array entries, 1 barycentre excluded)
 *   - Graea Gree NR-W d1-1 → 1 known  / 5 reported   → 20% (fixture trimmed to the neutron star)
 *   - Gru Hypai LM-V e2-8  → no bodyCount, no bodies → "Unknown" / "?%", bodies list hidden
 */

test.describe('System completeness bar', () => {
  test('shows 100% when known bodies meet or exceed the reported count (Sol)', async ({ page }) => {
    await loadFixtureSystem(page, { fixture: 'sol.json', systemName: 'Sol', id64: 10477373803 });

    const bar = page.locator('.system-completeness');
    await expect(bar).toBeVisible();
    await expect(bar.locator('.system-completeness-value')).toHaveText('100%');
    await expect(bar.locator('.system-completeness-fill')).toHaveCSS('width', /.+/);
    // Full completeness → green (green channel dominates).
    const green = await fillRgb(bar.locator('.system-completeness-fill'));
    expect(green.g).toBeGreaterThan(green.r);
    await expect(page.locator('.bodies')).toBeVisible();
  });

  test('shows a partial percentage for an incompletely-scanned system (Graea Gree NR-W d1-1)', async ({ page }) => {
    await loadFixtureSystem(page, {
      fixture: 'graea-gree-nr-w-d1-1.json',
      systemName: 'Graea Gree NR-W d1-1',
      id64: 44149006227,
    });

    const bar = page.locator('.system-completeness');
    await expect(bar).toBeVisible();
    await expect(bar.locator('.system-completeness-value')).toHaveText('20%');
    await expect(bar.locator('.system-completeness-unknown')).toHaveCount(0);
    // Low completeness → red (red channel dominates).
    const red = await fillRgb(bar.locator('.system-completeness-fill'));
    expect(red.r).toBeGreaterThan(red.g);
    // The neutron star is the one known body, so the list still renders.
    await expect(page.locator('.bodies')).toBeVisible();
  });

  test('shows "Unknown" / "?%" and hides the bodies list when no body count is available (Gru Hypai LM-V e2-8)', async ({ page }) => {
    await loadFixtureSystem(page, {
      fixture: 'gru-hypai-lm-v-e2-8.json',
      systemName: 'Gru Hypai LM-V e2-8',
      id64: 35766896476,
    });

    const bar = page.locator('.system-completeness');
    await expect(bar).toBeVisible();
    await expect(bar.locator('.system-completeness-value')).toHaveText('?%');
    await expect(bar.locator('.system-completeness-unknown')).toHaveText('Unknown');
    await expect(bar.locator('.system-completeness-fill')).toHaveCount(0);
    // No bodies in the JSON → the bodies list is omitted entirely.
    await expect(page.locator('.bodies')).toHaveCount(0);
  });
});
