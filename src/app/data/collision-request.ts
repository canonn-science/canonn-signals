import type { CanonnBiostatsBody, SystemBody } from '../home/home.component';

/**
 * The minimal, structured-clone-safe slice of the system tree the collision engine needs to
 * analyse one body: the shared parent's `bodyData` plus every co-orbital sibling's `bodyData`
 * (the parent's whole `subBodies` set, including the focus body itself), and the index of the
 * focus within that set.
 *
 * A leaf {@link SystemBody} can't be posted to the worker directly — its `parent`/`subBodies`
 * back-references form a cycle that would drag the entire system tree across the wire. But the
 * heavy methods only ever read the focus body, `body.parent`, `body.parent.subBodies` and each
 * sibling's `bodyData`; they never walk above the parent or into a sibling's own sub-tree. So
 * this flat family is everything they need. `CanonnBiostatsBody` is itself acyclic and clone-safe
 * (its `id64` is a `bigint`, which structured clone supports), so no manual copy/prune is required.
 */
export interface CollisionFamilyDto {
  /** The shared parent's data (the body every family member orbits). */
  parent: CanonnBiostatsBody;
  /** Every body under the parent, in `subBodies` order — the focus body and all its siblings. */
  siblings: CanonnBiostatsBody[];
  /** Index of the focus body within {@link siblings}. */
  focusIndex: number;
}

/**
 * Extracts the {@link CollisionFamilyDto} for `body` from the live system tree, ready to post to
 * the worker. Returns null when the body has no parent (nothing to compare against) or somehow
 * isn't listed among its parent's `subBodies` — both cases mean there is no collision analysis to
 * run, and the caller falls back to a "not a candidate" result.
 *
 * The `bodyData` objects are referenced, not copied: the main-thread inline path reuses them (the
 * engine never mutates `bodyData`), and the worker path structured-clones the whole DTO on post.
 */
export function serializeCollisionFamily(body: SystemBody): CollisionFamilyDto | null {
  const parent = body.parent;
  if (!parent) { return null; }
  const focusIndex = parent.subBodies.indexOf(body);
  if (focusIndex < 0) { return null; }
  return {
    parent: parent.bodyData,
    siblings: parent.subBodies.map(sibling => sibling.bodyData),
    focusIndex,
  };
}

/**
 * Rebuilds a minimal {@link SystemBody} tree from a {@link CollisionFamilyDto} inside the worker
 * (or the fallback path) and returns the focus body. The reconstructed focus node is
 * reference-identical to one entry in the synthetic parent's `subBodies`, which the engine's
 * `sibling !== body` identity checks rely on.
 */
export function rehydrateCollisionFamily(dto: CollisionFamilyDto): SystemBody {
  const parent: SystemBody = { bodyData: dto.parent, subBodies: [], parent: null };
  parent.subBodies = dto.siblings.map(bodyData => ({ bodyData, subBodies: [], parent }));
  return parent.subBodies[dto.focusIndex];
}
