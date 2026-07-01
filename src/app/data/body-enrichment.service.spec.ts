import { TestBed } from '@angular/core/testing';
import { BodyEnrichmentService } from './body-enrichment.service';
import { CanonnBiostatsBody, SystemBody } from '../home/home.component';
import { BODY_TYPE } from './body-types';

const KM_PER_AU = 149597870.7;

/** A fixed epoch so every time-dependent value is reproducible. */
const NOW = Date.UTC(2026, 0, 1, 0, 0, 0);

function makeBody(bodyData: Partial<CanonnBiostatsBody>, parent: SystemBody | null = null): SystemBody {
  const node: SystemBody = {
    bodyData: { bodyId: 1, id64: 0n, name: 'Test', type: BODY_TYPE.Planet, subType: '', ...bodyData },
    subBodies: [],
    parent,
  };
  if (parent) { parent.subBodies.push(node); }
  return node;
}

describe('BodyEnrichmentService', () => {
  let service: BodyEnrichmentService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BodyEnrichmentService);
  });

  it('is created', () => {
    expect(service).toBeTruthy();
  });

  describe('orbit extents', () => {
    it('derives apoapsis/periapsis and eccentricity class from the Keplerian elements', () => {
      const body = makeBody({ semiMajorAxis: 1, orbitalEccentricity: 0.5 });
      const { orbit } = service.computeCalculatedValues(body, NOW);
      expect(orbit).not.toBeNull();
      expect(orbit!.semiMajorAxisKm).toBeCloseTo(KM_PER_AU, 3);
      expect(orbit!.apoapsisKm).toBeCloseTo(KM_PER_AU * 1.5, 3);
      expect(orbit!.periapsisKm).toBeCloseTo(KM_PER_AU * 0.5, 3);
      expect(orbit!.eccentricityClass).toBe('Eccentric');
    });

    it('classifies a circular orbit and returns null when no semi-major axis is present', () => {
      expect(service.computeCalculatedValues(makeBody({ semiMajorAxis: 2, orbitalEccentricity: 0 }), NOW).orbit!.eccentricityClass)
        .toBe('Circular');
      expect(service.computeCalculatedValues(makeBody({}), NOW).orbit).toBeNull();
    });
  });

  describe('time-dependent values', () => {
    it('echoes the supplied epoch as computedAt and computes the next apsis relative to it', () => {
      const body = makeBody({
        semiMajorAxis: 1,
        orbitalEccentricity: 0.3,
        orbitalPeriod: 100,
        meanAnomaly: 0,
        timestamps: { distanceToArrival: '', meanAnomaly: new Date(NOW).toISOString() },
      });
      const calc = service.computeCalculatedValues(body, NOW);
      expect(calc.computedAt).toBe(new Date(NOW).toISOString());
      // meanAnomaly 0 at NOW → apoapsis (180°) is half a period (50 days) away.
      expect(calc.nextApoapsis).not.toBeNull();
      expect(calc.nextApoapsis!.days).toBeCloseTo(50, 6);
    });

    it('returns null apsides when the orbital timing data is missing', () => {
      const calc = service.computeCalculatedValues(makeBody({ semiMajorAxis: 1, orbitalEccentricity: 0.3 }), NOW);
      expect(calc.nextApoapsis).toBeNull();
      expect(calc.nextPeriapsis).toBeNull();
    });
  });

  describe('gated stellar values', () => {
    it('classifies a neutron star and reports compact-object radius, tangential velocity and Schwarzschild radius', () => {
      const ns = makeBody({
        type: BODY_TYPE.Star,
        subType: 'Neutron Star',
        solarMasses: 1.5,
        solarRadius: 0.00002,
        rotationalPeriod: 1e-7, // ~8.6 ms spin period → sub-0.01s "Millisecond Pulsar" band
        absoluteMagnitude: 12,
      });
      const calc = service.computeCalculatedValues(ns, NOW);
      expect(calc.neutronStarClass).toBe('Millisecond Pulsar');
      expect(calc.schwarzschildRadiusKm).toBeGreaterThan(0);
      expect(calc.compactObjectRadiusKm).toBeGreaterThan(0);
      expect(calc.tangentialVelocityKms).toBeGreaterThan(0);
    });

    it('leaves compact-object fields null for an ordinary planet', () => {
      const calc = service.computeCalculatedValues(makeBody({ subType: 'High metal content world' }), NOW);
      expect(calc.neutronStarClass).toBeNull();
      expect(calc.schwarzschildRadiusKm).toBeNull();
      expect(calc.compactObjectRadiusKm).toBeNull();
      expect(calc.tangentialVelocityKms).toBeNull();
    });

    it('flags a super-Chandrasekhar white dwarf via massStability', () => {
      const wd = makeBody({ type: BODY_TYPE.Star, subType: 'White Dwarf (DA)', solarMasses: 1.6 });
      expect(service.computeCalculatedValues(wd, NOW).massStability?.severity).toBe('danger');
    });
  });

  describe('spin resonance', () => {
    it('reports a simple resonance and maps "none" to null', () => {
      expect(service.computeCalculatedValues(makeBody({ rotationalPeriod: 10, orbitalPeriod: 10 }), NOW).spinResonance)
        .toBe('1:1');
      expect(service.computeCalculatedValues(makeBody({ rotationalPeriod: 1, orbitalPeriod: 7.13 }), NOW).spinResonance)
        .toBeNull();
    });
  });

  describe('temperature', () => {
    it('estimates an on-foot temperature range with its lookup source', () => {
      const calc = service.computeCalculatedValues(makeBody({ subType: 'High metal content world', surfaceTemperature: 300 }), NOW);
      expect(calc.temperature).not.toBeNull();
      expect(calc.temperature!.minK).toBeLessThan(calc.temperature!.maxK);
      expect(typeof calc.temperature!.source).toBe('string');
    });

    it('returns null temperature when no surface temperature is recorded', () => {
      expect(service.computeCalculatedValues(makeBody({ subType: 'Icy body' }), NOW).temperature).toBeNull();
    });
  });

  describe('ring geometry', () => {
    it('derives width, area, density, Roche limits and dynamics for a ring', () => {
      const parent = makeBody({ type: BODY_TYPE.Planet, radius: 60000, earthMasses: 95 });
      const ring = makeBody({
        type: BODY_TYPE.Ring,
        subType: 'Icy',
        innerRadius: 70000,
        outerRadius: 140000,
        mass: 1e18,
      }, parent);
      const { ring: r } = service.computeCalculatedValues(ring, NOW);
      expect(r).not.toBeNull();
      expect(r!.widthKm).toBeCloseTo(70000, 3);
      expect(r!.areaKm2).toBeCloseTo(Math.PI * (140000 ** 2 - 70000 ** 2), 0);
      expect(r!.dynamics).not.toBeNull();
      expect(r!.rigidRocheLimitKm).toBeGreaterThan(0);
      expect(r!.invisible).toBe(false);
    });

    it('leaves ring null for a non-ring body', () => {
      expect(service.computeCalculatedValues(makeBody({ subType: 'Icy body' }), NOW).ring).toBeNull();
    });
  });

  describe('shepherding', () => {
    it('reports shepherding analysis for a moon orbiting within its parent\'s rings', () => {
      // Parent planet (60 000 km radius) with a ring system out to 200 000 km, and a moon
      // orbiting at ~150 000 km — inside the rings, so it is a shepherding candidate.
      const parent = makeBody({
        type: BODY_TYPE.Planet, radius: 60000, earthMasses: 95,
        rings: [{ name: 'A Ring', innerRadius: 70_000_000, outerRadius: 200_000_000, mass: 1e18, type: 'Icy' }],
      });
      const moon = makeBody({
        type: BODY_TYPE.Planet, subType: 'Icy body', semiMajorAxis: 0.001, earthMasses: 0.01, radius: 1500,
      }, parent);
      const { shepherding } = service.computeCalculatedValues(moon, NOW);
      expect(shepherding).not.toBeNull();
      expect(shepherding!.isCandidate).toBe(true);
      expect(shepherding!.withinParentRings).toBe(true);
      expect(typeof shepherding!.isShepherd).toBe('boolean');
    });

    it('leaves shepherding null for a body with no ringed parent', () => {
      expect(service.computeCalculatedValues(makeBody({ semiMajorAxis: 1 }), NOW).shepherding).toBeNull();
    });
  });

  describe('enrichBody', () => {
    it('attaches calculated without mutating the raw body and preserves raw fields', () => {
      const body = makeBody({ bodyId: 7, name: 'Sol 3', subType: 'Earth-like world', semiMajorAxis: 1, orbitalEccentricity: 0.02 });
      const enriched = service.enrichBody(body, NOW);
      expect(enriched.name).toBe('Sol 3');
      expect(enriched.bodyId).toBe(7);
      expect(enriched.calculated).toBeTruthy();
      expect(enriched.calculated.orbit!.eccentricityClass).toBe('Nearly Circular');
      // The original body data must be untouched (no `calculated` key leaked onto it).
      expect('calculated' in body.bodyData).toBe(false);
    });
  });

  describe('determinism', () => {
    it('produces identical output for identical inputs and epoch', () => {
      const build = () => makeBody({
        type: BODY_TYPE.Star, subType: 'Neutron Star', solarMasses: 1.5,
        solarRadius: 0.00002, rotationalPeriod: 0.5, absoluteMagnitude: 12,
      });
      expect(service.computeCalculatedValues(build(), NOW)).toEqual(service.computeCalculatedValues(build(), NOW));
    });
  });
});
