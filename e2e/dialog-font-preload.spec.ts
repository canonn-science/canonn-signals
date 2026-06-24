import { test, expect, type Page } from '@playwright/test';
import { loadFixtureSystem } from './support/system-fixture';

/**
 * Regression guard for the "elements briefly jump up when the first dialog opens" bug.
 *
 * The dialogs render glyphs (greek Δ θ ω, math ≈ −, symbols ← → ↔ ☉) that live in
 * Roboto `unicode-range` subsets the main system view never paints. fontsource fetches
 * each subset lazily on first paint, so before the fix the first dialog open fetched
 * `roboto-math`/`roboto-symbols`/`roboto-greek` and the fallback→Roboto swap reflowed
 * the text — the visible jump. `preloadDialogFontSubsets()` (see src/app/preload-fonts.ts)
 * warms those subsets at startup, so opening a dialog must trigger NO font request.
 */

const FIXTURE = { fixture: 'alpha-centauri.json', systemName: 'Alpha Centauri', id64: 1178708478315 };

function trackFontRequests(page: Page): string[] {
  const reqs: string[] = [];
  page.on('request', (r) => {
    const u = r.url();
    if (/\.(woff2?|ttf|otf|eot)(\?|$)/i.test(u)) reqs.push(u.split('/').slice(-1)[0]);
  });
  return reqs;
}

test('opening the first dialog fetches no font (subsets warmed at startup)', async ({ page }) => {
  const fontReqs = trackFontRequests(page);

  await loadFixtureSystem(page, FIXTURE);
  // Let the startup warm-up settle so its subset fetches are counted before, not during, the open.
  await page.evaluate(() => (document as unknown as { fonts: FontFaceSet }).fonts.ready);
  await page.waitForTimeout(400);

  // The dialog-only subsets must already have been fetched at startup.
  expect(fontReqs.some((f) => f.includes('roboto-math')), 'roboto-math warmed at startup').toBe(true);
  expect(fontReqs.some((f) => f.includes('roboto-symbols')), 'roboto-symbols warmed at startup').toBe(true);

  const countBeforeOpen = fontReqs.length;

  // Open the first dialog (tidal-lock, from Alpha Centauri B 1's purple spin/lock badge).
  await page.locator('#body-5 > .body-title .badge-purple').click();
  await expect(page.locator('app-tidal-lock-dialog')).toBeVisible();
  await page.waitForTimeout(600);

  // No new font file was requested by opening the dialog → no swap → no reflow jump.
  expect(fontReqs.slice(countBeforeOpen), 'no font fetched on first dialog open').toEqual([]);
});
