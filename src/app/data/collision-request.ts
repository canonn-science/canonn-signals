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

/**
 * The structured-clone-safe form of a *whole* system tree, for the ring-collision engine, which —
 * unlike planetary collision's single "parent + its children" family — walks the entire tree
 * (direct orbit, siblings, and one level of nesting through a sibling's own parent; see
 * {@link OrbitalRelationsCore.resolveRingOrbitPair}). `bodies[i]`'s parent is `bodies[parentIndex[i]]`,
 * or it's the root when `parentIndex[i]` is -1.
 */
export interface SystemTreeDto {
  /** Every body in the system, in a fixed (flattened, depth-first) order. */
  bodies: CanonnBiostatsBody[];
  /** Parallel to {@link bodies}: each entry's index of its own parent within this array, or -1 for the root. */
  parentIndex: number[];
  /** Index within {@link bodies} of the body the requested operation is for. */
  focusIndex: number;
}

/** Depth-first flatten of `root` and every descendant, in a fixed, repeatable order. */
function flattenTree(root: SystemBody): SystemBody[] {
  const out: SystemBody[] = [root];
  for (const child of root.subBodies) { out.push(...flattenTree(child)); }
  return out;
}

/**
 * Extracts a {@link SystemTreeDto} for `body`'s whole system, ready to post to the worker. Returns
 * null only if `body` is somehow not part of the flattened tree from its own root (should not
 * happen for a real tree), meaning there is nothing to serialize.
 */
export function serializeSystemTree(body: SystemBody): SystemTreeDto | null {
  let root = body;
  while (root.parent) { root = root.parent; }
  const flat = flattenTree(root);
  const focusIndex = flat.indexOf(body);
  if (focusIndex < 0) { return null; }
  const indexOf = new Map(flat.map((node, i) => [node, i]));
  return {
    bodies: flat.map(node => node.bodyData),
    parentIndex: flat.map(node => node.parent ? indexOf.get(node.parent)! : -1),
    focusIndex,
  };
}

/**
 * Rebuilds a minimal {@link SystemBody} tree from a {@link SystemTreeDto} inside the worker (or the
 * fallback path) and returns the focus body. Every other body in the tree is also reachable from
 * it via `parent`/`subBodies`, exactly as {@link OrbitalRelationsCore.detectRingCollisionStatus}'s
 * whole-tree scan needs.
 */
export function rehydrateSystemTree(dto: SystemTreeDto): SystemBody {
  const nodes: SystemBody[] = dto.bodies.map(bodyData => ({ bodyData, subBodies: [], parent: null }));
  dto.parentIndex.forEach((parentIdx, i) => {
    if (parentIdx < 0) { return; }
    nodes[i].parent = nodes[parentIdx];
    nodes[parentIdx].subBodies.push(nodes[i]);
  });
  return nodes[dto.focusIndex];
}

/**
 * Finds the body named `name` anywhere in the tree containing `node` (searching from its root),
 * for re-resolving a {@link RingCollisionExtent}'s partner by name after crossing the worker
 * boundary, the same way planetary collision dialogs already re-resolve a partner name against
 * the live sibling list. Returns null when no body has that name.
 */
export function findBodyInTree(node: SystemBody, name: string): SystemBody | null {
  let root = node;
  while (root.parent) { root = root.parent; }
  return flattenTree(root).find(n => n.bodyData.name === name) ?? null;
}
