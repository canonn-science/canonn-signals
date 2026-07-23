/**
 * Regression test for body deep-links (the "Copy link to body" button).
 *
 * Opening `?system=<name>#body-<id>` must land with that body scrolled to the top of the
 * viewport. A large system keeps growing its layout for seconds after render (canvas
 * renderers, images, worker badges above the anchor), so a one-shot scroll used to drift
 * the anchor to an arbitrary, viewport-dependent offset — the reported "doesn't open at the
 * right spot" bug. Eimbaith LW-W e1-290 body 7 (bodyId 43) is the last body in a 34-body
 * system, the worst case for that drift.
 */
import { test, expect, type Page } from '@playwright/test';
import * as path from 'path';

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

async function stubSystem(page: Page, systemName: string, id64: number, fixture: string): Promise<void> {
  const fixturePath = path.join(FIXTURES_DIR, fixture);
  await page.route('**/query/codex/biostats*', (route) => route.fulfill({ path: fixturePath }));
  await page.route('**/query/typeahead*', (route) =>
    route.fulfill({ json: { min_max: [{ name: systemName, id64 }] } }),
  );
  await page.route('**/query/codex/ref*', (route) => route.fulfill({ json: {} }));
  await page.route('**/query/simbad*', (route) => route.fulfill({ json: {} }));
  await page.route('**/query/gnosis*', (route) => route.fulfill({ json: {} }));
  await page.route('**/api/edastro/**', (route) => route.fulfill({ json: [] }));
  await page.clock.setFixedTime(new Date('2026-06-14T00:00:00Z'));
}

test('deep-link #body-43 scrolls the anchored body into view', async ({ page }) => {
  const systemName = 'Eimbaith LW-W e1-290';
  await stubSystem(page, systemName, 1246813571732, 'eimbaith-lw-w-e1-290.json');

  await page.goto('/?system=' + encodeURIComponent(systemName) + '#body-43');

  const anchor = page.locator('#body-43');
  await expect(anchor).toBeVisible({ timeout: 30_000 });

  const vh = page.viewportSize()!.height;
  // Let the deep-link scroll pin the anchor and all async content above it (canvas
  // renderers, images, worker badges) settle — the re-pin loop tracks that growth.
  await page.waitForTimeout(4000);

  const top = (await anchor.boundingBox())!.y;
  // The anchored body's header must remain pinned near the top of the viewport once the
  // page settles — not scrolled past (off the top) nor still parked far below the fold.
  expect(top, `anchor should stay in view (top=${top}, vh=${vh})`).toBeGreaterThan(-5);
  expect(top, `anchor should stay near the top (top=${top}, vh=${vh})`).toBeLessThan(vh * 0.35);
});
