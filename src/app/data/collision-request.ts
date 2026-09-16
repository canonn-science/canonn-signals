import type { CanonnBiostatsBody, SystemBody } from '../home/home.component';

/**
 * The structured-clone-safe form of a *whole* system tree, shared by both collision engines. Ring
 * collisions walk the entire tree (direct orbit, siblings, and one level of nesting through a
 * sibling's own parent; see {@link OrbitalRelationsCore.resolveRingOrbitPair}), and planetary
 * collisions need the same full ancestry to reach a moon's "aunt/uncle"
 * ({@link OrbitalRelationsCore.nestedCollisionPartners}) and "cousin"
 * ({@link OrbitalRelationsCore.cousinCollisionPartners}) nested collision partners — both walk
 * *above* the focus body's own parent, which a "parent + its children" DTO can't support.
 * `bodies[i]`'s parent is `bodies[parentIndex[i]]`, or it's the root when `parentIndex[i]` is -1.
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

/** Child-index path from the system root to `node` (root = []). */
export function bodyPathFromRoot(node: SystemBody): number[] {
  const path: number[] = [];
  for (let current: SystemBody | null = node; current.parent; current = current.parent) {
    const idx = current.parent.subBodies.indexOf(current);
    if (idx < 0) { return []; }
    path.push(idx);
  }
  return path.reverse();
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

/** Re-resolves a body anywhere in `node`'s system tree by its child-index path from the root. */
export function findBodyByPath(node: SystemBody, path: readonly number[]): SystemBody | null {
  let root = node;
  while (root.parent) { root = root.parent; }
  let current: SystemBody | null = root;
  for (const index of path) {
    current = current?.subBodies[index] ?? null;
    if (!current) { return null; }
  }
  return current;
}
