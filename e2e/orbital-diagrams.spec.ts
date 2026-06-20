import { test, expect, type Page } from '@playwright/test';
import { ensureBodyExpanded, loadFixtureSystem } from './support/system-fixture';

/**
 * Deterministic tests for the orbital-diagram modals reachable from a body's
 * "Orbital inclination", "Argument of periapsis" and "Axial tilt" rows. Loaded from
 * the saved Alpha Centauri biostats payload with the network stubbed and the clock
 * pinned (see {@link loadFixtureSystem}), so the diagrams and the live inclination
 * marker are reproducible.
 *
 * Body 8 ("2042 L1") is used throughout: it has all three angles, a steeply inclined
 * orbit (~82.5°) and a short orbital period (~3 days), so its live marker visibly
 * advances when the pinned clock moves forward. Its parent is body 7, "Lagrange".
 */
const FIXTURE = { fixture: 'alpha-centauri.json', systemName: 'Alpha Centauri', id64: 1178708478315 };
const BODY_ID = 8;

/** Clicks one of the body's clickable angle rows and returns the opened modal. */
async function openDiagram(page: Page, label: string) {
  await ensureBodyExpanded(page, BODY_ID);
  const content = page.locator(`#body-${BODY_ID} > .system-body-grow`);
  const row = content.locator('.body-data-entry.clickable').filter({ has: page.getByText(label, { exact: true }) });
  await row.first().scrollIntoViewIfNeeded();
  await row.first().click();
  return page.locator('app-orbital-diagram-dialog');
}

test.describe('Orbital diagram modals (Alpha Centauri fixture)', () => {
  test.beforeEach(async ({ page }) => {
    await loadFixtureSystem(page, FIXTURE);
  });

  for (const title of ['Orbital inclination', 'Argument of periapsis', 'Axial tilt']) {
    test(`opens the ${title} diagram from its row`, async ({ page }) => {
      const dialog = await openDiagram(page, title);
      await expect(dialog.locator('h2')).toHaveText(title);
      await expect(dialog.locator('svg.orbital-diagram')).toBeVisible();
      // Closing the modal removes it from the DOM.
      await dialog.getByRole('button', { name: 'Close' }).click();
      await expect(dialog).toHaveCount(0);
    });
  }

  test('names the parent and the body on the inclination diagram', async ({ page }) => {
    const svg = (await openDiagram(page, 'Orbital inclination')).locator('svg.orbital-diagram');
    await expect(svg.locator('circle.marker')).toBeVisible();
    await expect(svg.getByText('2042 L1')).toBeVisible(); // the orbiting body
    await expect(svg.getByText('Lagrange')).toBeVisible(); // the body it orbits
  });

  test('draws the periapsis orbit as an ellipse (rx ≠ ry)', async ({ page }) => {
    const ellipse = (await openDiagram(page, 'Argument of periapsis')).locator('ellipse.orbit-plane');
    const { rx, ry } = await ellipse.evaluate((el) => ({
      rx: parseFloat(el.getAttribute('rx') || '0'),
      ry: parseFloat(el.getAttribute('ry') || '0'),
    }));
    expect(rx).toBeGreaterThan(0);
    expect(ry).toBeGreaterThan(0);
    expect(Math.abs(rx - ry)).toBeGreaterThan(1);
  });

  test('advances the live inclination marker as the clock moves forward', async ({ page }) => {
    const marker = (await openDiagram(page, 'Orbital inclination')).locator('circle.marker');
    await expect(marker).toBeVisible();

    const readPos = () =>
      marker.evaluate((c) => ({
        x: parseFloat(c.getAttribute('cx') || '0'),
        y: parseFloat(c.getAttribute('cy') || '0'),
      }));
    const before = await readPos();

    // The fixture pins now to 2026-06-14T00:00:00Z. The orbit is ~3 days, so jumping
    // ~0.6 day forward sweeps the body ~72° and the live marker must visibly move.
    await page.clock.setFixedTime(new Date('2026-06-14T14:24:00Z'));

    await expect
      .poll(
        async () => {
          const now = await readPos();
          return Math.hypot(now.x - before.x, now.y - before.y);
        },
        { timeout: 8000 },
      )
      .toBeGreaterThan(2);
  });
});
