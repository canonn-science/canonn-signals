import { test } from '@playwright/test';
import { assertBody, expectSystemRow, loadFixtureSystem, type BodySpec } from './support/system-fixture';

/**
 * Deterministic, data-driven body-content tests for Merope — a famous Thargoid
 * hotspot in the Pleiades. Loaded from a saved biostats payload
 * (`fixtures/merope.json`) with the network stubbed, so values are stable.
 *
 * The headline coverage here is the Thargoid signals (`Merope 1 a`): the header
 * icon and the Thargoid data panel with its catalogued signal. Reuses the shared
 * `assertBody` helpers — see `support/system-fixture.ts`.
 */

const FIXTURE = { fixture: 'merope.json', systemName: 'Merope', id64: 224644818084 };

const BODY_SPECS: BodySpec[] = [
  {
    bodyId: 0,
    name: 'Merope (B star)',
    type: 'B (Blue-White) Star',
    image: 'assets/bodies/stars/B.png',
    landable: false,
    sections: [
      {
        header: 'Physical Properties',
        rows: {
          'Solar radius': '3.03',
          'Solar masses': '5.25',
          Density: '0.27 g/cm³',
          Age: '774 million years',
        },
      },
      { header: 'Atmosphere & Environment', rows: { 'Surface Temperature': '17,620.00 K' } },
      { header: 'Dynamics', rows: { 'Rotational period': '23.68 h' } },
      {
        header: 'Stellar Properties',
        rows: { 'Spectral class': 'B7', 'Luminosity class': 'IV', 'Absolute magnitude': '-0.95' },
      },
    ],
  },
  {
    bodyId: 15,
    name: 'Merope 1 a (Thargoid signals)',
    type: 'Rocky body',
    image: 'assets/bodies/planets/terrestrial/RBDv4.png',
    landable: true,
    signalIcons: ['Geology.svg', 'Thargoid.svg'],
    materials: [
      { symbol: 'Fe', hover: 'Iron: 19.41%' },
      { symbol: 'S', hover: 'Sulphur: 18.88%' },
      { symbol: 'C', hover: 'Carbon: 15.88%' },
      { symbol: 'Ni', hover: 'Nickel: 14.68%' },
      { symbol: 'P', hover: 'Phosphorus: 10.16%' },
      { symbol: 'Cr', hover: 'Chromium: 8.73%' },
      { symbol: 'Zn', hover: 'Zinc: 5.28%' },
      { symbol: 'Se', hover: 'Selenium: 2.95%' },
      { symbol: 'Cd', hover: 'Cadmium: 1.51%' },
      { symbol: 'Nb', hover: 'Niobium: 1.33%' },
      { symbol: 'Sb', hover: 'Antimony: 1.19%' },
    ],
    sections: [
      {
        header: 'Orbit',
        rows: {
          'Orbital period': '20.08 h',
          'Semi-major axis': '3,709.87 km',
          'Orbital eccentricity': '0.1770 Nearly Circular',
          'Orbital inclination': '-2.90°',
        },
      },
      {
        header: 'Physical Properties',
        rows: { Radius: '1,159.05 km', Gravity: '0.14 G', Density: '4.15 g/cm³', 'Axial tilt': '2.42°' },
      },
      {
        header: 'Atmosphere & Environment',
        rows: { 'Average Surface Temperature': '484.73 K', Volcanism: 'Minor Metallic Magma' },
      },
      { header: 'Dynamics', rows: { 'Rotational period': '1.21 days', 'Distance to arrival': '2,108.23 ls' } },
      {
        header: 'Geology',
        rows: { 'Total Signals': '3/3' },
        contains: ['Sulphur Dioxide Fumarole', 'Iron Magma Lava Spout', 'Sulphur Dioxide Gas Vent'],
      },
      {
        // The Thargoid signal — the reason this system is in the test suite.
        header: 'Thargoid',
        rows: { 'Total Signals': '1/8' },
        contains: ['Thargoid Interceptor Shipwreck'],
      },
    ],
  },
];

test.describe('Merope bodies (fixture)', () => {
  test.beforeEach(async ({ page }) => {
    await loadFixtureSystem(page, FIXTURE);
  });

  test('shows the system location (region & id64)', async ({ page }) => {
    await expectSystemRow(page, 'Region', 'Inner Orion Spur');
    await expectSystemRow(page, 'Id64', '224644818084');
  });

  for (const spec of BODY_SPECS) {
    test(`renders ${spec.name}`, async ({ page }) => {
      await assertBody(page, spec);
    });
  }
});
