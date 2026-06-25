import { test } from '@playwright/test';
import { assertBody, loadFixtureSystem, type BodySpec } from './support/system-fixture';

/**
 * Deterministic, data-driven body-content tests for Alpha Centauri.
 *
 * These load the system from a saved biostats payload (`fixtures/alpha-centauri.json`,
 * the same data the live API returns) with the network stubbed, so the exact body
 * values are stable and can be asserted precisely — independent of live data drift.
 *
 * Each entry in {@link BODY_SPECS} is one body; the assertions live in
 * `support/system-fixture.ts`. To cover another body, add a spec. To cover another
 * system, drop its biostats JSON in `fixtures/` and reuse the same helpers.
 *
 * The star/planet values below were confirmed against the rendered app.
 */

const FIXTURE = { fixture: 'alpha-centauri.json', systemName: 'Alpha Centauri', id64: 1178708478315 };

const BODY_SPECS: BodySpec[] = [
  {
    bodyId: 2,
    name: 'Alpha Centauri (G star)',
    type: 'G (White-Yellow) Star',
    image: 'assets/bodies/stars/G.png',
    landable: false,
    sections: [
      {
        header: 'Orbit',
        rows: {
          'Orbital period': '2.56 decades',
          'Semi-major axis': '693,042,242.53 km',
          'Orbital eccentricity': '0.5179 Eccentric',
          Apoapsis: '1,051,968,819.93 km',
          // Day-count to the next apsis. Wall-clock-dependent, but deterministic because
          // the fixture loader pins `now` to 2026-06-14T00:00:00Z (see loadFixtureSystem).
          'Next apoapsis': '3,721.9 days',
          Periapsis: '334,115,665.12 km',
          'Next periapsis': '8,396.3 days',
          'Orbital inclination': '79.21°',
          'Argument of periapsis': '116.66°',
          'Ascending node': '-155.15°',
        },
        // The day-count above changes with `now`; the tooltip is the fixed event *date*
        // (now-independent). Timezone is pinned to UTC in playwright.config.ts, so
        // 2036-08-21 20:55 UTC (= 22:55 CEST) renders verbatim.
        tooltips: {
          'Next apoapsis': '2036-08-21 20:55',
          'Next periapsis': '2049-06-09 07:48',
        },
      },
      {
        header: 'Physical Properties',
        rows: {
          Radius: '1.10 R☉',
          Mass: '1.18 Solar masses',
          Density: '1.24 g/cm³',
          'Axial tilt': '10.05°',
          Age: '9440 million years',
        },
      },
      { header: 'Atmosphere & Environment', rows: { 'Surface Temperature': '6,557.00 K' } },
      { header: 'Dynamics', rows: { 'Rotational period': '4.16 days', 'Distance to arrival': '0.00 ls' } },
      {
        header: 'Stellar Properties',
        rows: { 'Spectral class': 'G2', 'Luminosity class': 'V', 'Absolute magnitude': '4.36' },
      },
    ],
  },
  {
    bodyId: 3,
    name: 'Alpha Centauri B (K star)',
    type: 'K (Yellow-Orange) Star',
    image: 'assets/bodies/stars/K.png',
    landable: false,
    sections: [
      {
        header: 'Orbit',
        rows: {
          'Orbital period': '2.56 decades',
          'Semi-major axis': '952,535,688.88 km',
          'Orbital eccentricity': '0.5179 Eccentric',
          Apoapsis: '1,445,853,922.15 km',
          Periapsis: '459,217,455.61 km',
          'Orbital inclination': '79.21°',
          'Argument of periapsis': '296.66°',
          'Ascending node': '-155.15°',
        },
      },
      {
        header: 'Physical Properties',
        rows: {
          Radius: '0.90 R☉',
          Mass: '0.86 Solar masses',
          Density: '1.63 g/cm³',
          'Axial tilt': '11.63°',
          Age: '9212 million years',
        },
      },
      { header: 'Atmosphere & Environment', rows: { 'Surface Temperature': '5,240.00 K' } },
      { header: 'Dynamics', rows: { 'Rotational period': '4.04 days', 'Distance to arrival': '4,202.75 ls' } },
      {
        header: 'Stellar Properties',
        rows: { 'Spectral class': 'K1', 'Luminosity class': 'V', 'Absolute magnitude': '5.72' },
      },
    ],
  },
  {
    bodyId: 5,
    name: 'Alpha Centauri B 1 (metal-rich body)',
    type: 'Metal-rich body',
    image: 'assets/bodies/planets/terrestrial/MRBv2.png',
    landable: true,
    signalIcons: ['Geology.svg'],
    materials: [
      { symbol: 'Fe', hover: 'Iron: 35.21%' },
      { symbol: 'Ni', hover: 'Nickel: 26.63%' },
      { symbol: 'Cr', hover: 'Chromium: 15.83%' },
      { symbol: 'Mn', hover: 'Manganese: 14.54%' },
      { symbol: 'Se', hover: 'Selenium: 2.49%' },
      { symbol: 'Sn', hover: 'Tin: 2.35%' },
      { symbol: 'W', hover: 'Tungsten: 1.93%' },
      { symbol: 'Po', hover: 'Polonium: 1.02%' },
    ],
    sections: [
      {
        header: 'Orbit',
        rows: {
          'Orbital period': '3.24 days',
          'Semi-major axis': '6,260,765.19 km',
          'Orbital eccentricity': '0.0000 Circular',
          'Orbital inclination': '0.05°',
          'Argument of periapsis': '4.95°',
        },
      },
      {
        header: 'Physical Properties',
        rows: {
          Radius: '4,314.73 km',
          Mass: '0.67 Earth masses',
          Gravity: '1.47 G',
          Density: '11,972.01 kg/m³',
          'Axial tilt': '-15.81°',
        },
      },
      {
        header: 'Atmosphere & Environment',
        rows: {
          'Average Surface Temperature': '1,080.86 K',
          'Min Surface Temperature Estimate': '665.10 K',
          'Max Surface Temperature Estimate': '4,443.94 K',
          Volcanism: 'Rocky Magma',
        },
      },
      { header: 'Dynamics', rows: { 'Rotational period': '3.38 days', 'Distance to arrival': '4,185.62 ls' } },
      {
        // Geological signals are intrinsic to the body (unlike human signal counts,
        // which come and go), so they're safe to assert.
        header: 'Geology',
        rows: { 'Total Signals': '3/2' },
        contains: ['Sulphur Dioxide Fumarole', 'Sulphur Dioxide Gas Vent', 'Silicate Vapour Gas Vent'],
      },
    ],
  },
  {
    bodyId: 7,
    name: 'Lagrange (Class I gas giant)',
    type: 'Class I gas giant',
    image: 'assets/bodies/planets/giant/GG1v17.png',
    landable: false,
    sections: [
      {
        header: 'Orbit',
        rows: {
          'Orbital period': '2.56 decades',
          'Semi-major axis': '1,431,006,133.56 km',
          'Orbital eccentricity': '0.5179 Eccentric',
          Apoapsis: '2,172,124,210.13 km',
          Periapsis: '689,888,056.99 km',
          'Argument of periapsis': '90.00°',
        },
      },
      {
        header: 'Physical Properties',
        rows: {
          Radius: '70,837.20 km',
          Mass: '301.24 Earth masses',
          Gravity: '2.44 G',
          Density: '1.21 g/cm³',
          'Axial tilt': '3.33°',
        },
      },
      { header: 'Atmosphere & Environment', rows: { 'Average Surface Temperature': '131.69 K' } },
      { header: 'Dynamics', rows: { 'Rotational period': '12.87 h', 'Distance to arrival': '4,060.79 ls' } },
    ],
  },
  {
    bodyId: 8,
    name: '2042 L1 (rocky body)',
    type: 'Rocky body',
    image: 'assets/bodies/planets/terrestrial/RBDv2.png',
    landable: true,
    materials: [
      { symbol: 'Fe', hover: 'Iron: 20.96%' },
      { symbol: 'S', hover: 'Sulphur: 17.26%' },
      { symbol: 'Ni', hover: 'Nickel: 15.85%' },
      { symbol: 'C', hover: 'Carbon: 14.51%' },
      { symbol: 'P', hover: 'Phosphorus: 9.29%' },
      { symbol: 'Mn', hover: 'Manganese: 8.65%' },
      { symbol: 'V', hover: 'Vanadium: 5.15%' },
      { symbol: 'Ge', hover: 'Germanium: 5.10%' },
      { symbol: 'Sn', hover: 'Tin: 1.34%' },
      { symbol: 'W', hover: 'Tungsten: 1.15%' },
      { symbol: 'Tc', hover: 'Technetium: 0.75%' },
    ],
    sections: [
      {
        header: 'Orbit',
        rows: {
          'Orbital period': '3.00 days',
          'Semi-major axis': '598,391.94 km',
          'Orbital eccentricity': '0.0030 Nearly Circular',
          'Orbital inclination': '82.50°',
        },
      },
      {
        header: 'Physical Properties',
        rows: { Radius: '684.21 km', Gravity: '0.09 G', Density: '4.45 g/cm³', 'Axial tilt': '20.98°' },
      },
      {
        header: 'Atmosphere & Environment',
        rows: {
          'Average Surface Temperature': '85.03 K',
          'Min Surface Temperature Estimate': '-34.53 K',
          'Max Surface Temperature Estimate': '211.08 K',
        },
      },
      { header: 'Dynamics', rows: { 'Rotational period': '3.07 days', 'Distance to arrival': '4,061.01 ls' } },
    ],
  },
  {
    bodyId: 10,
    name: 'Eden (high metal content world)',
    type: 'High metal content world',
    image: 'assets/bodies/planets/terrestrial/HMCv20.png',
    landable: false,
    sections: [
      {
        header: 'Orbit',
        rows: {
          'Orbital period': '4.43 weeks',
          'Semi-major axis': '1,495,979.73 km',
          'Orbital eccentricity': '0.0100 Nearly Circular',
          'Orbital inclination': '77.10°',
        },
      },
      {
        header: 'Physical Properties',
        rows: {
          Radius: '5,412.28 km',
          Mass: '0.66 Earth masses',
          Gravity: '0.92 G',
          Density: '5.94 g/cm³',
          'Axial tilt': '-12.23°',
        },
      },
      {
        header: 'Atmosphere & Environment',
        rows: {
          'Average Surface Temperature': '1,223.60 K',
          'Surface pressure': '2,213.29 atmospheres',
          Volcanism: 'Minor Metallic Magma',
        },
      },
      { header: 'Dynamics', rows: { 'Rotational period': '1.05 days', 'Distance to arrival': '0.20 ly' } },
    ],
  },
];

test.describe('Alpha Centauri bodies (fixture)', () => {
  test.beforeEach(async ({ page }) => {
    await loadFixtureSystem(page, FIXTURE);
  });

  for (const spec of BODY_SPECS) {
    test(`renders ${spec.name}`, async ({ page }) => {
      await assertBody(page, spec);
    });
  }
});
