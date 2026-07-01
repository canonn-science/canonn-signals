import { inject, Injectable } from '@angular/core';
import { CanonnBiostatsBody, SystemBody } from '../home/home.component';
import { BODY_TYPE } from './body-types';
import {
  BodyPhysicsService,
  BodyRocheLimits,
  MassStabilityAlert,
  PlanetaryDensity,
  RingDynamics,
  ShepherdingHillLimit,
} from './body-physics.service';
import { StellarPhysicsService } from './stellar-physics.service';
import {
  CollisionStatus,
  CollisionWindow,
  OrbitalRelationsService,
  TrojanStatus,
} from './orbital-relations.service';
import { estimateTempRange, lookupTempDelta } from './temperature-estimation';

/** Orbit extents and eccentricity classification derived from the Keplerian elements. */
export interface OrbitExtents {
  semiMajorAxisKm: number;
  apoapsisKm: number;
  periapsisKm: number;
  eccentricity: number;
  /** Descriptive class: Circular / Nearly Circular / Eccentric / Highly Eccentric. */
  eccentricityClass: string;
}

/** A future periapsis/apoapsis passage, with the date rendered as an ISO-8601 string. */
export interface OrbitalEventJson {
  /** ISO-8601 instant of the passage. */
  date: string;
  /** Days from {@link CalculatedValues.computedAt} until the passage. */
  days: number;
}

/** Ring/belt geometry derived from the inner/outer radii and mass. */
export interface RingGeometry {
  widthKm: number;
  areaKm2: number;
  densityKgPerKm2: number;
  /** True when the ring is too diffuse and wide to render in-game (density < 0.1 kg/km², width > 1e6 km). */
  invisible: boolean;
  /** Rigid-body (1.26×) and fluid (2.456×) Roche limits for this ring's material, in km. */
  rigidRocheLimitKm: number | null;
  fluidRocheLimitKm: number | null;
  /** Rigid-body orbital period and edge velocities (Elite treats rings as rigid). */
  dynamics: RingDynamics | null;
}

/** Estimated on-foot surface-temperature range (Kelvin) with the lookup rule that produced it. */
export interface EstimatedTempRangeJson {
  minK: number;
  maxK: number;
  /** Human-readable description of the delta-lookup rule (e.g. "SubType + Atmosphere (...)"). */
  source: string;
}

/** Ring-shepherding analysis for a moon that may confine its parent's rings. */
export interface ShepherdingJson {
  hillLimit: ShepherdingHillLimit | null;
  isShepherd: boolean;
  isCandidate: boolean;
  withinParentRings: boolean;
}

/** A collision contact window, with dates rendered as ISO-8601 strings. */
export interface CollisionWindowJson {
  start: string;
  end: string;
  days: number;
  minSeparationKm: number;
  partnerName: string | null;
  combinedRadiiKm: number | null;
}

/** Summary of crossing-orbit collision analysis for a body. */
export interface CollisionJson {
  isCandidate: boolean;
  partnerName: string | null;
  synodicPeriodDays: number | null;
  combinedRadiiKm: number | null;
  nextCollision: CollisionWindowJson | null;
  upcomingCollisions: CollisionWindowJson[];
  simultaneousPartners: string[];
}

/**
 * The derived/calculated values the UI computes from raw Spansh body data, gathered into a
 * single plain-JSON structure for export. Every field is null when it does not apply to the
 * body (e.g. `neutronStarClass` is null for a planet), so the shape is stable and
 * self-describing. Time-dependent values (`nextApoapsis`, `nextPeriapsis`, `collision`) are
 * computed relative to {@link computedAt}, so an export is fully reproducible given that instant.
 */
export interface CalculatedValues {
  /** ISO-8601 instant the time-dependent values were computed at (makes the export reproducible). */
  computedAt: string;
  orbit: OrbitExtents | null;
  nextApoapsis: OrbitalEventJson | null;
  nextPeriapsis: OrbitalEventJson | null;
  density: PlanetaryDensity | null;
  ring: RingGeometry | null;
  bodyRocheLimits: BodyRocheLimits | null;
  rocheExcessKm: number | null;
  shepherding: ShepherdingJson | null;
  /** Spin-orbit resonance ratio (e.g. "1:1", "3:2"), or null when there is no simple resonance. */
  spinResonance: string | null;
  /** Equatorial surface velocity (km/s) — only reported for neutron stars / black holes. */
  tangentialVelocityKms: number | null;
  /** Physical radius (km) of a compact object (neutron star / black hole), or null. */
  compactObjectRadiusKm: number | null;
  schwarzschildRadiusKm: number | null;
  neutronStarClass: string | null;
  massStability: MassStabilityAlert | null;
  temperature: EstimatedTempRangeJson | null;
  /** Trojan/Lagrange status, or null when the body is not part of a co-orbital configuration. */
  trojan: TrojanStatus | null;
  /** Rosette label (e.g. "Rosette (3)"), or null. */
  rosette: string | null;
  collision: CollisionJson | null;
}

/** A raw Spansh body with the derived values attached under a single `calculated` key. */
export type EnrichedBody = CanonnBiostatsBody & { calculated: CalculatedValues };

/**
 * Computes the derived ("calculated") values for a body by delegating to the existing physics
 * services, so the export can never disagree with what the UI renders. This is the single source
 * of truth for enrichment used by both the per-body JSON export and the full-system export.
 *
 * The service is pure with respect to its inputs: the only non-determinism is the `now` epoch,
 * which every time-dependent value is computed against and which is echoed back in
 * {@link CalculatedValues.computedAt}.
 */
@Injectable({ providedIn: 'root' })
export class BodyEnrichmentService {
  private readonly physics = inject(BodyPhysicsService);
  private readonly stellarPhysics = inject(StellarPhysicsService);
  private readonly orbital = inject(OrbitalRelationsService);

  private isBlackHoleOrNeutronStar(bd: CanonnBiostatsBody): boolean {
    return bd.type === BODY_TYPE.Star
      && (bd.subType?.includes('Black Hole') || bd.subType === 'Neutron Star') === true;
  }

  private orbitExtents(bd: CanonnBiostatsBody): OrbitExtents | null {
    const extents = this.physics.orbitExtentsKm(bd);
    if (!extents) { return null; }
    return { ...extents, eccentricityClass: this.physics.eccentricityClass(extents.eccentricity) };
  }

  private orbitalEventJson(bd: CanonnBiostatsBody, type: 'apo' | 'peri', now: number): OrbitalEventJson | null {
    const event = this.orbital.nextOrbitalEvent(bd, type, now);
    return event ? { date: event.date.toISOString(), days: event.days } : null;
  }

  private ringGeometry(body: SystemBody): RingGeometry | null {
    const bd = body.bodyData;
    if (bd.type !== BODY_TYPE.Ring && bd.type !== BODY_TYPE.Belt) { return null; }
    const outer = bd.outerRadius ?? 0;
    const inner = bd.innerRadius ?? 0;
    const widthKm = outer - inner;
    const areaKm2 = Math.PI * (outer * outer - inner * inner);
    const densityKgPerKm2 = areaKm2 > 0 ? (bd.mass ?? 0) / areaKm2 : 0;
    const invisible = bd.type === BODY_TYPE.Ring && this.physics.isLowDensityWideRing(widthKm, densityKgPerKm2);
    return {
      widthKm,
      areaKm2,
      densityKgPerKm2,
      invisible,
      rigidRocheLimitKm: this.physics.calculateRigidRocheLimit(body),
      fluidRocheLimitKm: this.physics.calculateFluidRocheLimit(body),
      dynamics: this.physics.ringDynamics(body),
    };
  }

  private shepherding(body: SystemBody): ShepherdingJson | null {
    const bd = body.bodyData;
    if (bd.type === BODY_TYPE.Ring || bd.type === BODY_TYPE.Belt || !body.parent) { return null; }
    const isCandidate = this.physics.isShepherdingCandidate(body);
    const withinParentRings = this.physics.isBodyWithinParentRings(body);
    if (!isCandidate && !withinParentRings) { return null; }
    return {
      hillLimit: this.physics.calculateShepherdingHillLimit(body),
      isShepherd: this.physics.isActualShepherd(body),
      isCandidate,
      withinParentRings,
    };
  }

  private temperature(bd: CanonnBiostatsBody): EstimatedTempRangeJson | null {
    if (!bd.surfaceTemperature) { return null; }
    const range = estimateTempRange(bd.surfaceTemperature, bd.subType, bd.atmosphereType, bd.surfacePressure);
    const { source } = lookupTempDelta(bd.subType, bd.atmosphereType, bd.surfacePressure);
    return { minK: range.min, maxK: range.max, source };
  }

  private tangentialVelocity(bd: CanonnBiostatsBody): number | null {
    if (!this.isBlackHoleOrNeutronStar(bd) || !bd.rotationalPeriod) { return null; }
    const radiusKm = this.stellarPhysics.radiusKm(bd.radius, bd.solarRadius);
    return radiusKm === null ? null : this.stellarPhysics.tangentialVelocityKms(bd.rotationalPeriod, radiusKm);
  }

  private compactObjectRadiusKm(bd: CanonnBiostatsBody): number | null {
    return this.isBlackHoleOrNeutronStar(bd) ? this.stellarPhysics.radiusKm(bd.radius, bd.solarRadius) : null;
  }

  private schwarzschildRadiusKm(bd: CanonnBiostatsBody): number | null {
    return this.isBlackHoleOrNeutronStar(bd) ? this.physics.schwarzschildRadiusKm(bd.solarMasses) : null;
  }

  private neutronStarClass(bd: CanonnBiostatsBody): string | null {
    if (bd.type !== BODY_TYPE.Star || bd.subType !== 'Neutron Star') { return null; }
    return this.stellarPhysics.classifyNeutronStar(bd.solarMasses, bd.rotationalPeriod, bd.absoluteMagnitude);
  }

  private collisionWindowJson(window: CollisionWindow): CollisionWindowJson {
    return {
      start: window.start.toISOString(),
      end: window.end.toISOString(),
      days: window.days,
      minSeparationKm: window.minSeparationKm,
      partnerName: window.partnerName ?? null,
      combinedRadiiKm: window.combinedRadiiKm ?? null,
    };
  }

  private collision(body: SystemBody, now: number): CollisionJson | null {
    const status: CollisionStatus = this.orbital.detectCollisionStatus(body, now);
    if (!status.isCandidate) { return null; }
    return {
      isCandidate: status.isCandidate,
      partnerName: status.partnerName,
      synodicPeriodDays: status.synodicPeriodDays,
      combinedRadiiKm: status.combinedRadiiKm,
      nextCollision: status.nextCollision ? this.collisionWindowJson(status.nextCollision) : null,
      upcomingCollisions: status.upcomingCollisions.map(w => this.collisionWindowJson(w)),
      simultaneousPartners: status.simultaneousPartners,
    };
  }

  private trojan(body: SystemBody): TrojanStatus | null {
    const status = this.orbital.detectTrojanStatus(body);
    return (status.lagrangePoint || status.isHost) ? status : null;
  }

  /**
   * Builds the full {@link CalculatedValues} block for a body. `now` (epoch ms) fixes the instant
   * the time-dependent values (next apo/peri, collisions) are computed against; it defaults to the
   * current time but callers should pass an explicit epoch for a reproducible export.
   */
  public computeCalculatedValues(body: SystemBody, now: number = Date.now()): CalculatedValues {
    const bd = body.bodyData;
    const spin = this.stellarPhysics.spinResonance(bd.rotationalPeriod, bd.orbitalPeriod);

    return {
      computedAt: new Date(now).toISOString(),
      orbit: this.orbitExtents(bd),
      nextApoapsis: this.orbitalEventJson(bd, 'apo', now),
      nextPeriapsis: this.orbitalEventJson(bd, 'peri', now),
      density: this.physics.getPlanetaryDensity(bd),
      ring: this.ringGeometry(body),
      bodyRocheLimits: this.physics.calculateBodyRocheLimits(body),
      rocheExcessKm: this.physics.rocheExcess(body),
      shepherding: this.shepherding(body),
      spinResonance: spin === 'none' ? null : spin,
      tangentialVelocityKms: this.tangentialVelocity(bd),
      compactObjectRadiusKm: this.compactObjectRadiusKm(bd),
      schwarzschildRadiusKm: this.schwarzschildRadiusKm(bd),
      neutronStarClass: this.neutronStarClass(bd),
      massStability: this.physics.massStabilityAlert(bd.subType, bd.solarMasses),
      temperature: this.temperature(bd),
      trojan: this.trojan(body),
      rosette: this.orbital.detectRosetteStatus(body),
      collision: this.collision(body, now),
    };
  }

  /** Returns a shallow copy of the raw body with the calculated values attached under `calculated`. */
  public enrichBody(body: SystemBody, now: number = Date.now()): EnrichedBody {
    return { ...body.bodyData, calculated: this.computeCalculatedValues(body, now) };
  }
}
