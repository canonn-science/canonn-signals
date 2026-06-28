import { Injectable } from '@angular/core';
import { CanonnBiostatsBody, SystemBody } from '../home/home.component';
import { BODY_TYPE } from './body-types';
import { KM_PER_AU, KM_PER_SOLAR_RADIUS, KG_PER_EARTH_MASS, KG_PER_SOLAR_MASS, KG_PER_MEGATONNE } from './unit-conversions';
import type { RingClassificationRingInfo } from '../dialogs/ring-classification-dialog/ring-classification-dialog.component';

/** Approximate Earth masses per solar mass, used for parent-mass conversions. */
const EARTH_MASSES_PER_SOLAR_MASS = 332950;

/** Newtonian gravitational constant (m³ kg⁻¹ s⁻²) and speed of light (m/s). */
export const GRAVITATIONAL_CONSTANT = 6.6743e-11;
export const SPEED_OF_LIGHT = 299792458;

/** Rings below this surface density (kg/km²) are considered invisible in-game. */
export const INVISIBLE_RING_MAX_DENSITY = 0.1;
/** Rings wider than this (km) are considered invisible when density is also low. */
export const INVISIBLE_RING_MIN_WIDTH = 1_000_000;

/**
 * Maximum gap between adjacent rings (km) for the Racing Rings badge.
 * Set so that both ring edges are likely to be simultaneously visible when
 * flying nearby. The value is intentionally generous and may be tightened
 * once in-game observations are collected.
 */
export const RACING_RINGS_MAX_GAP_KM = 50;
/**
 * Minimum outer-to-inner velocity difference (km/s) for the Racing Rings badge.
 * Chosen as a speed differential large enough to be noticeable in-game;
 * may be adjusted after in-game observations.
 */
export const RACING_RINGS_MIN_SPEED_DIFF_KMS = 5;

/**
 * Body-radius multiple below which a ring system's total span counts as narrow. Used
 * as the Taylor ring badge's upper threshold, and as the Pauper ring badge's lower
 * bound (a span this narrow is a Taylor ring, not a Pauper ring).
 */
export const NARROW_RING_SPAN_RADII = 0.25;
/** Body-radii the innermost visible ring edge must clear for the Pauper ring badge (unusually distant). */
export const PAUPER_RING_MIN_INNER_EDGE_RADII = 14;
/** Maximum span (body radii) for the Pauper ring badge — no wider than one body diameter. */
export const PAUPER_RING_MAX_SPAN_RADII = 2;
/** Fraction of the total span above which a gap between two adjacent visible rings is called out as potentially visible. */
export const VISIBLE_GAP_SPAN_FRACTION = 0.02;

/**
 * Minimum angular diameter (degrees) a landable body's parent *star* must subtend in its
 * sky for the High Angular Diameter badge. Ported from Custom Criteria for Everyone's
 * `starDiameterThreshold` (CCFE default: 25°).
 */
export const HIGH_ANGULAR_DIAMETER_STAR_THRESHOLD_DEGREES = 25;
/**
 * Minimum angular diameter (degrees) a landable body's parent *planet* must subtend in its
 * sky for the High Angular Diameter badge. Ported from CCFE's `planetDiameterThreshold`
 * (CCFE default: 45°).
 */
export const HIGH_ANGULAR_DIAMETER_PLANET_THRESHOLD_DEGREES = 45;

/**
 * Degenerate-matter stability limits (solar masses). The Chandrasekhar limit caps a
 * white dwarf supported by electron degeneracy pressure; the Tolman–Oppenheimer–Volkoff
 * (TOV) limit caps a neutron star supported by neutron degeneracy pressure.
 */
const CHANDRASEKHAR_LIMIT_SOLAR_MASSES = 1.44;
// Theoretical TOV maximum-mass estimate constrained by the GW170817 neutron-star merger.
const TOV_LIMIT_SOLAR_MASSES = 2.17;
// Observed upper bound: the heaviest neutron-star mass recorded in Elite Dangerous (not a
// real-life measurement). A star above this is treated as a highly anomalous in-game body.
const OBSERVED_NEUTRON_STAR_MAX_SOLAR_MASSES = 2.51;

/**
 * A degeneracy-pressure stability warning. `severity` is `'warning'` when a neutron star
 * exceeds the theoretical TOV limit but stays within the observed mass range, and
 * `'danger'` when a body exceeds a hard limit (Chandrasekhar, or the observed neutron-star
 * maximum) and should already have collapsed.
 */
export interface MassStabilityAlert {
  message: string;
  severity: 'warning' | 'danger';
}

export interface PlanetaryDensity {
  value: number;
  unit: string;
  tooltip: string;
  /** Raw bulk density in kg/m³ — the base for the unit-conversion dialog. */
  densityKgM3: number;
}

/** Orbit extents (km) derived from a body's semi-major axis and eccentricity. */
export interface OrbitExtentsKm {
  semiMajorAxisKm: number;
  apoapsisKm: number;
  periapsisKm: number;
  eccentricity: number;
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

/** Orbital period and tangential velocity range for a ring or belt. */
export interface RingDynamics {
  /** Orbital period in days, derived from Kepler's third law at the nominal radius. */
  orbitalPeriodDays: number;
  /** Tangential velocity (km/s) at the inner radius using the nominal orbital period. */
  minVelocityKms: number;
  /** Tangential velocity (km/s) at the outer radius using the nominal orbital period. */
  maxVelocityKms: number;
}

/** Taylor/Pauper ring classification, shared by every visible ring belonging to the same parent. */
export interface RingClassification {
  isTaylor: boolean;
  isPauper: boolean;
  span: number;
  innermostInner: number;
  outermostOuter: number;
  parentRadius: number;
  rings: RingClassificationRingInfo[];
  hasVisibleGap: boolean;
}

/** Gap and relative velocity to a ring's next-outward sibling, for the Racing Rings badge. */
export interface RingNeighbourDistance {
  distance: number | null;
  label: string;
  velocityDiff: number | null;
  eitherRingInvisible: boolean;
}

/** High Angular Diameter badge assessment: the parent's apparent size dominates the sky. */
export interface HighAngularDiameterAssessment {
  angularDiameterDegrees: number;
  parentType: typeof BODY_TYPE.Star | typeof BODY_TYPE.Planet;
  /** The parent's subtype (star class or planet class), for the badge tooltip. */
  parentLabel: string;
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

  /**
   * Orbit extents (km) from a body's semi-major axis (AU) and eccentricity: apoapsis =
   * a(1+e), periapsis = a(1−e). Returns null when there is no semi-major axis. Single
   * source of truth shared by the orbit row in the UI and the JSON export.
   */
  orbitExtentsKm(bd: CanonnBiostatsBody): OrbitExtentsKm | null {
    if (!bd.semiMajorAxis) { return null; }
    const semiMajorAxisKm = bd.semiMajorAxis * KM_PER_AU;
    const eccentricity = bd.orbitalEccentricity ?? 0;
    return {
      semiMajorAxisKm,
      apoapsisKm: semiMajorAxisKm * (1 + eccentricity),
      periapsisKm: semiMajorAxisKm * (1 - eccentricity),
      eccentricity,
    };
  }

  /** Descriptive eccentricity class: Circular / Nearly Circular / Eccentric / Highly Eccentric. */
  eccentricityClass(eccentricity: number): string {
    if (eccentricity === 0) { return 'Circular'; }
    if (eccentricity < 0.4) { return 'Nearly Circular'; }
    if (eccentricity < 0.8) { return 'Eccentric'; }
    return 'Highly Eccentric';
  }

  /**
   * Invisible-ring heuristic: a ring is invisible in-game when it is both very low surface
   * density (kg/km²) and very wide (km). Shared by the ring badge, the invisible-ring dialog
   * and the JSON export so all three agree.
   */
  isLowDensityWideRing(widthKm: number, densityKgPerKm2: number): boolean {
    return densityKgPerKm2 < INVISIBLE_RING_MAX_DENSITY && widthKm > INVISIBLE_RING_MIN_WIDTH;
  }

  /** Whether `bd` (a ring) is invisible in-game — see {@link isLowDensityWideRing}. */
  isInvisibleRing(bd: CanonnBiostatsBody): boolean {
    if (bd.type !== BODY_TYPE.Ring) { return false; }
    const outer = bd.outerRadius ?? 0;
    const inner = bd.innerRadius ?? 0;
    const width = outer - inner;
    const area = Math.PI * (outer * outer - inner * inner);
    const density = area > 0 ? (bd.mass ?? 0) / area : 0;
    return this.isLowDensityWideRing(width, density);
  }

  /** `parent`'s ring-type sub-bodies, sorted by inner radius ascending. Includes invisible rings — callers filter those out themselves when they don't want them. */
  sortedRingSiblings(parent: SystemBody): SystemBody[] {
    return parent.subBodies
      .filter(s => s.bodyData.type === BODY_TYPE.Ring)
      .sort((a, b) => (a.bodyData.innerRadius ?? 0) - (b.bodyData.innerRadius ?? 0));
  }

  /** Strips the " Ring" suffix from a ring body's name, leaving just its letter designation (e.g. "A"). */
  private stripRingSuffix(name: string): string {
    return name.replace('Ring', '').trim();
  }

  /**
   * Classifies `body`'s ring system as Taylor (unusually narrow) and/or Pauper (unusually
   * wide and distant), or null when `body` isn't a visible ring or the classification can't
   * be computed. Both badges are derived from the same "span" of the body's *visible* rings
   * (invisible rings — see {@link isInvisibleRing} — are stripped first), so the result is
   * identical for every ring belonging to the same parent and the badge shows on all of them.
   */
  classifyRingSystem(body: SystemBody): RingClassification | null {
    const bd = body.bodyData;
    if (bd.type !== BODY_TYPE.Ring || !body.parent || this.isInvisibleRing(bd)) { return null; }

    const parentRadius = this.getParentRadiusKm(body);
    if (!parentRadius) { return null; }

    const visibleRings = this.sortedRingSiblings(body.parent)
      .filter(s => !this.isInvisibleRing(s.bodyData));
    if (visibleRings.length === 0) { return null; }

    // Already sorted by inner radius ascending, so the first entry is the innermost inner edge.
    const innermostInner = visibleRings[0].bodyData.innerRadius ?? 0;
    const outermostOuter = Math.max(...visibleRings.map(r => r.bodyData.outerRadius ?? 0));
    const span = outermostOuter - innermostInner;

    const isTaylor = span < NARROW_RING_SPAN_RADII * parentRadius;
    // `span > NARROW_RING_SPAN_RADII * parentRadius` here is what keeps this mutually
    // exclusive with isTaylor above (span < the same threshold).
    const isPauper = innermostInner >= PAUPER_RING_MIN_INNER_EDGE_RADII * parentRadius
      && span <= PAUPER_RING_MAX_SPAN_RADII * parentRadius
      && span > NARROW_RING_SPAN_RADII * parentRadius;

    const rings = visibleRings.map(r => ({
      name: this.stripRingSuffix(r.bodyData.name),
      innerRadius: r.bodyData.innerRadius ?? 0,
      outerRadius: r.bodyData.outerRadius ?? 0,
    }));

    // Gap between each ring's outer edge and the next ring's inner edge — a gap wide enough
    // relative to the total span may show up as a visible break in an otherwise "single ring".
    const hasVisibleGap = span > 0 && rings.some((r, i) => {
      const next = rings[i + 1];
      if (!next) { return false; }
      return (next.innerRadius - r.outerRadius) > VISIBLE_GAP_SPAN_FRACTION * span;
    });

    return { isTaylor, isPauper, span, innermostInner, outermostOuter, parentRadius, rings, hasVisibleGap };
  }

  /** Gap and relative velocity between `body` (a ring) and its next-outward sibling, for the Racing Rings badge. */
  ringNeighbourDistance(body: SystemBody): RingNeighbourDistance {
    const bd = body.bodyData;
    if (bd.type !== BODY_TYPE.Ring || !body.parent) {
      return { distance: null, label: '', velocityDiff: null, eitherRingInvisible: false };
    }
    const siblings = this.sortedRingSiblings(body.parent);
    const idx = siblings.indexOf(body);
    if (idx < 0 || idx === siblings.length - 1) {
      return { distance: null, label: '', velocityDiff: null, eitherRingInvisible: false };
    }
    const next = siblings[idx + 1];
    const distance = (next.bodyData.innerRadius ?? 0) - (bd.outerRadius ?? 0);
    const thisLabel = this.stripRingSuffix(bd.name);
    const nextLabel = this.stripRingSuffix(next.bodyData.name);
    const currentDynamics = this.ringDynamics(body);
    const nextDynamics = this.ringDynamics(next);
    const velocityDiff = (currentDynamics !== null && nextDynamics !== null)
      ? currentDynamics.maxVelocityKms - nextDynamics.minVelocityKms
      : null;
    const eitherRingInvisible = this.isInvisibleRing(bd) || this.isInvisibleRing(next.bodyData);
    return { distance, label: `${thisLabel}-${nextLabel}`, velocityDiff, eitherRingInvisible };
  }

  /**
   * Racing Rings badge: `body` (a ring) sits within {@link RACING_RINGS_MAX_GAP_KM} of its
   * next-outward sibling with a velocity differential above {@link RACING_RINGS_MIN_SPEED_DIFF_KMS},
   * and neither ring in the pair is invisible.
   */
  isRacingRings(body: SystemBody): boolean {
    const { distance, velocityDiff, eitherRingInvisible } = this.ringNeighbourDistance(body);
    return distance !== null && velocityDiff !== null
      && distance < RACING_RINGS_MAX_GAP_KM && velocityDiff > RACING_RINGS_MIN_SPEED_DIFF_KMS && !eitherRingInvisible;
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

    // Pick the unit by magnitude: g/cm³ for ordinary bodies, kg/m³ mid-range, and Mt/cm³
    // for degenerate matter — a neutron star reads a fraction of a Mt/cm³, far tidier than
    // ~1e17 kg/m³. 1 Mt/cm³ = 1e18 kg/m³ (Elite's teragram megatonne, see KG_PER_MEGATONNE).
    let value: number;
    let unit: string;
    if (densityKgM3 >= 1e15) {
      value = densityKgM3 / 1e18;
      unit = 'Mt/cm³';
    } else if (densityKgM3 < 10000) {
      value = densityKgM3 / 1000;
      unit = 'g/cm³';
    } else {
      value = densityKgM3;
      unit = 'kg/m³';
    }

    // Round to 6 significant figures so the tooltip stays readable across scales
    // (ordinary rock ~3936 kg/m³ … neutron-star matter ~1e17 kg/m³) without
    // dumping raw floating-point digits.
    return { value, unit, tooltip: `${densityKgM3.toPrecision(6)} kg/m³`, densityKgM3 };
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

  /** Radius (km) of a body's parent primary, or null when the parent exposes no radius. */
  getParentRadiusKm(body: SystemBody): number | null {
    if (!body.parent) { return null; }
    return this.parentRadiusKmOrNull(body.parent.bodyData);
  }

  /**
   * Angular diameter (degrees) the parent body subtends in `body`'s sky, i.e. how large the
   * parent appears from `body` at its orbital distance (centre-to-centre). Computed exactly as
   * `2 * atan(parentRadius / distance)` — CCFE's original Lua script instead uses the
   * small-angle approximation `57.3 * (2 * radius / distance)`, which diverges by a few
   * percent at the angles this badge cares about (see AGENTS.md's "physical accuracy" rule).
   * `distance` is `body`'s own orbital semi-major axis (its average distance from the parent
   * it orbits). Returns null when the parent or orbit data is unavailable.
   */
  angularDiameterDegrees(body: SystemBody): number | null {
    if (!body.parent || !body.bodyData.semiMajorAxis) { return null; }
    const parentRadiusKm = this.parentRadiusKmOrNull(body.parent.bodyData);
    if (parentRadiusKm === null) { return null; }
    const distanceKm = body.bodyData.semiMajorAxis * KM_PER_AU;
    if (distanceKm <= 0) { return null; }
    return 2 * Math.atan(parentRadiusKm / distanceKm) * (180 / Math.PI);
  }

  /**
   * High Angular Diameter badge (ported from CCFE's Complex 4.7): a landable body whose
   * parent star or planet visibly dominates its sky — angular diameter above
   * {@link HIGH_ANGULAR_DIAMETER_STAR_THRESHOLD_DEGREES} for a star parent, or
   * {@link HIGH_ANGULAR_DIAMETER_PLANET_THRESHOLD_DEGREES} for a planet parent. Returns null
   * when `body` isn't landable, has no eligible parent, or falls under the threshold.
   */
  highAngularDiameterAssessment(body: SystemBody): HighAngularDiameterAssessment | null {
    if (!body.bodyData.isLandable || !body.parent) { return null; }

    const isStarParent = body.parent.bodyData.type === BODY_TYPE.Star;
    const isPlanetParent = body.parent.bodyData.type === BODY_TYPE.Planet;
    if (!isStarParent && !isPlanetParent) { return null; }

    const angularDiameterDegrees = this.angularDiameterDegrees(body);
    if (angularDiameterDegrees === null) { return null; }

    const threshold = isStarParent
      ? HIGH_ANGULAR_DIAMETER_STAR_THRESHOLD_DEGREES
      : HIGH_ANGULAR_DIAMETER_PLANET_THRESHOLD_DEGREES;
    if (angularDiameterDegrees <= threshold) { return null; }

    const parentType = isStarParent ? BODY_TYPE.Star : BODY_TYPE.Planet;
    return { angularDiameterDegrees, parentType, parentLabel: body.parent.bodyData.subType };
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
    const innerRadiusM = inner * 1000;
    const outerRadiusM = outer * 1000;
    const periodS = 2 * Math.PI * Math.sqrt(nominalRadiusM ** 3 / (GRAVITATIONAL_CONSTANT * parentMassKg));
    return {
      orbitalPeriodDays: periodS / 86400,
      minVelocityKms: (2 * Math.PI * innerRadiusM / periodS) / 1000,
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

    // A Roche breach is set by closest approach (periapsis), not the mean distance, so an
    // eccentric body can dip inside the rigid limit even when its semi-major axis is safe.
    const eccentricity = body.bodyData.orbitalEccentricity || 0;
    const periapsisM = body.bodyData.semiMajorAxis * KM_PER_AU * 1000 * (1 - eccentricity);
    const rhoParent = parentMassKg / this.sphereVolumeM3(parentRadiusM);
    const rhoSatellite = bodyMassKg / this.sphereVolumeM3(body.bodyData.radius * 1000);
    const rocheLimitM = 1.26 * parentRadiusM * Math.pow(rhoParent / rhoSatellite, 1 / 3);

    return periapsisM < rocheLimitM ? (rocheLimitM - periapsisM) / 1000 : null;
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
   * Chandrasekhar (1.44 M☉) for white dwarfs, and for neutron stars the theoretical TOV
   * limit (~2.17 M☉) and the observed maximum (~2.51 M☉). Returns the tooltip message and a
   * severity, or null when the body is stable / not a degenerate object. A neutron star
   * between the two limits is flagged as a `'warning'`; one above the observed maximum (or a
   * super-Chandrasekhar white dwarf) is flagged as `'danger'`. Black holes have already
   * collapsed, so the "will collapse into a black hole" warning does not apply to them.
   */
  massStabilityAlert(subType: string | null | undefined, solarMasses: number | null | undefined): MassStabilityAlert | null {
    if (solarMasses === null || solarMasses === undefined) { return null; }

    if (subType?.startsWith('White Dwarf') && solarMasses > CHANDRASEKHAR_LIMIT_SOLAR_MASSES) {
      return {
        severity: 'danger',
        message: 'Anomalous mass — exceeds the Chandrasekhar limit (1.44 M☉).\n'
          + 'Electron degeneracy pressure is not expected to support a white dwarf this heavy, '
          + 'which would normally trigger gravitational collapse or a Type Ia supernova.',
      };
    }

    if (subType === 'Neutron Star') {
      if (solarMasses > OBSERVED_NEUTRON_STAR_MAX_SOLAR_MASSES) {
        return {
          severity: 'danger',
          message: 'Highly anomalous mass — exceeds the observed maximum neutron-star mass (2.51 M☉).\n'
            + 'Beyond this point a star would normally be expected to collapse into a black hole.',
        };
      }

      if (solarMasses > TOV_LIMIT_SOLAR_MASSES) {
        return {
          severity: 'warning',
          message: 'Anomalous mass — exceeds the theoretical Tolman–Oppenheimer–Volkoff limit (2.17 M☉).\n'
            + 'Beyond this, neutron degeneracy pressure is not expected to support the star.',
        };
      }
    }

    return null;
  }
}
