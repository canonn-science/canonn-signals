import * as Comlink from 'comlink';
import { OrbitalWorkerService } from './orbital-worker.service';
import { OrbitalRelationsCore } from './orbital-relations.core';
import { SystemBody, CanonnBiostatsBody } from '../home/home.component';

// Comlink's ESM exports can't be spied on (vitest limitation), so mock the module: `wrap` returns
// a stub proxy we can assert against, driving the service's worker path without a real thread. The
// other tests in this file never reach Comlink (Worker is stubbed undefined → inline path).
const { proxyMock } = vi.hoisted(() => ({
  proxyMock: {
    detectCollisionStatus: vi.fn(),
    simultaneousCollisionsWithin: vi.fn(),
    upcomingContactsWithin: vi.fn(),
    separationSeries: vi.fn(),
  },
}));
vi.mock('comlink', () => ({ wrap: vi.fn(() => proxyMock), expose: vi.fn() }));

/**
 * The main-thread facade. Under jsdom there is no `Worker`, so every method takes the inline
 * fallback path — running the framework-free engine on the live tree and resolving a Promise.
 * These tests assert the async API returns exactly what the core would, which is also how the
 * facade keeps the engine's coverage without a real thread. (The real Comlink wire is exercised
 * separately in collision-worker-api.spec.ts.)
 */
describe('OrbitalWorkerService (inline fallback)', () => {
  const now = Date.parse('2026-06-27T00:00:00Z');
  let service: OrbitalWorkerService;
  let core: OrbitalRelationsCore;

  beforeEach(() => {
    // Force the no-Worker path deterministically, regardless of the test environment.
    vi.stubGlobal('Worker', undefined);
    service = new OrbitalWorkerService();
    core = new OrbitalRelationsCore();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  describe('worker path (Worker available)', () => {
    /** Minimal stand-in for the browser Worker; the URL/options are ignored (no chunk is loaded). */
    class FakeWorker {
      constructor(_url: URL, _opts: unknown) { /* no-op */ }
    }

    beforeEach(() => {
      vi.clearAllMocks(); // reset call counts between worker-path cases (keeps mocked implementations)
    });

    it('routes every method through a single shared Comlink proxy instead of the inline core', async () => {
      vi.stubGlobal('Worker', FakeWorker);
      proxyMock.detectCollisionStatus.mockResolvedValue({
        isCandidate: true, partnerName: 'From Worker', synodicPeriodDays: 1,
        nextCollision: null, upcomingCollisions: [], combinedRadiiKm: 1, simultaneousPartners: [],
      });
      proxyMock.simultaneousCollisionsWithin.mockResolvedValue([]);
      proxyMock.upcomingContactsWithin.mockResolvedValue([]);
      proxyMock.separationSeries.mockResolvedValue([]);

      const svc = new OrbitalWorkerService();
      const [a, b] = collidingPair();

      const status = await svc.detectCollisionStatus(a, now);
      expect(status.partnerName).toBe('From Worker'); // came from the proxy, not the local core
      expect(proxyMock.detectCollisionStatus).toHaveBeenCalledOnce();

      await svc.simultaneousCollisionsWithin(a, 180, now);
      await svc.upcomingContactsWithin(a, 180, now);
      await svc.separationSeries(a.bodyData, b.bodyData, now, now + 1000, 10);
      expect(proxyMock.simultaneousCollisionsWithin).toHaveBeenCalledOnce();
      expect(proxyMock.upcomingContactsWithin).toHaveBeenCalledOnce();
      expect(proxyMock.separationSeries).toHaveBeenCalledOnce();

      // The worker + its proxy are created once and reused across every call.
      expect(Comlink.wrap).toHaveBeenCalledOnce();
    });

    it('falls back to the inline core when the worker cannot be constructed', async () => {
      class ThrowingWorker {
        constructor() { throw new Error('module workers blocked'); }
      }
      vi.stubGlobal('Worker', ThrowingWorker);

      const svc = new OrbitalWorkerService();
      const [a] = collidingPair();

      // Construction throws → getProxy latches unavailable and runs the real engine inline.
      const result = await svc.detectCollisionStatus(a, now);
      expect(result.isCandidate).toBe(true);
      expect(result.partnerName).toBe('Child 2');
      expect(result).toEqual(core.detectCollisionStatus(a, now));
      expect(Comlink.wrap).not.toHaveBeenCalled();
      expect(proxyMock.detectCollisionStatus).not.toHaveBeenCalled();

      // A second call does not retry construction (latched) — still inline, still no proxy.
      await svc.upcomingContactsWithin(a, 365, now);
      expect(Comlink.wrap).not.toHaveBeenCalled();
      expect(proxyMock.upcomingContactsWithin).not.toHaveBeenCalled();
    });
  });
});
