import { expect, type Page, type Locator } from '@playwright/test';
import * as path from 'path';

/**
 * Reusable helpers for deterministic, offline system-content tests.
 *
 * Instead of hitting the live Canonn/Spansh/EDAstro APIs, a test supplies a saved
 * biostats payload (the same shape the app fetches) from `e2e/fixtures/`, and these
 * helpers stub the network so the app renders that exact system. Body assertions are
 * data-driven via {@link BodySpec}, so covering a new body — or a whole new system —
 * is just more data, not more code.
 */

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');

/** One data panel within a body (e.g. "Orbit"), and the values to check in it. */
export interface SectionSpec {
  header: string;
  /**
   * Label → exact rendered value (asserted as the value *for* that label). Each
   * label must be unique within its section — the row is matched by label, so two
   * rows sharing a label (rare, e.g. a body with both `earthMasses` and `mass`
   * shown as "Mass") would make the match ambiguous.
   */
  rows?: Record<string, string>;
  /**
   * Label → exact tooltip text on that row's value cell. Use for values whose visible
   * text is wall-clock-dependent (e.g. "Next apoapsis" shows a drifting day-count, but
   * its tooltip is the fixed event date). Asserted by hovering the value cell.
   */
  tooltips?: Record<string, string>;
  /** Free text expected somewhere in the section (e.g. listed signal names). */
  contains?: string[];
}

/** The expected content of a single body, addressed by its stable DOM id. */
export interface BodySpec {
  /** `bodyId` from the fixture → DOM id `#body-<bodyId>`. */
  bodyId: number;
  /** Human label for the test title. */
  name: string;
  /** Classification text shown in the header (e.g. "G (White-Yellow) Star"). */
  type: string;
  /** Exact body image asset path (e.g. "assets/bodies/stars/G.png"). */
  image: string;
  /** Whether the on-foot footprint badge is expected in the header. */
  landable?: boolean;
  /** Signal-type icon filenames expected in the header (e.g. "Geology.svg"). */
  signalIcons?: string[];
  /**
   * Element composition badges, in the order they render (highest % first). Each
   * badge shows its symbol by default and the full "Name: NN.NN%" on hover; both
   * are asserted, and the badge count is checked against this list's length.
   */
  materials?: { symbol: string; hover: string }[];
  /** Data panels and their values. */
  sections: SectionSpec[];
}

export interface FixtureOptions {
  /** Filename under `e2e/fixtures/` holding the biostats payload. */
  fixture: string;
  /** System name to type into the search box. */
  systemName: string;
  /** The system's id64 (returned by the stubbed typeahead). */
  id64: number;
}

/**
 * Stubs the remote APIs to serve a local biostats fixture, then searches for the
 * system and waits for it to render. Only the biostats + typeahead responses carry
 * data; the enrichment endpoints (codex/simbad/gnosis/edastro) return empty so the
 * render is fully offline and deterministic.
 *
 * The edastro stub matches the dev-server proxy path (`/api/edastro/**`), which is
 * what the app requests in development (the mode the Playwright webServer runs). A
 * production build would call `edastro.com` directly and bypass this stub.
 */
export async function loadFixtureSystem(page: Page, opts: FixtureOptions): Promise<void> {
  const fixturePath = path.join(FIXTURES_DIR, opts.fixture);

  await page.route('**/query/codex/biostats*', (route) => route.fulfill({ path: fixturePath }));
  await page.route('**/query/typeahead*', (route) =>
    route.fulfill({ json: { min_max: [{ name: opts.systemName, id64: opts.id64 }] } }),
  );
  await page.route('**/query/codex/ref*', (route) => route.fulfill({ json: {} }));
  await page.route('**/query/simbad*', (route) => route.fulfill({ json: {} }));
  await page.route('**/query/gnosis*', (route) => route.fulfill({ json: {} }));
  await page.route('**/api/edastro/**', (route) => route.fulfill({ json: [] }));

  // Pin "now" so wall-clock-dependent values are deterministic: the "Next apoapsis/
  // periapsis" day-counts (asserted directly) and the event-date tooltips (now-independent,
  // but pinning also guards the far-future rollover once real time passes an apsis).
  // setFixedTime pins Date.now()/new Date() but keeps timers running, so the app's
  // setTimeout-driven logic (marker scaling, etc.) still works.
  await page.clock.setFixedTime(new Date('2026-06-14T00:00:00Z'));

  await page.goto('/');
  await page.getByRole('combobox').fill(opts.systemName);
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByText(opts.systemName, { exact: true }).first()).toBeVisible({ timeout: 30_000 });
}

/**
 * Asserts a labelled row in the system info panel holds the expected value — i.e.
 * that `value` is the value *for* `label`, not merely present on the page.
 */
export async function expectSystemRow(page: Page, label: string, value: string | RegExp): Promise<void> {
  const row = page.locator('.system-data-entry').filter({ has: page.getByText(label, { exact: true }) });
  await expect(row, `system info should have exactly one "${label}" row`).toHaveCount(1);
  await expect(row.locator('> div').last()).toHaveText(value);
}

/** A body's own header (direct child — not a nested child body's header). */
function ownHeader(page: Page, bodyId: number): Locator {
  return page.locator(`#body-${bodyId} > .body-title`);
}

/** A body's own expanded detail panel (excludes nested child bodies). */
function ownContent(page: Page, bodyId: number): Locator {
  return page.locator(`#body-${bodyId} > .system-body-grow`);
}

/**
 * The value cell (`> div`, last) of a labelled data row within a body's own detail
 * panel. The body must already be expanded ({@link ensureBodyExpanded}).
 */
export function bodyRowValue(page: Page, bodyId: number, label: string): Locator {
  return ownContent(page, bodyId)
    .locator('.body-data-entry')
    .filter({ has: page.getByText(label, { exact: true }) })
    .locator('> div')
    .last();
}

/**
 * Asserts the degeneracy-limit warning (⚠) on a star's "Solar masses" row is present
 * or absent, and — when present and an `tooltip` is given — that hovering it shows that
 * text. Tooltip comparison is whitespace-normalised, so the message's embedded newline
 * is matched as a single space.
 */
export async function expectMassStabilityWarning(
  page: Page,
  bodyId: number,
  opts: { present: boolean; tooltip?: string },
): Promise<void> {
  const warning = bodyRowValue(page, bodyId, 'Solar masses').locator('.status-danger');
  await expect(warning, `#body-${bodyId} mass-stability warning presence`).toHaveCount(opts.present ? 1 : 0);

  if (opts.present && opts.tooltip) {
    await warning.scrollIntoViewIfNeeded();
    await warning.hover();
    await expect(page.locator('.mat-mdc-tooltip-show'), `#body-${bodyId} mass-warning tooltip`)
      .toHaveText(opts.tooltip);
    // Move away so the next hover's tooltip is unambiguous.
    await page.mouse.move(0, 0);
    await expect(page.locator('.mat-mdc-tooltip-show')).toHaveCount(0);
  }
}

/** Expands a body's detail panel if it isn't already open. */
export async function ensureBodyExpanded(page: Page, bodyId: number): Promise<void> {
  const expand = ownHeader(page, bodyId).getByLabel('Expand body details');
  if ((await expand.count()) > 0 && (await expand.first().isVisible())) {
    await expand.first().click();
  }
  await expect(ownContent(page, bodyId)).toBeVisible();
}

/**
 * Asserts a body matches its {@link BodySpec}: classification, landable/signal icons,
 * chemical-composition badges, image (present and decoded) and every data panel/row.
 * Everything is scoped to the body's *own* DOM, so nested child bodies never bleed in.
 */
export async function assertBody(page: Page, spec: BodySpec): Promise<void> {
  const header = ownHeader(page, spec.bodyId);
  await expect(header, `#body-${spec.bodyId} should exist`).toBeVisible();
  await expect(header, `body "${spec.name}" classification`).toContainText(spec.type);

  if (spec.landable !== undefined) {
    await expect(
      header.locator('img[src*="footprint.svg"]'),
      `body "${spec.name}" landable footprint`,
    ).toHaveCount(spec.landable ? 1 : 0);
  }

  for (const icon of spec.signalIcons ?? []) {
    await expect(
      header.locator(`img[src*="${icon}"]`),
      `body "${spec.name}" should show the ${icon} signal icon`,
    ).toBeVisible();
  }

  if (spec.materials) {
    const badges = header.locator('.materials-badges .badge');
    await expect(badges, `body "${spec.name}" material badge count`).toHaveCount(spec.materials.length);
    for (let i = 0; i < spec.materials.length; i++) {
      const badge = badges.nth(i);
      const { symbol, hover } = spec.materials[i];
      // Default state shows the element symbol…
      await expect(badge, `body "${spec.name}" material[${i}] symbol`).toHaveText(symbol);
      // …and hovering reveals the full name with its composition percentage.
      // Dispatch mouseenter directly rather than a physical hover: expanding the
      // badge text reflows the wrapped badge row, which moves a real cursor off a
      // narrow-viewport target (flaky on Firefox). The dispatched event is exactly
      // what the component's (mouseenter) binding listens for.
      await badge.dispatchEvent('mouseenter');
      await expect(badge, `body "${spec.name}" material[${i}] hover %`).toHaveText(hover);
      // No explicit reset needed: hovering the next badge moves the highlight, so
      // this badge reverts to its symbol on its own.
    }
  }

  await ensureBodyExpanded(page, spec.bodyId);
  const content = ownContent(page, spec.bodyId);

  // The planet/star image: present, the expected asset, and actually decoded.
  const img = content.locator('.body-image img').last();
  await img.scrollIntoViewIfNeeded();
  await expect(img, `body "${spec.name}" image`).toBeVisible();
  await expect(img).toHaveAttribute('src', spec.image);
  await expect
    .poll(async () => img.evaluate((el: HTMLImageElement) => el.naturalWidth), { timeout: 10_000 })
    .toBeGreaterThan(0);

  for (const section of spec.sections) {
    const panel = content
      .locator('.body-data-columns > .body-data-section')
      .filter({ has: page.getByText(section.header, { exact: true }) });
    await expect(panel, `body "${spec.name}" should have a "${section.header}" panel`).toHaveCount(1);

    for (const [label, value] of Object.entries(section.rows ?? {})) {
      const row = panel.locator('.body-data-entry').filter({ has: page.getByText(label, { exact: true }) });
      await expect(row.locator('> div').last(), `${spec.name} › ${section.header} › ${label}`).toHaveText(value);
    }
    for (const [label, tooltip] of Object.entries(section.tooltips ?? {})) {
      const valueCell = panel
        .locator('.body-data-entry')
        .filter({ has: page.getByText(label, { exact: true }) })
        .locator('> div')
        .last();
      await valueCell.scrollIntoViewIfNeeded();
      await valueCell.hover();
      // Scope to the *shown* tooltip — Material keeps hidden tooltips in the DOM
      // (toggling -show/-hide classes), so `.mat-mdc-tooltip` alone is ambiguous.
      await expect(
        page.locator('.mat-mdc-tooltip-show'),
        `${spec.name} › ${section.header} › ${label} tooltip`,
      ).toHaveText(tooltip);
      // Move away and wait for it to hide so the next hover's tooltip is unambiguous.
      await page.mouse.move(0, 0);
      await expect(page.locator('.mat-mdc-tooltip-show')).toHaveCount(0);
    }
    for (const text of section.contains ?? []) {
      await expect(panel, `${spec.name} › ${section.header} should mention "${text}"`).toContainText(text);
    }
  }
}
