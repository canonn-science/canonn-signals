import { Injectable, signal } from '@angular/core';
import type { SystemBody } from '../home/home.component';

/**
 * Tracks which bodies in the currently-loaded system have resolved as orbital-collision
 * candidates. Collision status is computed off the main thread per body (see
 * `SystemBodyComponent.requestCollisionStatus`) independently of whether that body's panel
 * is expanded, so results trickle in asynchronously; this registry lets the "Tourist" quick
 * filter (computed eagerly from synchronous body data in `HomeComponent`) pick up collision
 * candidates as they resolve, without every body needing to re-run its own collision search.
 *
 * Keyed by `SystemBody` object identity rather than `bodyData.bodyId`: belts and rings are
 * synthesized with a shared placeholder `bodyId` of `-1` (see `HomeComponent.processBodies`),
 * so an id-keyed set would make one candidate ring/belt mark every ring and belt as one too.
 */
@Injectable({ providedIn: 'root' })
export class BodyInterestRegistryService {
  private systemKey: string | number | bigint | null = null;
  private readonly collisionCandidates = signal<ReadonlySet<SystemBody>>(new Set());
  readonly collisionCandidateBodies = this.collisionCandidates.asReadonly();

  /** Clears prior results when a new system loads. `key` should uniquely identify the system (its id64). */
  resetForSystem(key: string | number | bigint): void {
    if (this.systemKey === key) { return; }
    this.systemKey = key;
    this.collisionCandidates.set(new Set());
  }

  /** Reports whether `body` is a collision candidate. Ignored if `systemKey` isn't the current system. */
  reportCollisionCandidate(systemKey: string | number | bigint, body: SystemBody, isCandidate: boolean): void {
    if (systemKey !== this.systemKey) { return; }
    const current = this.collisionCandidates();
    if (current.has(body) === isCandidate) { return; }
    const next = new Set(current);
    if (isCandidate) { next.add(body); } else { next.delete(body); }
    this.collisionCandidates.set(next);
  }
}
