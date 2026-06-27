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
 * (`fixtures/compact-object-limits.json`) holding six compact objects so each limit
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
  'Anomalous mass — exceeds the Chandrasekhar limit (1.44 M☉). ' +
  'Electron degeneracy pressure is not expected to support a white dwarf this heavy, ' +
  'which would normally trigger gravitational collapse or a Type Ia supernova.';

const TOV_TOOLTIP =
  'Anomalous mass — exceeds the theoretical Tolman–Oppenheimer–Volkoff limit (2.17 M☉). ' +
  'Beyond this, neutron degeneracy pressure is not expected to support the star.';

const OBSERVED_MAX_TOOLTIP =
  'Highly anomalous mass — exceeds the observed maximum neutron-star mass (2.51 M☉). ' +
  'Beyond this point a star would normally be expected to collapse into a black hole.';

test.describe('Compact-object stability limits (fixture)', () => {
  test.beforeEach(async ({ page }) => {
    await loadFixtureSystem(page, FIXTURE);
  });

  test('white dwarf above the Chandrasekhar limit (1.45 M☉) shows the warning', async ({ page }) => {
    await ensureBodyExpanded(page, 0);
    await expect(bodyRowValue(page, 0, 'Solar masses')).toContainText('1.45');
    await expectMassStabilityWarning(page, 0, { present: true, tooltip: CHANDRASEKHAR_TOOLTIP, severity: 'danger' });
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

  test("Jackson's Lighthouse — neutron star above the observed maximum (13.48 M☉) shows the danger warning", async ({ page }) => {
    await ensureBodyExpanded(page, 3);
    await expect(bodyRowValue(page, 3, 'Solar masses')).toContainText('13.48');
    await expectMassStabilityWarning(page, 3, { present: true, tooltip: OBSERVED_MAX_TOOLTIP, severity: 'danger' });
  });

  test('Sifoae WV-C d13-1 — neutron star below the TOV limit (0.81 M☉) has no warning', async ({ page }) => {
    await ensureBodyExpanded(page, 4);
    await expect(bodyRowValue(page, 4, 'Solar masses')).toContainText('0.81');
    await expectMassStabilityWarning(page, 4, { present: false });
  });

  test('Super-TOV Neutron Star — between the theoretical and observed limits (2.35 M☉) shows the amber warning', async ({ page }) => {
    await ensureBodyExpanded(page, 5);
    await expect(bodyRowValue(page, 5, 'Solar masses')).toContainText('2.35');
    await expectMassStabilityWarning(page, 5, { present: true, tooltip: TOV_TOOLTIP, severity: 'warning' });
  });
});
