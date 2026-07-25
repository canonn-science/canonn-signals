import type { SystemBody, CanonnBiostatsBody } from '../home/home.component';
import { BODY_TYPE } from './body-types';
import { KM_PER_AU, KM_PER_LIGHT_SECOND } from './unit-conversions';

/**
 * Determines which star in a multi-star system governs a body's biology, by porting the
 * flux-dominance algorithm validated by Canonn's StarInfluence project
 * (S:\Canonn\StarInfluence\influencing_star.py). Two hypotheses, tried in order:
 *
 *   N — flux ranking on the real 3D orbital distance (own orbital offset plus every
 *       ancestor's offset, up to the system root), with near-tie orbital-phase
 *       time-averaging. Most accurate, but every candidate star needs a fully resolvable
 *       orbital chain (all six Keplerian elements at every hop).
 *   F — falls back to SrvSurvey's characteristic orbital-scale distance (root-sum-square of
 *       semiMajorAxis up to the nearest common ancestor) when N can't be computed for every
 *       candidate. Needs only semiMajorAxis, so it resolves far more often.
 *
 * Unlike the Python reference (which reconstructs a body's ancestor chain from Spansh's flat
 * `parents` id list), this walks `SystemBody.parent` directly — the tree already resolves that.
 */

const DEG_TO_RAD = Math.PI / 180;
const MS_PER_DAY = 86400000;

// Fixed snapshot date for the single-position distance calculation (reproducible; the
// reference tool verified the exact date barely matters). Time-averaging (for near ties)
// samples a separate 1500-2700 AD window.
const REFERENCE_MS = Date.parse('2021-04-01T00:00:00Z');
const NEAR_TIE_RATIO_THRESHOLD = 2.0;
const TIME_AVERAGE_N_SAMPLES = 24;
const SAMPLE_TIMES_MS = Array.from({ length: TIME_AVERAGE_N_SAMPLES }, (_, i) =>
  Date.parse(`${Math.round(1500 + (2700 - 1500) * i / (TIME_AVERAGE_N_SAMPLES - 1))}-01-01T00:00:00Z`),
);

// Y-class (brown dwarf) flux boost. A brown dwarf governs biology only when it is close enough
// to be near-competitive on flux, so a gentle multiplicative boost tips back the near-miss
// cases without promoting the many systems where a Y star is merely present. 1.75x lifts
// Y-class decided accuracy from ~87% to ~98.6% in the reference tool's dataset sweep.
const Y_BOOST = 1.75;
// Neutron-star flux boost. Stefan-Boltzmann (R^2*T^4) systematically under-ranks neutron
// stars — their microscopic radius crushes even their multi-million-K fictional
// surfaceTemperature — so a larger boost compensates. 2.5x lifts N-class decided accuracy
// from ~99.4% to ~99.9% with no measured collateral in the reference tool's dataset.
const N_BOOST = 2.5;

interface Vec3 { x: number; y: number; z: number; }

type ScoredStar = [SystemBody, number | null];

function meanAnomalyNowDeg(
  meanAnomalyDeg: number, orbitalPeriodDays: number | undefined, timestamp: string | undefined, nowMs: number,
): number {
  if (!orbitalPeriodDays || !timestamp) { return meanAnomalyDeg; }
  const epochMs = Date.parse(timestamp);
  if (!Number.isFinite(epochMs)) { return meanAnomalyDeg; }
  const cycles = ((nowMs - epochMs) / MS_PER_DAY) / orbitalPeriodDays;
  return (((meanAnomalyDeg + cycles * 360) % 360) + 360) % 360;
}

/**
 * Keplerian state vector (km), relative to the body's immediate parent. ED/Spansh negate
 * ascendingNode and argOfPeriapsis versus the standard astronomical frame, so both are negated
 * here before the rotation — matching Canonn's tested orbital-relations reference.
 */
function orbitalStateVectorKm(
  aAu: number, e: number, inclDeg: number, nodeDeg: number, argpDeg: number, meanAnomalyDeg: number,
): Vec3 {
  const a = aAu * KM_PER_AU;
  const ecc = Math.min(Math.max(e, 0), 0.999);
  const m = (((meanAnomalyDeg % 360) + 360) % 360) * DEG_TO_RAD;
  let E = ecc < 0.8 ? m : Math.PI;
  for (let i = 0; i < 12; i++) {
    const delta = (E - ecc * Math.sin(E) - m) / (1 - ecc * Math.cos(E));
    E -= delta;
    if (Math.abs(delta) < 1e-12) { break; }
  }
  const xo = a * (Math.cos(E) - ecc);
  const yo = a * Math.sqrt(1 - ecc * ecc) * Math.sin(E);
  const node = -nodeDeg * DEG_TO_RAD;
  const argp = -argpDeg * DEG_TO_RAD;
  const incl = inclDeg * DEG_TO_RAD;
  const cO = Math.cos(node), sO = Math.sin(node);
  const cw = Math.cos(argp), sw = Math.sin(argp);
  const ci = Math.cos(incl), si = Math.sin(incl);
  return {
    x: xo * (cO * cw - sO * sw * ci) - yo * (cO * sw + sO * cw * ci),
    y: xo * (sO * cw + cO * sw * ci) - yo * (sO * sw - cO * cw * ci),
    z: xo * (sw * si) + yo * (cw * si),
  };
}

const ORBITAL_FIELDS = [
  'semiMajorAxis', 'orbitalEccentricity', 'orbitalInclination', 'ascendingNode', 'argOfPeriapsis', 'meanAnomaly',
] as const satisfies readonly (keyof CanonnBiostatsBody)[];

function bodyOffsetKm(bd: CanonnBiostatsBody, nowMs: number): Vec3 | null {
  if (ORBITAL_FIELDS.some(f => bd[f] == null)) { return null; }
  const m = meanAnomalyNowDeg(bd.meanAnomaly!, bd.orbitalPeriod, bd.timestamps?.meanAnomaly, nowMs);
  return orbitalStateVectorKm(bd.semiMajorAxis!, bd.orbitalEccentricity!, bd.orbitalInclination!, bd.ascendingNode!, bd.argOfPeriapsis!, m);
}

/**
 * Absolute position (km) in the system's shared frame: own orbital offset plus every
 * ancestor's, up to the root (which sits at the origin). Null when any hop's orbital elements
 * are unresolvable. `cache` is per-snapshot-time — a fresh one per sampled instant.
 */
function absolutePositionKm(body: SystemBody, nowMs: number, cache: Map<SystemBody, Vec3 | null>): Vec3 | null {
  if (cache.has(body)) { return cache.get(body)!; }
  if (!body.parent) {
    const origin = { x: 0, y: 0, z: 0 };
    cache.set(body, origin);
    return origin;
  }
  const offset = bodyOffsetKm(body.bodyData, nowMs);
  if (!offset) { cache.set(body, null); return null; }
  const parentPos = absolutePositionKm(body.parent, nowMs, cache);
  if (!parentPos) { cache.set(body, null); return null; }
  const pos = { x: offset.x + parentPos.x, y: offset.y + parentPos.y, z: offset.z + parentPos.z };
  cache.set(body, pos);
  return pos;
}

function calculatedDistanceLs(
  target: SystemBody, star: SystemBody, nowMs: number, cache: Map<SystemBody, Vec3 | null>,
): number | null {
  const tp = absolutePositionKm(target, nowMs, cache);
  if (!tp) { return null; }
  const sp = absolutePositionKm(star, nowMs, cache);
  if (!sp) { return null; }
  const dx = tp.x - sp.x, dy = tp.y - sp.y, dz = tp.z - sp.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) / KM_PER_LIGHT_SECOND;
}

/** Flux score: (R * T^2 / d)^2 — Stefan-Boltzmann, with the distance unit free to vary by hypothesis. */
function flux(star: CanonnBiostatsBody, distance: number | null): number | null {
  if (distance == null || distance === 0) { return null; }
  const r = star.solarRadius, t = star.surfaceTemperature;
  if (r == null || t == null) { return null; }
  return (r * t * t / distance) ** 2;
}

/** Mean flux over TIME_AVERAGE_N_SAMPLES orbital phases; null unless every sample resolves. */
function timeAveragedFlux(target: SystemBody, star: SystemBody): number | null {
  let total = 0;
  for (const t of SAMPLE_TIMES_MS) {
    const d = calculatedDistanceLs(target, star, t, new Map());
    const f = flux(star.bodyData, d);
    if (f == null) { return null; }
    total += f;
  }
  return total / SAMPLE_TIMES_MS.length;
}

function ancestorChain(body: SystemBody): SystemBody[] {
  const chain: SystemBody[] = [];
  for (let node = body.parent; node; node = node.parent) { chain.push(node); }
  return chain;
}

function nearestCommonAncestor(a: SystemBody, b: SystemBody): SystemBody | null {
  const chainB = new Set(ancestorChain(b));
  for (const anc of ancestorChain(a)) {
    if (anc === b || chainB.has(anc)) { return anc; }
  }
  return null;
}

function sumSqSemiMajorAxisTo(body: SystemBody, stopAt: SystemBody): number | null {
  if (body === stopAt) { return 0; }
  const sma = body.bodyData.semiMajorAxis;
  if (sma == null) { return null; }
  let total = sma * sma;
  for (let node = body.parent; node; node = node.parent) {
    if (node === stopAt) { return total; }
    const nodeSma = node.bodyData.semiMajorAxis;
    if (nodeSma == null) { return null; }
    total += nodeSma * nodeSma;
  }
  return null;
}

function characteristicDistanceAu(target: SystemBody, star: SystemBody): number | null {
  const common = nearestCommonAncestor(target, star);
  if (!common) { return null; }
  const d1 = sumSqSemiMajorAxisTo(target, common);
  if (d1 == null) { return null; }
  const d2 = sumSqSemiMajorAxisTo(star, common);
  if (d2 == null) { return null; }
  return Math.sqrt(d1 + d2);
}

/** True for a Y-class brown dwarf, from the observable spectralClass/subType. */
function isYStar(star: CanonnBiostatsBody): boolean {
  if ((star.spectralClass ?? '').charAt(0) === 'Y') { return true; }
  return (star.subType ?? '').startsWith('Y (Brown dwarf');
}

/** True for a neutron star. Checks subType too — a real neutron can have a null spectralClass. */
function isNStar(star: CanonnBiostatsBody): boolean {
  if ((star.spectralClass ?? '').charAt(0) === 'N') { return true; }
  return star.subType === 'Neutron Star';
}

function classBoostFactor(star: CanonnBiostatsBody): number {
  if (isNStar(star)) { return N_BOOST; }
  if (isYStar(star)) { return Y_BOOST; }
  return 1;
}

function applyBoosts(scored: ScoredStar[]): ScoredStar[] {
  return scored.map(([s, sc]) => [s, sc == null ? sc : sc * classBoostFactor(s.bodyData)]);
}

function pickMax(scored: ScoredStar[]): SystemBody | null {
  if (scored.length === 0 || scored.some(([, s]) => s == null)) { return null; }
  return scored.reduce((best, cur) => (cur[1]! > best[1]! ? cur : best))[0];
}

function systemRoot(body: SystemBody): SystemBody {
  let node = body;
  while (node.parent) { node = node.parent; }
  return node;
}

function flattenStars(root: SystemBody): SystemBody[] {
  const out: SystemBody[] = [];
  const visit = (b: SystemBody): void => {
    if (b.bodyData.type === BODY_TYPE.Star) { out.push(b); }
    for (const child of b.subBodies) { visit(child); }
  };
  visit(root);
  return out;
}

/**
 * Which rule actually decided the winner, for the "how was this determined" explanation UI:
 *  - `only-star`: the system has exactly one star — nothing to compare.
 *  - `flux-3d`: hypothesis N — flux ranked on the real 3D orbital distance.
 *  - `flux-characteristic`: hypothesis F — flux ranked on the characteristic orbital-scale
 *    distance, because N couldn't be resolved for every candidate star.
 */
export type InfluencingStarMethod = 'only-star' | 'flux-3d' | 'flux-characteristic';

export interface InfluencingStarResult {
  star: SystemBody;
  method: InfluencingStarMethod;
  /** Number of stars in the system (including the winner), for the explanation UI. */
  starCount: number;
}

/**
 * Determines the star that governs `body`'s biology, or null when the system has no stars or
 * the winner can't be determined (both the N and F hypotheses failed to resolve for every
 * candidate). A single-star system trivially returns that star.
 */
export function influencingStar(body: SystemBody): InfluencingStarResult | null {
  const stars = flattenStars(systemRoot(body));
  if (stars.length === 0) { return null; }
  if (stars.length === 1) { return { star: stars[0], method: 'only-star', starCount: 1 }; }

  // N: real 3D distance flux, with near-tie time-averaging.
  const posCache = new Map<SystemBody, Vec3 | null>();
  const snapshot: ScoredStar[] = stars.map(star =>
    [star, flux(star.bodyData, calculatedDistanceLs(body, star, REFERENCE_MS, posCache))]);

  if (snapshot.every(([, s]) => s != null)) {
    let effective = snapshot;
    const ranked = snapshot.map(([, s]) => s!).sort((a, b) => b - a);
    const nearTie = ranked.length >= 2 && ranked[1] > 0 && ranked[0] / ranked[1] <= NEAR_TIE_RATIO_THRESHOLD;
    if (nearTie) {
      effective = snapshot.map(([star, snapScore]) => [star, timeAveragedFlux(body, star) ?? snapScore]);
    }
    const winner = pickMax(applyBoosts(effective));
    if (winner) { return { star: winner, method: 'flux-3d', starCount: stars.length }; }
    // (only reachable on an exact score tie — vanishingly rare; fall through to F)
  }

  // F fallback: characteristic orbital-scale distance flux.
  const characteristic: ScoredStar[] = stars.map(star =>
    [star, flux(star.bodyData, characteristicDistanceAu(body, star))]);
  const winner = pickMax(applyBoosts(characteristic));
  return winner ? { star: winner, method: 'flux-characteristic', starCount: stars.length } : null;
}
