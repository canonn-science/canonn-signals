import { OrbitalRelationsCore } from './orbital-relations.core';
import type { CollisionStatus, SimultaneousCollision, CollisionWindow, SeparationSample } from './orbital-relations.core';
import { rehydrateCollisionFamily } from './collision-request';
import type { CollisionFamilyDto } from './collision-request';
import type { CanonnBiostatsBody } from '../home/home.component';

/**
 * The collision engine's heavy methods as exposed over Comlink. Every argument is
 * structured-clone-safe (a {@link CollisionFamilyDto} or flat `bodyData`) and every return value
 * is plain data — `Date` and `bigint` both survive structured clone — so no `Comlink.proxy`/
 * `Comlink.transfer` is needed. {@link OrbitalWorkerService} wraps this shape on the main thread.
 */
export interface CollisionWorkerApi {
  detectCollisionStatus(dto: CollisionFamilyDto, now: number): CollisionStatus;
  simultaneousCollisionsWithin(dto: CollisionFamilyDto, horizonDays: number, now: number): SimultaneousCollision[];
  upcomingContactsWithin(dto: CollisionFamilyDto, horizonDays: number, now: number): CollisionWindow[];
  separationSeries(a: CanonnBiostatsBody, b: CanonnBiostatsBody, startMs: number, endMs: number, samples: number): SeparationSample[];
}

/**
 * Builds the collision API around an {@link OrbitalRelationsCore}. Kept separate from the worker
 * entry (which calls `Comlink.expose`) so tests can drive the real API over a `MessageChannel`
 * without the import side-effect of exposing on the global scope. Each tree-based method rehydrates
 * the minimal family from its DTO before running the framework-free engine.
 */
export function createCollisionApi(core: OrbitalRelationsCore = new OrbitalRelationsCore()): CollisionWorkerApi {
  return {
    detectCollisionStatus: (dto, now) =>
      core.detectCollisionStatus(rehydrateCollisionFamily(dto), now),
    simultaneousCollisionsWithin: (dto, horizonDays, now) =>
      core.simultaneousCollisionsWithin(rehydrateCollisionFamily(dto), horizonDays, now),
    upcomingContactsWithin: (dto, horizonDays, now) =>
      core.upcomingContactsWithin(rehydrateCollisionFamily(dto), horizonDays, now),
    separationSeries: (a, b, startMs, endMs, samples) =>
      core.separationSeries(a, b, startMs, endMs, samples),
  };
}
