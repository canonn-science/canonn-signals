import { test, expect } from '@playwright/test';
import {
  bodyRowValue,
  ensureBodyExpanded,
  expectMassStabilityWarning,
  loadFixtureSystem,
} from './support/system-fixture';

/**
 * Deterministic tests for the degenerate-matter stability warnings (Chandrasekhar /
 * TOV) and the black-hole Schwarzschild radius, loaded from a fixture
 * (`fixtures/compact-object-limits.json`) holding five compact objects so each limit
 * boundary is exercised in one offline page load.
 *
 * LAWD 96, Clooku BA-A f81, Jackson's Lighthouse and Sifoae WV-C d13-1 A carry their
 * actual values from the Spansh bodies API. The Chandrasekhar case is necessarily
 * synthetic — no real white dwarf exists above the limit — so it uses the real
 * LP 458-64 (DQ) parameters with its mass raised to 1.45 M☉ to trip the warning.
 */

const FIXTURE = {
  fixture: 'compact-object-limits.json',
  systemName: 'Compact Object Limits',
  id64: 9100000000001,
};

// Whitespace-normalised (the message's embedded newline is matched as a single space).
const CHANDRASEKHAR_TOOLTIP =
  'Exceeds Chandrasekhar limit (1.44 M☉). ' +
  'Electron degeneracy pressure can no longer support the star against gravity, ' +
  'leading to gravitational collapse or a Type Ia supernova.';

const TOV_TOOLTIP =
  'Exceeds Tolman–Oppenheimer–Volkoff limit. ' +
  'Above the TOV limit (2.17 solar masses), neutron degeneracy pressure can no longer ' +
  'support the star against gravity, and it collapses into a black hole.';

test.describe('Compact-object stability limits (fixture)', () => {
  test.beforeEach(async ({ page }) => {
    await loadFixtureSystem(page, FIXTURE);
  });

  test('white dwarf above the Chandrasekhar limit (1.45 M☉) shows the warning', async ({ page }) => {
    await ensureBodyExpanded(page, 0);
    await expect(bodyRowValue(page, 0, 'Solar masses')).toContainText('1.45');
    await expectMassStabilityWarning(page, 0, { present: true, tooltip: CHANDRASEKHAR_TOOLTIP });
  });

  test('LAWD 96 — white dwarf below the Chandrasekhar limit (1.26 M☉) has no warning', async ({ page }) => {
    await ensureBodyExpanded(page, 1);
    await expect(bodyRowValue(page, 1, 'Solar masses')).toContainText('1.26');
    await expectMassStabilityWarning(page, 1, { present: false });
  });

  test('Clooku BA-A f81 — black hole (4.52 M☉) shows its Schwarzschild radius and no limit warning', async ({ page }) => {
    await ensureBodyExpanded(page, 2);
    await expect(bodyRowValue(page, 2, 'Solar masses')).toContainText('4.52');
    // r_s = 2GM/c² for 4.52 M☉ ≈ 13.35 km.
    await expect(bodyRowValue(page, 2, 'Schwarzschild radius')).toHaveText('13.35 km');
    await expectMassStabilityWarning(page, 2, { present: false });
  });

  test("Jackson's Lighthouse — neutron star above the TOV limit (13.48 M☉) shows the warning", async ({ page }) => {
    await ensureBodyExpanded(page, 3);
    await expect(bodyRowValue(page, 3, 'Solar masses')).toContainText('13.48');
    await expectMassStabilityWarning(page, 3, { present: true, tooltip: TOV_TOOLTIP });
  });

  test('Sifoae WV-C d13-1 — neutron star below the TOV limit (0.81 M☉) has no warning', async ({ page }) => {
    await ensureBodyExpanded(page, 4);
    await expect(bodyRowValue(page, 4, 'Solar masses')).toContainText('0.81');
    await expectMassStabilityWarning(page, 4, { present: false });
  });
});
