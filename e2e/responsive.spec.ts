import { test, expect } from '@playwright/test';

/**
 * Responsive rendering checks. These run across every project defined in
 * `playwright.config.ts` (desktop / tablet / mobile × Chromium / Firefox), so a
 * single spec verifies the layout holds up on all three form factors and both
 * rendering engines.
 *
 * Like `system-search.spec.ts`, these exercise the deterministic, offline `test`
 * fixture (`assets/test-system.json`) so the layout assertions never depend on a
 * live API. A screenshot is attached to the HTML report for each case so the
 * rendering can be eyeballed per form factor.
 */

/** Derives the form-factor label ('desktop' | 'tablet' | 'mobile') from the project name. */
function formFactor(projectName: string): string {
  return projectName.split('-')[0];
}

/**
 * Asserts the page has no meaningful horizontal overflow — the surest automated
 * signal that something is too wide for the viewport. A 1px slack absorbs
 * sub-pixel rounding.
 *
 * The app scrolls on the document root (`document.scrollingElement`), so a too-wide
 * body widens the document itself. We measure the scrolling element's scrollWidth
 * against its clientWidth.
 */
async function expectNoHorizontalOverflow(page: import('@playwright/test').Page, label = '') {
  const overflow = await page.evaluate(() => {
    const scroller = document.scrollingElement ?? document.documentElement;
    return { scrollWidth: scroller.scrollWidth, clientWidth: scroller.clientWidth };
  });
  expect(
    overflow.scrollWidth,
    `${label} scrollWidth (${overflow.scrollWidth}) should not exceed the viewport width (${overflow.clientWidth})`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

async function loadTestSystem(page: import('@playwright/test').Page) {
  await page.getByRole('combobox').fill('test');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByText('Test System', { exact: true })).toBeVisible({ timeout: 30_000 });
}

test.describe('Responsive layout', () => {
  test('landing page fits the viewport', async ({ page }, testInfo) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'System Signals' })).toBeVisible();
    await expect(page.getByRole('combobox')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();

    await expectNoHorizontalOverflow(page);

    await testInfo.attach(`landing-${formFactor(testInfo.project.name)}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('loaded system fits the viewport and shows the key panels', async ({ page }, testInfo) => {
    await page.goto('/');
    await loadTestSystem(page);

    // Core panels render on every form factor.
    await expect(page.getByText('Test System Primary').first()).toBeVisible();
    await expect(page.locator('app-region-map')).toBeVisible();
    await expect(page.locator('app-system-body').first()).toBeVisible();

    // Let the results animation and any late layout settle before measuring.
    await page.waitForTimeout(500);
    await expectNoHorizontalOverflow(page);

    await testInfo.attach(`system-${formFactor(testInfo.project.name)}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  // The body tree's old fixed 500px-min boxes overflowed at in-between widths (a
  // ~932px window in particular fell between the desktop and phone layouts). The
  // tree is now fluid, so the loaded system must fit at every width — sweep a
  // range, resizing a single loaded page, and assert no horizontal overflow.
  test('the loaded system fits at every width (no breakpoint gaps)', async ({ page }) => {
    await page.goto('/');
    await loadTestSystem(page);

    for (const width of [360, 390, 600, 768, 932, 1024, 1280, 1600, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      // Let the layout reflow after the resize.
      await page.waitForTimeout(150);
      await expectNoHorizontalOverflow(page, `at ${width}px`);
    }
  });
});
