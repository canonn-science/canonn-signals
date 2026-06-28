import { test, expect, type Page } from '@playwright/test';
import { loadFixtureSystem, type FixtureOptions } from './support/system-fixture';

/**
 * Trojan / Lagrange badge rendering, end-to-end, from saved biostats payloads.
 *
 * The unit suite (`orbital-relations.service.spec.ts`) pins the detection maths; these
 * tests close the loop by proving the full pipeline — biostats parse → body-tree build →
 * co-orbital detection → header badge — lights up the right badge on the right body for
 * five real systems. They are genuine same-radius ±60° Trojans (not 180° binaries), each
 * encoding the entire offset in `argOfPeriapsis` with ascendingNode/meanAnomaly held equal
 * across siblings — see the fixtures under `e2e/fixtures/` and the service-spec rationale.
 *
 * A body's own header carries the badge as `<span class="badge badge-blue">` with text
 * "L4"/"L5" (a Trojan) or "Host" (the co-orbital primary, companions at both L4 and L5).
 */

interface TrojanBadge {
  /** `bodyId` from the fixture → DOM id `#body-<bodyId>`. */
  bodyId: number;
  /** Human label for the test title. */
  name: string;
  /** Badge text: a Lagrange point a body occupies, or 'Host' for the primary. */
  badge: 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'Host';
  /** Expected tooltip on the badge (asserted by hover when given). */
  tooltip?: string;
}

interface TrojanSystem extends FixtureOptions {
  badges: TrojanBadge[];
}

const HOST_TOOLTIP =
  'Co-orbital primary: this body has companions at its L4 and L5 Lagrange points — click for the diagram';

const SYSTEMS: TrojanSystem[] = [
  {
    fixture: 'pro-eurl-jf-a-d88.json',
    systemName: 'Pro Eurl JF-A d88',
    id64: 3034587351427,
    badges: [
      { bodyId: 30, name: 'Pro Eurl JF-A d88 B 2', badge: 'L5' },
      { bodyId: 33, name: 'Pro Eurl JF-A d88 B 3', badge: 'L4' },
    ],
  },
  {
    fixture: 'prooe-bli-fq-r-c19-2.json',
    systemName: 'Prooe Bli FQ-R c19-2',
    id64: 646492666282,
    badges: [
      { bodyId: 18, name: 'Prooe Bli FQ-R c19-2 2', badge: 'L5' },
      { bodyId: 25, name: 'Prooe Bli FQ-R c19-2 3', badge: 'L4' },
    ],
  },
  {
    fixture: 'truecho-ne-p-c22-0.json',
    systemName: 'Truecho NE-P c22-0',
    id64: 94590909634,
    badges: [
      { bodyId: 50, name: 'Truecho NE-P c22-0 6', badge: 'L4' },
      { bodyId: 68, name: 'Truecho NE-P c22-0 7', badge: 'L5' },
    ],
  },
  {
    fixture: 'pipe-stem-sector-dl-y-d17.json',
    systemName: 'Pipe (stem) Sector DL-Y d17',
    id64: 594592926107,
    badges: [
      { bodyId: 34, name: 'Pipe (stem) Sector DL-Y d17 barycentre', badge: 'L4' },
      { bodyId: 44, name: 'Pipe (stem) Sector DL-Y d17 11', badge: 'L5' },
    ],
  },
  {
    fixture: 'eorld-byio-aa-a-h539.json',
    systemName: 'Eorld Byio AA-A h539',
    id64: 4524375383,
    badges: [
      // The barycentre is the co-orbital primary: companions at both L4 (A 18) and L5 (A 19).
      { bodyId: 35, name: 'Eorld Byio AA-A h539 barycentre', badge: 'Host', tooltip: HOST_TOOLTIP },
      { bodyId: 38, name: 'Eorld Byio AA-A h539 A 18', badge: 'L4', tooltip: 'Trojan at Lagrange L4 — click for the diagram' },
      { bodyId: 39, name: 'Eorld Byio AA-A h539 A 19', badge: 'L5', tooltip: 'Trojan at Lagrange L5 — click for the diagram' },
    ],
  },
];

/**
 * Asserts the expected blue Trojan/Host badge is present in a body's *own* header
 * (`#body-<id> > .body-title`, so nested child bodies never bleed in), with exact text.
 * When a `tooltip` is given, hovers the badge and checks the overlay text too.
 */
async function expectTrojanBadge(page: Page, b: TrojanBadge): Promise<void> {
  const header = page.locator(`#body-${b.bodyId} > .body-title`);
  await expect(header, `#body-${b.bodyId} ("${b.name}") header should render`).toBeVisible();

  const badge = header
    .locator('.badge.badge-blue')
    .filter({ hasText: new RegExp(`^${b.badge}$`) });
  await expect(badge, `"${b.name}" should show the ${b.badge} badge`).toHaveCount(1);

  if (b.tooltip) {
    await badge.scrollIntoViewIfNeeded();
    await badge.hover();
    await expect(
      page.locator('.mat-mdc-tooltip-show'),
      `"${b.name}" ${b.badge} badge tooltip`,
    ).toHaveText(b.tooltip);
    // Move away and wait for it to hide so the next hover's tooltip is unambiguous.
    await page.mouse.move(0, 0);
    await expect(page.locator('.mat-mdc-tooltip-show')).toHaveCount(0);
  }
}

for (const system of SYSTEMS) {
  test.describe(`${system.systemName} Trojan/Lagrange badges (fixture)`, () => {
    test.beforeEach(async ({ page }) => {
      await loadFixtureSystem(page, system);
    });

    for (const b of system.badges) {
      test(`renders the ${b.badge} badge on ${b.name}`, async ({ page }) => {
        await expectTrojanBadge(page, b);
      });
    }
  });
}

const byName = (name: string): TrojanSystem => SYSTEMS.find(s => s.systemName === name)!;

test.describe('Lagrange points dialog', () => {
  test('Host badge opens the diagram with the host highlighted and L4/L5 companions', async ({ page }) => {
    await loadFixtureSystem(page, byName('Eorld Byio AA-A h539'));

    await page.locator('#body-35 > .body-title .badge.badge-blue', { hasText: 'Host' }).click();

    const svg = page.locator('app-lagrange-dialog svg');
    await expect(page.locator('app-lagrange-dialog').getByRole('heading', { name: 'Lagrange points' })).toBeVisible();
    // Real companions are placed at L4 and L5, and all five points are captioned.
    await expect(svg).toContainText('A 18');
    await expect(svg).toContainText('A 19');
    // The repeated system-name prefix is stripped from the body names.
    await expect(svg).not.toContainText('Eorld Byio AA-A h539 A 18');
    for (const id of ['L1', 'L2', 'L3', 'L4', 'L5']) {
      await expect(svg).toContainText(id);
    }
    // The clicked body (the host) is the single highlighted marker.
    await expect(svg.locator('circle.body.focus')).toHaveCount(1);
    // Three real bodies (host + L4 + L5); the remaining points are placeholders.
    await expect(svg.locator('circle.body')).toHaveCount(3);
    await expect(svg.locator('circle.placeholder')).toHaveCount(3);
  });

  test('Trojan badge on a lone pair opens the diagram with a placeholder secondary', async ({ page }) => {
    await loadFixtureSystem(page, byName('Pro Eurl JF-A d88'));

    // Body 33 (B 3) is labelled L4; clicking it focuses it in the diagram.
    await page.locator('#body-33 > .body-title .badge.badge-blue', { hasText: 'L4' }).click();

    const svg = page.locator('app-lagrange-dialog svg');
    await expect(page.locator('app-lagrange-dialog').getByRole('heading', { name: 'Lagrange points' })).toBeVisible();
    await expect(svg).toContainText('B 2');
    await expect(svg).toContainText('B 3');
    // No recorded host → the secondary slot is a placeholder with its caption.
    await expect(svg).toContainText('secondary');
    await expect(svg.locator('circle.body.focus')).toHaveCount(1);
    // L4 + L5 bodies; L1/L2/L3 + the empty secondary slot are placeholders.
    await expect(svg.locator('circle.body')).toHaveCount(2);
    await expect(svg.locator('circle.placeholder')).toHaveCount(4);
  });
});
