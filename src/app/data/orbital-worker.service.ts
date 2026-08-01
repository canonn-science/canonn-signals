import { Injectable } from '@angular/core';
import * as Comlink from 'comlink';
import type { SystemBody, CanonnBiostatsBody } from '../home/home.component';
import { OrbitalRelationsCore } from './orbital-relations.core';
import type { CollisionStatus, SimultaneousCollision, CollisionWindow, SeparationSample } from './orbital-relations.core';
import { serializeCollisionFamily } from './collision-request';
import type { CollisionWorkerApi } from './collision-worker-api';

const WORKER_CALL_TIMEOUT_MS = 30_000;

/**
 * Main-thread facade for the heavy collision engine, run off the UI thread in a single shared
 * {@link https://github.com/GoogleChromeLabs/comlink Comlink} worker so the 3D orbit search never
 * janks rendering. The worker is created lazily on first use and reused for the app's lifetime.
 *
 * When no `Worker` is available (jsdom unit tests, SSR), a worker fails/rejects/times out, or a
 * body has no parent and there is nothing to serialize, each method falls back to running the
 * framework-free
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
  /** Worker backing {@link proxy}, retained so a failed runtime can be terminated. */
  private worker: Worker | null = null;
  /** Rejects active RPC races when the worker reports a module/runtime or message error. */
  private workerFailure: Promise<never> | null = null;
  /** Rejector paired with {@link workerFailure}, retained so any disable path wakes all RPCs. */
  private rejectWorkerFailure: ((reason: unknown) => void) | null = null;
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
      this.registerWorker(worker);
      return Comlink.wrap<CollisionWorkerApi>(worker);
    } catch (error) {
      this.disableWorker(error);
      return null;
    }
  }

  /** Registers runtime failure listeners before the first Comlink request can be made. */
  private registerWorker(worker: Worker): void {
    this.worker = worker;
    let rejectFailure!: (reason: unknown) => void;
    const failure = new Promise<never>((_, reject) => { rejectFailure = reject; });
    // A failure can happen between calls. Mark the shared promise handled while retaining its
    // rejected state so the next/current Promise.race still takes the inline fallback path.
    void failure.catch(() => undefined);
    this.workerFailure = failure;
    this.rejectWorkerFailure = rejectFailure;

    const fail = (event: Event): void => {
      const reason = 'error' in event && event.error
        ? event.error
        : new Error(event.type === 'messageerror' ? 'Collision worker message error' : 'Collision worker runtime error');
      this.disableWorker(reason);
    };
    worker.addEventListener('error', fail);
    worker.addEventListener('messageerror', fail);
  }

  /** Permanently switches this service instance to inline execution after a worker failure. */
  private disableWorker(reason: unknown = new Error('Collision worker disabled')): void {
    const proxy = this.proxy;
    const worker = this.worker;
    const rejectFailure = this.rejectWorkerFailure;
    this.proxy = null;
    this.worker = null;
    this.workerFailure = null;
    this.rejectWorkerFailure = null;
    this.workerUnavailable = true;
    // Wake every RPC racing this shared signal before terminating the transport. Without this,
    // calls other than the one that observed a rejection/timeout wait for their own watchdogs.
    rejectFailure?.(reason);

    try {
      proxy?.[Comlink.releaseProxy]();
    } catch {
      // A broken transport may also reject release; worker termination below is authoritative.
    }
    worker?.terminate();
  }

  /** Runs one worker RPC, retrying inline after rejection, worker failure, or a silent hang. */
  private async runWithFallback<T>(workerCall: () => Promise<T>, inlineCall: () => T): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error('Collision worker call timed out')), WORKER_CALL_TIMEOUT_MS);
    });

    try {
      const call = workerCall();
      const races: Promise<T>[] = [call, timedOut];
      if (this.workerFailure) { races.push(this.workerFailure); }
      return await Promise.race(races);
    } catch (error) {
      this.disableWorker(error);
      return inlineCall();
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Off-thread {@link OrbitalRelationsCore.detectCollisionStatus}. */
  async detectCollisionStatus(body: SystemBody, now: number): Promise<CollisionStatus> {
    const proxy = this.getProxy();
    const dto = proxy ? serializeCollisionFamily(body) : null;
    if (!proxy || !dto) { return this.inline.detectCollisionStatus(body, now); }
    return this.runWithFallback(
      () => proxy.detectCollisionStatus(dto, now),
      () => this.inline.detectCollisionStatus(body, now),
    );
  }

  /** Off-thread {@link OrbitalRelationsCore.simultaneousCollisionsWithin}. */
  async simultaneousCollisionsWithin(body: SystemBody, horizonDays: number, now: number): Promise<SimultaneousCollision[]> {
    const proxy = this.getProxy();
    const dto = proxy ? serializeCollisionFamily(body) : null;
    if (!proxy || !dto) { return this.inline.simultaneousCollisionsWithin(body, horizonDays, now); }
    return this.runWithFallback(
      () => proxy.simultaneousCollisionsWithin(dto, horizonDays, now),
      () => this.inline.simultaneousCollisionsWithin(body, horizonDays, now),
    );
  }

  /** Off-thread {@link OrbitalRelationsCore.upcomingContactsWithin}. */
  async upcomingContactsWithin(body: SystemBody, horizonDays: number, now: number): Promise<CollisionWindow[]> {
    const proxy = this.getProxy();
    const dto = proxy ? serializeCollisionFamily(body) : null;
    if (!proxy || !dto) { return this.inline.upcomingContactsWithin(body, horizonDays, now); }
    return this.runWithFallback(
      () => proxy.upcomingContactsWithin(dto, horizonDays, now),
      () => this.inline.upcomingContactsWithin(body, horizonDays, now),
    );
  }

  /** Off-thread {@link OrbitalRelationsCore.separationSeries} (takes flat bodyData — no rehydrate). */
  async separationSeries(a: CanonnBiostatsBody, b: CanonnBiostatsBody, startMs: number, endMs: number, samples: number): Promise<SeparationSample[]> {
    const proxy = this.getProxy();
    if (!proxy) { return this.inline.separationSeries(a, b, startMs, endMs, samples); }
    return this.runWithFallback(
      () => proxy.separationSeries(a, b, startMs, endMs, samples),
      () => this.inline.separationSeries(a, b, startMs, endMs, samples),
    );
  }
}
