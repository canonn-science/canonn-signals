import { test } from '@playwright/test';
import { assertBody, expectSystemRow, loadFixtureSystem, type BodySpec } from './support/system-fixture';

/**
 * Deterministic, data-driven body-content tests for Synuefe XR-H d11-102 — a
 * system with Guardian ruins. Loaded from a saved biostats payload
 * (`fixtures/synuefe-xr-h-d11-102.json`) with the network stubbed.
 *
 * The headline coverage is the Guardian signals (`1 b` and `1 b a`): the header
 * icon and the Guardian data panel listing catalogued Guardian sites. Reuses the
 * shared `assertBody` helpers — see `support/system-fixture.ts`.
 */

const FIXTURE = {
  fixture: 'synuefe-xr-h-d11-102.json',
  systemName: 'Synuefe XR-H d11-102',
  id64: 3515254557027,
};

const BODY_SPECS: BodySpec[] = [
  {
    bodyId: 0,
    name: 'Synuefe XR-H d11-102 (F star)',
    type: 'F (White) Star',
    image: 'assets/bodies/stars/F.png',
    landable: false,
    sections: [
      {
        header: 'Physical Properties',
        rows: {
          Radius: '1.31 R☉',
          Mass: '1.39 Solar masses',
          Density: '0.88 g/cm³',
          Age: '3600 million years',
        },
      },
      { header: 'Atmosphere & Environment', rows: { 'Surface Temperature': '6,914.00 K' } },
      { header: 'Dynamics', rows: { 'Rotational period': '2.81 days' } },
      {
        header: 'Stellar Properties',
        rows: { 'Spectral class': 'F3', 'Luminosity class': 'Vb', 'Absolute magnitude': '3.47' },
      },
    ],
  },
  {
    bodyId: 14,
    name: 'Synuefe XR-H d11-102 1 b a (Guardian signals)',
    type: 'Rocky body',
    image: 'assets/bodies/planets/terrestrial/RBDv1.png',
    landable: true,
    signalIcons: ['Geology.svg', 'Guardian.svg'],
    materials: [
      { symbol: 'S', hover: 'Sulphur: 19.79%' },
      { symbol: 'Fe', hover: 'Iron: 17.72%' },
      { symbol: 'C', hover: 'Carbon: 16.64%' },
      { symbol: 'Ni', hover: 'Nickel: 13.41%' },
      { symbol: 'P', hover: 'Phosphorus: 10.65%' },
      { symbol: 'Cr', hover: 'Chromium: 7.97%' },
      { symbol: 'Mn', hover: 'Manganese: 7.32%' },
      { symbol: 'As', hover: 'Arsenic: 2.61%' },
      { symbol: 'Te', hover: 'Tellurium: 1.51%' },
      { symbol: 'Nb', hover: 'Niobium: 1.21%' },
      { symbol: 'Mo', hover: 'Molybdenum: 1.16%' },
    ],
    sections: [
      {
        header: 'Physical Properties',
        rows: { Radius: '455.23 km', Gravity: '0.05 G', Density: '3.90 g/cm³', 'Axial tilt': '5.21°' },
      },
      {
        header: 'Atmosphere & Environment',
        rows: { 'Average Surface Temperature': '299.69 K', Volcanism: 'Major Silicate Vapour Geysers' },
      },
      { header: 'Dynamics', rows: { 'Rotational period': '7.01 h', 'Distance to arrival': '795.70 ls' } },
      {
        header: 'Geology',
        rows: { 'Total Signals': '3/3' },
        contains: ['Silicate Vapour Fumarole', 'Silicate Magma Lava Spout', 'Silicate Vapour Gas Vent'],
      },
      {
        // The Guardian signal — the reason this system is in the test suite.
        header: 'Guardian',
        rows: { 'Total Signals': '1/0' },
        contains: ['Guardian Codex'],
      },
    ],
  },
  {
    bodyId: 13,
    name: 'Synuefe XR-H d11-102 1 b (Guardian ruins)',
    type: 'Rocky body',
    image: 'assets/bodies/planets/terrestrial/RBDv1.png',
    landable: true,
    signalIcons: ['Guardian.svg'],
    sections: [
      {
        header: 'Guardian',
        rows: { 'Total Signals': '2/1' },
        contains: ['Guardian Codex', 'Guardian Relic Tower'],
      },
    ],
  },
];

test.describe('Synuefe XR-H d11-102 bodies (fixture)', () => {
  test.beforeEach(async ({ page }) => {
    await loadFixtureSystem(page, FIXTURE);
  });

  test('shows the system location (region & id64)', async ({ page }) => {
    await expectSystemRow(page, 'Region', 'Inner Orion Spur');
    await expectSystemRow(page, 'Id64', '3515254557027');
  });

  for (const spec of BODY_SPECS) {
    test(`renders ${spec.name}`, async ({ page }) => {
      await assertBody(page, spec);
    });
  }
});
