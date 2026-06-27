import { BodyPhysicsService } from './body-physics.service';
import { CanonnBiostatsBody, SystemBody } from '../home/home.component';

const KM_PER_AU = 149597870.7;

function body(data: Partial<CanonnBiostatsBody>, parent: SystemBody | null = null): SystemBody {
  return { bodyData: data as CanonnBiostatsBody, subBodies: [], parent };
}

describe('BodyPhysicsService', () => {
  let service: BodyPhysicsService;

  beforeEach(() => {
    service = new BodyPhysicsService();
  });

  describe('getPlanetaryDensity', () => {
    it('computes Earth bulk density in g/cm³', () => {
      const result = service.getPlanetaryDensity({ earthMasses: 1, radius: 6371 } as CanonnBiostatsBody)!;
      expect(result.unit).toBe('g/cm³');
      expect(result.value).toBeCloseTo(5.51, 1);
    });

    it('switches to kg/m³ for extreme densities', () => {
      // A neutron-star-like density: heavy and tiny.
      const result = service.getPlanetaryDensity({ solarMasses: 1.4, radius: 12 } as CanonnBiostatsBody)!;
      expect(result.unit).toBe('kg/m³');
    });

    it('returns null without mass or radius', () => {
      expect(service.getPlanetaryDensity({ radius: 6371 } as CanonnBiostatsBody)).toBeNull();
      expect(service.getPlanetaryDensity({ earthMasses: 1 } as CanonnBiostatsBody)).toBeNull();
    });
  });

  describe('Roche limits', () => {
    const parent = body({ earthMasses: 100, radius: 50000 });

    it('returns null when the body has no parent', () => {
      expect(service.calculateRigidRocheLimit(body({ subType: 'Icy' }))).toBeNull();
      expect(service.calculateFluidRocheLimit(body({ subType: 'Icy' }))).toBeNull();
    });

    it('relates rigid and fluid limits by their coefficient ratio', () => {
      const ring = body({ subType: 'Icy ring' }, parent);
      const rigid = service.calculateRigidRocheLimit(ring)!;
      const fluid = service.calculateFluidRocheLimit(ring)!;
      expect(rigid).toBeGreaterThan(0);
      expect(fluid / rigid).toBeCloseTo(2.456 / 1.26, 5);
    });

    it('gives metal rings a smaller Roche limit than icy rings (denser satellite)', () => {
      const icy = service.calculateRigidRocheLimit(body({ subType: 'Icy' }, parent))!;
      const metal = service.calculateRigidRocheLimit(body({ subType: 'Metal Rich' }, parent))!;
      expect(metal).toBeLessThan(icy);
    });

    it('computes body Roche limits with orbit extents', () => {
      const moon = body(
        { type: 'Planet', earthMasses: 0.01, radius: 1500, semiMajorAxis: 0.001, orbitalEccentricity: 0.1 },
        parent,
      );
      const limits = service.calculateBodyRocheLimits(moon)!;
      expect(limits.rigid).toBeLessThan(limits.fluid);
      expect(limits.currentDistance).toBeCloseTo(0.001 * KM_PER_AU, 3);
      expect(limits.periapsis).toBeCloseTo(0.001 * KM_PER_AU * 0.9, 3);
      expect(limits.apoapsis).toBeCloseTo(0.001 * KM_PER_AU * 1.1, 3);
    });

    it('does not compute body Roche limits for rings or stars', () => {
      expect(service.calculateBodyRocheLimits(body({ type: 'Ring' }, parent))).toBeNull();
      expect(service.calculateBodyRocheLimits(body({ type: 'Star' }, parent))).toBeNull();
    });
  });

  describe('shepherding / rings', () => {
    it('is not a shepherding candidate when the parent has no rings', () => {
      const parent = body({ earthMasses: 100, radius: 50000 });
      const moon = body({ type: 'Planet', semiMajorAxis: 0.01, earthMasses: 0.1 }, parent);
      expect(service.isShepherdingCandidate(moon)).toBe(false);
      expect(service.calculateShepherdingHillLimit(moon)).toBeNull();
      expect(service.isActualShepherd(moon)).toBe(false);
    });

    it('flags a body orbiting within the ring system as a candidate', () => {
      // Ring outer radius 100,000 km -> stored in metres.
      const parent = body({ earthMasses: 100, radius: 10000, rings: [{ outerRadius: 100_000_000 } as any] });
      const moonDistanceAu = 50000 / KM_PER_AU; // 50,000 km, inside the rings
      const moon = body({ type: 'Planet', semiMajorAxis: moonDistanceAu, earthMasses: 0.1 }, parent);
      expect(service.isShepherdingCandidate(moon)).toBe(true);
    });
  });

  describe('rocheExcess', () => {
    it('returns null for a body safely outside its Roche limit', () => {
      const parent = body({ earthMasses: 100, radius: 50000 });
      const moon = body({ earthMasses: 1, radius: 6371, semiMajorAxis: 1 }, parent); // 1 AU away
      expect(service.rocheExcess(moon)).toBeNull();
    });

    it('returns a positive excess for a body well inside its Roche limit', () => {
      // Dense, close-orbiting body around a massive primary.
      const parent = body({ solarMasses: 1, solarRadius: 1 });
      const moon = body({ earthMasses: 1, radius: 6371, semiMajorAxis: 0.0001 }, parent);
      const excess = service.rocheExcess(moon);
      expect(excess).not.toBeNull();
      expect(excess!).toBeGreaterThan(0);
    });
  });

  describe('ringDynamics', () => {
    // Hand-calculated reference values using:
    //   G = 6.6743e-11 m³/(kg·s²)
    //   nominalRadius = inner + (outer - inner) * 3/8
    //   T = 2π * sqrt(nominalRadius³ / (G * M))
    //   v_max = 2π * outerRadius / T  (converted to km/s)
    //
    // Note: Elite Dangerous rings rotate as a rigid body (single period for all
    // radii), unlike real Keplerian rings where inner particles orbit faster.
    // The 3/8 factor is empirically derived from observational data.

    const G = 6.6743e-11;
    const KG_PER_EARTH_MASS = 5.972e24;
    // Mirror the service's conversion: solarMasses → earthMasses → kg
    // (uses EARTH_MASSES_PER_SOLAR_MASS = 332950, not a direct KG_PER_SOLAR_MASS constant).
    const EARTH_MASSES_PER_SOLAR_MASS = 332950;
    const KG_PER_SOLAR_MASS_VIA_EARTH = EARTH_MASSES_PER_SOLAR_MASS * KG_PER_EARTH_MASS;

    function expectedDynamics(innerKm: number, outerKm: number, massKg: number) {
      const nominalM = (innerKm + (outerKm - innerKm) * (3 / 8)) * 1000;
      const innerM = innerKm * 1000;
      const outerM = outerKm * 1000;
      const periodS = 2 * Math.PI * Math.sqrt(nominalM ** 3 / (G * massKg));
      return {
        periodDays: periodS / 86400,
        minVelocityKms: (2 * Math.PI * innerM / periodS) / 1000,
        maxVelocityKms: (2 * Math.PI * outerM / periodS) / 1000,
      };
    }

    it('returns null for a non-ring/belt body type', () => {
      const parent = body({ earthMasses: 1 });
      expect(service.ringDynamics(body({ type: 'Planet', innerRadius: 10000, outerRadius: 50000 }, parent))).toBeNull();
      expect(service.ringDynamics(body({ type: 'Star',   innerRadius: 10000, outerRadius: 50000 }, parent))).toBeNull();
    });

    it('returns null when the ring has no parent', () => {
      const ring = body({ type: 'Ring', innerRadius: 10000, outerRadius: 50000 });
      expect(service.ringDynamics(ring)).toBeNull();
    });

    it('returns null when parent has no mass', () => {
      const parent = body({ radius: 6371 });
      const ring = body({ type: 'Ring', innerRadius: 10000, outerRadius: 50000 }, parent);
      expect(service.ringDynamics(ring)).toBeNull();
    });

    it('returns null when outerRadius is zero or absent', () => {
      const parent = body({ earthMasses: 1 });
      expect(service.ringDynamics(body({ type: 'Ring', innerRadius: 0, outerRadius: 0 }, parent))).toBeNull();
      expect(service.ringDynamics(body({ type: 'Ring' }, parent))).toBeNull();
    });

    it('computes correct dynamics for a ring around an Earth-mass planet', () => {
      const inner = 10000; const outer = 50000;
      const parent = body({ earthMasses: 1 });
      const ring = body({ type: 'Ring', innerRadius: inner, outerRadius: outer }, parent);
      const result = service.ringDynamics(ring)!;
      const expected = expectedDynamics(inner, outer, 1 * KG_PER_EARTH_MASS);
      expect(result).not.toBeNull();
      expect(result.orbitalPeriodDays).toBeCloseTo(expected.periodDays, 6);
      expect(result.minVelocityKms).toBeCloseTo(expected.minVelocityKms, 6);
      expect(result.maxVelocityKms).toBeCloseTo(expected.maxVelocityKms, 6);
    });

    it('computes correct dynamics for a ring around a solar-mass star', () => {
      const inner = 500000; const outer = 2000000;
      const parent = body({ solarMasses: 1 });
      const ring = body({ type: 'Ring', innerRadius: inner, outerRadius: outer }, parent);
      const result = service.ringDynamics(ring)!;
      const expected = expectedDynamics(inner, outer, 1 * KG_PER_SOLAR_MASS_VIA_EARTH);
      expect(result).not.toBeNull();
      expect(result.orbitalPeriodDays).toBeCloseTo(expected.periodDays, 6);
      expect(result.minVelocityKms).toBeCloseTo(expected.minVelocityKms, 6);
      expect(result.maxVelocityKms).toBeCloseTo(expected.maxVelocityKms, 6);
    });

    it('min velocity is always less than max velocity when inner < outer', () => {
      const ring = service.ringDynamics(body({ type: 'Ring', innerRadius: 10000, outerRadius: 50000 }, body({ earthMasses: 100 })))!;
      expect(ring.minVelocityKms).toBeGreaterThan(0);
      expect(ring.minVelocityKms).toBeLessThan(ring.maxVelocityKms);
    });

    it('a more massive parent produces a higher max velocity for the same ring geometry', () => {
      // Heavier parent → shorter period at the nominal radius → outer edge moves faster.
      const light  = service.ringDynamics(body({ type: 'Ring', innerRadius: 10000, outerRadius: 50000 }, body({ earthMasses: 10 })))!;
      const heavy  = service.ringDynamics(body({ type: 'Ring', innerRadius: 10000, outerRadius: 50000 }, body({ earthMasses: 1000 })))!;
      expect(heavy.maxVelocityKms).toBeGreaterThan(light.maxVelocityKms);
    });

    it('nominal radius uses 3/8 of the ring width from the inner edge', () => {
      // With inner=0 and outer=8000, nominalRadius = 8000 * 3/8 = 3000 km.
      // Cross-check the period against Kepler at 3000 km.
      const inner = 0; const outer = 8000;
      const massKg = 1 * KG_PER_EARTH_MASS;
      const parent = body({ earthMasses: 1 });
      const ring = body({ type: 'Ring', innerRadius: inner, outerRadius: outer }, parent);
      const result = service.ringDynamics(ring)!;
      const nominalM = 3000 * 1000;
      const expectedPeriodS = 2 * Math.PI * Math.sqrt(nominalM ** 3 / (G * massKg));
      expect(result.orbitalPeriodDays).toBeCloseTo(expectedPeriodS / 86400, 8);
    });
  });

  describe('schwarzschildRadiusKm', () => {
    it('returns ~2.95 km for one solar mass', () => {
      expect(service.schwarzschildRadiusKm(1)).toBeCloseTo(2.95, 1);
    });

    it('scales linearly with mass', () => {
      const oneSolar = service.schwarzschildRadiusKm(1)!;
      expect(service.schwarzschildRadiusKm(10)!).toBeCloseTo(oneSolar * 10, 5);
    });

    it('returns null for missing or non-positive mass', () => {
      expect(service.schwarzschildRadiusKm(null)).toBeNull();
      expect(service.schwarzschildRadiusKm(undefined)).toBeNull();
      expect(service.schwarzschildRadiusKm(0)).toBeNull();
      expect(service.schwarzschildRadiusKm(-1)).toBeNull();
    });
  });

  describe('massStabilityAlert', () => {
    it('warns when a white dwarf exceeds the Chandrasekhar limit (1.44 M☉)', () => {
      expect(service.massStabilityAlert('White Dwarf (DA)', 1.45)).toContain('Chandrasekhar');
    });

    it('does not warn for a white dwarf just below the Chandrasekhar limit', () => {
      // 1.42 M☉ — e.g. LP 458-64 — sits below the accurate 1.44 M☉ limit.
      expect(service.massStabilityAlert('White Dwarf (DA)', 1.42)).toBeNull();
    });

    it('warns when a neutron star exceeds the TOV limit (2.17 M☉)', () => {
      expect(service.massStabilityAlert('Neutron Star', 2.2)).toContain('Tolman');
    });

    it('does not warn for a neutron star below the TOV limit', () => {
      expect(service.massStabilityAlert('Neutron Star', 2.1)).toBeNull();
    });

    it('does not warn for black holes (already collapsed)', () => {
      expect(service.massStabilityAlert('Black Hole', 5)).toBeNull();
      expect(service.massStabilityAlert('Supermassive Black Hole', 1e6)).toBeNull();
    });

    it('returns null for ordinary stars and missing mass', () => {
      expect(service.massStabilityAlert('M (Red dwarf) Star', 0.4)).toBeNull();
      expect(service.massStabilityAlert('Neutron Star', null)).toBeNull();
    });

    it('returns null for a missing subType even with a large mass', () => {
      expect(service.massStabilityAlert(null, 5)).toBeNull();
      expect(service.massStabilityAlert(undefined, 5)).toBeNull();
    });
  });
});
