import { test, expect } from '@playwright/test';
import { loadFixtureSystem } from './support/system-fixture';

/**
 * Performance guard for the 3D collision-candidate search.
 *
 * `OrbitalRelationsService.detectCollisionStatus` runs a synchronous orbit-to-orbit
 * proximity scan for every crossing-orbit sibling of every body, on the main thread,
 * during render. A past regression made the coarse sampling step adaptive down to a
 * 0.05° floor, which for any orbit beyond ~0.1 AU exploded the inner double-loop to
 * 7200² ≈ 52M iterations (~200 ms) *per sibling pair* — freezing the UI for seconds.
 *
 * This test loads {@link FIXTURE}, a synthetic system of five planets that share one
 * orbit (so every pair is a guaranteed collision candidate) at 1 AU with small radii —
 * exactly the geometry that drove the step to its floor. It then asserts, via the
 * browser's Long Tasks API, that no single main-thread task during the render exceeds
 * {@link MAX_TASK_MS}. With the regression this fixture blocks for several seconds in a
 * single task; with the bounded grid it stays well under the budget (tens of ms of
 * collision work). This is the "time limit for operations": rendering a collision-heavy
 * system must never monopolise the main thread past the budget.
 *
 * Chromium-only: the Long Tasks API (`PerformanceObserver` with `entryType: 'longtask'`)
 * is not implemented in Firefox.
 */

const FIXTURE = {
  fixture: 'collision-stress.json',
  systemName: 'Collision Stress Test',
  id64: 1234567890123,
};

/**
 * Budget for the longest single main-thread task. The regression produced multi-second
 * tasks; the fixed code's collision work is tens of ms on top of normal Angular render.
 * 1000 ms sits far above normal render (no flakiness) yet far below the seconds-long
 * freeze a reintroduced O(N²) blow-up would cause on this many-candidate fixture.
 */
const MAX_TASK_MS = 1000;

test.describe('collision-detection performance (fixture)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Long Tasks API is Chromium-only');

  test('rendering a collision-heavy system never blocks the main thread past the budget', async ({ page }) => {
    // Install the observer before any app code runs so the render's long tasks are captured.
    await page.addInitScript(() => {
      (window as unknown as { __longTasks: number[] }).__longTasks = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          (window as unknown as { __longTasks: number[] }).__longTasks.push(entry.duration);
        }
      }).observe({ entryTypes: ['longtask'] });
    });

    await loadFixtureSystem(page, FIXTURE);

    // The collision badge only appears once the expensive 3D search has run for these
    // bodies, so its presence proves the guarded operation actually executed (rather
    // than the test passing because nothing was computed). Every planet shares an orbit,
    // so all five are flagged.
    const badges = page.locator('.badge-red', { hasText: 'Collision' });
    await expect(badges.first()).toBeVisible({ timeout: 30_000 });
    await expect(badges).toHaveCount(5);

    // Long Tasks are delivered to the observer asynchronously after the task ends; poll so
    // a late-arriving entry can still fail the assertion. The longest task only grows as
    // entries arrive, so a stable max under budget is a genuine pass.
    await expect
      .poll(
        () => page.evaluate(() => Math.max(0, ...(window as unknown as { __longTasks: number[] }).__longTasks)),
        {
          timeout: 5_000,
          message: `longest main-thread task should stay under ${MAX_TASK_MS} ms during collision-heavy render`,
        },
      )
      .toBeLessThan(MAX_TASK_MS);
  });
});
