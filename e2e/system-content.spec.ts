import { test, expect, type Page, type Locator } from '@playwright/test';
import { expectSystemRow } from './support/system-fixture';

/**
 * Deterministic content tests for the loaded-system view. These run against the
 * built-in `test` fixture (`assets/test-system.json`) — no live API — so the
 * body types, classifications, icons, images and data panels are stable and the
 * assertions can be exact.
 *
 * Bodies are addressed by their stable DOM id (`#body-<bodyId>` from the
 * fixture); each is a leaf, so the id scopes cleanly to that one body:
 *   #body-1  → Test Neutron Star (Star)
 *   #body-2  → Venus            (High metal content world, has signals)
 *   #body-10 → Green Landable   (Rocky body, landable)
 */

async function loadTestSystem(page: Page) {
  await page.goto('/');
  await page.getByRole('combobox').fill('test');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByText('Test System', { exact: true })).toBeVisible({ timeout: 30_000 });
}

/** Expands a body's detail panel if it isn't already expanded. */
async function ensureExpanded(body: Locator) {
  const expand = body.getByLabel('Expand body details');
  if ((await expand.count()) > 0 && (await expand.isVisible())) {
    await expand.click();
  }
}

/** Asserts a body's data panel has a section with the given header. */
async function expectSection(body: Locator, header: string) {
  await expect(body.locator('.body-data-section-header').filter({ hasText: header })).toBeVisible();
}

/** Asserts the body's planet/star image element is present and actually decoded. */
async function expectBodyImageLoads(body: Locator) {
  const img = body.locator('.body-image img').last();
  await img.scrollIntoViewIfNeeded();
  await expect(img).toBeVisible();
  await expect(img).toHaveAttribute('src', /assets\/bodies\//);
  await expect
    .poll(async () => img.evaluate((el: HTMLImageElement) => el.naturalWidth), { timeout: 10_000 })
    .toBeGreaterThan(0);
}

test.describe('System content (test fixture)', () => {
  test.beforeEach(async ({ page }) => {
    await loadTestSystem(page);
  });

  test('highlights the system region on the map', async ({ page }) => {
    await expect(page.locator('app-region-map svg')).toBeVisible();

    const map = await page.evaluate(() => {
      const svg = document.querySelector('app-region-map svg');
      const regions = svg ? [...svg.querySelectorAll('path[id^="Region_"]')] : [];
      const isHighlighted = (r: Element) => {
        const s = r.getAttribute('style') || '';
        return /#ff9900|rgb\(255,\s*153,\s*0\)/i.test(s) && /fill-opacity:\s*0?\.6/.test(s);
      };
      return {
        total: regions.length,
        highlightedIds: regions.filter(isHighlighted).map((r) => r.id),
        hasSystemMarker: !!svg?.querySelector('#system-marker'),
      };
    });

    // The full galaxy map has 42 regions; the fixture system is in region 1, so
    // exactly that one is highlighted and the system's own marker is drawn.
    expect(map.total).toBe(42);
    expect(map.highlightedIds).toEqual(['Region_01']);
    expect(map.hasSystemMarker).toBe(true);
  });

  test('renders a star body: classification, image and stellar data', async ({ page }) => {
    const star = page.locator('#body-1'); // Test Neutron Star
    await ensureExpanded(star);

    await expect(star.locator('.body-title')).toContainText('Neutron Star');
    await expectBodyImageLoads(star);
    await expectSection(star, 'Stellar Properties');
    await expectSection(star, 'Physical Properties');

    // A star is not a landable surface — no on-foot footprint badge.
    await expect(star.locator('img[src*="footprint"]')).toHaveCount(0);
  });

  test('renders a high-metal-content world: type, image, data sections and signals', async ({ page }) => {
    const venus = page.locator('#body-2');
    await ensureExpanded(venus);

    await expect(venus.locator('.body-title')).toContainText('High metal content world');
    await expectBodyImageLoads(venus);

    // The expected data panels for a surveyed planet with an atmosphere.
    await expectSection(venus, 'Orbit');
    await expectSection(venus, 'Physical Properties');
    await expectSection(venus, 'Atmosphere & Environment');

    // It carries a signal — the header icon and the Signals data section render.
    await expect(venus.locator('.title-left img[src*="Human.svg"]')).toBeVisible();
    await expectSection(venus, 'Signals');
  });

  test('renders a landable rocky body with the on-foot footprint icon', async ({ page }) => {
    const landable = page.locator('#body-10'); // Green Landable (Safe)

    await expect(landable.locator('.body-title')).toContainText('Rocky body');
    // The landable badge carries the footprint icon in the body header.
    await expect(landable.locator('.body-title img[src*="footprint.svg"]')).toBeVisible();
  });

  test('exposes the raw-JSON control on a body header', async ({ page }) => {
    // Every body header offers a "view JSON" button for the underlying data.
    await expect(page.locator('#body-2 .body-title .json-button')).toBeVisible();
  });

  test('hides the Society section for an unpopulated system but still shows permit/updated', async ({ page }) => {
    // The test fixture has population 0, so the populated-only Society block is absent.
    await expect(page.locator('.system-data-section-header').filter({ hasText: 'Society' })).toHaveCount(0);

    // Permit + info-updated are shown for every system. "Test System" is not permit-locked.
    await expectSystemRow(page, 'Permit required', 'No');
    // Rendered in local time; the suite pins timezoneId to UTC, so this is the UTC wall-clock.
    await expectSystemRow(page, 'Info updated', '2024-11-19 17:15');
  });
});
