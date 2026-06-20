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
});
