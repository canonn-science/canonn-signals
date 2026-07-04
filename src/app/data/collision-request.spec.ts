import { OrbitalRelationsCore } from './orbital-relations.core';
import { serializeCollisionFamily, rehydrateCollisionFamily } from './collision-request';
import { SystemBody, CanonnBiostatsBody } from '../home/home.component';

/**
 * The serialize/rehydrate boundary that lets the collision engine run in a web worker: it must
 * carry everything the engine reads (the focus body + its co-orbital family) and reconstruct a
 * tree the engine treats identically to the live one — same result, same sibling identities.
 */
describe('collision-request (worker serialization boundary)', () => {
  const now = Date.parse('2026-06-27T00:00:00Z');
  let core: OrbitalRelationsCore;

  beforeEach(() => {
    core = new OrbitalRelationsCore();
  });

  /** A parent whose children share the given partial body-data (mirrors the orbital spec helper). */
  function makeFamily(children: Partial<CanonnBiostatsBody>[]): SystemBody[] {
    const parent: SystemBody = {
      bodyData: { bodyId: 0, name: 'Parent', id64: 0n, subType: '', type: 'Star' } as CanonnBiostatsBody,
      subBodies: [],
      parent: null,
    };
    parent.subBodies = children.map((c, i) => ({
      bodyData: { bodyId: i + 1, name: `Child ${i + 1}`, id64: 0n, subType: '', type: 'Planet', ...c } as CanonnBiostatsBody,
      subBodies: [],
      parent,
    }));
    return parent.subBodies;
  }

  /** Two coplanar crossing orbits with large radii → a genuine collision candidate. */
  function collidingPair(): SystemBody[] {
    return makeFamily([
      {
        orbitalPeriod: 10, semiMajorAxis: 1, orbitalEccentricity: 0.1, orbitalInclination: 0,
        radius: 60000, meanAnomaly: 0, argOfPeriapsis: 0, ascendingNode: 0,
        timestamps: { meanAnomaly: '2026-06-27T00:00:00Z' } as CanonnBiostatsBody['timestamps'],
      },
      {
        orbitalPeriod: 11, semiMajorAxis: 1, orbitalEccentricity: 0.1, orbitalInclination: 0,
        radius: 60000, meanAnomaly: 0, argOfPeriapsis: 0, ascendingNode: 0,
        timestamps: { meanAnomaly: '2026-06-27T00:00:00Z' } as CanonnBiostatsBody['timestamps'],
      },
    ]);
  }

  describe('serializeCollisionFamily', () => {
    it('captures the parent, every sibling in order, and the focus index', () => {
      const [a, b] = collidingPair();
      const dto = serializeCollisionFamily(a);
      expect(dto).not.toBeNull();
      expect(dto!.parent).toBe(a.parent!.bodyData);
      expect(dto!.siblings).toEqual([a.bodyData, b.bodyData]);
      expect(dto!.focusIndex).toBe(0);

      // A non-first focus reports its own index.
      expect(serializeCollisionFamily(b)!.focusIndex).toBe(1);
    });

    it('returns null for a body with no parent (nothing to compare against)', () => {
      const orphan: SystemBody = {
        bodyData: { bodyId: 1, name: 'Lonely', id64: 0n, subType: '', type: 'Planet' } as CanonnBiostatsBody,
        subBodies: [],
        parent: null,
      };
      expect(serializeCollisionFamily(orphan)).toBeNull();
    });
  });

  describe('rehydrateCollisionFamily', () => {
    it('rebuilds a tree whose focus is reference-identical to one of its parent\'s subBodies', () => {
      const [a] = collidingPair();
      const focus = rehydrateCollisionFamily(serializeCollisionFamily(a)!);
      expect(focus.parent).not.toBeNull();
      expect(focus.parent!.subBodies).toContain(focus);
      expect(focus.parent!.subBodies[0]).toBe(focus);
      // Every sibling points back at the same synthetic parent.
      for (const sib of focus.parent!.subBodies) {
        expect(sib.parent).toBe(focus.parent);
      }
    });
  });

  describe('round-trip equivalence with the live tree', () => {
    it('detectCollisionStatus is identical on the original and the rehydrated body', () => {
      const [a] = collidingPair();
      const direct = core.detectCollisionStatus(a, now);
      const viaWire = core.detectCollisionStatus(rehydrateCollisionFamily(serializeCollisionFamily(a)!), now);
      expect(direct.isCandidate).toBe(true);
      expect(viaWire).toEqual(direct);
    });

    it('upcomingContactsWithin is identical through the boundary', () => {
      const [a] = collidingPair();
      const direct = core.upcomingContactsWithin(a, 365, now);
      const viaWire = core.upcomingContactsWithin(rehydrateCollisionFamily(serializeCollisionFamily(a)!), 365, now);
      expect(direct.length).toBeGreaterThan(0);
      expect(viaWire).toEqual(direct);
    });
  });
});
