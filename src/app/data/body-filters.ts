import type { SystemBody } from '../home/home.component';
import { BODY_TYPE } from './body-types';
import { MINING_RESOURCES } from './mining-resources';
import { BodyPhysicsService } from './body-physics.service';
import { OrbitalRelationsService } from './orbital-relations.service';
import { assessStellarAge, isPlottableStarClass } from './stellar-reference';

/**
 * Quick-filter categories for the system-page toolbar. Each expands the bodies
 * matching the category and collapses every other body. `materials`/`mining`
 * additionally need a set of selected keys (materials or hotspot resources).
 */
export type FilterCategory = 'biology' | 'geology' | 'guardian' | 'thargoid' | 'human' | 'materials' | 'mining' | 'landable' | 'tourist' | 'everything';

/**
 * A quick-filter "apply now" instruction, threaded down through every `SystemBodyComponent`
 * (root and descendants alike) as an input. `token` increments on every click so a repeat
 * click of the same button (recomputing the same `bodies`) still re-applies — a same-reference
 * `Set` wouldn't otherwise be seen as a change. `bodies === 'all'` expands every body (the
 * "Everything" filter); otherwise only the bodies in the set are expanded, and every other
 * body is collapsed.
 *
 * Matched by `SystemBody` object identity, not `bodyData.bodyId`: belts and rings are
 * synthesized in `HomeComponent.processBodies` with a shared placeholder `bodyId` of `-1`
 * (the game data has no real id for them), so an id-keyed set would make one matching ring
 * expand every ring and belt in the system.
 */
export interface FilterCommand {
  token: number;
  bodies: Set<SystemBody> | 'all';
}

/** Recursively visits every body in the tree, including all descendants. */
export function walkBodies(roots: SystemBody[], visit: (body: SystemBody) => void): void {
  for (const body of roots) {
    visit(body);
    if (body.subBodies.length) {
      walkBodies(body.subBodies, visit);
    }
  }
}

/** Collects every body (anywhere in the tree) for which `predicate` is true. */
export function collectMatchingBodies(roots: SystemBody[], predicate: (body: SystemBody) => boolean): Set<SystemBody> {
  const matches = new Set<SystemBody>();
  walkBodies(roots, body => {
    if (predicate(body)) {
      matches.add(body);
    }
  });
  return matches;
}

export function hasBiologySignals(body: SystemBody): boolean {
  if (body.bodyData.type === BODY_TYPE.Star) { return false; }
  const signals = body.bodyData.signals;
  return (signals?.biology?.length ?? 0) > 0 || (signals?.signals?.['$SAA_SignalType_Biological;'] ?? 0) > 0;
}

export function hasGeologySignals(body: SystemBody): boolean {
  if (body.bodyData.type === BODY_TYPE.Star) { return false; }
  const signals = body.bodyData.signals;
  return (signals?.geology?.length ?? 0) > 0 || (signals?.signals?.['$SAA_SignalType_Geological;'] ?? 0) > 0;
}

export function hasGuardianSignals(body: SystemBody): boolean {
  const signals = body.bodyData.signals;
  return (signals?.guardian?.length ?? 0) > 0 || (signals?.signals?.['$SAA_SignalType_Guardian;'] ?? 0) > 0;
}

export function hasThargoidSignals(body: SystemBody): boolean {
  const signals = body.bodyData.signals;
  return (signals?.thargoid?.length ?? 0) > 0 || (signals?.signals?.['$SAA_SignalType_Thargoid;'] ?? 0) > 0;
}

export function hasHumanSignals(body: SystemBody): boolean {
  return (body.bodyData.signals?.signals?.['$SAA_SignalType_Human;'] ?? 0) > 0;
}

export function isLandable(body: SystemBody): boolean {
  return !!body.bodyData.isLandable;
}

/**
 * Resolves the raw signal-count map (hotspot name -> count) that applies to `body`. Rings
 * carry their own signals nested under the parent's `rings[]` entry rather than on the ring's
 * own `bodyData.signals`, so those need a name-matched lookup against the parent.
 */
export function resolveBodySignalsMap(body: SystemBody): { [key: string]: number } | undefined {
  if (body.bodyData.signals?.signals) {
    return body.bodyData.signals.signals;
  }
  if (body.bodyData.type === BODY_TYPE.Ring && body.parent?.bodyData.rings) {
    const ringData = body.parent.bodyData.rings.find(r => r.name === body.bodyData.name);
    return ringData?.signals?.signals;
  }
  return undefined;
}

/** Mining-hotspot resource keys (as found in {@link MINING_RESOURCES}) present on `body`. */
export function getBodyHotspotKeys(body: SystemBody): string[] {
  const signals = resolveBodySignalsMap(body);
  if (!signals) { return []; }
  return Object.keys(signals).filter(key => key in MINING_RESOURCES);
}

/** Surface-material keys with a nonzero percentage on `body`. */
export function getBodyMaterialKeys(body: SystemBody): string[] {
  const materials = body.bodyData.materials;
  if (!materials) { return []; }
  return Object.entries(materials).filter(([, percentage]) => percentage > 0).map(([material]) => material);
}

const TOURIST_INTERESTING_SUBTYPES = new Set(['Earth-like world', 'Water world', 'Ammonia world']);

/**
 * "Tourist" quick filter: bodies carrying one of the special badges shown in the body title,
 * excluding orbital-collision candidates (that badge resolves asynchronously per body via a
 * background worker — see {@link BodyInterestRegistryService} for how it's folded back in once
 * available). Rings carry their own set of badges (Invisible, Taylor/Pauper, Racing Rings) via
 * {@link BodyPhysicsService}'s ring-classification methods.
 */
export function isTouristInteresting(body: SystemBody, physics: BodyPhysicsService, orbitalRelations: OrbitalRelationsService): boolean {
  const bd = body.bodyData;

  if (bd.type === BODY_TYPE.Ring) {
    if (physics.isInvisibleRing(bd)) { return true; }
    const ringClass = physics.classifyRingSystem(body);
    if (ringClass?.isTaylor || ringClass?.isPauper) { return true; }
    if (physics.isRacingRings(body)) { return true; }
  }

  if (TOURIST_INTERESTING_SUBTYPES.has(bd.subType)
    || bd.subType?.includes('Black Hole')
    || bd.subType === 'Neutron Star'
    || bd.subType?.includes('White Dwarf')
    || bd.subType?.includes('Wolf-Rayet')
    || bd.subType?.includes('Herbig')) {
    return true;
  }
  if (bd.isLandable) { return true; }
  if (bd.terraformingState === 'Terraformable') { return true; }

  const trojan = orbitalRelations.detectTrojanStatus(body);
  if (trojan.lagrangePoint || trojan.isHost) { return true; }
  if (orbitalRelations.detectRosetteStatus(body)) { return true; }

  if (physics.isActualShepherd(body)) { return true; }
  if (physics.rocheExcess(body) !== null) { return true; }

  if (bd.type === BODY_TYPE.Star && bd.age != null && isPlottableStarClass(bd.spectralClass, bd.subType)) {
    const assessment = assessStellarAge({
      spectralClass: bd.spectralClass,
      subType: bd.subType,
      luminosity: bd.luminosity,
      solarMasses: bd.solarMasses,
      ageMyr: bd.age,
    });
    if (assessment.status === 'old' || assessment.status === 'young') { return true; }
  }

  return false;
}
