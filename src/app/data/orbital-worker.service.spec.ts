import { OrbitalWorkerService } from './orbital-worker.service';
import { OrbitalRelationsCore } from './orbital-relations.core';
import { SystemBody, CanonnBiostatsBody } from '../home/home.component';

/**
 * The main-thread facade. Its `createProxy()` seam is stubbed per test so these cases never touch
 * the global `Worker` or the real `comlink` module — both of which are shared, and so leak, across
 * files under the Angular builder's non-isolated Vitest default (that shared state made this spec
 * flaky against collision-worker-api.spec.ts, which drives the real Comlink wire).
 *
 * The inline-fallback cases stub the seam to null and assert the async API returns exactly what the
 * core would; the worker-path cases stub it with a fake proxy and assert every method is routed
 * through that single proxy instead of the inline core.
 */
describe('OrbitalWorkerService', () => {
  const now = Date.parse('2026-06-27T00:00:00Z');
  let core: OrbitalRelationsCore;

  beforeEach(() => {
    core = new OrbitalRelationsCore();
  });

  afterEach(() => {
    vi.restoreAllMocks(); // drop the per-instance createProxy spies (belt-and-braces under isolate:false)
  });

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

  /** A service whose worker seam is forced off, so every method runs the engine inline. */
  function inlineService(): OrbitalWorkerService {
    const svc = new OrbitalWorkerService();
    vi.spyOn(svc as unknown as { createProxy(): unknown }, 'createProxy').mockReturnValue(null);
    return svc;
  }

  describe('inline fallback (no worker)', () => {
    let service: OrbitalWorkerService;

    beforeEach(() => {
      service = inlineService();
    });

    it('resolves detectCollisionStatus with the same result as the core', async () => {
      const [a] = collidingPair();
      const result = await service.detectCollisionStatus(a, now);
      expect(result.isCandidate).toBe(true);
      expect(result).toEqual(core.detectCollisionStatus(a, now));
    });

    it('resolves upcomingContactsWithin identically to the core', async () => {
      const [a] = collidingPair();
      const result = await service.upcomingContactsWithin(a, 365, now);
      expect(result.length).toBeGreaterThan(0);
      expect(result).toEqual(core.upcomingContactsWithin(a, 365, now));
    });

    it('resolves separationSeries (flat bodyData, no tree) identically to the core', async () => {
      const [a, b] = collidingPair();
      const endMs = now + 200 * 24 * 60 * 60 * 1000;
      const result = await service.separationSeries(a.bodyData, b.bodyData, now, endMs, 50);
      expect(result.length).toBe(50);
      expect(result).toEqual(core.separationSeries(a.bodyData, b.bodyData, now, endMs, 50));
    });

    it('resolves simultaneousCollisionsWithin identically to the core', async () => {
      const [a] = collidingPair();
      const result = await service.simultaneousCollisionsWithin(a, 180, now);
      expect(result).toEqual(core.simultaneousCollisionsWithin(a, 180, now));
    });

    it('falls back cleanly for a parentless body (nothing to serialize → not a candidate)', async () => {
      const orphan: SystemBody = {
        bodyData: { bodyId: 1, name: 'Lonely', id64: 0n, subType: '', type: 'Planet' } as CanonnBiostatsBody,
        subBodies: [],
        parent: null,
      };
      const result = await service.detectCollisionStatus(orphan, now);
      expect(result.isCandidate).toBe(false);
    });
  });

  describe('worker path (proxy available)', () => {
    /** A fake Comlink proxy; each method resolves the value the shared worker would post back. */
    function fakeProxy() {
      return {
        detectCollisionStatus: vi.fn().mockResolvedValue({
          isCandidate: true, partnerName: 'From Worker', synodicPeriodDays: 1,
          nextCollision: null, upcomingCollisions: [], combinedRadiiKm: 1, simultaneousPartners: [],
        }),
        simultaneousCollisionsWithin: vi.fn().mockResolvedValue([]),
        upcomingContactsWithin: vi.fn().mockResolvedValue([]),
        separationSeries: vi.fn().mockResolvedValue([]),
      };
    }

    /** Builds a service whose seam yields `proxy`, and returns both plus the spy on the seam. */
    function serviceWith(proxy: unknown) {
      const svc = new OrbitalWorkerService();
      const createSpy = vi.spyOn(svc as unknown as { createProxy(): unknown }, 'createProxy').mockReturnValue(proxy);
      return { svc, createSpy };
    }

    it('routes every method through a single shared proxy instead of the inline core', async () => {
      const proxy = fakeProxy();
      const { svc, createSpy } = serviceWith(proxy);
      const [a, b] = collidingPair();

      const status = await svc.detectCollisionStatus(a, now);
      expect(status.partnerName).toBe('From Worker'); // came from the proxy, not the local core
      expect(proxy.detectCollisionStatus).toHaveBeenCalledOnce();

      await svc.simultaneousCollisionsWithin(a, 180, now);
      await svc.upcomingContactsWithin(a, 180, now);
      await svc.separationSeries(a.bodyData, b.bodyData, now, now + 1000, 10);
      expect(proxy.simultaneousCollisionsWithin).toHaveBeenCalledOnce();
      expect(proxy.upcomingContactsWithin).toHaveBeenCalledOnce();
      expect(proxy.separationSeries).toHaveBeenCalledOnce();

      // The worker + its proxy are created once and reused across every call.
      expect(createSpy).toHaveBeenCalledOnce();
    });

    it('still falls back to the inline core when a body has no parent (nothing to serialize)', async () => {
      const proxy = fakeProxy();
      const { svc } = serviceWith(proxy);
      const orphan: SystemBody = {
        bodyData: { bodyId: 1, name: 'Lonely', id64: 0n, subType: '', type: 'Planet' } as CanonnBiostatsBody,
        subBodies: [],
        parent: null,
      };

      const result = await svc.detectCollisionStatus(orphan, now);
      expect(result.isCandidate).toBe(false);
      expect(proxy.detectCollisionStatus).not.toHaveBeenCalled(); // never crossed the wire
    });

    it('falls back to the inline core when the proxy cannot be created, and latches (no retry)', async () => {
      const { svc, createSpy } = serviceWith(null); // createProxy yields null → worker unavailable
      const [a] = collidingPair();

      const result = await svc.detectCollisionStatus(a, now);
      expect(result.isCandidate).toBe(true);
      expect(result.partnerName).toBe('Child 2');
      expect(result).toEqual(core.detectCollisionStatus(a, now));

      // A second call does not retry construction — the unavailable state is latched.
      await svc.upcomingContactsWithin(a, 365, now);
      expect(createSpy).toHaveBeenCalledOnce();
    });
  });

  it('runs inline in a real jsdom environment, where no Worker global exists', async () => {
    // Exercises the un-stubbed createProxy() seam: jsdom has no `Worker`, so it returns null and the
    // facade resolves via the inline engine. Guards the production no-worker branch.
    const svc = new OrbitalWorkerService();
    const [a] = collidingPair();
    const result = await svc.detectCollisionStatus(a, now);
    expect(result).toEqual(core.detectCollisionStatus(a, now));
  });
});
