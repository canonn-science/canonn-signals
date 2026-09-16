import { OrbitalRelationsCore } from './orbital-relations.core';
import { bodyPathFromRoot, serializeCollisionFamily, rehydrateCollisionFamily, serializeSystemTree, rehydrateSystemTree, findBodyByPath, findBodyInTree } from './collision-request';
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

  /**
   * Ring collisions scan the *whole* system tree (direct orbit, siblings, and nesting through a
   * sibling's own parent — see resolveRingOrbitPair), unlike planetary collision's single family,
   * so they need the whole tree serialized, not just one parent + its children.
   */
  describe('SystemTreeDto (whole-tree serialization for ring collisions)', () => {
    /** star -> [planetA -> [moonA1], planetB -> [ring]] — three levels, to exercise real nesting. */
    function multiLevelTree(): { star: SystemBody; planetA: SystemBody; moonA1: SystemBody; planetB: SystemBody; ring: SystemBody } {
      const star: SystemBody = { bodyData: { bodyId: 0, name: 'Star', id64: 0n, subType: '', type: 'Star' } as CanonnBiostatsBody, subBodies: [], parent: null };
      const planetA: SystemBody = { bodyData: { bodyId: 1, name: 'A', id64: 0n, subType: '', type: 'Planet' } as CanonnBiostatsBody, subBodies: [], parent: star };
      const planetB: SystemBody = { bodyData: { bodyId: 2, name: 'B', id64: 0n, subType: '', type: 'Planet' } as CanonnBiostatsBody, subBodies: [], parent: star };
      const moonA1: SystemBody = { bodyData: { bodyId: 3, name: 'A 1', id64: 0n, subType: '', type: 'Planet' } as CanonnBiostatsBody, subBodies: [], parent: planetA };
      const ring: SystemBody = { bodyData: { bodyId: -1, name: 'B Ring', id64: 0n, subType: '', type: 'Ring' } as CanonnBiostatsBody, subBodies: [], parent: planetB };
      star.subBodies = [planetA, planetB];
      planetA.subBodies = [moonA1];
      planetB.subBodies = [ring];
      return { star, planetA, moonA1, planetB, ring };
    }

    it('serializeSystemTree captures every body with correct parent links and the focus index', () => {
      const { moonA1 } = multiLevelTree();
      const dto = serializeSystemTree(moonA1);
      expect(dto).not.toBeNull();
      // Depth-first: A's subtree (A 1) is visited before B's.
      expect(dto!.bodies.map(b => b.name)).toEqual(['Star', 'A', 'A 1', 'B', 'B Ring']);
      expect(dto!.focusIndex).toBe(2); // "A 1"
      expect(dto!.parentIndex).toEqual([-1, 0, 1, 0, 3]);
    });

    it('rehydrateSystemTree rebuilds the whole tree, reachable in every direction from the focus', () => {
      const { moonA1 } = multiLevelTree();
      const focus = rehydrateSystemTree(serializeSystemTree(moonA1)!);
      expect(focus.bodyData.name).toBe('A 1');
      const planetA = focus.parent!;
      expect(planetA.bodyData.name).toBe('A');
      expect(planetA.subBodies).toContain(focus);
      const star = planetA.parent!;
      expect(star.bodyData.name).toBe('Star');
      expect(star.subBodies.map(b => b.bodyData.name)).toEqual(['A', 'B']);
      const planetB = star.subBodies.find(b => b.bodyData.name === 'B')!;
      expect(planetB.subBodies[0].bodyData.name).toBe('B Ring');
    });

    it('findBodyInTree finds a body anywhere in the same system by name, or null when absent', () => {
      const { moonA1 } = multiLevelTree();
      const found = findBodyInTree(moonA1, 'B Ring');
      expect(found?.bodyData.name).toBe('B Ring');
      expect(findBodyInTree(moonA1, 'Does Not Exist')).toBeNull();
    });

    it('bodyPathFromRoot and findBodyByPath round-trip a non-unique ring identity', () => {
      const { moonA1, ring } = multiLevelTree();
      const path = bodyPathFromRoot(ring);
      expect(path).toEqual([1, 0]);
      expect(findBodyByPath(moonA1, path)?.bodyData.name).toBe('B Ring');
      expect(findBodyByPath(moonA1, [9, 9])).toBeNull();
    });

    it('detectRingCollisionStatus is identical on the original and the rehydrated tree', () => {
      const barycentre: SystemBody = { bodyData: { bodyId: 0, name: 'Barycentre', id64: 0n, subType: '', type: 'Barycentre' } as CanonnBiostatsBody, subBodies: [], parent: null };
      const ts = { meanAnomaly: '2026-08-17T19:39:35Z' } as CanonnBiostatsBody['timestamps'];
      const body1: SystemBody = {
        bodyData: {
          bodyId: 1, name: '1', id64: 0n, subType: '', type: 'Planet',
          semiMajorAxis: 0.0000468578213261962, orbitalEccentricity: 0.198392, orbitalInclination: -4.164512,
          argOfPeriapsis: 173.768076, ascendingNode: -100.3383, meanAnomaly: 233.703906,
          orbitalPeriod: 0.283064148217593, timestamps: ts,
        } as CanonnBiostatsBody,
        subBodies: [], parent: barycentre,
      };
      const body2: SystemBody = {
        bodyData: {
          bodyId: 2, name: '2', id64: 0n, subType: '', type: 'Planet',
          semiMajorAxis: 0.0000823957132312579, orbitalEccentricity: 0.198392, orbitalInclination: -4.164512,
          argOfPeriapsis: 353.76807, ascendingNode: -100.3383, meanAnomaly: 233.703906,
          orbitalPeriod: 0.283064148217593, timestamps: ts,
        } as CanonnBiostatsBody,
        subBodies: [], parent: barycentre,
      };
      const ring1: SystemBody = { bodyData: { bodyId: -1, name: '1 Ring', id64: 0n, subType: '', type: 'Ring', innerRadius: 8452, outerRadius: 8454.4 } as CanonnBiostatsBody, subBodies: [], parent: body1 };
      const ring2: SystemBody = { bodyData: { bodyId: -1, name: '2 Ring', id64: 0n, subType: '', type: 'Ring', innerRadius: 7104, outerRadius: 7123.8 } as CanonnBiostatsBody, subBodies: [], parent: body2 };
      barycentre.subBodies = [body1, body2];
      body1.subBodies = [ring1];
      body2.subBodies = [ring2];

      const direct = core.detectRingCollisionStatus(ring1, now);
      expect(direct.isCandidate).toBe(true);
      expect(direct.partner?.name).toBe('2 Ring');
      const viaWire = core.detectRingCollisionStatus(rehydrateSystemTree(serializeSystemTree(ring1)!), now);
      expect(viaWire).toEqual(direct);
    });
  });
});
