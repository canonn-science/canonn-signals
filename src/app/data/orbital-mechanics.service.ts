import { Injectable } from '@angular/core';
import { SystemBody } from '../home/home.component';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/** Kilometres per astronomical unit. */
const KM_PER_AU = 149597870.7;

/**
 * Pure orbital-mechanics helpers extracted from SystemBodyComponent. Operates on
 * Keplerian elements / SystemBody data and has no Angular or DOM dependencies, so
 * it can be unit-tested directly.
 */
@Injectable({ providedIn: 'root' })
export class OrbitalMechanicsService {
  /**
   * Converts Keplerian orbital elements to a 3D Cartesian position (km) in the
   * reference frame, solving Kepler's equation for the eccentric anomaly.
   */
  orbitalElementsToCartesian(
    semiMajorAxisAU: number,
    eccentricity: number,
    inclinationDeg: number,
    argPeriapsisDeg: number,
    ascendingNodeDeg: number,
    meanAnomalyDeg: number,
  ): Vector3 {
    const a = semiMajorAxisAU * KM_PER_AU; // AU to km
    const e = eccentricity;
    const i = inclinationDeg * Math.PI / 180;
    const w = argPeriapsisDeg * Math.PI / 180;
    const omega = ascendingNodeDeg * Math.PI / 180;
    const M = meanAnomalyDeg * Math.PI / 180;

    // Solve Kepler's equation for eccentric anomaly E
    let E = M;
    for (let iter = 0; iter < 10; iter++) {
      E = M + e * Math.sin(E);
    }

    // True anomaly
    const nu = 2 * Math.atan2(
      Math.sqrt(1 + e) * Math.sin(E / 2),
      Math.sqrt(1 - e) * Math.cos(E / 2),
    );

    // Distance from focus
    const r = a * (1 - e * Math.cos(E));

    // Position in orbital plane
    const xOrb = r * Math.cos(nu);
    const yOrb = r * Math.sin(nu);

    // Rotate to reference frame
    const cosW = Math.cos(w);
    const sinW = Math.sin(w);
    const cosO = Math.cos(omega);
    const sinO = Math.sin(omega);
    const cosI = Math.cos(i);
    const sinI = Math.sin(i);

    const x = (cosO * cosW - sinO * sinW * cosI) * xOrb + (-cosO * sinW - sinO * cosW * cosI) * yOrb;
    const y = (sinO * cosW + cosO * sinW * cosI) * xOrb + (-sinO * sinW + cosO * cosW * cosI) * yOrb;
    const z = (sinW * sinI) * xOrb + (cosW * sinI) * yOrb;

    return { x, y, z };
  }

  /**
   * Position of a body in system coordinates (km), accounting for the hierarchical
   * parent-child orbit chain. Each body in the chain uses its current mean anomaly.
   * Returns null when orbital data is missing for a non-primary body.
   */
  getBodyPositionInSystemFrame(body: SystemBody, meanAnomalyDeg: number): Vector3 | null {
    const bodyData = body.bodyData;

    // If no parent, this is the root body (at origin)
    if (!body.parent) {
      return { x: 0, y: 0, z: 0 };
    }

    // If no orbital data for a body that has a parent
    if (!bodyData.semiMajorAxis) {
      // Special case: bodyId 0 can be at origin even with a parent (primary star/barycentre)
      if (bodyData.bodyId === 0) {
        return { x: 0, y: 0, z: 0 };
      }
      // For any other body (including unknown barycentres), missing semiMajorAxis means we can't calculate position
      return null;
    }

    // Check if all required orbital parameters are present
    if (bodyData.orbitalEccentricity === null || bodyData.orbitalEccentricity === undefined ||
      bodyData.orbitalInclination === null || bodyData.orbitalInclination === undefined ||
      bodyData.argOfPeriapsis === null || bodyData.argOfPeriapsis === undefined ||
      bodyData.ascendingNode === null || bodyData.ascendingNode === undefined) {
      // Special case: bodyId 0 can be at origin even with missing parameters
      if (bodyData.bodyId === 0) {
        return { x: 0, y: 0, z: 0 };
      }
      // Missing orbital parameters for non-primary body (like unknown barycentres)
      return null;
    }

    // Get orbital elements (convert from Elite Dangerous convention)
    const sma = bodyData.semiMajorAxis;
    const ecc = bodyData.orbitalEccentricity;
    const inc = bodyData.orbitalInclination;
    const argP = -bodyData.argOfPeriapsis;
    const node = -bodyData.ascendingNode;

    // Compute position relative to parent using this body's mean anomaly
    const localPos = this.orbitalElementsToCartesian(sma, ecc, inc, argP, node, meanAnomalyDeg);

    // Recursively get parent's position in system frame using its own mean anomaly
    const parentMeanAnomaly = body.parent.bodyData.meanAnomaly || 0;
    const parentPos = this.getBodyPositionInSystemFrame(body.parent, parentMeanAnomaly);

    if (!parentPos) {
      // Parent chain has missing data - cannot calculate absolute position
      return null;
    }

    // Transform to system coordinates by adding parent's position
    return {
      x: localPos.x + parentPos.x,
      y: localPos.y + parentPos.y,
      z: localPos.z + parentPos.z,
    };
  }
}
