import { Injectable } from '@angular/core';
import { CanonnBiostatsBody, SystemBody } from '../home/home.component';

/** Result of Trojan/Lagrange analysis for a body relative to its co-orbital siblings. */
export interface TrojanStatus {
  /** Lagrange point the body occupies ('L1'–'L5'), or null when it is not a Trojan. */
  lagrangePoint: string | null;
  /** True when this body hosts Trojans at both L4 and L5 (it is the reference body, not a Trojan). */
  isHost: boolean;
}

/** A future periapsis/apoapsis passage: when it occurs and how many days away it is. */
export interface OrbitalEvent {
  date: Date;
  days: number;
}

/**
 * The contact *window* of a collision: a collision is an interval, not an instant. `start`
 * is when the bodies' separation first drops below the sum of their radii and `end` is when
 * it rises back above; `days` is the number of days from `now` until `start` (it can be
 * slightly negative when contact is already in progress at `now`).
 */
export interface CollisionWindow {
  start: Date;
  end: Date;
  days: number;
  /** Centre-to-centre separation (km) at closest approach within the window — the deepest point of contact. */
  minSeparationKm: number;
}

/** Result of collision-candidate analysis for a body relative to a crossing-orbit sibling. */
export interface CollisionStatus {
  /** True when this body shares its parent with a sibling on a crossing, near-coplanar orbit. */
  isCandidate: boolean;
  /** Name of the sibling whose orbit crosses this body's, or null when none. */
  partnerName: string | null;
  /** Synodic period (days) between the pair — the interval between successive conjunctions. */
  synodicPeriodDays: number | null;
  /** Next contact window (when the bodies are within combined radii), or null when timing data is missing. */
  nextCollision: CollisionWindow | null;
  /** Up to 10 upcoming contact windows in chronological order; empty when timing data is missing. */
  upcomingCollisions: CollisionWindow[];
  /** Sum of the two bodies' radii (km) — the contact threshold; null when not a candidate. */
  combinedRadiiKm: number | null;
  /**
   * Names of additional siblings (beyond the primary partner) that are also on crossing orbits
   * with any member of this collision group, forming a multi-body collision cluster.
   * Empty for simple pairs.
   */
  simultaneousPartners: string[];
}

/** Milliseconds per day, used to convert orbital periods (days) to wall-clock time. */
const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Kilometres per astronomical unit, to compare body radii against orbital distances. */
const KM_PER_AU = 149597870.7;
/** Radians per degree, for the 3D Keplerian position maths. */
const DEG_TO_RAD = Math.PI / 180;
/**
 * Coarse orbit-curve sampling step (degrees of mean anomaly) for the proximity test is
 * adaptive: a fixed step that resolves a wide pair would step right over the narrow close-
 * approach valley of two tightly-nested orbits and report a wildly inflated minimum. We scale
 * the step so adjacent samples sit ~one contact-distance apart in arc length, clamped between
 * these bounds (fine for nested pairs, coarse — the historical 1° — for well-separated ones).
 */
const ORBIT_MIN_STEP_DEG = 0.05;
const ORBIT_MAX_STEP_DEG = 1;
/** How many of the closest coarse cells to refine from (covers multiple close-approach basins). */
const ORBIT_REFINE_TOPK = 6;
/** Half-grid size (per axis) for each zoom pass refining the orbit-to-orbit minimum. */
const ORBIT_REFINE_GRID = 4;
/** Number of zoom passes refining the orbit-to-orbit minimum distance. */
const ORBIT_REFINE_ITERATIONS = 10;
/** Upper bound on conjunctions examined before giving up on finding a collision date. */
const MAX_CONJUNCTIONS_SCANNED = 300;

/** Angular tolerance (degrees) for matching a Lagrange geometry. */
const ANGLE_TOLERANCE_DEG = 1;
/** Tolerance (degrees) for L1/L2 alignment of argument-of-periapsis and ascending node. */
const ALIGNMENT_TOLERANCE_DEG = 5;
/** Tolerance (degrees) for equal rosette spacing. */
const ROSETTE_TOLERANCE_DEG = 5;

/** A 3D position in the system's shared frame (kilometres). */
interface Vec3 { x: number; y: number; z: number; }

/**
 * Detects co-orbital configurations (Trojan/Lagrange points and rosettes) by comparing
 * a body's Keplerian elements with those of its siblings under the same parent. Pure —
 * no Angular/DOM dependency — so it can be unit-tested directly. Extracted from
 * SystemBodyComponent.
 */
@Injectable({ providedIn: 'root' })
export class OrbitalRelationsService {
  /** Bodies that share this body's parent (excluding itself) and expose an argOfPeriapsis. */
  private coOrbitalSiblings(
    body: SystemBody,
    predicate: (sibling: SystemBody) => boolean,
  ): SystemBody[] {
    const parent = body.parent;
    if (!parent) { return []; }
    return parent.subBodies.filter(sibling =>
      sibling !== body &&
      sibling.bodyData.orbitalPeriod === body.bodyData.orbitalPeriod &&
      sibling.bodyData.argOfPeriapsis !== undefined &&
      predicate(sibling),
    );
  }

  /** Signed angular difference a − b normalised to (−180, 180]. */
  private signedAngleDiff(a: number, b: number): number {
    return ((a - b + 540) % 360) - 180;
  }

  detectTrojanStatus(body: SystemBody): TrojanStatus {
    const result: TrojanStatus = { lagrangePoint: null, isHost: false };
    const bd = body.bodyData;
    if (!body.parent || !bd.orbitalPeriod || !bd.semiMajorAxis || bd.argOfPeriapsis === undefined) {
      return result;
    }

    // L3, L4, L5 candidates share the same orbital distance (semi-major axis).
    const sameSMABodies = this.coOrbitalSiblings(body, sibling =>
      sibling.bodyData.semiMajorAxis === bd.semiMajorAxis,
    );

    // A body with co-orbital neighbours at both +60° and −60° is the host of the Trojan
    // pair (the massive reference body); it should not itself be labelled a Trojan.
    let hasLeadingTrojan = false;
    let hasTrailingTrojan = false;
    for (const sibling of sameSMABodies) {
      const diff = this.signedAngleDiff(sibling.bodyData.argOfPeriapsis!, bd.argOfPeriapsis!);
      if (Math.abs(diff - 60) < ANGLE_TOLERANCE_DEG) hasLeadingTrojan = true;
      if (Math.abs(diff + 60) < ANGLE_TOLERANCE_DEG) hasTrailingTrojan = true;
    }
    if (hasLeadingTrojan && hasTrailingTrojan) {
      result.isHost = true;
      return result;
    }

    for (const sibling of sameSMABodies) {
      const argDiff = Math.abs(bd.argOfPeriapsis! - sibling.bodyData.argOfPeriapsis!);
      const normalizedDiff = Math.min(argDiff, 360 - argDiff);

      if (Math.abs(normalizedDiff - 60) < ANGLE_TOLERANCE_DEG) {
        const relativePos = this.signedAngleDiff(bd.argOfPeriapsis!, sibling.bodyData.argOfPeriapsis!);
        result.lagrangePoint = relativePos > 0 ? 'L4' : 'L5';
        return result;
      } else if (Math.abs(normalizedDiff - 180) < ANGLE_TOLERANCE_DEG) {
        result.lagrangePoint = 'L3';
        return result;
      }
    }

    // L1, L2 share the orbital period but sit at a different distance, aligned in
    // argument-of-periapsis and ascending node.
    const samePeriodBodies = this.coOrbitalSiblings(body, sibling =>
      sibling.bodyData.semiMajorAxis !== bd.semiMajorAxis &&
      sibling.bodyData.ascendingNode !== undefined,
    );

    for (const sibling of samePeriodBodies) {
      // Use wrapped angular differences so an aligned pair straddling the 0°/360°
      // seam (e.g. 1° vs 359°) is still recognised as aligned.
      const argDiff = Math.abs(this.signedAngleDiff(bd.argOfPeriapsis!, sibling.bodyData.argOfPeriapsis!));
      const nodeDiff = Math.abs(this.signedAngleDiff(bd.ascendingNode || 0, sibling.bodyData.ascendingNode || 0));

      if (argDiff < ALIGNMENT_TOLERANCE_DEG && nodeDiff < ALIGNMENT_TOLERANCE_DEG) {
        result.lagrangePoint = bd.semiMajorAxis! < sibling.bodyData.semiMajorAxis! ? 'L1' : 'L2';
        return result;
      }
    }

    return result;
  }

  /**
   * Returns a "Rosette (n)" label when this body belongs to a group of ≥3 co-orbital
   * bodies evenly spaced around the parent, or null otherwise.
   */
  detectRosetteStatus(body: SystemBody): string | null {
    const bd = body.bodyData;
    if (!body.parent || !bd.orbitalPeriod || !bd.semiMajorAxis || bd.argOfPeriapsis === undefined) {
      return null;
    }

    // Include this body itself in the group (it shares its own elements).
    const rosetteGroup = body.parent.subBodies.filter(sibling =>
      sibling.bodyData.orbitalPeriod === bd.orbitalPeriod &&
      sibling.bodyData.semiMajorAxis === bd.semiMajorAxis &&
      sibling.bodyData.argOfPeriapsis !== undefined,
    );

    if (rosetteGroup.length < 3) return null;

    const angles = rosetteGroup.map(b => b.bodyData.argOfPeriapsis!).sort((a, b) => a - b);
    const expectedSpacing = 360 / rosetteGroup.length;

    for (let i = 0; i < angles.length; i++) {
      const nextIndex = (i + 1) % angles.length;
      let spacing = angles[nextIndex] - angles[i];
      if (spacing < 0) spacing += 360;
      if (Math.abs(spacing - expectedSpacing) > ROSETTE_TOLERANCE_DEG) {
        return null;
      }
    }

    return `Rosette (${rosetteGroup.length})`;
  }

  /**
   * Mean anomaly (degrees, wrapped to [0, 360)) propagated from the recorded sample
   * to `now`. Inputs are assumed present; callers guard for missing orbital elements.
   */
  meanAnomalyNow(
    meanAnomalyDeg: number,
    orbitalPeriodDays: number,
    meanAnomalyTimestamp: string,
    now: number = Date.now(),
  ): number {
    const timestampMs = new Date(meanAnomalyTimestamp).getTime();
    const elapsedDays = (now - timestampMs) / MS_PER_DAY;
    const orbitalCycles = elapsedDays / orbitalPeriodDays;
    // JS `%` keeps the sign of the dividend, so a negative mean anomaly (or a `now`
    // before the sample timestamp) would otherwise return a value in (-360, 0). Add a
    // full turn and re-wrap so the result is genuinely in [0, 360) as documented.
    return (((meanAnomalyDeg + orbitalCycles * 360) % 360) + 360) % 360;
  }

  /**
   * Converts a mean anomaly (degrees) to a true anomaly (degrees, wrapped to [0, 360))
   * for the given eccentricity by solving Kepler's equation M = E - e·sin E with
   * Newton–Raphson, then mapping the eccentric anomaly E to the true anomaly ν. This
   * gives the body's actual angular position along its orbit, measured from periapsis.
   */
  meanToTrueAnomaly(meanAnomalyDeg: number, eccentricity: number): number {
    // Guard against non-finite inputs (e.g. a NaN eccentricity) so a single bad field
    // can't poison the solver into returning NaN and silently freezing the live marker.
    const e = Number.isFinite(eccentricity) ? Math.min(Math.max(eccentricity, 0), 0.999) : 0;
    const meanDeg = Number.isFinite(meanAnomalyDeg) ? meanAnomalyDeg : 0;
    const M = ((meanDeg % 360) + 360) % 360 * (Math.PI / 180);

    // Newton–Raphson on f(E) = E - e·sin E - M. A handful of iterations converges to
    // machine precision for all bound (e < 1) orbits.
    let E = e < 0.8 ? M : Math.PI;
    for (let i = 0; i < 12; i++) {
      const delta = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      E -= delta;
      if (Math.abs(delta) < 1e-10) break;
    }

    const trueAnomaly = 2 * Math.atan2(
      Math.sqrt(1 + e) * Math.sin(E / 2),
      Math.sqrt(1 - e) * Math.cos(E / 2),
    );
    return ((trueAnomaly * (180 / Math.PI)) % 360 + 360) % 360;
  }

  /** Degrees the body must still travel to reach its next apoapsis (180°) or periapsis (360°/0°). */
  degreesToEvent(currentMeanAnomaly: number, type: 'apo' | 'peri'): number {
    if (type === 'apo') {
      let degrees = (180 - currentMeanAnomaly) % 360;
      if (degrees < 0) { degrees += 360; }
      return degrees;
    }
    return (360 - currentMeanAnomaly) % 360;
  }

  /**
   * Next apoapsis/periapsis passage for a body, or null when the orbital elements are
   * missing or the orbit is circular (no distinguishable apsis). Pure and time-injectable.
   */
  nextOrbitalEvent(bd: CanonnBiostatsBody, type: 'apo' | 'peri', now: number = Date.now()): OrbitalEvent | null {
    // Use a null/undefined check for meanAnomaly (not a falsy check): a body that was
    // exactly at periapsis at sample time has a legitimate meanAnomaly of 0, which a
    // falsy check would wrongly treat as missing data and suppress the event row.
    // `!bd.orbitalEccentricity` already excludes a circular orbit (e = 0, the "no
    // distinguishable apsis" case) along with missing/NaN values.
    if (bd.meanAnomaly == null || !bd.orbitalPeriod || !bd.timestamps?.meanAnomaly ||
      !bd.orbitalEccentricity) {
      return null;
    }
    const currentMeanAnomaly = this.meanAnomalyNow(bd.meanAnomaly, bd.orbitalPeriod, bd.timestamps.meanAnomaly, now);
    const days = (this.degreesToEvent(currentMeanAnomaly, type) / 360) * bd.orbitalPeriod;
    // A present-but-unparseable meanAnomaly timestamp makes `currentMeanAnomaly`
    // (and thus `days`) NaN; bail out rather than emit an Invalid Date that the
    // template's date pipe would throw on (NG02100/NG02311).
    if (!Number.isFinite(days)) {
      return null;
    }
    return { date: new Date(now + days * MS_PER_DAY), days };
  }

  /**
   * Orbital radial range [periapsis, apoapsis] in AU, or null for an orbit that isn't a
   * bound, recurring ellipse: a missing/non-positive semi-major axis, or an eccentricity
   * ≥ 1 (parabolic/hyperbolic escape trajectory, which has no apoapsis and never returns,
   * so it can't be a recurring collision partner). The `> 0` check is deliberate — a
   * falsy/`!` test would let a negative semi-major axis (the convention for hyperbolic
   * orbits, or corrupt external data) through and produce an inverted range.
   */
  private orbitalRadialRange(bd: CanonnBiostatsBody): { peri: number; apo: number } | null {
    if (!(bd.semiMajorAxis! > 0)) { return null; }
    const e = bd.orbitalEccentricity ?? 0;
    if (!(e >= 0) || e >= 1) { return null; }
    return { peri: bd.semiMajorAxis! * (1 - e), apo: bd.semiMajorAxis! * (1 + e) };
  }

  /**
   * Parent-centric position (km) of a body at the given mean anomaly, from its Keplerian
   * elements. Solves Kepler's equation for the eccentric anomaly, places the body in its
   * orbital plane, then rotates by argument-of-periapsis, inclination and ascending node
   * into the shared 3D frame. This is the geometry both the orbit-proximity test and the
   * time-stepped collision search build on.
   */
  private orbitalStateVector(bd: CanonnBiostatsBody, meanAnomalyDeg: number): Vec3 {
    const a = bd.semiMajorAxis! * KM_PER_AU;
    const e = Math.min(Math.max(bd.orbitalEccentricity ?? 0, 0), 0.999);
    const M = (((meanAnomalyDeg % 360) + 360) % 360) * DEG_TO_RAD;

    let E = e < 0.8 ? M : Math.PI;
    for (let i = 0; i < 12; i++) {
      const delta = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      E -= delta;
      if (Math.abs(delta) < 1e-12) { break; }
    }

    // Position in the orbital plane (periapsis along +x), then standard 3-1-3 rotation.
    // The ED/Spansh data uses the opposite sign convention from the standard astronomical
    // frame, so both angles must be negated before the rotation is applied.
    const xo = a * (Math.cos(E) - e);
    const yo = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const node = -(bd.ascendingNode ?? 0) * DEG_TO_RAD;
    const argp = -(bd.argOfPeriapsis ?? 0) * DEG_TO_RAD;
    const incl = (bd.orbitalInclination ?? 0) * DEG_TO_RAD;
    const cO = Math.cos(node), sO = Math.sin(node);
    const cw = Math.cos(argp), sw = Math.sin(argp);
    const ci = Math.cos(incl), si = Math.sin(incl);
    return {
      x: xo * (cO * cw - sO * sw * ci) - yo * (cO * sw + sO * cw * ci),
      y: xo * (sO * cw + cO * sw * ci) - yo * (sO * sw - cO * cw * ci),
      z: xo * (sw * si) + yo * (cw * si),
    };
  }

  /**
   * Minimum distance (km) between the two orbit *curves*, independent of where each body
   * currently is. When this exceeds the sum of the bodies' radii the orbits never touch in
   * 3D — even if their radial ranges overlap, a relative tilt can hold the paths permanently
   * apart — so the pair is not a collision candidate at all.
   *
   * Two near-circular orbits a few km apart approach within a sliver around their mutual
   * node, far narrower than a uniform sweep can resolve, so a fixed coarse grid alone reports
   * a wildly inflated minimum. We defend against that two ways: the coarse step is scaled to
   * the geometry (`contactKm` is the resolution we care about, so adjacent samples sit ~one
   * contact-distance apart in arc length), and we additionally seed the refinement on the
   * orbits' mutual line of nodes — where a relative tilt brings near-coplanar orbits closest.
   * We then refine from each seed and take the overall minimum.
   */
  private minOrbitDistanceKm(a: CanonnBiostatsBody, b: CanonnBiostatsBody, contactKm: number): number {
    // Resolve the close-approach valley: step so the arc between samples on the larger orbit
    // is roughly the contact distance. clamp keeps it cheap for wide pairs (1°, as before) and
    // fine enough for tightly-nested ones without an unbounded grid.
    const aMaxKm = Math.max(a.semiMajorAxis!, b.semiMajorAxis!) * KM_PER_AU;
    const stepDeg = Math.min(
      Math.max((contactKm / aMaxKm) * (180 / Math.PI), ORBIT_MIN_STEP_DEG),
      ORBIT_MAX_STEP_DEG,
    );

    // Positions are computed once per sampled angle (per axis) and reused across the cross
    // product, so an N×N grid costs 2N state-vector evaluations, not N².
    const coarse: number[] = [];
    for (let deg = 0; deg < 360; deg += stepDeg) { coarse.push(deg); }
    const posA = coarse.map(d => this.orbitalStateVector(a, d));
    const posB = coarse.map(d => this.orbitalStateVector(b, d));

    // Keep the K closest coarse cells, not just the single closest. The closest approach of
    // two near-coincident orbits lies in a narrow valley; the single best coarse sample can
    // sit on a shallower stretch of that valley while the true minimum hides in a different
    // cell, so we refine from several basins and take the overall minimum.
    const topK: { d2: number; i: number; j: number }[] = [];
    for (let i = 0; i < posA.length; i++) {
      for (let j = 0; j < posB.length; j++) {
        const dx = posA[i].x - posB[j].x, dy = posA[i].y - posB[j].y, dz = posA[i].z - posB[j].z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (topK.length < ORBIT_REFINE_TOPK) {
          topK.push({ d2, i, j });
          topK.sort((p, q) => q.d2 - p.d2); // worst first
        } else if (d2 < topK[0].d2) {
          topK[0] = { d2, i, j };
          topK.sort((p, q) => q.d2 - p.d2);
        }
      }
    }

    // Refinement seeds: the K closest grid cells, plus the two ends of the mutual line of
    // nodes (the line where the orbital planes intersect). For near-coplanar nested orbits the
    // true minimum sits on that line — the grid can step over it, but the node seed cannot.
    const seeds: [number, number][] = topK.map(cell => [coarse[cell.i], coarse[cell.j]]);
    for (const seed of this.lineOfNodeSeeds(posA, posB, coarse)) { seeds.push(seed); }

    let best = Infinity;
    for (const [startA, startB] of seeds) {
      best = Math.min(best, this.refineOrbitMinimum(a, b, startA, startB, stepDeg));
    }
    return best;
  }

  /**
   * Mean-anomaly seeds at the two ends of the orbits' mutual line of nodes (the intersection
   * of the two orbital planes), one (mean-anomaly-A, mean-anomaly-B) pair per end. For
   * near-coplanar nested orbits the closest 3D approach lies on this line, where the relative
   * tilt's vertical separation vanishes — a valley a uniform grid can step over. Returns []
   * for effectively coplanar orbits: their planes are parallel, there is no distinct node
   * line, and without a vertical valley the coarse grid already resolves the minimum.
   */
  private lineOfNodeSeeds(posA: Vec3[], posB: Vec3[], coarse: number[]): [number, number][] {
    // Two position vectors from the focus span each orbital plane; their cross product is the
    // plane normal. Use samples ~90° apart so they are well separated.
    const quarter = Math.floor(coarse.length / 4);
    const normalA = this.cross(posA[0], posA[quarter]);
    const normalB = this.cross(posB[0], posB[quarter]);
    const nodeLine = this.cross(normalA, normalB);
    if (this.norm(nodeLine) <= 1e-6 * this.norm(normalA) * this.norm(normalB)) { return []; }

    const seeds: [number, number][] = [];
    for (const sign of [1, -1]) {
      const dir: Vec3 = { x: sign * nodeLine.x, y: sign * nodeLine.y, z: sign * nodeLine.z };
      seeds.push([this.mostAligned(posA, coarse, dir), this.mostAligned(posB, coarse, dir)]);
    }
    return seeds;
  }

  /** Mean anomaly of the sampled position whose direction (from the focus) best aligns with `dir`. */
  private mostAligned(pos: Vec3[], coarse: number[], dir: Vec3): number {
    let bestCos = -Infinity, bestIndex = 0;
    for (let i = 0; i < pos.length; i++) {
      const cos = this.dot(pos[i], dir) / this.norm(pos[i]);
      if (cos > bestCos) { bestCos = cos; bestIndex = i; }
    }
    return coarse[bestIndex];
  }

  private cross(p: Vec3, q: Vec3): Vec3 {
    return { x: p.y * q.z - p.z * q.y, y: p.z * q.x - p.x * q.z, z: p.x * q.y - p.y * q.x };
  }
  private dot(p: Vec3, q: Vec3): number { return p.x * q.x + p.y * q.y + p.z * q.z; }
  private norm(p: Vec3): number { return Math.sqrt(this.dot(p, p)); }

  /**
   * Refines the orbit-to-orbit minimum distance starting from a coarse (mean-anomaly-A,
   * mean-anomaly-B) cell, by repeatedly sampling a shrinking window around the running best.
   */
  private refineOrbitMinimum(a: CanonnBiostatsBody, b: CanonnBiostatsBody, startA: number, startB: number, stepDeg: number): number {
    let aDeg = startA, bDeg = startB, best = Infinity;
    let half = stepDeg;
    for (let iter = 0; iter < ORBIT_REFINE_ITERATIONS; iter++) {
      const degsA: number[] = [], degsB: number[] = [];
      for (let k = -ORBIT_REFINE_GRID; k <= ORBIT_REFINE_GRID; k++) {
        degsA.push(aDeg + (k / ORBIT_REFINE_GRID) * half);
        degsB.push(bDeg + (k / ORBIT_REFINE_GRID) * half);
      }
      const posA = degsA.map(d => this.orbitalStateVector(a, d));
      const posB = degsB.map(d => this.orbitalStateVector(b, d));
      let cA = aDeg, cB = bDeg;
      for (let i = 0; i < posA.length; i++) {
        for (let j = 0; j < posB.length; j++) {
          const dx = posA[i].x - posB[j].x, dy = posA[i].y - posB[j].y, dz = posA[i].z - posB[j].z;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d < best) { best = d; cA = degsA[i]; cB = degsB[j]; }
        }
      }
      aDeg = cA; bDeg = cB;
      half /= ORBIT_REFINE_GRID; // next window spans the previous grid spacing
    }
    return best;
  }

  /**
   * Finds the time of minimum separation between two bodies within
   * [centerMs − halfWindowMs, centerMs + halfWindowMs] using iterative zoom: 40 samples
   * per pass, window halved and recentred on the running best each pass, until the
   * half-window is under 500 ms (sub-second precision). This resolves arbitrarily narrow
   * contact windows regardless of orbital scale.
   */
  /**
   * Returns up to `count` upcoming contact windows between two bodies.
   *
   * Algorithm:
   *   1. Coarse scan over [now − ½syn, now + 1syn] with 2000 equal steps to locate the
   *      closest-approach spike (a sharp local minimum in the distance-vs-time curve).
   *   2. Iteratively refine: centre a ±½syn window on the running best and halve each pass
   *      until the half-window is under 500 ms (sub-second precision).
   *   3. Step backward in synodic-period increments until the reference time is before now.
   *   4. March forward one synodic period at a time; zoom-refine each event to sub-second
   *      precision and record it as a contact when separation ≤ contactKm.
   *
   * Not every close approach is a collision — many conjunctions miss the orbits' mutual node
   * — so each synodic event is evaluated individually rather than assumed to collide.
   */
  private nextContacts(a: CanonnBiostatsBody, b: CanonnBiostatsBody, contactKm: number, synodicDays: number, now: number, count: number): CollisionWindow[] {
    if (
      a.meanAnomaly == null || !a.orbitalPeriod || !a.timestamps?.meanAnomaly ||
      b.meanAnomaly == null || !b.orbitalPeriod || !b.timestamps?.meanAnomaly ||
      !Number.isFinite(synodicDays)
    ) { return []; }

    const epochA = Date.parse(a.timestamps!.meanAnomaly!);
    const epochB = Date.parse(b.timestamps!.meanAnomaly!);
    const sep = (tMs: number): number => {
      const Ma = a.meanAnomaly! + ((tMs - epochA) / MS_PER_DAY / a.orbitalPeriod!) * 360;
      const Mb = b.meanAnomaly! + ((tMs - epochB) / MS_PER_DAY / b.orbitalPeriod!) * 360;
      const pa = this.orbitalStateVector(a, Ma);
      const pb = this.orbitalStateVector(b, Mb);
      const dx = pa.x - pb.x, dy = pa.y - pb.y, dz = pa.z - pb.z;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    };

    const synodicMs = synodicDays * MS_PER_DAY;
    // 2000 steps keeps the first-pass resolution (≈ synodic/2000 per step) comfortably
    // below the narrowest expected contact window (~10 h for pairs with ~430-day synodics).
    const STEPS = 2000;

    /**
     * Zoom to sub-second precision by repeatedly sampling STEPS points over a ±half window
     * centred on the running best, halving each pass until half < 500 ms.
     */
    const zoomMin = (centerMs: number, halfMs: number): { t: number; sepKm: number } => {
      let bestT = centerMs;
      let bestS = Infinity;
      let half = halfMs;
      while (half > 500) {
        const lo = bestT - half;
        const hi = bestT + half;
        const step = (hi - lo) / STEPS;
        bestS = Infinity;
        for (let t = lo; t <= hi; t += step) {
          const s = sep(t);
          if (s < bestS) { bestS = s; bestT = t; }
        }
        half /= 2;
      }
      return { t: bestT, sepKm: bestS };
    };

    // Step 1: coarse scan over [now − ½syn, now + 1syn] with STEPS equal steps.
    const scanLo = now - synodicMs / 2;
    const scanHi = now + synodicMs;
    let initBestT = now;
    let initBestS = Infinity;
    const initStep = (scanHi - scanLo) / STEPS;
    for (let t = scanLo; t <= scanHi; t += initStep) {
      const s = sep(t);
      if (s < initBestS) { initBestS = s; initBestT = t; }
    }

    // Step 2: refine the coarse best with ±½syn halving to sub-second precision.
    const ref = zoomMin(initBestT, synodicMs / 2);

    // Step 3: step backward in synodic-period increments until t < now.
    let t0 = ref.t;
    while (t0 >= now) { t0 -= synodicMs; }

    // Step 4: march forward, zoom-refining each synodic event and collecting contacts.
    const stepMs = (30 / 86400) * MS_PER_DAY; // 30-second probes for window bisection
    const maxSpanMs = synodicMs / 2;           // bisection walk bound: half a synodic period
    const results: CollisionWindow[] = [];

    for (let k = 0; k < MAX_CONJUNCTIONS_SCANNED && results.length < count; k++) {
      const candidateMs = t0 + k * synodicMs;
      const min = zoomMin(candidateMs, synodicMs / 2);
      // Allow min.t to be slightly before now: a contact whose minimum lands at now±ε
      // (e.g. bodies aligned at the reference epoch) must not be discarded. We only skip
      // conjunctions whose minimum is older than half a synodic period; contacts whose
      // window has already ended are filtered below after computing endMs.
      if (min.t < now - maxSpanMs || !Number.isFinite(min.sepKm)) { continue; }
      if (min.sepKm > contactKm) { continue; }

      // De-duplicate: skip if this minimum falls inside the last recorded contact window.
      if (results.length > 0 && min.t <= results[results.length - 1].end.getTime()) { continue; }

      // Root-find the contact window start (backward bisection from min.t).
      let lo = min.t;
      let hi = min.t - stepMs;
      while (min.t - hi <= maxSpanMs && sep(hi) <= contactKm) { lo = hi; hi -= stepMs; }
      for (let i = 0; i < 40; i++) {
        const mid = (hi + lo) / 2;
        if (sep(mid) > contactKm) { hi = mid; } else { lo = mid; }
      }
      const startMs = lo;
      if (results.length > 0 && startMs <= results[results.length - 1].end.getTime()) { continue; }

      // Root-find the contact window end (forward bisection from min.t).
      let elo = min.t;
      let ehi = min.t + stepMs;
      while (ehi - min.t <= maxSpanMs && sep(ehi) <= contactKm) { elo = ehi; ehi += stepMs; }
      for (let i = 0; i < 40; i++) {
        const mid = (elo + ehi) / 2;
        if (sep(mid) > contactKm) { ehi = mid; } else { elo = mid; }
      }
      const endMs = elo;

      // Skip contacts whose window ended entirely before now (historical events; days < 0
      // and the window is over). Contacts in progress (endMs > now, startMs ≤ now) are kept:
      // days will be slightly negative, which CollisionWindow.days documents as intentional.
      if (endMs < now) { continue; }

      results.push({ start: new Date(startMs), end: new Date(endMs), days: (startMs - now) / MS_PER_DAY, minSeparationKm: min.sepKm });
    }
    return results;
  }

  /**
   * Flags a body as a collision candidate when a sibling under the same parent is on a
   * crossing orbit whose path comes within the sum of the two bodies' radii. The reported
   * next-collision date is the next time the bodies are actually that close in 3D — not
   * merely at the same longitude, since most conjunctions pass clear of the orbits' mutual
   * intersection. Same-period co-orbital bodies (Trojans/rosettes) are excluded: they never
   * lap each other (infinite synodic period) and are handled by the Trojan/rosette detectors.
   *
   * Note: this deliberately goes beyond the Canonn reference spreadsheet's 2D method (radial
   * apo/periapsis-band overlap + synodic period, ignoring inclination, ascending node, and
   * phase). The two agree for near-coplanar pairs but diverge on inclined pairs, where the 3D
   * model defers the collision to the next conjunction that actually falls on the mutual node.
   */
  detectCollisionStatus(body: SystemBody, now: number = Date.now()): CollisionStatus {
    const none: CollisionStatus = {
      isCandidate: false, partnerName: null, synodicPeriodDays: null, nextCollision: null, upcomingCollisions: [], combinedRadiiKm: null, simultaneousPartners: [],
    };
    const bd = body.bodyData;
    const range = this.orbitalRadialRange(bd);
    if (!body.parent || !bd.orbitalPeriod || !range) { return none; }

    let best: { partner: SystemBody; synodic: number; events: CollisionWindow[]; contactKm: number } | null = null;
    for (const sibling of body.parent.subBodies) {
      if (sibling === body) { continue; }
      const sd = sibling.bodyData;
      const sRange = this.orbitalRadialRange(sd);
      if (!sd.orbitalPeriod || !sRange) { continue; }
      // Equal periods never lap (synodic period → ∞): these are stable co-orbital pairs.
      if (sd.orbitalPeriod === bd.orbitalPeriod) { continue; }

      // Cheap radial pre-filter: if the orbits' distance bands can't approach within the
      // bodies' combined radius, they can never touch — skip the costly 3D work below.
      const contactKm = (bd.radius ?? 0) + (sd.radius ?? 0);
      const radialGapAu = Math.max(range.peri, sRange.peri) - Math.min(range.apo, sRange.apo);
      if (radialGapAu > contactKm / KM_PER_AU) { continue; }

      // Exact 3D candidacy: do the orbit curves themselves come within contact distance? A
      // relative tilt can keep radially-overlapping orbits permanently apart.
      if (this.minOrbitDistanceKm(bd, sd, contactKm) > contactKm) { continue; }

      const synodic = 1 / Math.abs(1 / bd.orbitalPeriod - 1 / sd.orbitalPeriod);
      // Fetch the first contact only for partner selection; the winning partner gets the full 10.
      const events = this.nextContacts(bd, sd, contactKm, synodic, now, 1);
      const first = events[0] ?? null;
      // Prefer the partner with the soonest predicted collision; keep any geometric
      // candidate as a fallback when timing data is unavailable for an earlier one.
      if (!best || (first && (!best.events[0] || first.days < best.events[0].days))) {
        best = { partner: sibling, synodic, events, contactKm };
      }
    }

    if (!best) { return none; }

    // Expand the winning partner to the full upcoming-collisions list.
    const upcoming = this.nextContacts(bd, best.partner.bodyData, best.contactKm, best.synodic, now, 10);

    // Identify additional siblings that are part of the same crossing-orbit group, making
    // this a multi-body cluster. Grow the group transitively: if A crosses B and B crosses C,
    // C is in the group even if A doesn’t directly cross C.
    const groupMembers = new Set<string>([bd.name, best.partner.bodyData.name]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const sibling of body.parent.subBodies) {
        if (groupMembers.has(sibling.bodyData.name)) { continue; }
        const sd = sibling.bodyData;
        const sRange = this.orbitalRadialRange(sd);
        if (!sd.orbitalPeriod || !sRange) { continue; }
        for (const memberName of groupMembers) {
          const member = memberName === bd.name
            ? body
            : body.parent!.subBodies.find(s => s.bodyData.name === memberName);
          if (!member) { continue; }
          const md = member.bodyData;
          const mRange = this.orbitalRadialRange(md);
          if (!mRange || !md.orbitalPeriod || md.orbitalPeriod === sd.orbitalPeriod) { continue; }
          const contactKm = (md.radius ?? 0) + (sd.radius ?? 0);
          const radialGapAu = Math.max(mRange.peri, sRange.peri) - Math.min(mRange.apo, sRange.apo);
          if (radialGapAu > contactKm / KM_PER_AU) { continue; }
          if (this.minOrbitDistanceKm(md, sd, contactKm) > contactKm) { continue; }
          groupMembers.add(sibling.bodyData.name);
          changed = true;
          break;
        }
      }
    }
    const simultaneousPartners = [...groupMembers].filter(n => n !== bd.name && n !== best!.partner.bodyData.name);

    return {
      isCandidate: true,
      partnerName: best.partner.bodyData.name,
      synodicPeriodDays: best.synodic,
      nextCollision: upcoming[0] ?? null,
      upcomingCollisions: upcoming,
      combinedRadiiKm: best.contactKm,
      simultaneousPartners,
    };
  }
}
