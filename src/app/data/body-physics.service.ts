import { Injectable } from '@angular/core';
import { CanonnBiostatsBody, SystemBody } from '../home/home.component';
import { BODY_TYPE } from './body-types';

/** Physical constants and unit conversions used across the body physics maths. */
const KM_PER_AU = 149597870.7;
const KM_PER_SOLAR_RADIUS = 695700;
const KG_PER_EARTH_MASS = 5.972e24;
const KG_PER_SOLAR_MASS = 1.989e30;
const KG_PER_MEGATONNE = 1e12;
const EARTH_MASSES_PER_SOLAR_MASS = 332950;

export interface PlanetaryDensity {
  value: number;
  unit: string;
  tooltip: string;
}

export interface ShepherdingHillLimit {
  hillRadius: number;
  bodyOrbitalRadius: number;
  bodyPeriapsis: number;
  bodyApoapsis: number;
  parentRadius: number;
  outermostRingRadius: number;
  withinRings: boolean;
  isFirstOutside: boolean;
}

export interface BodyRocheLimits {
  rigid: number;
  fluid: number;
  currentDistance: number;
  periapsis: number;
  apoapsis: number;
}

/**
 * Pure astrophysics for a body and its parent: densities, Roche limits, Hill
 * spheres and ring-shepherding analysis. Extracted from SystemBodyComponent so
 * the maths has no Angular/DOM dependency and can be unit-tested directly.
 */
@Injectable({ providedIn: 'root' })
export class BodyPhysicsService {
  private sphereVolumeM3(radiusM: number): number {
    return (4 / 3) * Math.PI * radiusM ** 3;
  }

  /** Parent radius in km, or null when the parent exposes no radius. */
  private parentRadiusKmOrNull(parent: CanonnBiostatsBody): number | null {
    if (parent.radius) { return parent.radius; }
    if (parent.solarRadius) { return parent.solarRadius * KM_PER_SOLAR_RADIUS; }
    return null;
  }

  /** Parent radius in km, defaulting to 0 when unknown (for ring/Hill geometry). */
  private parentRadiusKm(parent: CanonnBiostatsBody): number {
    return this.parentRadiusKmOrNull(parent) ?? 0;
  }

  /** Bulk density (kg/m³) of the primary, or null when mass/radius are unavailable. */
  private primaryDensityKgM3(parent: CanonnBiostatsBody): number | null {
    if (parent.earthMasses && parent.radius) {
      return parent.earthMasses * KG_PER_EARTH_MASS / this.sphereVolumeM3(parent.radius * 1000);
    }
    if (parent.mass && parent.radius) {
      return parent.mass * KG_PER_MEGATONNE / this.sphereVolumeM3(parent.radius * 1000);
    }
    if (parent.solarMasses && parent.solarRadius) {
      return parent.solarMasses * KG_PER_SOLAR_MASS / this.sphereVolumeM3(parent.solarRadius * KM_PER_SOLAR_RADIUS * 1000);
    }
    return null;
  }

  /** Assumed satellite (ring particle) density in kg/m³ based on ring composition. */
  ringSatelliteDensityKgM3(subType: string | null | undefined): number {
    const ringClass = subType?.toLowerCase() || '';
    if (ringClass.includes('metal')) { return 4500; }      // metal-rich / metallic (iron/nickel)
    if (ringClass.includes('metallic')) { return 4500; }
    if (ringClass.includes('rocky')) { return 3000; }      // silicates
    if (ringClass.includes('icy')) { return 1000; }        // water ice
    return 1000;                                            // default: icy rings
  }

  /** Outermost ring radius in km (rings store metres), or 0 when there are none. */
  private outermostRingRadiusKm(parent: CanonnBiostatsBody): number {
    let outermost = 0;
    for (const ring of parent.rings ?? []) {
      const outerRadiusKm = (ring.outerRadius || 0) / 1000;
      if (outerRadiusKm > outermost) { outermost = outerRadiusKm; }
    }
    return outermost;
  }

  /** Parent mass expressed in Earth masses, or null when unknown. */
  private parentMassEarthMasses(parent: CanonnBiostatsBody): number | null {
    if (parent.earthMasses) { return parent.earthMasses; }
    if (parent.solarMasses) { return parent.solarMasses * EARTH_MASSES_PER_SOLAR_MASS; }
    return null;
  }

  /** Density of a planet or star, formatted with an appropriate unit. */
  getPlanetaryDensity(bodyData: CanonnBiostatsBody): PlanetaryDensity | null {
    let radiusKm: number;
    if (bodyData.radius) {
      radiusKm = bodyData.radius;
    } else if (bodyData.solarRadius) {
      radiusKm = bodyData.solarRadius * KM_PER_SOLAR_RADIUS;
    } else {
      return null;
    }

    let massKg: number;
    if (bodyData.earthMasses) {
      massKg = bodyData.earthMasses * KG_PER_EARTH_MASS;
    } else if (bodyData.solarMasses) {
      massKg = bodyData.solarMasses * KG_PER_SOLAR_MASS;
    } else {
      return null;
    }

    const densityKgM3 = massKg / this.sphereVolumeM3(radiusKm * 1000);

    // Use g/cm³ for typical densities, kg/m³ for extreme ones (neutron stars, etc.).
    const value = densityKgM3 < 10000 ? densityKgM3 / 1000 : densityKgM3;
    const unit = densityKgM3 < 10000 ? 'g/cm³' : 'kg/m³';

    return { value, unit, tooltip: `${densityKgM3} kg/m³` };
  }

  /** Roche limit (km) for ring material orbiting the body's parent, for a given coefficient. */
  private ringRocheLimit(body: SystemBody, coefficient: number): number | null {
    if (!body.parent) { return null; }
    const parent = body.parent.bodyData;

    const primaryRadius = this.parentRadiusKmOrNull(parent);
    if (primaryRadius === null) { return null; }

    const primaryDensity = this.primaryDensityKgM3(parent);
    if (primaryDensity === null) { return null; }

    const satelliteDensity = this.ringSatelliteDensityKgM3(body.bodyData.subType);
    return coefficient * primaryRadius * Math.pow(primaryDensity / satelliteDensity, 1 / 3);
  }

  /** Rigid-body Roche limit (km) for solid ring material. */
  calculateRigidRocheLimit(body: SystemBody): number | null {
    return this.ringRocheLimit(body, 1.26);
  }

  /** Fluid-body Roche limit (km) for liquid ring material. */
  calculateFluidRocheLimit(body: SystemBody): number | null {
    return this.ringRocheLimit(body, 2.456);
  }

  /** Rigid and fluid Roche limits for a planet/moon (not rings), with its orbit extents. */
  calculateBodyRocheLimits(body: SystemBody): BodyRocheLimits | null {
    if (!body.parent || body.bodyData.type === BODY_TYPE.Ring || body.bodyData.type === BODY_TYPE.Star) {
      return null;
    }
    if (!body.bodyData.semiMajorAxis || !body.bodyData.radius || !body.bodyData.earthMasses) {
      return null;
    }

    const parent = body.parent.bodyData;
    const primaryRadius = this.parentRadiusKmOrNull(parent);
    if (primaryRadius === null) { return null; }

    const primaryDensity = this.primaryDensityKgM3(parent);
    if (primaryDensity === null) { return null; }

    const satelliteDensity =
      body.bodyData.earthMasses * KG_PER_EARTH_MASS / this.sphereVolumeM3(body.bodyData.radius * 1000);

    const densityRatio = Math.pow(primaryDensity / satelliteDensity, 1 / 3);
    const currentDistance = body.bodyData.semiMajorAxis * KM_PER_AU;
    const eccentricity = body.bodyData.orbitalEccentricity || 0;

    return {
      rigid: 1.26 * primaryRadius * densityRatio,
      fluid: 2.456 * primaryRadius * densityRatio,
      currentDistance,
      periapsis: currentDistance * (1 - eccentricity),
      apoapsis: currentDistance * (1 + eccentricity),
    };
  }

  /** True when the body orbits within (or just beyond) its parent's ring system. */
  isBodyWithinParentRings(body: SystemBody): boolean {
    if (!body.parent || body.bodyData.type === BODY_TYPE.Ring || body.bodyData.type === BODY_TYPE.Star) {
      return false;
    }
    if (!body.bodyData.semiMajorAxis) { return false; }

    const parent = body.parent.bodyData;
    if (!parent.rings || parent.rings.length === 0) { return false; }

    const bodyDistanceKm = body.bodyData.semiMajorAxis * KM_PER_AU;
    const parentRadius = this.parentRadiusKm(parent);
    const outermostRingRadius = this.outermostRingRadiusKm(parent);
    if (outermostRingRadius === 0) { return false; }

    // Within parent surface and outer ring edge, or within 20% of the ring extent beyond it.
    const ringSystemExtent = outermostRingRadius - parentRadius;
    const proximityThreshold = outermostRingRadius + (ringSystemExtent * 0.2);
    return bodyDistanceKm >= parentRadius && bodyDistanceKm <= proximityThreshold;
  }

  /** True when the body's Hill sphere could shepherd the parent's rings. */
  isShepherdingCandidate(body: SystemBody): boolean {
    if (!body.parent || body.bodyData.type === BODY_TYPE.Ring || body.bodyData.type === BODY_TYPE.Star) {
      return false;
    }
    if (!body.bodyData.semiMajorAxis) { return false; }

    const parent = body.parent.bodyData;
    if (!parent.rings || parent.rings.length === 0) { return false; }

    const bodyDistanceKm = body.bodyData.semiMajorAxis * KM_PER_AU;
    const parentRadius = this.parentRadiusKm(parent);
    const outermostRingRadius = this.outermostRingRadiusKm(parent);
    if (outermostRingRadius === 0) { return false; }

    // Bodies orbiting within the rings always qualify.
    if (bodyDistanceKm >= parentRadius && bodyDistanceKm <= outermostRingRadius) { return true; }

    // Otherwise the Hill sphere must reach close to the ring system.
    const bodyMass = body.bodyData.earthMasses;
    if (!bodyMass) { return false; }
    const parentMass = this.parentMassEarthMasses(parent);
    if (!parentMass) { return false; }

    const hillRadius = bodyDistanceKm * Math.pow(bodyMass / (3 * parentMass), 1 / 3);
    const hillInnerEdge = bodyDistanceKm - hillRadius;
    const ringSystemWidth = outermostRingRadius - parentRadius;
    const influenceDistance = outermostRingRadius + (ringSystemWidth * 0.2);
    return hillInnerEdge <= influenceDistance;
  }

  /** Localised Hill-sphere analysis for a potential shepherd moon. */
  calculateShepherdingHillLimit(body: SystemBody): ShepherdingHillLimit | null {
    if (!body.parent || !this.isShepherdingCandidate(body)) { return null; }

    const parent = body.parent.bodyData;
    const bodyMass = body.bodyData.earthMasses;
    const semiMajorAxis = body.bodyData.semiMajorAxis;
    const eccentricity = body.bodyData.orbitalEccentricity || 0;
    if (!bodyMass || !semiMajorAxis) { return null; }

    const parentMass = this.parentMassEarthMasses(parent);
    if (!parentMass) { return null; }

    // Hill radius: r_H = a * (m / 3M)^(1/3)
    const semiMajorAxisKm = semiMajorAxis * KM_PER_AU;
    const hillRadius = semiMajorAxisKm * Math.pow(bodyMass / (3 * parentMass), 1 / 3);
    const parentRadius = this.parentRadiusKm(parent);
    const outermostRingRadius = this.outermostRingRadiusKm(parent);
    const withinRings = semiMajorAxisKm >= parentRadius && semiMajorAxisKm <= outermostRingRadius;

    // Is this the first non-ring sibling orbiting beyond the rings?
    const sortedSiblings = body.parent.subBodies
      .filter(b => b.bodyData.type !== 'Ring' && b.bodyData.semiMajorAxis && b.bodyData.semiMajorAxis > 0)
      .sort((a, b) => (a.bodyData.semiMajorAxis! - b.bodyData.semiMajorAxis!) * KM_PER_AU);
    const bodiesOutsideRings = sortedSiblings.filter(
      b => (b.bodyData.semiMajorAxis || 0) * KM_PER_AU > outermostRingRadius,
    );
    const isFirstOutside = bodiesOutsideRings.length > 0 && bodiesOutsideRings[0] === body;

    return {
      hillRadius,
      bodyOrbitalRadius: semiMajorAxisKm,
      bodyPeriapsis: semiMajorAxisKm * (1 - eccentricity),
      bodyApoapsis: semiMajorAxisKm * (1 + eccentricity),
      parentRadius,
      outermostRingRadius,
      withinRings,
      isFirstOutside,
    };
  }

  /** True when the body is a genuine shepherd moon (Hill sphere reaches the outer ring edge). */
  isActualShepherd(body: SystemBody): boolean {
    const hillData = this.calculateShepherdingHillLimit(body);
    if (!hillData) { return false; }
    if (hillData.withinRings) { return false; }
    if (!hillData.isFirstOutside) { return false; }

    const hillInnerEdge = hillData.bodyOrbitalRadius - hillData.hillRadius;
    const ringWidth = Math.max(0, hillData.outermostRingRadius - hillData.parentRadius);
    const tolerance = Math.max(1, ringWidth * 0.05);
    return hillInnerEdge <= (hillData.outermostRingRadius + tolerance);
  }

  /**
   * Rigid Roche-limit violation for a body, in km beyond the limit (positive when the
   * body orbits inside its rigid Roche limit), or null when it is safe / undeterminable.
   */
  rocheExcess(body: SystemBody): number | null {
    if (!body.parent || !body.bodyData.semiMajorAxis || !body.bodyData.radius) { return null; }
    const parent = body.parent.bodyData;

    let parentRadiusM: number;
    if (parent.radius) {
      parentRadiusM = parent.radius * 1000;
    } else if (parent.solarRadius) {
      parentRadiusM = parent.solarRadius * KM_PER_SOLAR_RADIUS * 1000;
    } else {
      return null;
    }

    let parentMassKg: number;
    if (parent.solarMasses) {
      parentMassKg = parent.solarMasses * KG_PER_SOLAR_MASS;
    } else if (parent.earthMasses) {
      parentMassKg = parent.earthMasses * KG_PER_EARTH_MASS;
    } else {
      return null;
    }

    let bodyMassKg: number;
    if (body.bodyData.solarMasses) {
      bodyMassKg = body.bodyData.solarMasses * KG_PER_SOLAR_MASS;
    } else if (body.bodyData.earthMasses) {
      bodyMassKg = body.bodyData.earthMasses * KG_PER_EARTH_MASS;
    } else {
      return null;
    }

    const semiMajorAxisM = body.bodyData.semiMajorAxis * KM_PER_AU * 1000;
    const rhoParent = parentMassKg / this.sphereVolumeM3(parentRadiusM);
    const rhoSatellite = bodyMassKg / this.sphereVolumeM3(body.bodyData.radius * 1000);
    const rocheLimitM = 1.26 * parentRadiusM * Math.pow(rhoParent / rhoSatellite, 1 / 3);

    return semiMajorAxisM < rocheLimitM ? (rocheLimitM - semiMajorAxisM) / 1000 : null;
  }
}
