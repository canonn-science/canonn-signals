import * as Comlink from 'comlink';
import { createCollisionApi, CollisionWorkerApi } from './collision-worker-api';
import { OrbitalRelationsCore } from './orbital-relations.core';
import { bodyPathFromRoot, serializeCollisionFamily, serializeSystemTree } from './collision-request';
import { SystemBody, CanonnBiostatsBody } from '../home/home.component';

/**
 * The worker-side API and the real Comlink wire. The direct tests prove `createCollisionApi`
 * rehydrates + delegates correctly; the MessageChannel test drives the exact same API through
 * Comlink's `expose`/`wrap` over a MessagePort — in-process, no OS thread — proving the
 * structured-clone round-trip of the DTO (with its `bigint` id64) and the `Date`-bearing result.
 */
describe('collision-worker-api', () => {
  const now = Date.parse('2026-06-27T00:00:00Z');
  let core: OrbitalRelationsCore;

  beforeEach(() => {
    core = new OrbitalRelationsCore();
  });

  function makeFamily(children: Partial<CanonnBiostatsBody>[]): SystemBody[] {
    const parent: SystemBody = {
      bodyData: { bodyId: 0, name: 'Parent', id64: 42n, subType: '', type: 'Star' } as CanonnBiostatsBody,
      subBodies: [],
      parent: null,
    };
    parent.subBodies = children.map((c, i) => ({
      bodyData: { bodyId: i + 1, name: `Child ${i + 1}`, id64: BigInt(i + 1), subType: '', type: 'Planet', ...c } as CanonnBiostatsBody,
      subBodies: [],
      parent,
    }));
    return parent.subBodies;
  }

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

  it('createCollisionApi rehydrates a DTO and delegates to the core', () => {
    const [a] = collidingPair();
    const api = createCollisionApi(core);
    const viaApi = api.detectCollisionStatus(serializeCollisionFamily(a)!, now);
    expect(viaApi.isCandidate).toBe(true);
    expect(viaApi).toEqual(core.detectCollisionStatus(a, now));
  });

  it('exposes all four methods, each matching the core on the same inputs', () => {
    const [a, b] = collidingPair();
    const api = createCollisionApi(core);
    const dto = serializeCollisionFamily(a)!;
    const endMs = now + 200 * 24 * 60 * 60 * 1000;

    expect(api.simultaneousCollisionsWithin(dto, 180, now)).toEqual(core.simultaneousCollisionsWithin(a, 180, now));
    expect(api.upcomingContactsWithin(dto, 365, now)).toEqual(core.upcomingContactsWithin(a, 365, now));
    expect(api.separationSeries(a.bodyData, b.bodyData, now, endMs, 50))
      .toEqual(core.separationSeries(a.bodyData, b.bodyData, now, endMs, 50));
  });

  it('defaults to a fresh core when none is passed', () => {
    const [a] = collidingPair();
    const api = createCollisionApi();
    expect(api.detectCollisionStatus(serializeCollisionFamily(a)!, now).isCandidate).toBe(true);
  });

  /** A ring-bearing binary pair orbiting a shared barycentre (Musca Dark Region SO-Q b5-5 1 & 2). */
  function ringCollidingPair(): { ring1: SystemBody; ring2: SystemBody } {
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
    const ring1: SystemBody = { bodyData: { bodyId: -1, name: 'Ring', id64: 0n, subType: '', type: 'Ring', innerRadius: 8452, outerRadius: 8454.4 } as CanonnBiostatsBody, subBodies: [], parent: body1 };
    const ring2: SystemBody = { bodyData: { bodyId: -1, name: 'Ring', id64: 0n, subType: '', type: 'Ring', innerRadius: 7104, outerRadius: 7123.8 } as CanonnBiostatsBody, subBodies: [], parent: body2 };
    barycentre.subBodies = [body1, body2];
    body1.subBodies = [ring1];
    body2.subBodies = [ring2];
    return { ring1, ring2 };
  }

  it('exposes the ring-collision methods, each matching the core on the same inputs', () => {
    const { ring1, ring2 } = ringCollidingPair();
    const api = createCollisionApi(core);
    const dto = serializeSystemTree(ring1)!;
    const endMs = now + 5 * 24 * 60 * 60 * 1000;

    const direct = core.detectRingCollisionStatus(ring1, now);
    expect(direct.isCandidate).toBe(true);
    expect(api.detectRingCollisionStatus(dto, now)).toEqual(direct);
    expect(api.detectRingCollisionStatuses(dto, now)).toEqual(core.detectRingCollisionStatuses(ring1, now));
    expect(api.ringContactsWithin(dto, bodyPathFromRoot(ring2), 5, now)).toEqual(core.ringContactsWithin(ring1, ring2, 5, now));
    expect(api.ringSeparationSeries(dto, bodyPathFromRoot(ring2), now, endMs, 20).length).toBe(20);
  });

  it('ring-collision methods return [] for an unresolvable partner name (never crashes the worker)', () => {
    const { ring1 } = ringCollidingPair();
    const api = createCollisionApi(core);
    const dto = serializeSystemTree(ring1)!;
    expect(api.ringContactsWithin(dto, [9, 9], 5, now)).toEqual([]);
    expect(api.ringSeparationSeries(dto, [9, 9], now, now + 1000, 10)).toEqual([]);
  });

  it('round-trips detectRingCollisionStatus over a real Comlink MessagePort', async () => {
    const { ring1 } = ringCollidingPair();
    const dto = serializeSystemTree(ring1)!;

    const { port1, port2 } = new MessageChannel();
    Comlink.expose(createCollisionApi(), port1);
    const proxy = Comlink.wrap<CollisionWorkerApi>(port2);

    try {
      const result = await proxy.detectRingCollisionStatus(dto, now);
      expect(result.isCandidate).toBe(true);
      expect(result.partner?.name).toBe('2 Ring');
      expect(result.nextCollision!.start).toBeInstanceOf(Date);
      expect(result).toEqual(core.detectRingCollisionStatus(ring1, now));
    } finally {
      proxy[Comlink.releaseProxy]();
      port1.close();
      port2.close();
    }
  });

  it('round-trips detectCollisionStatus over a real Comlink MessagePort', async () => {
    const [a] = collidingPair();
    const dto = serializeCollisionFamily(a)!;

    const { port1, port2 } = new MessageChannel();
    Comlink.expose(createCollisionApi(), port1);
    const proxy = Comlink.wrap<CollisionWorkerApi>(port2);

    try {
      const result = await proxy.detectCollisionStatus(dto, now);
      expect(result.isCandidate).toBe(true);
      expect(result.partnerName).toBe('Child 2');
      // The Date-bearing window survives structured clone as a real Date.
      expect(result.nextCollision!.start).toBeInstanceOf(Date);
      expect(result).toEqual(core.detectCollisionStatus(a, now));
    } finally {
      proxy[Comlink.releaseProxy]();
      port1.close();
      port2.close();
    }
  });
});
