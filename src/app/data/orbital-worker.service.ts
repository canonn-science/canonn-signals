import { Injectable } from '@angular/core';
import * as Comlink from 'comlink';
import type { SystemBody, CanonnBiostatsBody } from '../home/home.component';
import { OrbitalRelationsCore } from './orbital-relations.core';
import type { CollisionStatus, SimultaneousCollision, CollisionWindow, SeparationSample } from './orbital-relations.core';
import { serializeCollisionFamily } from './collision-request';
import type { CollisionWorkerApi } from './collision-worker-api';

/**
 * Main-thread facade for the heavy collision engine, run off the UI thread in a single shared
 * {@link https://github.com/GoogleChromeLabs/comlink Comlink} worker so the 3D orbit search never
 * janks rendering. The worker is created lazily on first use and reused for the app's lifetime.
 *
 * When no `Worker` is available (jsdom unit tests, SSR) — or a body has no parent, so there is
 * nothing to serialize — each method falls back to running the framework-free
 * {@link OrbitalRelationsCore} inline against the live tree and resolving a Promise, so callers get
 * one uniform async API regardless of environment.
 *
 * ## Adding another off-thread calculation
 * 1. add the method to a framework-free core (this one or a sibling under `data/`);
 * 2. add a wrapper to {@link CollisionWorkerApi} + `createCollisionApi` (rehydrate a DTO if it
 *    needs tree context, else pass flat args);
 * 3. add an `async` passthrough here mirroring the pattern below.
 * The single shared worker and Comlink wiring are reused — no new plumbing.
 */
@Injectable({ providedIn: 'root' })
export class OrbitalWorkerService {
  /** Comlink proxy to the shared worker; created on first heavy call, null until then. */
  private proxy: Comlink.Remote<CollisionWorkerApi> | null = null;
  /** Latched once the worker can't be constructed, so we stop retrying and stay on the inline path. */
  private workerUnavailable = false;
  /** Engine instance for the inline (no-worker) fallback and for bodies with no parent. */
  private readonly inline = new OrbitalRelationsCore();

  /** Lazily spins up the shared worker and its Comlink proxy; null when a worker can't be used. */
  private getProxy(): Comlink.Remote<CollisionWorkerApi> | null {
    if (this.workerUnavailable) { return null; }
    if (!this.proxy) {
      this.proxy = this.createProxy();
      if (!this.proxy) {
        // No worker available (SSR/jsdom) or its construction failed: latch off so we stop retrying
        // and run the engine inline on the main thread rather than leaving collision status blank.
        this.workerUnavailable = true;
        return null;
      }
    }
    return this.proxy;
  }

  /**
   * Constructs the shared worker and wraps it in a Comlink proxy, or returns null when workers are
   * unavailable (SSR/jsdom) or blocked (CSP / unresolvable worker URL). Isolated as a `protected`
   * seam so unit tests can substitute a fake proxy on the instance — the alternative, mocking the
   * global `Worker` and the `comlink` module, leaks across files under the Angular builder's
   * non-isolated Vitest default and made these tests flaky. The real Comlink wire is covered by
   * collision-worker-api.spec.ts.
   */
  protected createProxy(): Comlink.Remote<CollisionWorkerApi> | null {
    if (typeof Worker === 'undefined') { return null; }
    try {
      const worker = new Worker(new URL('./collision.worker', import.meta.url), { type: 'module' });
      return Comlink.wrap<CollisionWorkerApi>(worker);
    } catch {
      return null;
    }
  }

  /** Off-thread {@link OrbitalRelationsCore.detectCollisionStatus}. */
  async detectCollisionStatus(body: SystemBody, now: number): Promise<CollisionStatus> {
    const proxy = this.getProxy();
    const dto = proxy ? serializeCollisionFamily(body) : null;
    if (!proxy || !dto) { return this.inline.detectCollisionStatus(body, now); }
    return proxy.detectCollisionStatus(dto, now);
  }

  /** Off-thread {@link OrbitalRelationsCore.simultaneousCollisionsWithin}. */
  async simultaneousCollisionsWithin(body: SystemBody, horizonDays: number, now: number): Promise<SimultaneousCollision[]> {
    const proxy = this.getProxy();
    const dto = proxy ? serializeCollisionFamily(body) : null;
    if (!proxy || !dto) { return this.inline.simultaneousCollisionsWithin(body, horizonDays, now); }
    return proxy.simultaneousCollisionsWithin(dto, horizonDays, now);
  }

  /** Off-thread {@link OrbitalRelationsCore.upcomingContactsWithin}. */
  async upcomingContactsWithin(body: SystemBody, horizonDays: number, now: number): Promise<CollisionWindow[]> {
    const proxy = this.getProxy();
    const dto = proxy ? serializeCollisionFamily(body) : null;
    if (!proxy || !dto) { return this.inline.upcomingContactsWithin(body, horizonDays, now); }
    return proxy.upcomingContactsWithin(dto, horizonDays, now);
  }

  /** Off-thread {@link OrbitalRelationsCore.separationSeries} (takes flat bodyData — no rehydrate). */
  async separationSeries(a: CanonnBiostatsBody, b: CanonnBiostatsBody, startMs: number, endMs: number, samples: number): Promise<SeparationSample[]> {
    const proxy = this.getProxy();
    if (!proxy) { return this.inline.separationSeries(a, b, startMs, endMs, samples); }
    return proxy.separationSeries(a, b, startMs, endMs, samples);
  }
}
