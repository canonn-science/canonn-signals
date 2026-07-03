import * as Comlink from 'comlink';
import { createCollisionApi, CollisionWorkerApi } from './collision-worker-api';
import { OrbitalRelationsCore } from './orbital-relations.core';
import { serializeCollisionFamily } from './collision-request';
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
