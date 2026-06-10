import { OrbitalRelationsService } from './orbital-relations.service';
import { SystemBody, CanonnBiostatsBody } from '../home/home.component';

describe('OrbitalRelationsService', () => {
  let service: OrbitalRelationsService;

  beforeEach(() => {
    service = new OrbitalRelationsService();
  });

  /** Builds a parent body whose children share the given partial body-data. */
  function makeFamily(children: Partial<CanonnBiostatsBody>[]): SystemBody[] {
    const parent: SystemBody = {
      bodyData: { bodyId: 0, name: 'Parent', id64: 0, subType: '', type: 'Star' } as CanonnBiostatsBody,
      subBodies: [],
      parent: null,
    };
    parent.subBodies = children.map((c, i) => ({
      bodyData: { bodyId: i + 1, name: `Child ${i + 1}`, id64: 0, subType: '', type: 'Planet', ...c } as CanonnBiostatsBody,
      subBodies: [],
      parent,
    }));
    return parent.subBodies;
  }

  describe('detectTrojanStatus', () => {
    it('returns no status when orbital data is missing', () => {
      const [only] = makeFamily([{ orbitalPeriod: 10 }]);
      const r = service.detectTrojanStatus(only);
      expect(r.lagrangePoint).toBeNull();
      expect(r.isHost).toBe(false);
    });

    it('labels a +60° co-orbital body as L4 and −60° as L5', () => {
      const [host, leading, trailing] = makeFamily([
        { orbitalPeriod: 10, semiMajorAxis: 5, argOfPeriapsis: 100 },
        { orbitalPeriod: 10, semiMajorAxis: 5, argOfPeriapsis: 160 }, // +60
        { orbitalPeriod: 10, semiMajorAxis: 5, argOfPeriapsis: 40 },  // −60
      ]);
      expect(service.detectTrojanStatus(leading).lagrangePoint).toBe('L4');
      expect(service.detectTrojanStatus(trailing).lagrangePoint).toBe('L5');
      // The body with Trojans on both sides is the host, not a Trojan.
      const hostResult = service.detectTrojanStatus(host);
      expect(hostResult.isHost).toBe(true);
      expect(hostResult.lagrangePoint).toBeNull();
    });

    it('labels a 180° co-orbital body as L3', () => {
      const [, opposite] = makeFamily([
        { orbitalPeriod: 10, semiMajorAxis: 5, argOfPeriapsis: 0 },
        { orbitalPeriod: 10, semiMajorAxis: 5, argOfPeriapsis: 180 },
      ]);
      expect(service.detectTrojanStatus(opposite).lagrangePoint).toBe('L3');
    });

    it('distinguishes L1 (inner) from L2 (outer) for aligned same-period bodies', () => {
      const [inner, outer] = makeFamily([
        { orbitalPeriod: 10, semiMajorAxis: 4, argOfPeriapsis: 30, ascendingNode: 50 },
        { orbitalPeriod: 10, semiMajorAxis: 6, argOfPeriapsis: 30, ascendingNode: 50 },
      ]);
      expect(service.detectTrojanStatus(inner).lagrangePoint).toBe('L1');
      expect(service.detectTrojanStatus(outer).lagrangePoint).toBe('L2');
    });

    it('detects L1/L2 alignment across the 0°/360° seam', () => {
      // periapsis 1° vs 359° (2° apart) and nodes 2° vs 358° (4° apart) are aligned.
      const [inner, outer] = makeFamily([
        { orbitalPeriod: 10, semiMajorAxis: 4, argOfPeriapsis: 1, ascendingNode: 2 },
        { orbitalPeriod: 10, semiMajorAxis: 6, argOfPeriapsis: 359, ascendingNode: 358 },
      ]);
      expect(service.detectTrojanStatus(inner).lagrangePoint).toBe('L1');
      expect(service.detectTrojanStatus(outer).lagrangePoint).toBe('L2');
    });
  });

  describe('detectRosetteStatus', () => {
    it('detects three evenly-spaced co-orbital bodies as a rosette', () => {
      const children = makeFamily([
        { orbitalPeriod: 10, semiMajorAxis: 5, argOfPeriapsis: 0 },
        { orbitalPeriod: 10, semiMajorAxis: 5, argOfPeriapsis: 120 },
        { orbitalPeriod: 10, semiMajorAxis: 5, argOfPeriapsis: 240 },
      ]);
      expect(service.detectRosetteStatus(children[0])).toBe('Rosette (3)');
    });

    it('returns null when spacing is uneven', () => {
      const children = makeFamily([
        { orbitalPeriod: 10, semiMajorAxis: 5, argOfPeriapsis: 0 },
        { orbitalPeriod: 10, semiMajorAxis: 5, argOfPeriapsis: 90 },
        { orbitalPeriod: 10, semiMajorAxis: 5, argOfPeriapsis: 240 },
      ]);
      expect(service.detectRosetteStatus(children[0])).toBeNull();
    });

    it('returns null for fewer than three co-orbital bodies', () => {
      const children = makeFamily([
        { orbitalPeriod: 10, semiMajorAxis: 5, argOfPeriapsis: 0 },
        { orbitalPeriod: 10, semiMajorAxis: 5, argOfPeriapsis: 180 },
      ]);
      expect(service.detectRosetteStatus(children[0])).toBeNull();
    });
  });
});
