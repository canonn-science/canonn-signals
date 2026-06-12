import { test, expect, type Page } from '@playwright/test';
import { expectSystemRow } from './support/system-fixture';

/**
 * End-to-end tests for a real, well-known system — Alpha Centauri — exercised
 * across every project (desktop / tablet / mobile × Chromium / Firefox).
 *
 * Unlike the fixture-based suites, these drive the full live data path (EDAstro
 * cache → Spansh typeahead → Canonn biostats) with NO network stubbing, so they
 * verify the real integration but depend on those upstream APIs being reachable;
 * timeouts are therefore generous.
 *
 * Assertions target *stable* facts — galactic coordinates, the system address
 * (id64), region, SIMBAD designation, and Alpha Centauri's fixed lore population —
 * never volatile figures like signal counts. Per-body content is covered
 * deterministically in `alpha-centauri-bodies.spec.ts`, so it isn't repeated here.
 */

/** Searches for Alpha Centauri and waits for the loaded system to render. */
async function loadAlphaCentauri(page: Page) {
  await page.goto('/');
  await page.getByRole('combobox').fill('Alpha Centauri');
  await page.getByRole('button', { name: 'Search' }).click();

  // The system title renders once the biostats payload arrives.
  await expect(page.getByText('Alpha Centauri', { exact: true }).first()).toBeVisible({
    timeout: 60_000,
  });
  // A search failure surfaces in the error panel — assert we got real data instead.
  await expect(page.locator('.error-message')).toBeHidden();
}

test.describe('Alpha Centauri (live data)', () => {
  // The live API chain (multi-MB EDAstro dataset + biostats) can be slow.
  test.slow();

  test('loads and renders the Alpha Centauri system', async ({ page }, testInfo) => {
    await loadAlphaCentauri(page);

    // It's an inhabited system — the population line renders next to the title.
    await expect(page.getByText(/^Population:/)).toBeVisible();
    // Alpha Centauri has multiple bodies; at least the body tree should render.
    await expect(page.locator('app-system-body').first()).toBeVisible();

    // The deep, material-rich tree must fit without horizontal overflow at the
    // in-between and phone widths that previously broke.
    for (const width of [390, 768, 932, 1024]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(150);
      const overflow = await page.evaluate(() => {
        const sc = document.querySelector('mat-sidenav-content') ?? document.documentElement;
        return sc.scrollWidth - sc.clientWidth;
      });
      expect(overflow, `no horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
    }

    await testInfo.attach(`alpha-centauri-${testInfo.project.name}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('shows the system identity panel (location, SIMBAD & population)', async ({ page }) => {
    await loadAlphaCentauri(page);

    // Location section — each value asserted as the value *for* its label.
    await expectSystemRow(page, 'PG Name', 'Wregoe AC-D d12-34');
    await expectSystemRow(page, 'Region', 'Inner Orion Spur');
    await expectSystemRow(page, 'Id64', '1178708478315');
    await expectSystemRow(page, 'Coordinates', '3.03125 / -0.09375 / 3.15625');

    // SIMBAD cross-identification for the real-world star.
    await expectSystemRow(page, 'Name', '* alf Cen');

    // Sol sits ~4.4 ly away — a fixed distance shown in the Distances section.
    await expectSystemRow(page, 'Sol', '4.4 ly');

    // Alpha Centauri's population is fixed lore, so its exact value is asserted.
    await expect(page.locator('.population')).toHaveText('Population: 106,811');
  });

  test('highlights the system region (Inner Orion Spur) on the map', async ({ page }) => {
    await loadAlphaCentauri(page);

    await expect(page.locator('app-region-map svg')).toBeVisible();

    const map = await page.evaluate(() => {
      const svg = document.querySelector('app-region-map svg');
      const regions = svg ? [...svg.querySelectorAll('path[id^="Region_"]')] : [];
      // The current region is filled #ff9900 at 0.6 opacity; all others are a
      // faint darkorange at 0.1. Browsers may serialise the colour as hex or rgb.
      const isHighlighted = (r: Element) => {
        const s = r.getAttribute('style') || '';
        const orange = /#ff9900|rgb\(255,\s*153,\s*0\)/i.test(s);
        const strong = /fill-opacity:\s*0?\.6/.test(s);
        return orange && strong;
      };
      return {
        highlightedIds: regions.filter(isHighlighted).map((r) => r.id),
        hasSystemMarker: !!svg?.querySelector('#system-marker'),
      };
    });

    // Inner Orion Spur is region 18 — exactly one region highlighted, and it's that one.
    expect(map.highlightedIds).toEqual(['Region_18']);
    // The system's own position is marked within the highlighted region.
    expect(map.hasSystemMarker).toBe(true);
  });
});
