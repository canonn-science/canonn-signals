import { OrbitalRelationsCore } from './orbital-relations.core';
import type { CollisionStatus, SimultaneousCollision, CollisionWindow, SeparationSample, RingCollisionStatus } from './orbital-relations.core';
import { rehydrateSystemTree, findBodyByPath } from './collision-request';
import type { SystemTreeDto } from './collision-request';
import type { CanonnBiostatsBody } from '../home/home.component';

/**
 * The collision engine's heavy methods as exposed over Comlink. Every argument is
 * structured-clone-safe (a {@link SystemTreeDto}, a partner name/path, or flat `bodyData`) and
 * every return value is plain data — `Date` and `bigint` both survive structured clone — so no
 * `Comlink.proxy`/`Comlink.transfer` is needed. {@link OrbitalWorkerService} wraps this shape on
 * the main thread.
 */
export interface CollisionWorkerApi {
  detectCollisionStatus(dto: SystemTreeDto, now: number): CollisionStatus;
  detectCollisionStatuses(dto: SystemTreeDto, now: number): CollisionStatus[];
  simultaneousCollisionsWithin(dto: SystemTreeDto, horizonDays: number, now: number): SimultaneousCollision[];
  upcomingContactsWithin(dto: SystemTreeDto, horizonDays: number, now: number): CollisionWindow[];
  separationSeries(a: CanonnBiostatsBody, b: CanonnBiostatsBody, startMs: number, endMs: number, samples: number): SeparationSample[];
  detectRingCollisionStatus(dto: SystemTreeDto, now: number): RingCollisionStatus;
  detectRingCollisionStatuses(dto: SystemTreeDto, now: number): RingCollisionStatus[];
  /** `partnerPath` is re-resolved against the rehydrated tree — see {@link findBodyByPath}. */
  ringContactsWithin(dto: SystemTreeDto, partnerPath: number[], horizonDays: number, now: number): CollisionWindow[];
  /** `partnerPath` is re-resolved against the rehydrated tree — see {@link findBodyByPath}. */
  ringSeparationSeries(dto: SystemTreeDto, partnerPath: number[], startMs: number, endMs: number, samples: number): SeparationSample[];
  /**
   * `partnerPath` is re-resolved against the rehydrated tree — see {@link findBodyByPath}. Combines
   * {@link ringSeparationSeries} and {@link ringContactsWithin} against one rehydrated tree, so the
   * ring-collision dialog's diagram needs only one round trip instead of two.
   */
  ringCollisionDiagram(
    dto: SystemTreeDto,
    partnerPath: number[],
    startMs: number,
    endMs: number,
    samples: number,
    horizonDays: number,
    now: number,
  ): { series: SeparationSample[]; contacts: CollisionWindow[] };
}

/**
 * Builds the collision API around an {@link OrbitalRelationsCore}. Kept separate from the worker
 * entry (which calls `Comlink.expose`) so tests can drive the real API over a `MessageChannel`
 * without the import side-effect of exposing on the global scope. Each tree-based method rehydrates
 * the minimal family (or, for ring collisions, the whole system tree) from its DTO before running
 * the framework-free engine.
 */
export function createCollisionApi(core: OrbitalRelationsCore = new OrbitalRelationsCore()): CollisionWorkerApi {
  return {
    detectCollisionStatus: (dto, now) =>
      core.detectCollisionStatus(rehydrateSystemTree(dto), now),
    detectCollisionStatuses: (dto, now) =>
      core.detectCollisionStatuses(rehydrateSystemTree(dto), now),
    simultaneousCollisionsWithin: (dto, horizonDays, now) =>
      core.simultaneousCollisionsWithin(rehydrateSystemTree(dto), horizonDays, now),
    upcomingContactsWithin: (dto, horizonDays, now) =>
      core.upcomingContactsWithin(rehydrateSystemTree(dto), horizonDays, now),
    separationSeries: (a, b, startMs, endMs, samples) =>
      core.separationSeries(a, b, startMs, endMs, samples),
    detectRingCollisionStatus: (dto, now) =>
      core.detectRingCollisionStatus(rehydrateSystemTree(dto), now),
    detectRingCollisionStatuses: (dto, now) =>
      core.detectRingCollisionStatuses(rehydrateSystemTree(dto), now),
    ringContactsWithin: (dto, partnerPath, horizonDays, now) => {
      const self = rehydrateSystemTree(dto);
      const partner = findBodyByPath(self, partnerPath);
      return partner ? core.ringContactsWithin(self, partner, horizonDays, now) : [];
    },
    ringSeparationSeries: (dto, partnerPath, startMs, endMs, samples) => {
      const self = rehydrateSystemTree(dto);
      const partner = findBodyByPath(self, partnerPath);
      return partner ? core.ringSeparationSeries(self, partner, startMs, endMs, samples) : [];
    },
    ringCollisionDiagram: (dto, partnerPath, startMs, endMs, samples, horizonDays, now) => {
      const self = rehydrateSystemTree(dto);
      const partner = findBodyByPath(self, partnerPath);
      return partner
        ? core.ringCollisionDiagram(self, partner, startMs, endMs, samples, horizonDays, now)
        : { series: [], contacts: [] };
    },
  };
}
