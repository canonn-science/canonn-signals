import { test, expect, type Page } from '@playwright/test';
import { loadFixtureSystem, type FixtureOptions } from './support/system-fixture';

/**
 * Trojan / Lagrange badge rendering, end-to-end, from saved biostats payloads.
 *
 * The unit suite (`orbital-relations.service.spec.ts`) pins the detection maths; these
 * tests close the loop by proving the full pipeline — biostats parse → body-tree build →
 * co-orbital detection → header badge — lights up the right badge on the right body across
 * several real systems. Most are genuine same-radius ±60° Trojans, each encoding the entire
 * offset in `argOfPeriapsis` with ascendingNode/meanAnomaly held equal across siblings;
 * Hyuqoae GH-V f2-368 adds a Trojan host that orbits a barycentre, and Cloomoo IL-Y e1
 * covers a same-radius 180° binary whose L3 is suppressed under its barycentre — see the
 * fixtures under `e2e/fixtures/` and the service-spec rationale.
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
  {
    // AB 2 / AB 3 / AB 4 are a same-radius ±60° Trojan trio — AB 2 (a T Tauri star) is the
    // host, AB 3 leads at +60° (L4), AB 4 trails at −60° (L5) — but they orbit *barycentre 1*,
    // not a star. They are still badged: a Trojan host is a real massive secondary even around
    // a barycentre (commit 97d9a50 wrongly suppressed these). The same-radius 180° L3
    // suppression under a barycentre is covered by Cloomoo C/D below; here the three 180°
    // stellar pairs (A/B, AB 5/6, AB 7/8) sit at *different* radii, so they aren't co-orbital
    // L-point candidates at all — the suppression test confirms the trojan fix doesn't bleed
    // a badge onto them.
    fixture: 'hyuqoae-gh-v-f2-368.json',
    systemName: 'Hyuqoae GH-V f2-368',
    id64: 197707429341,
    badges: [
      { bodyId: 13, name: 'Hyuqoae GH-V f2-368 AB 2', badge: 'Host', tooltip: HOST_TOOLTIP },
      { bodyId: 15, name: 'Hyuqoae GH-V f2-368 AB 3', badge: 'L4', tooltip: 'Trojan at Lagrange L4 — click for the diagram' },
      { bodyId: 16, name: 'Hyuqoae GH-V f2-368 AB 4', badge: 'L5', tooltip: 'Trojan at Lagrange L5 — click for the diagram' },
    ],
  },
  {
    // B 3 a / B 3 b share an exact semi-major axis and period but sit ~180° apart in
    // argOfPeriapsis around the real planet B 3 — a genuine L3 opposition with a massive
    // central body (unlike Cloomoo's barycentre binary below, which is suppressed). Both
    // members read as L3.
    fixture: 'pro-eurl-hw-w-e1-1.json',
    systemName: 'Pro Eurl HW-W e1-1',
    id64: 5651842260,
    badges: [
      { bodyId: 31, name: 'Pro Eurl HW-W e1-1 B 3 a', badge: 'L3', tooltip: 'Trojan at Lagrange L3 — click for the diagram' },
      { bodyId: 32, name: 'Pro Eurl HW-W e1-1 B 3 b', badge: 'L3', tooltip: 'Trojan at Lagrange L3 — click for the diagram' },
    ],
  },
];

/**
 * Cloomoo IL-Y e1 C/D share an exact semi-major axis and orbital period but sit 180° apart in
 * argOfPeriapsis — geometrically a textbook L3 opposition. They are NOT badged, though: the pair
 * orbits a barycentre (their mutual centre of mass), and a Lagrange configuration needs a real
 * central body, so the detector deliberately suppresses any status here. See the suppression test
 * below and the orbital-relations spec's barycentre case.
 */
const CLOOMOO_BARYCENTRE_BINARY: FixtureOptions = {
  fixture: 'cloomoo-il-y-e1.json',
  systemName: 'Cloomoo IL-Y e1',
  id64: 6033516940,
};

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

  test('L3 opposition draws one body as the secondary and the other at L3', async ({ page }) => {
    await loadFixtureSystem(page, byName('Pro Eurl HW-W e1-1'));

    // B 3 a (body 31) is one half of the L3 pair; clicking its badge focuses it in the diagram.
    await page.locator('#body-31 > .body-title .badge.badge-blue', { hasText: 'L3' }).click();

    const svg = page.locator('app-lagrange-dialog svg');
    await expect(page.locator('app-lagrange-dialog').getByRole('heading', { name: 'Lagrange points' })).toBeVisible();
    // The opposed pair is split across the orbit: one promoted to the secondary slot, the
    // other left on the L3 marker — so neither the placeholder secondary nor a stacked L3.
    await expect(svg).toContainText('B 3 a');
    await expect(svg).toContainText('B 3 b');
    await expect(svg).not.toContainText('secondary');
    // Two real bodies (secondary + L3); L1/L2/L4/L5 stay placeholders.
    await expect(svg.locator('circle.body')).toHaveCount(2);
    await expect(svg.locator('circle.placeholder')).toHaveCount(4);
    // The clicked body stays on the labelled L3 marker as the single highlighted one.
    await expect(svg.locator('circle.body.focus')).toHaveCount(1);
  });

  test('shows no Lagrange badge for a 180° binary orbiting a barycentre', async ({ page }) => {
    await loadFixtureSystem(page, CLOOMOO_BARYCENTRE_BINARY);

    // C (body 6) and D (body 7) are a 180° pair, but they orbit a barycentre — not a real
    // central body — so the detector suppresses any Lagrange status: no blue badge appears.
    for (const bodyId of [6, 7]) {
      const header = page.locator(`#body-${bodyId} > .body-title`);
      await expect(header, `#body-${bodyId} header should render`).toBeVisible();
      // Scope to Lagrange badge text — badge-blue is also used by Odyssey/Shepherd badges.
      await expect(
        header.locator('.badge.badge-blue').filter({ hasText: /^(L[1-5]|Host)$/ }),
        `#body-${bodyId} should carry no Trojan/Lagrange badge`,
      ).toHaveCount(0);
    }
    // With nothing to click, the diagram is never created.
    await expect(page.locator('app-lagrange-dialog')).toHaveCount(0);
  });

  test('badges a barycentre Trojan host but not the same system\'s 180° binaries', async ({ page }) => {
    await loadFixtureSystem(page, byName('Hyuqoae GH-V f2-368'));

    // AB 2 (body 13) hosts AB 3 / AB 4 at ±60° around barycentre 1 → it is badged Host, and
    // clicking opens the diagram centred on the barycentre as the primary.
    await page.locator('#body-13 > .body-title .badge.badge-blue', { hasText: 'Host' }).click();
    const svg = page.locator('app-lagrange-dialog svg');
    await expect(page.locator('app-lagrange-dialog').getByRole('heading', { name: 'Lagrange points' })).toBeVisible();
    await expect(svg).toContainText('AB 2');
    await expect(svg).toContainText('AB 3');
    await expect(svg).toContainText('AB 4');
    // The barycentre is the primary at the centre (system prefix stripped).
    await expect(svg).toContainText('barycentre 1');
    // Host + L4 + L5 are real bodies; L1/L2/L3 stay placeholders.
    await expect(svg.locator('circle.body')).toHaveCount(3);
    await expect(svg.locator('circle.placeholder')).toHaveCount(3);

    // The system's three 180° stellar pairs (A/B, AB 5/6, AB 7/8) sit at different radii, so
    // they are not co-orbital L-point candidates — they must carry no Trojan/Lagrange badge,
    // confirming the trojan fix above doesn't bleed onto a barycentre's other children.
    // (The same-radius 180° L3-suppression guard itself is exercised by the Cloomoo test.)
    for (const bodyId of [2, 3, 18, 19, 21, 22]) {
      const header = page.locator(`#body-${bodyId} > .body-title`);
      await expect(header, `#body-${bodyId} header should render`).toBeVisible();
      await expect(
        header.locator('.badge.badge-blue').filter({ hasText: /^(L[1-5]|Host)$/ }),
        `#body-${bodyId} should carry no Trojan/Lagrange badge`,
      ).toHaveCount(0);
    }
  });

  // Open the same AB 2/3/4 family from each member and confirm the diagram is identical —
  // host AB 2 always fills the secondary slot, AB 3/AB 4 stay on L4/L5 — with the focus
  // highlight tracking whichever body was clicked.
  for (const { bodyId, badge, name } of [
    { bodyId: 13, badge: 'Host', name: 'AB 2' },
    { bodyId: 15, badge: 'L4', name: 'AB 3' },
    { bodyId: 16, badge: 'L5', name: 'AB 4' },
  ] as const) {
    test(`opens the AB 2/3/4 barycentre Trojan diagram from ${name} (${badge})`, async ({ page }) => {
      await loadFixtureSystem(page, byName('Hyuqoae GH-V f2-368'));

      await page.locator(`#body-${bodyId} > .body-title .badge.badge-blue`, { hasText: badge }).click();

      const svg = page.locator('app-lagrange-dialog svg');
      await expect(page.locator('app-lagrange-dialog').getByRole('heading', { name: 'Lagrange points' })).toBeVisible();
      // Host AB 2 (secondary) + AB 3 (L4) + AB 4 (L5) are all drawn, around barycentre 1.
      await expect(svg).toContainText('AB 2');
      await expect(svg).toContainText('AB 3');
      await expect(svg).toContainText('AB 4');
      await expect(svg).toContainText('barycentre 1');
      // The host fills the secondary slot, so it is never a "secondary" placeholder caption.
      await expect(svg).not.toContainText('secondary');
      // Three real bodies (host + L4 + L5); L1/L2/L3 remain placeholders.
      await expect(svg.locator('circle.body')).toHaveCount(3);
      await expect(svg.locator('circle.placeholder')).toHaveCount(3);
      // Exactly the clicked body is highlighted.
      await expect(svg.locator('circle.body.focus')).toHaveCount(1);
    });
  }
});
