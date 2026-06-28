import { test, expect, type Page, type Locator } from '@playwright/test';
import { loadFixtureSystem } from './support/system-fixture';

/**
 * Multi-body collision rendering for the real system Eoch Flyuae YK-K c10-56, whose moons
 * 1 a / 1 b / 1 c share crossing orbits. Viewed from body 1 b, two of its upcoming contacts
 * fall in the same conjunction on 2026-10-28 — one with 1 c and one with 1 a — so both rows
 * are flagged as a simultaneous (three-body) collision and a combined entry is listed.
 *
 * "Now" is pinned to 2026-10-20 — a week before that conjunction — so the simultaneous contacts
 * fall within the first few upcoming rows (rather than ~20 rows out from an earlier date), making
 * them visible under the dialog's 10-row cap.
 */
const SYSTEM = {
  fixture: 'eoch-flyuae-yk-k-c10-56.json',
  systemName: 'Eoch Flyuae YK-K c10-56',
  id64: 15463257612378,
  fixedTime: '2026-10-20T00:00:00Z',
};

/** bodyId of "Eoch Flyuae YK-K c10-56 1 b" in the fixture. */
const BODY_1B = 10;

/** Opens the collision dialog from a body's "Collision" badge and returns the dialog locator. */
async function openCollisionDialog(page: Page, bodyId: number): Promise<Locator> {
  // Scope to the body's OWN header (direct child) so a nested child body's badge can't match.
  await page.locator(`#body-${bodyId} > .body-title .badge-red`).click();
  const dialog = page.locator('app-collision-dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

/** A row in the upcoming-collisions table identified by its (unique) contact-start timestamp. */
function rowAt(dialog: Locator, startUtc: string): Locator {
  return dialog.locator('.upcoming-collisions tbody tr').filter({ hasText: startUtc });
}

test.describe('multi-body collisions (Eoch Flyuae YK-K c10-56 1 b)', () => {
  test('flags coincident contacts as a simultaneous collision and lists the cluster', async ({ page }) => {
    await loadFixtureSystem(page, SYSTEM);

    const dialog = await openCollisionDialog(page, BODY_1B);
    await expect(dialog.getByRole('heading', { name: /Collision/ })).toBeVisible();

    // The two contacts that share the 2026-10-28 conjunction are both flagged "multi", and each
    // row names BOTH involved bodies (this body ↔ partner), not just the partner.
    const withC = rowAt(dialog, '2026-10-28 13:01 UTC');
    await expect(withC).toHaveClass(/multi/);
    await expect(withC.locator('.multi-tag')).toBeVisible();
    await expect(withC.locator('td.bodies')).toContainText('1 b ↔ 1 c');
    await expect(withC).toContainText('82.9%');

    const withA = rowAt(dialog, '2026-10-28 15:06 UTC');
    await expect(withA).toHaveClass(/multi/);
    await expect(withA.locator('.multi-tag')).toBeVisible();
    await expect(withA.locator('td.bodies')).toContainText('1 b ↔ 1 a');
    await expect(withA).toContainText('46.9%');

    // A neighbouring single-partner contact must NOT be flagged — the highlight discriminates.
    const lone = rowAt(dialog, '2026-10-21 18:23 UTC');
    await expect(lone).not.toHaveClass(/multi/);
    await expect(lone.locator('.multi-tag')).toHaveCount(0);
    await expect(lone).toContainText('1 a');

    // The dedicated "Simultaneous collisions" section names every body in the pile-up at once.
    const section = dialog.locator('.multi-collisions');
    await expect(section.getByRole('heading', { name: 'Simultaneous collisions' })).toBeVisible();
    const cluster = section.locator('li').filter({ hasText: '2026-10-28 13:01 UTC' });
    await expect(cluster).toContainText('Eoch Flyuae YK-K c10-56 1 b, 1 a, 1 c');
    await expect(cluster).toContainText('9 days');
  });

  test('renders the distance-over-time diagram with a curve per colliding partner', async ({ page }) => {
    await loadFixtureSystem(page, SYSTEM);
    const dialog = await openCollisionDialog(page, BODY_1B);

    const chart = dialog.locator('svg.separation-chart');
    await expect(chart).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Distance over time' })).toBeVisible();

    // One separation curve, threshold line and "now" marker per directly-colliding partner
    // (1 b collides with both 1 a and 1 c here).
    await expect(chart.locator('polyline.curve')).toHaveCount(2);
    await expect(chart.locator('line.threshold')).toHaveCount(2);
    await expect(chart.locator('line.now-line')).toHaveCount(1);
    await expect(chart.locator('path.marker').first()).toBeVisible();

    // The legend pairs this body with each partner.
    const legend = dialog.locator('.legend');
    await expect(legend).toContainText('1 b ↔ 1 a');
    await expect(legend).toContainText('1 b ↔ 1 c');
  });
});
