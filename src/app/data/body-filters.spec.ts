import { TestBed } from '@angular/core/testing';
import { CanonnBiostatsBody, SystemBody } from '../home/home.component';
import { BODY_TYPE } from './body-types';
import { BodyPhysicsService } from './body-physics.service';
import { OrbitalRelationsService } from './orbital-relations.service';
import {
  collectMatchingBodies, walkBodies, resolveBodySignalsMap, getBodyHotspotKeys, getBodyMaterialKeys,
  hasBiologySignals, hasGeologySignals, hasGuardianSignals, hasThargoidSignals, hasHumanSignals, isLandable,
  isTouristInteresting,
} from './body-filters';

function makeBody(overrides: Partial<CanonnBiostatsBody> & { bodyId: number }): CanonnBiostatsBody {
  return {
    id64: BigInt(overrides.bodyId), name: `Body ${overrides.bodyId}`, type: BODY_TYPE.Planet, subType: 'Rocky body',
    ...overrides,
  };
}

function node(bodyData: CanonnBiostatsBody, parent: SystemBody | null = null): SystemBody {
  return { bodyData, subBodies: [], parent };
}

describe('body-filters', () => {
  describe('signal predicates', () => {
    it('detects biology/geology signals but never on a Star', () => {
      const planet = node(makeBody({
        bodyId: 1, type: BODY_TYPE.Planet,
        signals: { biology: ['Bacterium'], geology: [], updateTime: '' },
      }));
      expect(hasBiologySignals(planet)).toBe(true);
      expect(hasGeologySignals(planet)).toBe(false);

      const star = node(makeBody({
        bodyId: 2, type: BODY_TYPE.Star,
        signals: { biology: ['Bacterium'], signals: { '$SAA_SignalType_Geological;': 3 }, updateTime: '' },
      }));
      expect(hasBiologySignals(star)).toBe(false);
      expect(hasGeologySignals(star)).toBe(false);
    });

    it('detects guardian/thargoid/human from either the array or the SAA signal count', () => {
      const guardianByArray = node(makeBody({ bodyId: 1, signals: { guardian: ['Structure'], updateTime: '' } }));
      const thargoidByCount = node(makeBody({ bodyId: 2, signals: { signals: { '$SAA_SignalType_Thargoid;': 4 }, updateTime: '' } }));
      const humanBody = node(makeBody({ bodyId: 3, signals: { signals: { '$SAA_SignalType_Human;': 1 }, updateTime: '' } }));
      const plainBody = node(makeBody({ bodyId: 4 }));

      expect(hasGuardianSignals(guardianByArray)).toBe(true);
      expect(hasThargoidSignals(thargoidByCount)).toBe(true);
      expect(hasHumanSignals(humanBody)).toBe(true);
      expect(hasGuardianSignals(plainBody)).toBe(false);
      expect(hasThargoidSignals(plainBody)).toBe(false);
      expect(hasHumanSignals(plainBody)).toBe(false);
    });
  });

  describe('isLandable', () => {
    it('matches only bodies flagged landable', () => {
      expect(isLandable(node(makeBody({ bodyId: 1, isLandable: true })))).toBe(true);
      expect(isLandable(node(makeBody({ bodyId: 2, isLandable: false })))).toBe(false);
      expect(isLandable(node(makeBody({ bodyId: 3 })))).toBe(false);
    });
  });

  describe('resolveBodySignalsMap / getBodyHotspotKeys', () => {
    it('reads a ring body\'s hotspot signals from the parent\'s rings array, not the ring\'s own bodyData', () => {
      const parentData = makeBody({
        bodyId: 1, type: BODY_TYPE.Planet,
        rings: [{
          name: 'Ring A', innerRadius: 1, outerRadius: 2, mass: 1, type: 'Metallic',
          signals: { signals: { 'Painite': 2, 'Platinum': 1 }, updateTime: '' },
        }],
      });
      const parent = node(parentData);
      const ring = node(makeBody({ bodyId: 2, name: 'Ring A', type: BODY_TYPE.Ring }), parent);
      parent.subBodies.push(ring);

      expect(resolveBodySignalsMap(ring)).toEqual({ 'Painite': 2, 'Platinum': 1 });
      expect(getBodyHotspotKeys(ring)).toEqual(['Painite', 'Platinum']);
    });

    it('excludes non-mining SAA signal-type keys from the hotspot list', () => {
      const planet = node(makeBody({ bodyId: 1, signals: { signals: { '$SAA_SignalType_Geological;': 3 }, updateTime: '' } }));
      expect(getBodyHotspotKeys(planet)).toEqual([]);
    });

    it('returns undefined when a ring has no matching parent ring entry', () => {
      const parent = node(makeBody({ bodyId: 1 }));
      const ring = node(makeBody({ bodyId: 2, name: 'Ring A', type: BODY_TYPE.Ring }), parent);
      expect(resolveBodySignalsMap(ring)).toBeUndefined();
    });
  });

  describe('getBodyMaterialKeys', () => {
    it('only includes materials with a nonzero percentage', () => {
      const planet = node(makeBody({
        bodyId: 1,
        materials: {
          Carbon: 5, Chromium: 0, Germanium: 0, Iron: 20, Manganese: 0,
          Mercury: 0, Nickel: 0, Phosphorus: 0, Ruthenium: 0, Sulphur: 0, Tin: 0,
        },
      }));
      expect(getBodyMaterialKeys(planet).sort()).toEqual(['Carbon', 'Iron']);
    });

    it('returns an empty list when the body has no materials', () => {
      expect(getBodyMaterialKeys(node(makeBody({ bodyId: 1 })))).toEqual([]);
    });
  });

  describe('walkBodies / collectMatchingBodies', () => {
    it('visits every descendant, not just direct children', () => {
      const root = node(makeBody({ bodyId: 1 }));
      const child = node(makeBody({ bodyId: 2 }), root);
      const grandchild = node(makeBody({ bodyId: 3 }), child);
      root.subBodies.push(child);
      child.subBodies.push(grandchild);

      const visited: number[] = [];
      walkBodies([root], b => visited.push(b.bodyData.bodyId));
      expect(visited).toEqual([1, 2, 3]);
    });

    it('collects only the bodies matching the predicate', () => {
      const root = node(makeBody({ bodyId: 1 }));
      const a = node(makeBody({ bodyId: 2, signals: { biology: ['X'], updateTime: '' } }), root);
      const b = node(makeBody({ bodyId: 3 }), root);
      root.subBodies.push(a, b);

      expect(collectMatchingBodies([root], hasBiologySignals)).toEqual(new Set([a]));
    });

    it('distinguishes bodies that share the same placeholder bodyId (belts/rings all use -1)', () => {
      const root = node(makeBody({ bodyId: 1 }));
      const ringA = node(makeBody({ bodyId: -1, name: 'Ring A', type: BODY_TYPE.Ring, signals: { signals: { 'Painite': 2 }, updateTime: '' } }), root);
      const ringB = node(makeBody({ bodyId: -1, name: 'Ring B', type: BODY_TYPE.Ring }), root);
      root.subBodies.push(ringA, ringB);

      const matches = collectMatchingBodies([root], body => getBodyHotspotKeys(body).includes('Painite'));
      expect(matches.has(ringA)).toBe(true);
      expect(matches.has(ringB)).toBe(false);
    });
  });

  describe('isTouristInteresting', () => {
    let physics: BodyPhysicsService;
    let orbitalRelations: OrbitalRelationsService;

    beforeEach(() => {
      TestBed.configureTestingModule({});
      physics = TestBed.inject(BodyPhysicsService);
      orbitalRelations = TestBed.inject(OrbitalRelationsService);
    });

    it('matches an interesting subtype', () => {
      const body = node(makeBody({ bodyId: 1, subType: 'Earth-like world' }));
      expect(isTouristInteresting(body, physics, orbitalRelations)).toBe(true);
    });

    it('matches a landable body', () => {
      const body = node(makeBody({ bodyId: 1, isLandable: true }));
      expect(isTouristInteresting(body, physics, orbitalRelations)).toBe(true);
    });

    it('matches a terraformable body', () => {
      const body = node(makeBody({ bodyId: 1, terraformingState: 'Terraformable' }));
      expect(isTouristInteresting(body, physics, orbitalRelations)).toBe(true);
    });

    it('matches a catalogued Green Gas Giant', () => {
      const body = node(makeBody({ bodyId: 1, name: 'Systimbu WJ-R e4-720 10', subType: 'Class I gas giant' }));
      expect(isTouristInteresting(body, physics, orbitalRelations)).toBe(true);
    });

    it('does not match a tidally-locked (synchronised) body on its own', () => {
      const body = node(makeBody({ bodyId: 1, subType: 'Rocky body', rotationalPeriodTidallyLocked: true }));
      expect(isTouristInteresting(body, physics, orbitalRelations)).toBe(false);
    });

    it('does not match an unremarkable body', () => {
      const body = node(makeBody({ bodyId: 1, subType: 'Rocky body' }));
      expect(isTouristInteresting(body, physics, orbitalRelations)).toBe(false);
    });

    it('matches a ring carrying a Taylor-ring badge', () => {
      const parent = node(makeBody({ bodyId: 1, type: BODY_TYPE.Planet, radius: 1000 }));
      const ring = node(makeBody({
        bodyId: -1, name: 'Ring A', type: BODY_TYPE.Ring, innerRadius: 100, outerRadius: 150, mass: 1e10,
      }), parent);
      parent.subBodies.push(ring);

      expect(isTouristInteresting(ring, physics, orbitalRelations)).toBe(true);
    });

    it('does not match an unremarkable ring', () => {
      const parent = node(makeBody({ bodyId: 1, type: BODY_TYPE.Planet, radius: 1000 }));
      const ring = node(makeBody({
        bodyId: -1, name: 'Ring A', type: BODY_TYPE.Ring, innerRadius: 100, outerRadius: 400, mass: 1e10,
      }), parent);
      parent.subBodies.push(ring);

      expect(isTouristInteresting(ring, physics, orbitalRelations)).toBe(false);
    });
  });
});
