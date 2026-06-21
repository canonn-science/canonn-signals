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

/** Milliseconds per day, used to convert orbital periods (days) to wall-clock time. */
const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Angular tolerance (degrees) for matching a Lagrange geometry. */
const ANGLE_TOLERANCE_DEG = 1;
/** Tolerance (degrees) for L1/L2 alignment of argument-of-periapsis and ascending node. */
const ALIGNMENT_TOLERANCE_DEG = 5;
/** Tolerance (degrees) for equal rosette spacing. */
const ROSETTE_TOLERANCE_DEG = 5;

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
}
