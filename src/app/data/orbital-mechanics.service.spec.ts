import { OrbitalMechanicsService } from './orbital-mechanics.service';

const KM_PER_AU = 149597870.7;

describe('OrbitalMechanicsService', () => {
  let service: OrbitalMechanicsService;

  beforeEach(() => {
    service = new OrbitalMechanicsService();
  });

  describe('orbitalElementsToCartesian', () => {
    it('places a circular orbit at periapsis on the +x axis', () => {
      const result = service.orbitalElementsToCartesian(1.0, 0.0, 0.0, 0.0, 0.0, 0.0);
      expect(result.x).toBeCloseTo(KM_PER_AU, 1);
      expect(result.y).toBeCloseTo(0, 1);
      expect(result.z).toBeCloseTo(0, 1);
    });

    it('places a circular orbit at 90 degrees on the +y axis', () => {
      const result = service.orbitalElementsToCartesian(1.0, 0.0, 0.0, 0.0, 0.0, 90.0);
      expect(result.x).toBeCloseTo(0, 1);
      expect(result.y).toBeCloseTo(KM_PER_AU, 1);
      expect(result.z).toBeCloseTo(0, 1);
    });

    it('computes a(1-e) distance at periapsis for an eccentric orbit', () => {
      const result = service.orbitalElementsToCartesian(1.0, 0.5, 0.0, 0.0, 0.0, 0.0);
      const distance = Math.sqrt(result.x ** 2 + result.y ** 2 + result.z ** 2);
      expect(distance).toBeCloseTo(0.5 * KM_PER_AU, 1);
    });

    it('computes a(1+e) distance at apoapsis for an eccentric orbit', () => {
      const result = service.orbitalElementsToCartesian(1.0, 0.5, 0.0, 0.0, 0.0, 180.0);
      const distance = Math.sqrt(result.x ** 2 + result.y ** 2 + result.z ** 2);
      expect(distance).toBeCloseTo(1.5 * KM_PER_AU, 1);
    });

    it('moves the body onto the z-axis for a 90 degree inclination', () => {
      const result = service.orbitalElementsToCartesian(1.0, 0.0, 90.0, 0.0, 0.0, 90.0);
      expect(result.x).toBeCloseTo(0, 1);
      expect(result.y).toBeCloseTo(0, 1);
      expect(result.z).toBeCloseTo(KM_PER_AU, 1);
    });

    it('keeps a constant radius for a circular orbit at any mean anomaly', () => {
      for (let angle = 0; angle < 360; angle += 45) {
        const result = service.orbitalElementsToCartesian(1.0, 0.0, 0.0, 0.0, 0.0, angle);
        const distance = Math.sqrt(result.x ** 2 + result.y ** 2 + result.z ** 2);
        expect(distance).toBeCloseTo(KM_PER_AU, 1);
      }
    });

    it('scales correctly for a small semi-major axis', () => {
      const result = service.orbitalElementsToCartesian(0.1, 0.2, 0.0, 0.0, 0.0, 0.0);
      const distance = Math.sqrt(result.x ** 2 + result.y ** 2 + result.z ** 2);
      expect(distance).toBeCloseTo(0.08 * KM_PER_AU, 1);
    });
  });

  describe('getBodyPositionInSystemFrame', () => {
    it('returns the origin for a root body with no parent', () => {
      const root = { bodyData: { bodyId: 0 } as any, subBodies: [], parent: null };
      expect(service.getBodyPositionInSystemFrame(root, 0)).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('returns null for a non-primary body missing orbital data', () => {
      const root = { bodyData: { bodyId: 0 } as any, subBodies: [], parent: null };
      const child = { bodyData: { bodyId: 5 } as any, subBodies: [], parent: root };
      expect(service.getBodyPositionInSystemFrame(child, 0)).toBeNull();
    });

    it('adds a child local position to its parent at the origin', () => {
      const root = { bodyData: { bodyId: 0 } as any, subBodies: [], parent: null };
      const child = {
        bodyData: {
          bodyId: 1,
          semiMajorAxis: 1.0,
          orbitalEccentricity: 0,
          orbitalInclination: 0,
          argOfPeriapsis: 0,
          ascendingNode: 0,
        } as any,
        subBodies: [],
        parent: root,
      };
      const pos = service.getBodyPositionInSystemFrame(child, 0)!;
      const distance = Math.sqrt(pos.x ** 2 + pos.y ** 2 + pos.z ** 2);
      expect(distance).toBeCloseTo(KM_PER_AU, 1);
    });
  });
});
