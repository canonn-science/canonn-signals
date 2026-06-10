import { BodyPhysicsService } from './body-physics.service';
import { CanonnBiostatsBody, SystemBody } from '../home/home.component';

const KM_PER_AU = 149597870.7;

function node(data: Partial<CanonnBiostatsBody>, parent: SystemBody | null = null): SystemBody {
  return { bodyData: data as CanonnBiostatsBody, subBodies: [], parent };
}

/** Builds a parent SystemBody with the given children attached as subBodies. */
function family(parentData: Partial<CanonnBiostatsBody>, childrenData: Partial<CanonnBiostatsBody>[]): SystemBody {
  const parent = node(parentData);
  parent.subBodies = childrenData.map(c => node(c, parent));
  return parent;
}

describe('BodyPhysicsService (extended coverage)', () => {
  let service: BodyPhysicsService;
  beforeEach(() => { service = new BodyPhysicsService(); });

  describe('ringSatelliteDensityKgM3', () => {
    it('assigns densities by composition keyword', () => {
      expect(service.ringSatelliteDensityKgM3('Metal Rich')).toBe(4500);
      expect(service.ringSatelliteDensityKgM3('Metallic')).toBe(4500);
      expect(service.ringSatelliteDensityKgM3('Rocky')).toBe(3000);
      expect(service.ringSatelliteDensityKgM3('Icy')).toBe(1000);
      expect(service.ringSatelliteDensityKgM3(undefined)).toBe(1000);
      expect(service.ringSatelliteDensityKgM3('Something else')).toBe(1000);
    });
  });

  describe('getPlanetaryDensity (solar units)', () => {
    it('uses solar radius and solar mass when earth units are absent', () => {
      const result = service.getPlanetaryDensity({ solarMasses: 1, solarRadius: 1 } as CanonnBiostatsBody)!;
      // The Sun's mean density is ~1.41 g/cm³.
      expect(result.unit).toBe('g/cm³');
      expect(result.value).toBeCloseTo(1.41, 1);
    });
  });

  describe('Roche limits via the megatonne mass branch', () => {
    it('computes a rigid Roche limit from a parent expressed in megatonnes', () => {
      // Parent density derived from `mass` (megatonnes) + radius rather than earthMasses.
      const parent = node({ mass: 1e9, radius: 500 });
      const ring = node({ subType: 'Rocky ring' }, parent);
      const rigid = service.calculateRigidRocheLimit(ring);
      expect(rigid).not.toBeNull();
      expect(rigid!).toBeGreaterThan(0);
    });

    it('returns null when the parent exposes neither radius nor solar radius', () => {
      const parent = node({ earthMasses: 100 });
      expect(service.calculateRigidRocheLimit(node({ subType: 'Icy' }, parent))).toBeNull();
    });

    it('returns null when parent mass/density cannot be determined', () => {
      const parent = node({ radius: 50000 });
      expect(service.calculateRigidRocheLimit(node({ subType: 'Icy' }, parent))).toBeNull();
    });
  });

  describe('calculateBodyRocheLimits guard clauses', () => {
    const parent = node({ earthMasses: 100, radius: 50000 });
    it('returns null without a parent', () => {
      expect(service.calculateBodyRocheLimits(node({ type: 'Planet', semiMajorAxis: 1, radius: 1000, earthMasses: 1 }))).toBeNull();
    });
    it('returns null when orbital/physical data is incomplete', () => {
      expect(service.calculateBodyRocheLimits(node({ type: 'Planet', radius: 1000, earthMasses: 1 }, parent))).toBeNull();
      expect(service.calculateBodyRocheLimits(node({ type: 'Planet', semiMajorAxis: 1, earthMasses: 1 }, parent))).toBeNull();
      expect(service.calculateBodyRocheLimits(node({ type: 'Planet', semiMajorAxis: 1, radius: 1000 }, parent))).toBeNull();
    });
    it('returns null when the parent has no resolvable radius/density', () => {
      const noRadiusParent = node({ earthMasses: 100 });
      expect(service.calculateBodyRocheLimits(
        node({ type: 'Planet', semiMajorAxis: 1, radius: 1000, earthMasses: 1 }, noRadiusParent),
      )).toBeNull();
    });
    it('defaults eccentricity to zero (periapsis == apoapsis == currentDistance)', () => {
      const moon = node({ type: 'Planet', semiMajorAxis: 0.01, radius: 1500, earthMasses: 0.1 }, parent);
      const limits = service.calculateBodyRocheLimits(moon)!;
      expect(limits.periapsis).toBeCloseTo(limits.currentDistance, 6);
      expect(limits.apoapsis).toBeCloseTo(limits.currentDistance, 6);
    });
  });

  describe('ring containment and shepherding', () => {
    // Parent: radius 10,000 km, single ring with outer edge at 100,000 km (stored in metres).
    const ringedParentData = { earthMasses: 100, radius: 10000, rings: [{ outerRadius: 100_000_000 } as any] };

    it('detects a body orbiting within the ring system', () => {
      const parent = node(ringedParentData);
      const within = node({ type: 'Planet', semiMajorAxis: 50000 / KM_PER_AU, earthMasses: 0.1 }, parent);
      expect(service.isBodyWithinParentRings(within)).toBe(true);
    });

    it('treats a far-orbiting body as outside the rings', () => {
      const parent = node(ringedParentData);
      const far = node({ type: 'Planet', semiMajorAxis: 1, earthMasses: 0.1 }, parent);
      expect(service.isBodyWithinParentRings(far)).toBe(false);
    });

    it('returns false for stars, rings and ring-less parents', () => {
      const parent = node(ringedParentData);
      expect(service.isBodyWithinParentRings(node({ type: 'Star', semiMajorAxis: 0.01 }, parent))).toBe(false);
      expect(service.isBodyWithinParentRings(node({ type: 'Ring', semiMajorAxis: 0.01 }, parent))).toBe(false);
      const ringlessParent = node({ earthMasses: 100, radius: 10000 });
      expect(service.isBodyWithinParentRings(node({ type: 'Planet', semiMajorAxis: 0.01 }, ringlessParent))).toBe(false);
    });

    it('qualifies a massive body just outside the rings via its Hill sphere', () => {
      const parent = node(ringedParentData);
      const shepherd = node({ type: 'Planet', semiMajorAxis: 110000 / KM_PER_AU, earthMasses: 10 }, parent);
      expect(service.isShepherdingCandidate(shepherd)).toBe(true);
    });

    it('rejects a tiny distant body as a shepherding candidate', () => {
      const parent = node(ringedParentData);
      const tiny = node({ type: 'Planet', semiMajorAxis: 1, earthMasses: 1e-6 }, parent);
      expect(service.isShepherdingCandidate(tiny)).toBe(false);
    });

    it('computes a Hill limit and flags a genuine shepherd moon', () => {
      const parent = family(ringedParentData, [
        { type: 'Planet', semiMajorAxis: 110000 / KM_PER_AU, earthMasses: 10, orbitalEccentricity: 0.05 },
      ]);
      const shepherd = parent.subBodies[0];
      const hill = service.calculateShepherdingHillLimit(shepherd)!;
      expect(hill).not.toBeNull();
      expect(hill.withinRings).toBe(false);
      expect(hill.isFirstOutside).toBe(true);
      expect(hill.bodyApoapsis).toBeGreaterThan(hill.bodyPeriapsis);
      expect(service.isActualShepherd(shepherd)).toBe(true);
    });
  });

  describe('getParentRadiusAndDensity', () => {
    it('returns null without a parent', () => {
      expect(service.getParentRadiusAndDensity(node({ radius: 1000 }))).toBeNull();
    });

    it('returns null when the parent has no resolvable radius', () => {
      const parent = node({ earthMasses: 100 });
      expect(service.getParentRadiusAndDensity(node({ radius: 1000 }, parent))).toBeNull();
    });

    it('returns null when the parent has no resolvable mass/density', () => {
      const parent = node({ radius: 50000 });
      expect(service.getParentRadiusAndDensity(node({ radius: 1000 }, parent))).toBeNull();
    });

    it('returns the parent radius (km) and a positive bulk density for a valid parent', () => {
      const parent = node({ earthMasses: 100, radius: 50000 });
      const result = service.getParentRadiusAndDensity(node({ radius: 1000 }, parent))!;
      expect(result).not.toBeNull();
      expect(result.primaryRadius).toBe(50000);
      expect(result.primaryDensity).toBeGreaterThan(0);
    });
  });

  describe('rocheLimitCurves', () => {
    it('samples 500–8000 kg/m³ in 100-step increments', () => {
      const { densityRange } = service.rocheLimitCurves(50000, 3000);
      expect(densityRange[0]).toBe(500);
      expect(densityRange[densityRange.length - 1]).toBe(8000);
      expect(densityRange.length).toBe(76); // (8000-500)/100 + 1
    });

    it('uses the 1.26 (rigid) and 2.456 (fluid) coefficients and decreases with density', () => {
      const primaryRadius = 50000;
      const primaryDensity = 3000;
      const { densityRange, rigidLimits, fluidLimits } = service.rocheLimitCurves(primaryRadius, primaryDensity);
      // At the first sample (density 500) the fluid/rigid ratio is exactly 2.456/1.26.
      expect(fluidLimits[0] / rigidLimits[0]).toBeCloseTo(2.456 / 1.26, 6);
      const expectedRigid0 = 1.26 * primaryRadius * Math.cbrt(primaryDensity / densityRange[0]);
      expect(rigidLimits[0]).toBeCloseTo(expectedRigid0, 3);
      // Limits shrink as particle density rises.
      expect(rigidLimits[0]).toBeGreaterThan(rigidLimits[rigidLimits.length - 1]);
    });
  });

  describe('rocheExcess', () => {
    it('returns a positive excess for a dense body inside a stellar Roche limit (solar-mass body branch)', () => {
      const parent = node({ solarMasses: 1, solarRadius: 1 });
      const moon = node({ solarMasses: 0.0001, radius: 6371, semiMajorAxis: 0.0001 }, parent);
      const excess = service.rocheExcess(moon);
      expect(excess).not.toBeNull();
      expect(excess!).toBeGreaterThan(0);
    });

    it('returns null when required mass/radius data is missing', () => {
      expect(service.rocheExcess(node({ semiMajorAxis: 1, radius: 1000 }))).toBeNull(); // no parent
      const parentNoMass = node({ radius: 50000 });
      expect(service.rocheExcess(node({ earthMasses: 1, radius: 1000, semiMajorAxis: 1 }, parentNoMass))).toBeNull();
      const parent = node({ earthMasses: 100, radius: 50000 });
      expect(service.rocheExcess(node({ semiMajorAxis: 1, radius: 1000 }, parent))).toBeNull(); // no body mass
    });
  });
});
