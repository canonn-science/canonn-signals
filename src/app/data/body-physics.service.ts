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

/** Newtonian gravitational constant (m³ kg⁻¹ s⁻²) and speed of light (m/s). */
export const GRAVITATIONAL_CONSTANT = 6.6743e-11;
export const SPEED_OF_LIGHT = 299792458;

/**
 * Degenerate-matter stability limits (solar masses). The Chandrasekhar limit caps a
 * white dwarf supported by electron degeneracy pressure; the Tolman–Oppenheimer–Volkoff
 * (TOV) limit caps a neutron star supported by neutron degeneracy pressure.
 */
const CHANDRASEKHAR_LIMIT_SOLAR_MASSES = 1.44;
// Modern maximum-mass estimate constrained by the GW170817 neutron-star merger.
const TOV_LIMIT_SOLAR_MASSES = 2.17;

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

/** Radius (km) and bulk density (kg/m³) of a body's parent primary. */
export interface PrimaryRadiusDensity {
  primaryRadius: number;
  primaryDensity: number;
}

/** Roche-limit curves sampled across a range of particle densities. */
export interface RocheLimitCurves {
  densityRange: number[];
  rigidLimits: number[];
  fluidLimits: number[];
}

/** Orbital period and maximum tangential velocity for a ring or belt. */
export interface RingDynamics {
  /** Orbital period in days, derived from Kepler's third law at the nominal radius. */
  orbitalPeriodDays: number;
  /** Tangential velocity (km/s) at the outer radius using the nominal orbital period. */
  maxVelocityKms: number;
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

  /** Parent mass in kg, or null when unknown. */
  public parentMassKg(parent: CanonnBiostatsBody): number | null {
    const earthMasses = this.parentMassEarthMasses(parent);
    return earthMasses !== null ? earthMasses * KG_PER_EARTH_MASS : null;
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

    // Round to 6 significant figures so the tooltip stays readable across scales
    // (ordinary rock ~3936 kg/m³ … neutron-star matter ~1e17 kg/m³) without
    // dumping raw floating-point digits.
    return { value, unit, tooltip: `${densityKgM3.toPrecision(6)} kg/m³` };
  }

  /**
   * Radius (km) and bulk density (kg/m³) of a body's parent primary, or null when the
   * parent exposes insufficient data. Single source of truth for the Roche/Hill chart
   * dialogs, which previously recomputed this inline.
   */
  getParentRadiusAndDensity(body: SystemBody): PrimaryRadiusDensity | null {
    if (!body.parent) { return null; }
    const parent = body.parent.bodyData;
    const primaryRadius = this.parentRadiusKmOrNull(parent);
    if (primaryRadius === null) { return null; }
    const primaryDensity = this.primaryDensityKgM3(parent);
    if (primaryDensity === null) { return null; }
    return { primaryRadius, primaryDensity };
  }

  /**
   * Samples the rigid (1.26×) and fluid (2.456×) Roche-limit curves across particle
   * densities of 500–8000 kg/m³ for plotting against ring/body positions.
   */
  rocheLimitCurves(primaryRadius: number, primaryDensity: number): RocheLimitCurves {
    const densityRange: number[] = [];
    const rigidLimits: number[] = [];
    const fluidLimits: number[] = [];
    for (let density = 500; density <= 8000; density += 100) {
      densityRange.push(density);
      const ratio = Math.pow(primaryDensity / density, 1 / 3);
      rigidLimits.push(1.26 * primaryRadius * ratio);
      fluidLimits.push(2.456 * primaryRadius * ratio);
    }
    return { densityRange, rigidLimits, fluidLimits };
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

  /**
   * Orbital period and max tangential velocity for a ring or belt.
   *
   * **Note: Elite Dangerous ring physics differ from real-world orbital mechanics.**
   *
   * In real rings (e.g. Saturn's), each particle follows its own Keplerian orbit, so
   * inner particles move faster than outer ones. Elite Dangerous instead treats the
   * entire ring as a rigid body: every part shares a single rotational period, meaning
   * the outer edge moves faster than the inner edge — the opposite of Keplerian shear.
   *
   * To recover that single period we apply Kepler's third law at a "nominal radius":
   *   `nominalRadius = innerRadius + (outerRadius − innerRadius) × 3/8`
   *
   * The 3/8 factor was arrived at through observational data gathered by the Canonn
   * Research Group. Earlier candidates included Euler's number e (≈ 0.368) and 1/φ²
   * (≈ 0.382, where φ is the golden ratio); 3/8 = 0.375 sits between them and
   * currently gives the closest fit to in-game measurements.
   *
   * This remains an approximation for several reasons:
   *  - The game journals store ring radii to 4 significant figures, limiting precision.
   *  - Data collection is ongoing; edge cases may yet refine or challenge the factor.
   *
   * The maximum velocity is the tangential speed at the outer edge using the period
   * derived from the nominal radius.
   *
   * @param body  The Ring or Belt SystemBody.
   * @returns     Dynamics values, or null when parent mass or radii are unavailable.
   */
  ringDynamics(body: SystemBody): RingDynamics | null {
    const bd = body.bodyData;
    if (bd.type !== BODY_TYPE.Ring && bd.type !== BODY_TYPE.Belt) { return null; }
    const outer = bd.outerRadius ?? 0;
    const inner = bd.innerRadius ?? 0;
    if (outer <= 0 || !body.parent) { return null; }
    const parentMassKg = this.parentMassKg(body.parent.bodyData);
    if (parentMassKg === null || parentMassKg <= 0) { return null; }
    const nominalRadiusM = (inner + (outer - inner) * (3 / 8)) * 1000;
    const outerRadiusM = outer * 1000;
    const periodS = 2 * Math.PI * Math.sqrt(nominalRadiusM ** 3 / (GRAVITATIONAL_CONSTANT * parentMassKg));
    return {
      orbitalPeriodDays: periodS / 86400,
      maxVelocityKms: (2 * Math.PI * outerRadiusM / periodS) / 1000,
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

  /**
   * Tri-state shepherd classification from pre-computed Hill data — the single
   * source of truth shared by `isActualShepherd()` (the badge) and the shepherding
   * dialog: `'inner'` (orbits within the rings), `'shepherd'` (Hill sphere reaches
   * the outer ring edge within tolerance), or `'none'`.
   */
  shepherdStatus(hillData: ShepherdingHillLimit): 'shepherd' | 'inner' | 'none' {
    if (hillData.withinRings) { return 'inner'; }
    if (!hillData.isFirstOutside) { return 'none'; }

    const hillInnerEdge = hillData.bodyOrbitalRadius - hillData.hillRadius;
    // Require the Hill sphere to reach (or slightly overlap) the outermost ring
    // edge — tolerance is 5% of ring width or a minimum of 1 km.
    const ringWidth = Math.max(0, hillData.outermostRingRadius - hillData.parentRadius);
    const tolerance = Math.max(1, ringWidth * 0.05);
    return hillInnerEdge <= (hillData.outermostRingRadius + tolerance) ? 'shepherd' : 'none';
  }

  /** True when the body is a genuine shepherd moon (Hill sphere reaches the outer ring edge). */
  isActualShepherd(body: SystemBody): boolean {
    const hillData = this.calculateShepherdingHillLimit(body);
    return hillData ? this.shepherdStatus(hillData) === 'shepherd' : false;
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

  /**
   * Schwarzschild radius (km) for a mass in solar masses: r_s = 2GM/c². For a black hole
   * this is the event-horizon radius; for a neutron star it is the radius it would need to
   * collapse to in order to become one. Returns null when the mass is unknown/non-positive.
   */
  schwarzschildRadiusKm(solarMasses: number | null | undefined): number | null {
    if (!solarMasses || solarMasses <= 0) { return null; }
    const massKg = solarMasses * KG_PER_SOLAR_MASS;
    const radiusM = 2 * GRAVITATIONAL_CONSTANT * massKg / (SPEED_OF_LIGHT ** 2);
    return radiusM / 1000;
  }

  /**
   * Degeneracy-pressure stability warning when a body's mass exceeds the relevant limit:
   * Chandrasekhar (1.44 M☉) for white dwarfs, TOV (~2.17 M☉) for neutron stars. Returns the
   * tooltip message, or null when the body is stable / not a degenerate object. Black holes
   * have already collapsed, so the "will collapse into a black hole" warning does not apply
   * to them.
   */
  massStabilityAlert(subType: string | null | undefined, solarMasses: number | null | undefined): string | null {
    if (solarMasses === null || solarMasses === undefined) { return null; }

    if (subType?.startsWith('White Dwarf') && solarMasses > CHANDRASEKHAR_LIMIT_SOLAR_MASSES) {
      return 'Exceeds Chandrasekhar limit (1.44 M☉).\n'
        + 'Electron degeneracy pressure can no longer support the star against gravity, '
        + 'leading to gravitational collapse or a Type Ia supernova.';
    }

    if (subType === 'Neutron Star' && solarMasses > TOV_LIMIT_SOLAR_MASSES) {
      return 'Exceeds Tolman–Oppenheimer–Volkoff limit.\n'
        + 'Above the TOV limit (2.17 solar masses), neutron degeneracy pressure can no longer '
        + 'support the star against gravity, and it collapses into a black hole.';
    }

    return null;
  }
}
