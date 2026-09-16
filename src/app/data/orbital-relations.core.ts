import type { CanonnBiostatsBody, SystemBody } from '../home/home.component';
import { BODY_TYPE } from './body-types';
import { bodyPathFromRoot } from './collision-request';

/** The five Lagrange points of a two-body system. */
export type LagrangePointId = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

/** Result of Trojan/Lagrange analysis for a body relative to its co-orbital siblings. */
export interface TrojanStatus {
  /** Lagrange point the body occupies ('L1'–'L5'), or null when it is not a Trojan. */
  lagrangePoint: LagrangePointId | null;
  /** True when this body hosts Trojans at both L4 and L5 (it is the reference body, not a Trojan). */
  isHost: boolean;
}

/** A body sitting at one of the slots of a Lagrange configuration. */
export interface LagrangeOccupant {
  /** The body's name (raw — callers may map it to a display name). */
  name: string;
  /** Its `bodyId`, for DOM ids / de-duplication. */
  bodyId: number;
  /** True for the body the configuration was requested for (so the UI can highlight it). */
  isFocus: boolean;
}

/**
 * A co-orbital family expressed as a Lagrange diagram: the central primary they orbit,
 * the secondary (a host with companions at L4 & L5, when one exists), and whichever
 * bodies occupy each Lagrange point. Built by {@link OrbitalRelationsService.lagrangeConfiguration}.
 */
export interface LagrangeConfiguration {
  /** Name of the shared parent the family orbits (the central primary), or null. */
  primaryName: string | null;
  /** The co-orbital secondary (host), or null when none is recorded → drawn as a placeholder. */
  secondary: LagrangeOccupant | null;
  /** Bodies at each Lagrange point — usually 0 or 1 per point. */
  points: Record<LagrangePointId, LagrangeOccupant[]>;
}

/** A future periapsis/apoapsis passage: when it occurs and how many days away it is. */
export interface OrbitalEvent {
  date: Date;
  days: number;
}

/** A single (time, centre-to-centre distance) sample for plotting separation against time. */
export interface SeparationSample {
  /** Epoch milliseconds of the sample. */
  tMs: number;
  /** Centre-to-centre distance (km) between the two bodies at {@link tMs}. */
  sepKm: number;
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
  /**
   * When {@link minSeparationKm} actually occurs. For an ordinary single-dip window this sits
   * near the middle, but it need not be the midpoint — most notably for one half of a ring
   * pair's split contact (see {@link OrbitalRelationsCore.ringContactBand}), where the deepest
   * point is pinned to whichever edge (`start` or `end`) is nearest the shared closest approach,
   * not to the window's centre. Always set by {@link OrbitalRelationsCore.detectCollisionStatus}
   * and {@link OrbitalRelationsCore.detectRingCollisionStatus}; optional only so hand-built test
   * fixtures may omit it, in which case callers should fall back to the window's midpoint.
   */
  minSeparationAt?: Date;
  /**
   * Name of the sibling body this contact is with. Always set by {@link OrbitalRelationsService.detectCollisionStatus}
   * (a body can have several crossing partners); optional only so hand-built test fixtures may omit it.
   */
  partnerName?: string;
  /**
   * Sum of the two bodies' radii (km) for *this* pair — the contact threshold used to gauge overlap.
   * Distinct per partner, so it travels with the window rather than living once on the status.
   */
  combinedRadiiKm?: number;
}

/** Result of collision-candidate analysis for a body relative to a crossing-orbit sibling. */
export interface CollisionStatus {
  /** True when this body shares its parent with a sibling on a crossing, near-coplanar orbit. */
  isCandidate: boolean;
  /**
   * Name of the *primary* partner — the sibling owning the soonest predicted collision (or the
   * first geometric candidate when no pair has timing data). Null when there is no partner.
   * A body may collide with several siblings; see {@link upcomingCollisions} for the full set.
   */
  partnerName: string | null;
  /** Synodic period (days) with the primary partner — the interval between successive conjunctions. */
  synodicPeriodDays: number | null;
  /** Next contact window (when any pair is within combined radii), or null when timing data is missing. */
  nextCollision: CollisionWindow | null;
  /**
   * Up to 10 upcoming contact windows in chronological order, merged across every crossing
   * partner of this body; empty when timing data is missing. Each window names its own partner.
   */
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

/**
 * One side of a ring collision: either a solid body (its own bound orbit) or a ring (a static
 * band around its host). Deliberately plain data rather than a `SystemBody` reference — this
 * status crosses the worker boundary (see {@link OrbitalWorkerService}), so callers re-resolve the
 * live node from its stable child-index path against the local system tree when they need it back.
 */
export interface RingCollisionExtent {
  /**
   * Full display name. For a body this is its own `bodyData.name` (already system-prefixed); for
   * a ring it's its host body's name plus the ring's own bare identifier (e.g. "A Ring") — a
   * ring's own `bodyData.name` alone is ambiguous once two different bodies' rings are shown side
   * by side, since it's stripped of its host's name at parse time (see
   * {@link OrbitalRelationsCore.ringCollisionExtent}).
   */
  name: string;
  /** 'body' for a planet/moon/star, 'ring' for a ring. */
  kind: 'body' | 'ring';
  /** Stable child-index path from the system root, for re-resolving this node across the worker boundary. */
  path: number[];
}

/**
 * Result of ring-collision analysis for a body or ring: whether a genuine, timeable collision was
 * found with some other body's rings (a "Body on Ring" collision) or another ring ("Ring on
 * Ring") — see {@link OrbitalRelationsCore.detectRingCollisionStatus}. Unlike
 * {@link CollisionStatus}, there is no untimed "geometric candidate" state: a pair is only ever
 * reported here once an actual contact window has been found, since rings are static (they don't
 * move relative to their host) and only the configurations {@link OrbitalRelationsCore.resolveRingOrbitPair}
 * describes have a tractable orbital frame to search precisely — anything else (e.g. requiring a
 * shared ancestor two or more levels up) simply isn't evaluated at all rather than surfaced as an
 * unconfirmed guess.
 */
export interface RingCollisionStatus {
  /** True when a genuine, timed collision was found with another body's rings. */
  isCandidate: boolean;
  /** This object, when {@link isCandidate}; null otherwise. */
  self: RingCollisionExtent | null;
  /** The other object involved — a ring, or the body whose orbit reaches this ring; null when not a candidate. */
  partner: RingCollisionExtent | null;
  /** Sum of the two objects' physical extents (a ring's outer radius, or a body's radius) — the contact threshold. Null when not a candidate. */
  combinedRadiiKm: number | null;
  /**
   * The contact band's *lower* edge (km) — see {@link OrbitalRelationsCore.ringContactBand}. Zero
   * when the pair can never separate once close enough (e.g. a body whose own radius already
   * reaches a ring's inner edge); nonzero when closer than this means one side has passed inside
   * the other's central hole, briefly breaking contact — the source of a close ring-on-ring pass
   * registering as two collisions either side of closest approach. Null when not a candidate.
   */
  combinedRadiiMinKm: number | null;
  /** Synodic period (days) between the pair's orbital timing — the interval between successive close approaches. Null when not a candidate. */
  synodicPeriodDays: number | null;
  /** The soonest contact window; never null when {@link isCandidate} is true. */
  nextCollision: CollisionWindow | null;
  /** Up to 10 upcoming contact windows in chronological order; empty when not a candidate. */
  upcomingCollisions: CollisionWindow[];
}

/**
 * What {@link OrbitalRelationsCore.resolveRingOrbitPair} resolves a ring-collision pair to: either
 * side may be a plain single-Kepler-orbit body (`'simple'`, timed the same way as a planet-planet
 * collision) or a "nested" body whose absolute motion is the superposition of two orbits (a moon
 * riding its own planet's orbit around a shared barycentre) — timed by tracking its exact combined
 * position over time rather than a single ellipse.
 */
type RingOrbitPair =
  | { kind: 'simple'; a: CanonnBiostatsBody; b: CanonnBiostatsBody; synodicDays: number }
  | {
    kind: 'nested';
    /** Absolute position (km) of each side at any epoch-ms time. */
    posA: (tMs: number) => Vec3;
    posB: (tMs: number) => Vec3;
    /** The faster of the two component periods (days) — sets the scan resolution. */
    fastPeriodDays: number;
    /** The slower of the two component periods (days) — bounds the default scan horizon. */
    slowPeriodDays: number;
    /** Each side's own display name, for the resulting {@link CollisionWindow.partnerName}. */
    labelA: string;
    labelB: string;
  };

/**
 * A collision partner for a plain body-body collision (see {@link OrbitalRelationsCore.collisionPartners}):
 * either a direct sibling (`'simple'`, both sides a single Kepler orbit under the same parent) or
 * a "nested" aunt/uncle — a sibling of the reference body's own parent, checked against the
 * reference body's exact composite motion (see {@link OrbitalRelationsCore.nestedCollisionPartners}).
 * The body-body analogue of {@link RingOrbitPair}, minus the ring-specific contact band (a plain
 * combined-radii threshold covers both bodies here).
 */
type CollisionPartnerDescriptor =
  | { kind: 'simple'; partner: SystemBody; synodic: number; contactKm: number }
  | {
    kind: 'nested';
    partner: SystemBody;
    posA: (tMs: number) => Vec3;
    posB: (tMs: number) => Vec3;
    fastPeriodDays: number;
    slowPeriodDays: number;
    contactKm: number;
  };

/**
 * A timed multi-body pile-up: an interval in which a reference body is simultaneously in
 * contact with two or more siblings. Detected over a fixed time horizon rather than from the
 * (capped) upcoming-contacts list, so a cluster further out than the listed rows is still found.
 */
export interface SimultaneousCollision {
  /** Full names of the sibling bodies the reference body contacts at once (≥ 2). */
  partnerNames: string[];
  /** Earliest contact start across the cluster. */
  start: Date;
  /** Latest contact end across the cluster. */
  end: Date;
  /** Days from `now` until the cluster opens (slightly negative when already in progress). */
  days: number;
}

/** Milliseconds per day, used to convert orbital periods (days) to wall-clock time. */
const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Kilometres per astronomical unit, to compare body radii against orbital distances. */
const KM_PER_AU = 149597870.7;
/** Radians per degree, for the 3D Keplerian position maths. */
const DEG_TO_RAD = Math.PI / 180;
/**
 * Number of evenly-spaced mean-anomaly samples per orbit for the coarse proximity scan.
 * The coarse grid only has to resolve the *basins* of the orbit-to-orbit distance surface
 * (which are far wider than the contact width), not the contact arc itself: the narrow
 * close-approach valley of two tightly-nested, tilted orbits is caught separately by the
 * line-of-nodes seeds, and every seed is then zoomed to sub-km precision by
 * {@link OrbitalRelationsService.refineOrbitMinimum}. So we cap the grid at a fixed sample
 * count (0.5° spacing — four times finer than the historical 1° that missed valleys, and
 * the node seeds now cover those valleys regardless) instead of scaling the step down to the
 * contact arc. The old adaptive step bottomed out at 0.05° for any orbit beyond ~0.1 AU,
 * driving the O(N²) coarse double-loop to 7200² ≈ 52M iterations (~200 ms) per sibling pair.
 */
const ORBIT_COARSE_SAMPLES = 720;
/** How many of the closest coarse cells to refine from (covers multiple close-approach basins). */
const ORBIT_REFINE_TOPK = 6;
/** Half-grid size (per axis) for each zoom pass refining the orbit-to-orbit minimum. */
const ORBIT_REFINE_GRID = 4;
/** Number of zoom passes refining the orbit-to-orbit minimum distance. */
const ORBIT_REFINE_ITERATIONS = 10;
/** Upper bound on conjunctions examined before giving up on finding a collision date. */
const MAX_CONJUNCTIONS_SCANNED = 300;
/**
 * Hard cap on how many conjunctions a single {@link OrbitalRelationsCore.nextContacts} or
 * {@link OrbitalRelationsCore.nestedContactWindows} search may spend on {@link contactCrossing}'s
 * genuinely bounded but nontrivial edge search (see {@link appendMinimumWindows}'
 * `didExpensiveWork`), on top of (not instead of) {@link MAX_CONJUNCTIONS_SCANNED}'s cap on
 * conjunctions examined overall. A pair whose contact geometry sits right at a threshold boundary
 * can have *every* conjunction reach that point without ever resolving a window — a real system (a
 * moon orbiting just inside its own planet's ring band) measured at 2.6–3.7 seconds *per pair*
 * despite windows.length ending at 0, all MAX_CONJUNCTIONS_SCANNED attempts paying that cost. Run
 * on a single worker shared by every row, one such pair blocks all the others queued behind it.
 * A genuine search reaching MAX_UPCOMING_CONTACTS successfully needs nowhere near this many.
 */
const MAX_EXPENSIVE_CONTACT_ATTEMPTS = 40;

/** Cap on how many upcoming contact windows are surfaced (merged across all crossing partners). */
const MAX_UPCOMING_CONTACTS = 10;

/**
 * Vertical thickness (km) assumed for a planetary ring. Elite's rings run a little under 15 km
 * thick, of which roughly the inner 5 km is what actually reads as visible material. The dumps
 * carry no thickness field, so this stands in for it.
 *
 * It matters because a ring is a slab, not a razor-thin annulus: its edges reach about half a
 * thickness beyond `outerRadius` and half a thickness inside `innerRadius`, which widens the
 * contact band at both ends in {@link OrbitalRelationsCore.ringContactBand} — lengthening each
 * contact slightly and shortening the no-contact gap through closest approach.
 */
const RING_THICKNESS_KM = 15;

/**
 * Coarse-scan resolution for a "nested" ring-collision pair (see {@link OrbitalRelationsCore.resolveRingOrbitPair}):
 * samples per cycle of the faster of its two component periods, just enough to seed each local
 * minimum's basin for {@link OrbitalRelationsCore.zoomToMinimum} to refine to sub-second precision —
 * it doesn't need to resolve the contact window itself, only land within it.
 */
const NESTED_SAMPLES_PER_FAST_PERIOD = 300;
/** Hard cap on total coarse samples for a nested pair's scan, guarding against a pathologically short fast period paired with a long horizon. */
const MAX_NESTED_SAMPLES = 1_000_000;

/** Angular tolerance (degrees) for matching a Lagrange geometry. */
const ANGLE_TOLERANCE_DEG = 1;
/** Tolerance (degrees) for L1/L2 alignment of argument-of-periapsis and ascending node. */
const ALIGNMENT_TOLERANCE_DEG = 5;
/** Tolerance (degrees) for equal rosette spacing. */
const ROSETTE_TOLERANCE_DEG = 5;

/** A 3D position in the system's shared frame (kilometres). */
interface Vec3 { x: number; y: number; z: number; }

/**
 * Detects co-orbital configurations (Trojan/Lagrange points and rosettes) and predicts
 * collisions by comparing a body's Keplerian elements with those of its siblings under the
 * same parent. Pure — no Angular/DOM dependency — so it runs identically on the main thread
 * or inside the collision web worker, and is unit-tested directly. The `@Injectable`
 * {@link OrbitalRelationsService} is a thin subclass of this for Angular DI; the worker
 * imports this framework-free class so no Angular runtime ends up in the worker bundle.
 */
export class OrbitalRelationsCore {
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

    // L1, L2 and L3 are defined relative to a real massive central body. When the shared
    // parent is a barycentre there is no such third body — its children are the components
    // of a binary (or families) orbiting a centre of mass — so those points are suppressed
    // below (the L3 branch and the L1/L2 block both bail on `parentIsBarycentre`). A ±60°
    // Trojan host, by contrast, *is* the massive co-orbital secondary its companions hang
    // off, so it remains valid even around a barycentre; we therefore no longer suppress the
    // whole family here (commit 97d9a50 did, which also hid genuine barycentre-orbiting
    // Trojan hosts like Hyuqoae GH-V f2-368 AB 2/3/4).
    const parentIsBarycentre = body.parent.bodyData.type === BODY_TYPE.Barycentre;

    // L3, L4, L5 candidates share the same orbital distance (semi-major axis).
    //
    // A body's true along-orbit position is its mean longitude λ = Ω + ω + M
    // (ascendingNode + argOfPeriapsis + meanAnomaly), so the angular separation of two
    // co-orbital siblings is Δλ = ΔΩ + Δω + ΔM. We compare argOfPeriapsis (Δω) alone.
    // That is exact — not merely a heuristic — for Elite's data, because the game holds
    // Ω and M *identical* across co-orbital siblings and encodes the entire along-orbit
    // offset in argOfPeriapsis, so ΔΩ = ΔM = 0 and Δλ = Δω. Verified against every real
    // co-orbital pair in the fixtures — both 180° binaries (Alpha Centauri's "2045 PC2" /
    // "Lagrange" L3 pair, Merope 1 a/b, …) and genuine ±60° Trojans (Pro Eurl JF-A d88,
    // Pipe (stem) Sector DL-Y d17, Prooe Bli FQ-R c19-2, Truecho NE-P c22-0, and the
    // Eorld Byio AA-A h539 host with companions at both L4 and L5): in each, ascendingNode
    // and meanAnomaly match between siblings (or are absent on both) and only argOfPeriapsis
    // differs. See the orbital-relations spec's "real game fixtures" block for the pinned values.
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
      } else if (!parentIsBarycentre && Math.abs(normalizedDiff - 180) < ANGLE_TOLERANCE_DEG) {
        // 180° opposition → L3, but only around a real central body. A 180° pair orbiting a
        // barycentre is a binary, not an L3, so it falls through here and is left unbadged.
        result.lagrangePoint = 'L3';
        return result;
      }
    }

    // L1 and L2 (like L3) are defined relative to a real massive central body, so under a
    // barycentre none of them apply — only the ±60° Trojan host detected above (which is
    // itself the massive co-orbital secondary) survives. A binary's components are 180°
    // opposed, never aligned, so the L1/L2 test below can't misfire on one anyway, but we
    // stop here to keep the barycentre rule symmetric with the suppressed L3.
    if (parentIsBarycentre) {
      return result;
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
   * Resolves the whole co-orbital family `body` belongs to into a Lagrange diagram: the
   * shared parent (central primary), the secondary host (if any), and which bodies occupy
   * each Lagrange point. Every family member is classified with {@link detectTrojanStatus},
   * so the assignment matches the badges shown on each body. `body` itself is flagged as the
   * focus so the UI can highlight it.
   *
   * Returns null when there is nothing meaningful to draw — no parent, no shared orbital
   * period, or no co-orbital relationships detected anywhere in the family.
   */
  lagrangeConfiguration(body: SystemBody): LagrangeConfiguration | null {
    const parent = body.parent;
    const bd = body.bodyData;
    if (!parent || !bd.orbitalPeriod) {
      return null;
    }

    // A barycentre can be the centre of a genuine Trojan configuration (its mass hosts a
    // ±60° co-orbital secondary at L4/L5), so — unlike commit 97d9a50, which bailed out for
    // every barycentre — we build the diagram and let detectTrojanStatus decide per member.
    // A plain 180° binary orbiting a barycentre yields no classified members (its L3 is
    // suppressed there), so the family below has no occupants and we still return null.

    // The co-orbital family: every sibling sharing this body's orbital period (so L1/L2
    // partners at a different radius are included too), plus `body` itself — it already
    // lives in `parent.subBodies`. Members without an argOfPeriapsis can't be classified.
    const family = parent.subBodies.filter(member =>
      member.bodyData.orbitalPeriod === bd.orbitalPeriod &&
      member.bodyData.argOfPeriapsis !== undefined,
    );

    const points: Record<LagrangePointId, LagrangeOccupant[]> = { L1: [], L2: [], L3: [], L4: [], L5: [] };
    let secondary: LagrangeOccupant | null = null;

    for (const member of family) {
      const status = this.detectTrojanStatus(member);
      if (!status.isHost && !status.lagrangePoint) { continue; }
      const occupant: LagrangeOccupant = {
        name: member.bodyData.name,
        bodyId: member.bodyData.bodyId,
        isFocus: member === body,
      };
      if (status.isHost) {
        secondary = occupant;
      } else if (status.lagrangePoint) {
        points[status.lagrangePoint].push(occupant);
      }
    }

    // An L3 opposition has no host (neither body has companions at both L4 and L5), so the
    // pair both read as L3 and the secondary slot would be left empty — stacking the two
    // opposed bodies on the single L3 marker. But L3 is defined as the point 180° across the
    // primary *from the secondary*, so one of the opposed pair plays the secondary's role:
    // promote it into the secondary slot and the diagram draws them on opposite sides of the
    // orbit (secondary at 0°, the other at L3), exactly the geometry the configuration is.
    // Promote a non-focused member when possible, so a dialog opened from an L3 badge keeps
    // the clicked body on the labelled L3 marker.
    if (secondary === null && points.L3.length > 1) {
      const focusIndex = points.L3.findIndex(o => o.isFocus);
      const promoteIndex = focusIndex === 0 ? 1 : 0;
      [secondary] = points.L3.splice(promoteIndex, 1);
    }

    const hasOccupant = secondary !== null || Object.values(points).some(slot => slot.length > 0);
    if (!hasOccupant) {
      return null;
    }

    return { primaryName: parent.bodyData.name, secondary, points };
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

  /** Walks to the root of the system tree containing `body`. */
  private systemRoot(body: SystemBody): SystemBody {
    let node = body;
    while (node.parent) { node = node.parent; }
    return node;
  }

  /** Every body in the system (root + all descendants), flattened. */
  private flattenSystem(root: SystemBody): SystemBody[] {
    const out: SystemBody[] = [root];
    for (const child of root.subBodies) { out.push(...this.flattenSystem(child)); }
    return out;
  }

  /**
   * The most recent mean-anomaly observation timestamp recorded anywhere in `body`'s
   * system — the shared epoch every body's displayed mean/true anomaly is calculated
   * at, so bodies observed at different times still read as one consistent snapshot.
   * Null when no body in the system carries a mean-anomaly timestamp.
   */
  systemAnomalyEpoch(body: SystemBody): Date | null {
    let latestMs: number | null = null;
    for (const b of this.flattenSystem(this.systemRoot(body))) {
      const ts = b.bodyData.timestamps?.meanAnomaly;
      const ms = ts ? Date.parse(ts) : NaN;
      if (Number.isFinite(ms) && (latestMs === null || ms > latestMs)) { latestMs = ms; }
    }
    return latestMs === null ? null : new Date(latestMs);
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
   * node, far narrower than a uniform sweep can resolve, so the closest *coarse* sample alone
   * reports a wildly inflated minimum. We defend against that two ways that don't depend on
   * grid fineness: we keep the K closest coarse cells (multiple basins), and we additionally
   * seed the refinement on the orbits' mutual line of nodes — where a relative tilt brings
   * near-coplanar orbits closest. Every seed is then zoomed to sub-km precision, so the coarse
   * grid only needs to land each true minimum in *some* seed's catchment, not resolve it. That
   * lets the grid stay a fixed, bounded size ({@link ORBIT_COARSE_SAMPLES}) instead of an
   * adaptive step that exploded the O(N²) double-loop for distant orbits.
   */
  private minOrbitDistanceKm(a: CanonnBiostatsBody, b: CanonnBiostatsBody): number {
    // Fixed coarse grid: its job is to seed the refinement into the right basin, not to
    // resolve the contact arc, so its cost is bounded regardless of orbital scale. The
    // refinement window below is the coarse spacing, so each ±window covers the gap to the
    // neighbouring sample and the zoom can reach any minimum between two coarse cells.
    const stepDeg = 360 / ORBIT_COARSE_SAMPLES;

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
   * Builds a closure giving a body's absolute position (km) at any epoch-ms time, by propagating
   * its mean anomaly from its recorded sample and evaluating its 3D Keplerian position. Returns
   * null when the body lacks the phase data (mean anomaly + timestamp) needed to place it in
   * time. The building block both {@link separationFunction} (two single-orbit bodies) and
   * {@link nestedPositionFunction} (one body superposed on another) are assembled from.
   */
  private positionFunction(bd: CanonnBiostatsBody): ((tMs: number) => Vec3) | null {
    if (bd.meanAnomaly == null || !bd.orbitalPeriod || !bd.timestamps?.meanAnomaly) { return null; }
    const epoch = Date.parse(bd.timestamps.meanAnomaly);
    return (tMs: number): Vec3 => {
      const M = bd.meanAnomaly! + ((tMs - epoch) / MS_PER_DAY / bd.orbitalPeriod!) * 360;
      return this.orbitalStateVector(bd, M);
    };
  }

  /**
   * Absolute position (km) of a body nested one level under another orbiting body, at any
   * epoch-ms time: its own orbit around its immediate parent, plus that parent's orbit around
   * the shared grandparent — an exact superposition, not an approximation, since both component
   * orbits are independently Keplerian. Returns null when either body lacks the phase data
   * needed to place it in time.
   */
  private nestedPositionFunction(inner: CanonnBiostatsBody, outer: CanonnBiostatsBody): ((tMs: number) => Vec3) | null {
    const posInner = this.positionFunction(inner);
    const posOuter = this.positionFunction(outer);
    if (!posInner || !posOuter) { return null; }
    return (tMs: number): Vec3 => {
      const pi = posInner(tMs), po = posOuter(tMs);
      return { x: pi.x + po.x, y: pi.y + po.y, z: pi.z + po.z };
    };
  }

  /** Centre-to-centre distance (km) between two position closures at any epoch-ms time. */
  private separationFunctionFromPositions(posA: (tMs: number) => Vec3, posB: (tMs: number) => Vec3): (tMs: number) => number {
    return (tMs: number): number => {
      const pa = posA(tMs), pb = posB(tMs);
      const dx = pa.x - pb.x, dy = pa.y - pb.y, dz = pa.z - pb.z;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    };
  }

  /**
   * Builds a closure giving the centre-to-centre distance (km) between two bodies at any
   * epoch-ms time. Returns null when either body lacks the phase data (mean anomaly +
   * timestamp) needed to place it in time. Shared by the collision search and the
   * distance-over-time diagram so both measure separation identically.
   */
  private separationFunction(a: CanonnBiostatsBody, b: CanonnBiostatsBody): ((tMs: number) => number) | null {
    const posA = this.positionFunction(a);
    const posB = this.positionFunction(b);
    if (!posA || !posB) { return null; }
    return this.separationFunctionFromPositions(posA, posB);
  }

  /**
   * Centre-to-centre distance (km) sampled at `samples` evenly-spaced instants over
   * [startMs, endMs] inclusive, from an already-built separation closure — the data behind the
   * collision dialog's distance-over-time (synodic) diagram. The curve dips to a minimum at each
   * conjunction and is deepest when that conjunction falls on the orbits' mutual node (a
   * collision). Returns [] when the window/sample count is degenerate.
   */
  private sampleSeparation(sep: (tMs: number) => number, startMs: number, endMs: number, samples: number): SeparationSample[] {
    if (!(endMs > startMs) || samples < 2) { return []; }
    const step = (endMs - startMs) / (samples - 1);
    const out: SeparationSample[] = [];
    for (let i = 0; i < samples; i++) {
      const tMs = startMs + i * step;
      out.push({ tMs, sepKm: sep(tMs) });
    }
    return out;
  }

  /**
   * Centre-to-centre distance (km) between two bodies sampled at `samples` evenly-spaced
   * instants over [startMs, endMs] inclusive — the data behind the collision dialog's
   * distance-over-time (synodic) diagram. Returns [] when either body lacks the phase data
   * needed to place it in time, or when the window/sample count is degenerate.
   */
  separationSeries(a: CanonnBiostatsBody, b: CanonnBiostatsBody, startMs: number, endMs: number, samples: number): SeparationSample[] {
    const sep = this.separationFunction(a, b);
    return sep ? this.sampleSeparation(sep, startMs, endMs, samples) : [];
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
  private nextContacts(a: CanonnBiostatsBody, b: CanonnBiostatsBody, contactKm: number, synodicDays: number, now: number, count: number, horizonMs: number = Infinity, minContactKm: number = 0): CollisionWindow[] {
    const sep = this.separationFunction(a, b);
    if (!sep || !Number.isFinite(synodicDays)) { return []; }

    const synodicMs = synodicDays * MS_PER_DAY;

    // Step 1: coarse scan over [now − ½syn, now + 1syn] with 2000 equal steps to locate the
    // closest-approach spike (a sharp local minimum in the distance-vs-time curve).
    const STEPS = 2000;
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
    const ref = this.zoomToMinimum(sep, initBestT, synodicMs / 2);

    // Step 3: step backward in synodic-period increments until t < now.
    let t0 = ref.t;
    while (t0 >= now) { t0 -= synodicMs; }

    // Step 4: march forward one synodic period at a time; zoom-refine each event to sub-second
    // precision and record it as a contact when separation ≤ contactKm. Not every close approach
    // is a collision — many conjunctions miss the orbits' mutual node — so each synodic event is
    // evaluated individually rather than assumed to collide.
    const stepMs = (30 / 86400) * MS_PER_DAY; // 30-second probes for window bisection
    const maxSpanMs = synodicMs / 2;           // bisection walk bound: half a synodic period
    const results: CollisionWindow[] = [];
    let expensiveAttempts = 0;

    for (let k = 0; k < MAX_CONJUNCTIONS_SCANNED && results.length < count; k++) {
      const candidateMs = t0 + k * synodicMs;
      // Stop once conjunctions march past the caller's time horizon (later ones only recede
      // further). Used by the simultaneity scan to bound work to the next N days.
      if (candidateMs - now > horizonMs) { break; }
      const min = this.zoomToMinimum(sep, candidateMs, synodicMs / 2);
      const { didExpensiveWork } = this.appendMinimumWindows(sep, min.t, min.sepKm, contactKm, minContactKm, stepMs, maxSpanMs, now, count, b.name, results);
      // See MAX_EXPENSIVE_CONTACT_ATTEMPTS: caps a pair whose every conjunction pays the full
      // edge-search cost without ever resolving a window from running all 300 attempts anyway.
      if (didExpensiveWork && ++expensiveAttempts >= MAX_EXPENSIVE_CONTACT_ATTEMPTS) { break; }
    }
    return results;
  }

  /**
   * Finds the time of minimum separation within [centerMs − halfMs, centerMs + halfMs] using
   * iterative zoom: 2000 samples per pass, window halved and recentred on the running best each
   * pass, until the half-window is under 500 ms (sub-second precision). Shared by
   * {@link nextContacts}'s synodic marching and {@link nestedContactWindows}'s dense scan to
   * refine a coarse candidate to the true local minimum, regardless of how that candidate was found.
   */
  private zoomToMinimum(sep: (tMs: number) => number, centerMs: number, halfMs: number): { t: number; sepKm: number } {
    const STEPS = 2000;
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
  }

  /**
   * Given one conjunction's already-refined minimum (`minT`/`minSepKm`), builds its contact
   * window(s) — bisecting the edges with {@link contactCrossing} — and appends any that survive
   * (in-threshold, not already covered by the last recorded window, not entirely in the past) to
   * `results`, mutating it in place. Shared by {@link nextContacts} (which finds each conjunction
   * by marching in fixed synodic-period steps) and {@link nestedContactWindows} (which finds them
   * by scanning a dense local-minima search instead) — everything downstream of "here is a
   * conjunction's minimum" is identical between the two.
   *
   * `didExpensiveWork` is false for a conjunction rejected by one of the cheap checks below
   * (too old, too far, already covered) and true once it reaches {@link contactCrossing} — callers
   * use it to cap the number of genuinely expensive attempts a single search can make (see
   * {@link MAX_EXPENSIVE_CONTACT_ATTEMPTS}), since a pair whose geometry sits right at a threshold
   * boundary can have *every* conjunction reach this point without ever resolving a window.
   *
   * `forwardUnresolved` is true when the forward-most edge search came back null — i.e. contact is
   * still open going forward, {@link contactCrossing} couldn't find where it ends within
   * `maxSpanMs`. A marching caller ({@link nextContacts}) doesn't need this (it always advances a
   * full synodic period next regardless); a dense-scan caller ({@link nestedContactWindows}) does —
   * without it, every subsequent sample still inside that same unresolved stretch would re-trigger
   * the same expensive, equally-fruitless edge search, since a null edge is never recorded to
   * de-duplicate against the way a resolved one is.
   */
  private appendMinimumWindows(
    sep: (tMs: number) => number,
    minT: number, minSepKm: number,
    contactKm: number, minContactKm: number,
    stepMs: number, maxSpanMs: number,
    now: number, count: number, partnerName: string,
    results: CollisionWindow[],
  ): { didExpensiveWork: boolean; forwardUnresolved: boolean } {
    const cheapReject = { didExpensiveWork: false, forwardUnresolved: false };
    // Allow minT to be slightly before now: a contact whose minimum lands at now±ε (e.g. bodies
    // aligned at the reference epoch) must not be discarded. We only reject a conjunction whose
    // minimum is older than maxSpanMs; contacts whose window has already ended are filtered below
    // after computing endMs.
    if (minT < now - maxSpanMs || !Number.isFinite(minSepKm)) { return cheapReject; }
    if (minSepKm > contactKm) { return cheapReject; }

    // De-duplicate: skip if this minimum falls inside the last recorded contact window.
    if (results.length > 0 && minT <= results[results.length - 1].end.getTime()) { return cheapReject; }

    // The conjunction's contact windows. With the default minContactKm of 0 there is exactly
    // one — separation simply dips below contactKm and back, bottoming out at minT — but a
    // ring pair has a contact *band* (see ringContactBand): once the bodies come closer than
    // the band's inner edge, one ring has passed inside the other's central hole along the line
    // joining them and they separate again, so a single conjunction yields two windows either
    // side of the minimum, each bottoming out — at minContactKm, not the true minimum — right
    // at the edge nearest closest approach (endMs approaching, startMs receding), not centred.
    const conjunctionWindows: { startMs: number | null; endMs: number | null; minSepKm: number; minSepAtMs: number }[] = [];
    if (minSepKm >= minContactKm) {
      conjunctionWindows.push({
        startMs: this.contactCrossing(sep, minT, -1, contactKm, stepMs, maxSpanMs),
        endMs: this.contactCrossing(sep, minT, 1, contactKm, stepMs, maxSpanMs),
        minSepKm, minSepAtMs: minT,
      });
    } else {
      // Approaching: contact opens at the band's outer edge and closes at its inner edge.
      const endMs = this.contactCrossing(sep, minT, -1, minContactKm, stepMs, maxSpanMs);
      conjunctionWindows.push({
        startMs: this.contactCrossing(sep, minT, -1, contactKm, stepMs, maxSpanMs),
        endMs, minSepKm: minContactKm, minSepAtMs: endMs ?? minT,
      });
      // Receding: contact re-opens at the inner edge and closes at the outer edge.
      const startMs = this.contactCrossing(sep, minT, 1, minContactKm, stepMs, maxSpanMs);
      conjunctionWindows.push({
        startMs,
        endMs: this.contactCrossing(sep, minT, 1, contactKm, stepMs, maxSpanMs),
        minSepKm: minContactKm, minSepAtMs: startMs ?? minT,
      });
    }

    for (const w of conjunctionWindows) {
      if (results.length >= count) { break; }
      // A null edge means no crossing was found within maxSpanMs (see contactCrossing) — the
      // window can't be reliably bounded, so skip it rather than report a fabricated edge.
      if (w.startMs === null || w.endMs === null) { continue; }
      if (!(w.endMs > w.startMs)) { continue; }
      // Skip contacts whose window ended entirely before now (historical events; days < 0
      // and the window is over). Contacts in progress (endMs > now, startMs ≤ now) are kept:
      // days will be slightly negative, which CollisionWindow.days documents as intentional.
      if (w.endMs < now) { continue; }
      if (results.length > 0 && w.startMs <= results[results.length - 1].end.getTime()) { continue; }
      results.push({
        start: new Date(w.startMs), end: new Date(w.endMs),
        days: (w.startMs - now) / MS_PER_DAY,
        minSeparationKm: w.minSepKm, minSeparationAt: new Date(w.minSepAtMs),
        partnerName, combinedRadiiKm: contactKm,
      });
    }

    // The forward-most edge is always the last entry's endMs (the "not in the hole" case has one
    // entry; the split-window case's second, receding entry closes at the true outer edge).
    return { didExpensiveWork: true, forwardUnresolved: conjunctionWindows[conjunctionWindows.length - 1].endMs === null };
  }

  /**
   * Contact windows for a "nested" ring-collision pair (see {@link resolveRingOrbitPair}): one
   * side's absolute motion is the superposition of two Kepler orbits, not a single ellipse, so
   * conjunctions don't recur at one fixed synodic period the way {@link nextContacts} assumes.
   * Instead this scans the true separation curve densely enough to resolve the faster of the two
   * component periods, finds every local minimum, and hands each to
   * {@link appendMinimumWindows} exactly as {@link nextContacts} does per synodic conjunction.
   *
   * The scan runs from one fast period before `now` (to catch a contact already in progress) out
   * to `horizonMs` — or, when unbounded, out to {@link MAX_CONJUNCTIONS_SCANNED} cycles of the
   * *slower* component period, mirroring how the synodic marcher bounds an unbounded horizon.
   */
  private nestedContactWindows(
    posA: (tMs: number) => Vec3, posB: (tMs: number) => Vec3,
    fastPeriodDays: number, slowPeriodDays: number,
    contactKm: number, minContactKm: number,
    now: number, count: number, horizonMs: number, partnerName: string,
  ): CollisionWindow[] {
    const results: CollisionWindow[] = [];
    const fastMs = fastPeriodDays * MS_PER_DAY;
    const slowMs = slowPeriodDays * MS_PER_DAY;
    if (!(fastMs > 0) || !(slowMs > 0)) { return results; }

    const sep = this.separationFunctionFromPositions(posA, posB);
    const effectiveHorizonMs = Number.isFinite(horizonMs) ? horizonMs : MAX_CONJUNCTIONS_SCANNED * slowMs;
    const scanStart = now - fastMs;
    const scanEnd = now + effectiveHorizonMs;
    const rawStepMs = fastMs / NESTED_SAMPLES_PER_FAST_PERIOD;
    const stepMs = Math.max(rawStepMs, (scanEnd - scanStart) / MAX_NESTED_SAMPLES);

    const edgeStepMs = (30 / 86400) * MS_PER_DAY; // 30-second probes for window bisection
    const maxSpanMs = fastMs;                      // bisection walk bound: one fast period

    // Three-point local-minimum scan: a sample that's no larger than both neighbours seeds a
    // zoom-refine to the true nearby minimum. Every candidate is refined (not just ones already
    // under contactKm) since a coarse sample can sit noticeably above the true dip beside it.
    //
    // `suppressed` guards against a genuinely wide contact — one that outlasts maxSpanMs, so
    // appendMinimumWindows can't bound its forward edge and returns true. Without this, every
    // later sample still inside that same still-unresolved stretch would trigger its own full,
    // equally fruitless edge search (a null edge is never recorded to de-duplicate against the
    // way a resolved one is) — turning one wide contact into thousands of expensive searches
    // instead of one. While suppressed, only the (already-computed) coarse sample is checked
    // against contactKm — cheap — until it naturally exits, at which point detection resumes.
    let prevPrev = sep(scanStart);
    let prev = sep(scanStart + stepMs);
    let suppressed = false;
    let expensiveAttempts = 0;
    for (let t = scanStart + 2 * stepMs; t <= scanEnd && results.length < count; t += stepMs) {
      const curr = sep(t);
      if (suppressed) {
        if (curr > contactKm) { suppressed = false; }
      } else if (prev <= prevPrev && prev <= curr) {
        const refined = this.zoomToMinimum(sep, t - stepMs, stepMs);
        const r = this.appendMinimumWindows(sep, refined.t, refined.sepKm, contactKm, minContactKm, edgeStepMs, maxSpanMs, now, count, partnerName, results);
        suppressed = r.forwardUnresolved;
        // See MAX_EXPENSIVE_CONTACT_ATTEMPTS: a backstop on top of the suppression above, for
        // whatever pathological shape (many *distinct* costly stretches, say) it doesn't cover.
        if (r.didExpensiveWork && ++expensiveAttempts >= MAX_EXPENSIVE_CONTACT_ATTEMPTS) { break; }
      }
      prevPrev = prev; prev = curr;
    }
    return results;
  }

  /**
   * Time at which `sep` first rises above `threshold`, walking away from `fromMs` in `dir`
   * (+1 forward, −1 backward) from a point known to be at or below it: coarse 30-second probes
   * out to `maxSpanMs`, then bisection. Used to root-find the edges of a contact window.
   *
   * Returns null when no crossing is found within `maxSpanMs` — i.e. `sep` never rises above
   * `threshold` anywhere in that whole span, so `outside` never actually leaves the "inside"
   * region and there is no valid bracket to bisect. Bisecting anyway would silently converge on
   * the search cap itself and report it as a fabricated contact boundary.
   */
  private contactCrossing(
    sep: (tMs: number) => number,
    fromMs: number,
    dir: 1 | -1,
    threshold: number,
    stepMs: number,
    maxSpanMs: number,
  ): number | null {
    let inside = fromMs;
    let outside = fromMs + dir * stepMs;
    while (Math.abs(outside - fromMs) <= maxSpanMs && sep(outside) <= threshold) {
      inside = outside;
      outside += dir * stepMs;
    }
    if (sep(outside) <= threshold) { return null; }
    for (let i = 0; i < 40; i++) {
      const mid = (inside + outside) / 2;
      if (sep(mid) > threshold) { outside = mid; } else { inside = mid; }
    }
    return inside;
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
  /**
   * Every sibling under the same parent whose orbit actually crosses this body's within the
   * combined radius — each a direct collision partner — with the pair's synodic period and
   * contact threshold. Most bodies have at most one, but three or four siblings can share
   * crossing orbits. Returns [] when this body itself isn't on a bound, recurring orbit.
   *
   * Only *direct* siblings — see {@link nestedCollisionPartners} for a moon crossing its own
   * parent's sibling.
   */
  private collisionPartners(body: SystemBody): CollisionPartnerDescriptor[] {
    const bd = body.bodyData;
    const range = this.orbitalRadialRange(bd);
    if (!body.parent || !bd.orbitalPeriod || !range) { return []; }

    const partners: CollisionPartnerDescriptor[] = [];
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
      if (this.minOrbitDistanceKm(bd, sd) > contactKm) { continue; }

      const synodic = 1 / Math.abs(1 / bd.orbitalPeriod - 1 / sd.orbitalPeriod);
      partners.push({ kind: 'simple', partner: sibling, synodic, contactKm });
    }
    return partners;
  }

  /**
   * Every "aunt/uncle" collision candidate for `body`: a sibling of `body`'s own parent (i.e. a
   * body two colliding siblings would each call a "sibling"), checked against `body`'s exact
   * composite motion — its own orbit superposed on its parent's (see {@link nestedPositionFunction})
   * — rather than `body`'s own orbit alone. This is the body-on-body analogue of
   * {@link resolveRingOrbitPair}'s nested ring-collision case: if two planets collide and one has
   * a moon, the moon's own true position can independently cross the *other* planet too, at a
   * different moment than its parent's own collision — worth surfacing on the moon's own page the
   * same way a direct sibling collision is. The aunt/uncle's own moons are not, in turn, checked
   * here (that would need superposing *both* sides, a further step this doesn't take).
   */
  private nestedCollisionPartners(body: SystemBody): CollisionPartnerDescriptor[] {
    const grandparent = body.parent?.parent;
    if (!body.parent || !grandparent) { return []; }

    const partners: CollisionPartnerDescriptor[] = [];
    for (const aunt of grandparent.subBodies) {
      if (aunt === body.parent) { continue; }
      if (aunt.bodyData.type === BODY_TYPE.Ring || aunt.bodyData.type === BODY_TYPE.Barycentre) { continue; }
      const contactKm = (body.bodyData.radius ?? 0) + (aunt.bodyData.radius ?? 0);
      if (!(contactKm > 0)) { continue; }

      // Cheap radial pre-filter, mirroring collisionPartners' — a loose (never-too-small) bound
      // on the composite side's reach from the shared grandparent, so it can never miss a real
      // collision, only skip pairs that provably can't touch — checked before paying for
      // buildNestedPair's position-function construction, not after.
      if (this.nestedPairOutOfReach(body.bodyData, body.parent.bodyData, aunt.bodyData, contactKm)) { continue; }

      const nested = this.buildNestedPair(body, body.parent, aunt);
      if (!nested) { continue; }

      partners.push({
        kind: 'nested', partner: aunt, contactKm,
        posA: nested.posA, posB: nested.posB,
        fastPeriodDays: nested.fastPeriodDays, slowPeriodDays: nested.slowPeriodDays,
      });
    }
    return partners;
  }

  /** Upcoming contact windows for one collision partner, dispatching on whether it's simple or nested. */
  private collisionWindowsFor(bd: CanonnBiostatsBody, p: CollisionPartnerDescriptor, now: number, count: number, horizonMs: number): CollisionWindow[] {
    return p.kind === 'simple'
      ? this.nextContacts(bd, p.partner.bodyData, p.contactKm, p.synodic, now, count, horizonMs)
      : this.nestedContactWindows(p.posA, p.posB, p.fastPeriodDays, p.slowPeriodDays, p.contactKm, 0, now, count, horizonMs, p.partner.bodyData.name);
  }

  /**
   * Every contact window for `body` across all its crossing partners that opens within the next
   * `horizonDays`, in chronological order — uncapped, unlike {@link detectCollisionStatus}'s
   * 10-row {@link CollisionStatus.upcomingCollisions}. Each window names its own partner. Lets the
   * dialog mark *all* collisions inside the distance diagram's window, not just the first ten, so
   * no in-view collision dip is left without a marker. Empty when the body has no crossing
   * partners or lacks the phase data to time them.
   */
  upcomingContactsWithin(body: SystemBody, horizonDays: number, now: number = Date.now()): CollisionWindow[] {
    const partners = [...this.collisionPartners(body), ...this.nestedCollisionPartners(body)];
    return this.contactWindowsWithin(partners, body.bodyData, horizonDays * MS_PER_DAY, now)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  /**
   * Contact windows opening within `horizonMs` for each given partner, merged (unsorted). The
   * forward march is bounded both by the horizon and by MAX_CONJUNCTIONS_SCANNED, so tightly
   * spaced pairs stay cheap.
   */
  private contactWindowsWithin(
    partners: CollisionPartnerDescriptor[],
    bodyData: CanonnBiostatsBody,
    horizonMs: number,
    now: number,
  ): CollisionWindow[] {
    const windows: CollisionWindow[] = [];
    for (const p of partners) {
      windows.push(...this.collisionWindowsFor(bodyData, p, now, MAX_CONJUNCTIONS_SCANNED, horizonMs)
        .filter(w => w.start.getTime() <= now + horizonMs));
    }
    return windows;
  }

  /**
   * Timed multi-body pile-ups for `body` over the next `horizonDays`: intervals in which it is
   * simultaneously within contact of two or more siblings (or "aunt/uncle" nested partners —
   * see {@link nestedCollisionPartners}). Unlike the simultaneity derived from
   * {@link detectCollisionStatus}'s capped upcoming-contacts list, this scans every direct
   * partner's contacts across the whole horizon, so a cluster beyond the listed rows is still
   * found. Empty when the body has fewer than two crossing partners.
   */
  simultaneousCollisionsWithin(body: SystemBody, horizonDays: number, now: number = Date.now()): SimultaneousCollision[] {
    const partners = [...this.collisionPartners(body), ...this.nestedCollisionPartners(body)];
    if (partners.length < 2) { return []; }
    return this.groupSimultaneous(this.contactWindowsWithin(partners, body.bodyData, horizonDays * MS_PER_DAY, now), now);
  }

  /**
   * Groups contact windows that overlap in time; a group spanning two or more distinct partners
   * is a simultaneous multi-body collision. Mirrors the time-overlap clustering the dialog does
   * on its visible rows, but over the full horizon set.
   */
  private groupSimultaneous(windows: CollisionWindow[], now: number): SimultaneousCollision[] {
    const sorted = [...windows].sort((a, b) => a.start.getTime() - b.start.getTime());
    const out: SimultaneousCollision[] = [];
    let group: CollisionWindow[] = [];
    let maxEnd = -Infinity;

    const flush = (): void => {
      const partnerNames = new Set(group.map(w => w.partnerName).filter((n): n is string => !!n));
      if (partnerNames.size >= 2) {
        out.push({
          partnerNames: [...partnerNames].sort(),
          start: new Date(Math.min(...group.map(w => w.start.getTime()))),
          end: new Date(Math.max(...group.map(w => w.end.getTime()))),
          days: Math.min(...group.map(w => w.days)),
        });
      }
      group = [];
    };

    for (const w of sorted) {
      if (group.length === 0 || w.start.getTime() <= maxEnd) {
        group.push(w);
        maxEnd = Math.max(maxEnd, w.end.getTime());
      } else {
        flush();
        group = [w];
        maxEnd = w.end.getTime();
      }
    }
    flush();
    return out;
  }

  detectCollisionStatus(body: SystemBody, now: number = Date.now()): CollisionStatus {
    const none: CollisionStatus = {
      isCandidate: false, partnerName: null, synodicPeriodDays: null, nextCollision: null, upcomingCollisions: [], combinedRadiiKm: null, simultaneousPartners: [],
    };
    const bd = body.bodyData;
    const range = this.orbitalRadialRange(bd);
    if (!body.parent || !bd.orbitalPeriod || !range) { return none; }

    const directPartners = this.collisionPartners(body);
    const nestedPartners = this.nestedCollisionPartners(body);
    const partners: CollisionPartnerDescriptor[] = [...directPartners, ...nestedPartners];
    if (partners.length === 0) { return none; }

    // Compute each partner's upcoming contact windows, then merge them into one chronological
    // list so the soonest collisions surface regardless of which sibling — or "aunt/uncle" nested
    // partner (see nestedCollisionPartners) — they involve. Each window already carries its
    // partner's name and contact radius (stamped in collisionWindowsFor).
    const merged: CollisionWindow[] = [];
    for (const p of partners) {
      merged.push(...this.collisionWindowsFor(bd, p, now, MAX_UPCOMING_CONTACTS, Infinity));
    }
    merged.sort((x, y) => x.start.getTime() - y.start.getTime());
    const upcoming = merged.slice(0, MAX_UPCOMING_CONTACTS);

    // The primary partner owns the soonest collision; fall back to the first geometric
    // candidate when no pair has usable phase/timing data (so the badge still appears).
    const primary = (upcoming[0]
      ? partners.find(p => p.partner.bodyData.name === upcoming[0].partnerName)
      : null) ?? partners[0];

    // Identify additional siblings that are part of the same crossing-orbit group, making
    // this a multi-body cluster. Grow the group transitively from every *direct* partner: if
    // A crosses B and B crosses C, C is in the group even if A doesn’t directly cross C. Nested
    // (aunt/uncle) partners sit one level removed from this body's own sibling set and aren't
    // folded into it — a moon crossing its parent's sibling is its own candidate, not part of the
    // sibling cluster's transitive closure.
    const groupMembers = new Set<string>([bd.name, ...directPartners.map(p => p.partner.bodyData.name)]);
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
          if (this.minOrbitDistanceKm(md, sd) > contactKm) { continue; }
          groupMembers.add(sibling.bodyData.name);
          changed = true;
          break;
        }
      }
    }
    const simultaneousPartners = [...groupMembers].filter(n => n !== bd.name && n !== primary.partner.bodyData.name);

    return {
      isCandidate: true,
      partnerName: primary.partner.bodyData.name,
      // A nested pair's true recurrence is quasi-periodic (see nestedContactWindows); its faster
      // component period is the closest single-number stand-in, same as the ring engine's own.
      synodicPeriodDays: primary.kind === 'simple' ? primary.synodic : primary.fastPeriodDays,
      nextCollision: upcoming[0] ?? null,
      upcomingCollisions: upcoming,
      combinedRadiiKm: primary.contactKm,
      simultaneousPartners,
    };
  }

  /**
   * A degenerate a=0 "orbit" that {@link orbitalStateVector} places permanently at (0,0,0)
   * regardless of mean anomaly — used as a stand-in for a fixed reference point (another body's
   * position) so the existing time-stepped separation search ({@link separationFunction}/
   * {@link nextContacts}, which expect two independently orbiting bodies) can be reused for a
   * body orbiting directly around that reference instead of two siblings orbiting a shared parent.
   */
  private stationaryOrigin(name: string, referencePeriodDays: number): CanonnBiostatsBody {
    return {
      bodyId: -1, name, id64: 0n, subType: '', type: BODY_TYPE.Planet,
      semiMajorAxis: 0, orbitalEccentricity: 0, orbitalInclination: 0,
      argOfPeriapsis: 0, ascendingNode: 0, meanAnomaly: 0,
      orbitalPeriod: referencePeriodDays,
      timestamps: { meanAnomaly: '1970-01-01T00:00:00.000Z' },
    } as CanonnBiostatsBody;
  }

  /** {@link orbitalRadialRange}, converted to km. */
  private orbitalRadialRangeKm(bd: CanonnBiostatsBody): { peri: number; apo: number } | null {
    const range = this.orbitalRadialRange(bd);
    return range ? { peri: range.peri * KM_PER_AU, apo: range.apo * KM_PER_AU } : null;
  }

  /**
   * A nested body's own radial reach (km) from the shared grandparent, bounded by the triangle
   * inequality: at least `nestedParent`'s periapsis minus the nested body's apoapsis, at most
   * `nestedParent`'s apoapsis plus the nested body's apoapsis. This can only be loose, never
   * tight — it drops the (irrelevant, for a reject test) direction each orbit points in — so a
   * gap check built on it can only skip pairs that provably can't touch, never miss a real one.
   */
  private nestedRangeKm(nested: CanonnBiostatsBody, nestedParent: CanonnBiostatsBody): { peri: number; apo: number } | null {
    const parentRangeKm = this.orbitalRadialRangeKm(nestedParent);
    const nestedBodyRangeKm = this.orbitalRadialRangeKm(nested);
    return parentRangeKm && nestedBodyRangeKm
      ? { peri: Math.max(0, parentRangeKm.peri - nestedBodyRangeKm.apo), apo: parentRangeKm.apo + nestedBodyRangeKm.apo }
      : null;
  }

  /**
   * Cheap reject for a nested pair — using only the component orbits' own periapsis/apoapsis via
   * {@link nestedRangeKm}, before paying for {@link buildNestedPair}'s position-function
   * construction (two Kepler evaluators plus, downstream, a dense conjunction scan). Mirrors
   * {@link collisionPartners}'s own radial pre-filter; a `false` here is not a guarantee the pair
   * touches, only that it isn't ruled out yet.
   */
  private nestedPairOutOfReach(nested: CanonnBiostatsBody, nestedParent: CanonnBiostatsBody, other: CanonnBiostatsBody, contactKm: number): boolean {
    const rangeA = this.nestedRangeKm(nested, nestedParent);
    const rangeB = this.orbitalRadialRangeKm(other);
    if (!rangeA || !rangeB) { return false; }
    return Math.max(rangeA.peri, rangeB.peri) - Math.min(rangeA.apo, rangeB.apo) > contactKm;
  }

  /**
   * Builds the `'nested'` half of {@link resolveRingOrbitPair}: `nested` orbits `nestedParent`
   * (a real body, sharing an immediate parent with `other`), so its absolute motion is the exact
   * superposition of the two orbits (see {@link nestedPositionFunction}) — tracked directly
   * rather than approximated by widening the contact threshold with its periapsis/apoapsis reach,
   * which is what an earlier version of this feature did and which review found false-positive
   * prone: it let *any* conjunction of `nestedParent` and `other` count as a hit, regardless of
   * where the nested body actually was at that moment. Callers are expected to have already
   * rejected the pair via {@link nestedPairOutOfReach} where a contact threshold is known.
   */
  private buildNestedPair(nested: SystemBody, nestedParent: SystemBody, other: SystemBody): {
    posA: (tMs: number) => Vec3; posB: (tMs: number) => Vec3;
    fastPeriodDays: number; slowPeriodDays: number;
  } | null {
    const nestedBody = nested.bodyData, parentBody = nestedParent.bodyData, otherBody = other.bodyData;
    if (!nestedBody.orbitalPeriod || !parentBody.orbitalPeriod || !otherBody.orbitalPeriod) { return null; }

    const posA = this.nestedPositionFunction(nestedBody, parentBody);
    const posB = this.positionFunction(otherBody);
    if (!posA || !posB) { return null; }

    const fastPeriodDays = Math.min(nestedBody.orbitalPeriod, parentBody.orbitalPeriod);
    const slowPeriodDays = Math.max(nestedBody.orbitalPeriod, parentBody.orbitalPeriod, otherBody.orbitalPeriod);

    return { posA, posB, fastPeriodDays, slowPeriodDays };
  }

  /**
   * Resolves a ring-collision pair (either or both sides possibly rings) into what
   * {@link nextContacts}/{@link nestedContactWindows}/{@link separationSeries} need to time it —
   * or null when the pair doesn't have a tractable orbital frame to search precisely. Four
   * configurations qualify:
   *  - one orbits the other *directly* (e.g. a moon crossing its own planet's rings): the
   *    non-orbiting side becomes a {@link stationaryOrigin} stand-in for its position, and the
   *    "distance" is simply the orbiter's own orbital radius over time;
   *  - the two share an *immediate* parent (e.g. two ringed planets orbiting the same star, or —
   *    just as validly — two components of a binary orbiting their shared barycentre): both
   *    sides' real orbits are used directly. The parent itself, whatever it is, never becomes one
   *    of the two colliding objects; it's only used to confirm the pair shares one orbital plane;
   *  - one side is *nested* one level under a real body that is itself a sibling of the other side
   *    (e.g. a moon of one binary component reaching into the rings of the *other* component,
   *    both sharing a barycentre): {@link buildNestedPair} tracks the nested side's exact,
   *    superposed absolute motion rather than a single ellipse.
   *
   * Anything needing a shared ancestor two or more levels further up than that (e.g. a moon of
   * one barycentre component reaching toward a *moon* of the other) has no tractable orbital
   * frame to search and is deliberately not resolved, rather than reported as an unconfirmed guess.
   *
   * A pair sharing an immediate parent with *equal* orbital periods (typical of two components of
   * a binary, which by construction complete one loop of their mutual orbit together) is still
   * resolved: unlike {@link collisionPartners}'s Trojan/rosette exclusion for bodies co-orbiting a
   * *third*, real central body, two siblings with the same period here simply repeat their whole
   * relative geometry once per shared period — so that period itself is used as the synodic step.
   *
   * `contactKm` — the pair's contact threshold, known to every caller via {@link ringContactBand}
   * before it needs the resolved pair itself — is used only to reject an out-of-reach *nested*
   * side cheaply (see {@link nestedPairOutOfReach}), before paying for its position-function
   * construction; the simple cases don't need it.
   */
  private resolveRingOrbitPair(self: SystemBody, partner: SystemBody, contactKm: number): RingOrbitPair | null {
    const selfOrbitBody = self.bodyData.type === BODY_TYPE.Ring ? self.parent : self;
    const partnerOrbitBody = partner.bodyData.type === BODY_TYPE.Ring ? partner.parent : partner;
    if (!selfOrbitBody || !partnerOrbitBody || selfOrbitBody === partnerOrbitBody) { return null; }

    if (selfOrbitBody.parent === partnerOrbitBody) {
      const orbiter = selfOrbitBody.bodyData;
      if (!orbiter.orbitalPeriod) { return null; }
      // b's own .name feeds nextContacts' CollisionWindow.partnerName directly — for the
      // stationary-origin stand-in that's otherwise just the ring's *host* name (e.g. "Planet"
      // rather than "Planet A Ring") whenever partner is a ring, so it's named via
      // ringDisplayName here rather than off partnerOrbitBody.bodyData.name directly.
      return { kind: 'simple', a: orbiter, b: this.stationaryOrigin(this.ringDisplayName(partner), orbiter.orbitalPeriod), synodicDays: orbiter.orbitalPeriod };
    }
    if (partnerOrbitBody.parent === selfOrbitBody) {
      const orbiter = partnerOrbitBody.bodyData;
      if (!orbiter.orbitalPeriod) { return null; }
      // Here it's self that plays b's role (partner is the real orbiter, a) — same naming fix.
      return { kind: 'simple', a: orbiter, b: this.stationaryOrigin(this.ringDisplayName(self), orbiter.orbitalPeriod), synodicDays: orbiter.orbitalPeriod };
    }
    if (selfOrbitBody.parent && selfOrbitBody.parent === partnerOrbitBody.parent) {
      const a = selfOrbitBody.bodyData, b = partnerOrbitBody.bodyData;
      if (!a.orbitalPeriod || !b.orbitalPeriod) { return null; }
      const synodicDays = a.orbitalPeriod === b.orbitalPeriod ? a.orbitalPeriod : 1 / Math.abs(1 / a.orbitalPeriod - 1 / b.orbitalPeriod);
      // b is partnerOrbitBody's own data (the ring's *host*, when partner is a ring) — override
      // just its display name, not its physics, to match ringCollisionExtent's convention.
      return { kind: 'simple', a, b: { ...b, name: this.ringDisplayName(partner) }, synodicDays };
    }
    // Nested: self orbits a real body (its own parent) that is itself a sibling of partner. The
    // cheap radial reject runs before buildNestedPair pays for its position-function closures.
    if (selfOrbitBody.parent && selfOrbitBody.parent !== partnerOrbitBody && selfOrbitBody.parent.parent === partnerOrbitBody.parent) {
      if (this.nestedPairOutOfReach(selfOrbitBody.bodyData, selfOrbitBody.parent.bodyData, partnerOrbitBody.bodyData, contactKm)) { return null; }
      const nested = this.buildNestedPair(selfOrbitBody, selfOrbitBody.parent, partnerOrbitBody);
      return nested && { kind: 'nested', ...nested, labelA: self.bodyData.name, labelB: partner.bodyData.name };
    }
    // Symmetric: partner orbits a real body that is itself a sibling of self.
    if (partnerOrbitBody.parent && partnerOrbitBody.parent !== selfOrbitBody && partnerOrbitBody.parent.parent === selfOrbitBody.parent) {
      if (this.nestedPairOutOfReach(partnerOrbitBody.bodyData, partnerOrbitBody.parent.bodyData, selfOrbitBody.bodyData, contactKm)) { return null; }
      const nested = this.buildNestedPair(partnerOrbitBody, partnerOrbitBody.parent, selfOrbitBody);
      return nested && {
        kind: 'nested', posA: nested.posB, posB: nested.posA,
        fastPeriodDays: nested.fastPeriodDays, slowPeriodDays: nested.slowPeriodDays,
        labelA: self.bodyData.name, labelB: partner.bodyData.name,
      };
    }
    return null;
  }

  /**
   * Minimum separation (km) between two bodies that share an identical orbital period — a
   * phase-locked pair (e.g. two components of a binary), whose relative geometry repeats exactly
   * once per period rather than sweeping through every possible relative phase the way a normal
   * (unequal-period) pair eventually does. {@link minOrbitDistanceKm}'s unconstrained two-body
   * search isn't a valid stand-in here: it freely varies each body's phase independently to find
   * the closest the two *orbit curves* could ever come, which can be smaller than what a
   * phase-locked pair — confined to a single, fixed relative phase — actually ever reaches. This
   * instead samples the real, single-degree-of-freedom separation-over-time curve directly
   * (a coarse scan over one shared period, then a few halving refine passes around the minimum).
   */
  private minLockedSeparationKm(a: CanonnBiostatsBody, b: CanonnBiostatsBody, periodDays: number): number {
    const sep = this.separationFunction(a, b);
    if (!sep) { return Infinity; }
    const periodMs = periodDays * MS_PER_DAY;
    const SAMPLES = 360;
    let bestT = 0, bestS = Infinity;
    for (let i = 0; i < SAMPLES; i++) {
      const t = (i / SAMPLES) * periodMs;
      const s = sep(t);
      if (s < bestS) { bestS = s; bestT = t; }
    }
    let half = periodMs / SAMPLES;
    for (let pass = 0; pass < 8; pass++) {
      const lo = bestT - half, hi = bestT + half;
      const step = (hi - lo) / 20;
      for (let t = lo; t <= hi; t += step) {
        const s = sep(t);
        if (s < bestS) { bestS = s; bestT = t; }
      }
      half /= 2;
    }
    return bestS;
  }

  /**
   * The centre-to-centre separation band within which two objects physically overlap, treating
   * each as the radial band it actually occupies: `[innerRadius, outerRadius]` for a ring, or
   * `[0, radius]` for a solid body.
   *
   * Contact is tested along the line joining the two bodies, which is where two rings in
   * *different* planes can meet — a real ring is a flat disc, so it only has material where its
   * plane cuts the other's. Along that line object A occupies `[innerA, outerA]` from A and
   * object B occupies `[D − outerB, D − innerB]`, so they overlap exactly when
   * `innerA + innerB ≤ D ≤ outerA + outerB`.
   *
   * The upper edge is the familiar combined-radii contact threshold. The lower edge is what a
   * sphere-shaped approximation misses: once the bodies are closer than that, one ring has passed
   * *inside* the other's central hole along the connecting line and they are no longer touching —
   * which is why a close ring-on-ring pass registers as two collisions either side of closest
   * approach rather than one continuous one (observed in Musca Dark Region SO-Q b5-5, whose raw
   * ring-edge interval is D ∈ [15,558.5, 15,594.2] km, widened by the 15 km slab thickness here to
   * a true contact band of D ∈ [15,543.5, 15,609.2] km, while their periapsis separation is
   * 15,499.9 km).
   *
   * That `innerA + innerB` lower edge only holds when *both* objects are flat rings confined to
   * the line, though. A solid body isn't confined to any plane — its surface genuinely occupies
   * every direction around its centre, not just the one along the connecting line — so a body of
   * radius `r` can reach a ring's inner edge `i` from the *far* side too, as soon as `D + r ≥ i`,
   * i.e. `D ≥ i − r`, without needing the line-restricted `D ≥ i` at all. So for a body-on-ring
   * pair the lower edge relaxes to `max(0, innerRing − bodyRadius)`. For two solid bodies both
   * inner radii are 0 and both this and the ring-only formula collapse to the plain `D ≤ rA + rB`
   * test used for planetary collisions.
   *
   * (This "far side" relief is deliberately *not* extended to ring-on-ring: two flat rings can
   * only meet where their planes actually cross, and for realistic — much-thinner-than-wide —
   * rings the equivalent far-side band sits at a separation far below anything an orbit reaches,
   * disjoint from the real contact band, not merged with it. Applying it there would silently
   * paper back over the very gap this method exists to find.)
   *
   * Each ring's edges are then relaxed by half of {@link RING_THICKNESS_KM}, since a ring is a
   * slab with real vertical extent rather than a razor-thin annulus, and so has a little reach
   * beyond the radii the dumps report.
   *
   */
  private ringContactBand(a: SystemBody, b: SystemBody): { minKm: number; maxKm: number } {
    const isRing = (n: SystemBody): boolean => n.bodyData.type === BODY_TYPE.Ring;
    const inner = (n: SystemBody): number => isRing(n) ? (n.bodyData.innerRadius ?? 0) : 0;
    const outer = (n: SystemBody): number => isRing(n) ? (n.bodyData.outerRadius ?? 0) : (n.bodyData.radius ?? 0);
    const reach = (n: SystemBody): number => isRing(n) ? RING_THICKNESS_KM / 2 : 0;
    const edgeKm = reach(a) + reach(b);
    const innerA = inner(a);
    const outerA = outer(a);
    const innerB = inner(b);
    const outerB = outer(b);
    const bothConfinedToLine = isRing(a) && isRing(b);
    const rawMinKm = bothConfinedToLine
      ? innerA + innerB
      : Math.max(innerA - outerB, innerB - outerA);
    return {
      minKm: Math.max(0, rawMinKm - edgeKm),
      maxKm: outerA + outerB + edgeKm,
    };
  }

  /**
   * Cheaply proves `ring` can never contact `other`, without paying for a contact-window search:
   * either there's no tractable orbital frame at all ({@link resolveRingOrbitPair} returns null,
   * which already runs {@link nestedPairOutOfReach}'s cheap nested-side reject internally), or —
   * for a `'simple'` pair — the two orbits' periapsis/apoapsis ranges can never come within the
   * contact band regardless of phase. A `false` result only means "not ruled out this way", not
   * that the pair actually touches.
   *
   * Both rejects are one-directional in the same useful way: they only ever compare against
   * {@link ringContactBand}'s `maxKm` (the *largest* separation that could still count as
   * contact), so shrinking `maxKm` — which is exactly what happens when this same test is reused
   * for a *narrower* ring of the same host, see {@link ringCollisionStatusesFor} — can only make
   * the reject easier to trigger, never harder. That's what lets a widest-ring result stand in for
   * every narrower ring sharing its host and orbit.
   */
  private ringPairCheaplyUnreachable(ring: SystemBody, other: SystemBody): boolean {
    const band = this.ringContactBand(ring, other);
    if (!(band.maxKm > 0)) { return true; }
    const pair = this.resolveRingOrbitPair(ring, other, band.maxKm);
    if (!pair) { return true; }
    if (pair.kind !== 'simple') { return false; }
    const rangeA = this.orbitalRadialRange(pair.a);
    const rangeB = this.orbitalRadialRange(pair.b);
    if (!rangeA || !rangeB) { return false; }
    const radialGapAu = Math.max(rangeA.peri, rangeB.peri) - Math.min(rangeA.apo, rangeB.apo);
    return radialGapAu > band.maxKm / KM_PER_AU;
  }

  /**
   * Centre-to-centre distance-over-time samples for a ring-collision pair's distance diagram —
   * the ring-collision analogue of {@link separationSeries}, resolving the pair via
   * {@link resolveRingOrbitPair} first so it also covers a body orbiting directly around the
   * other's ring host, not just two siblings. Returns [] when the pair can't be timed or lacks
   * the phase data needed to place it.
   */
  ringSeparationSeries(self: SystemBody, partner: SystemBody, startMs: number, endMs: number, samples: number): SeparationSample[] {
    const band = this.ringContactBand(self, partner);
    const pair = this.resolveRingOrbitPair(self, partner, band.maxKm);
    if (!pair) { return []; }
    if (pair.kind === 'simple') { return this.separationSeries(pair.a, pair.b, startMs, endMs, samples); }
    return this.sampleSeparation(this.separationFunctionFromPositions(pair.posA, pair.posB), startMs, endMs, samples);
  }

  /**
   * Every contact window for a known ring-collision pair that opens within the next `horizonDays`,
   * in chronological order — uncapped, unlike {@link detectRingCollisionStatus}'s 10-row
   * {@link RingCollisionStatus.upcomingCollisions}. A ring pass can yield two windows per
   * approach (see {@link ringContactBand}), so the diagram — which spans several synodic periods —
   * needs this rather than the capped list to mark every in-view dip, not just the first few.
   * Returns [] when the pair can't be timed (should not happen for a pair `detectRingCollisionStatus`
   * already found) or lacks the phase data to place it.
   */
  ringContactsWithin(self: SystemBody, partner: SystemBody, horizonDays: number, now: number = Date.now()): CollisionWindow[] {
    const band = this.ringContactBand(self, partner);
    if (!(band.maxKm > 0)) { return []; }
    const pair = this.resolveRingOrbitPair(self, partner, band.maxKm);
    if (!pair) { return []; }
    const horizonMs = horizonDays * MS_PER_DAY;
    const windows = pair.kind === 'simple'
      ? this.nextContacts(pair.a, pair.b, band.maxKm, pair.synodicDays, now, MAX_CONJUNCTIONS_SCANNED, horizonMs, band.minKm)
      : this.nestedContactWindows(pair.posA, pair.posB, pair.fastPeriodDays, pair.slowPeriodDays, band.maxKm, band.minKm, now, MAX_CONJUNCTIONS_SCANNED, horizonMs, pair.labelB);
    return windows.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  /**
   * Combines {@link ringSeparationSeries} and {@link ringContactsWithin} for the ring-collision
   * dialog's diagram into one call, so opening it costs one tree walk instead of two: across the
   * worker boundary each of those methods is handed its own rehydrated copy of the whole system
   * tree, so calling both independently (as `Promise.all([ringSeparationSeries(...),
   * ringContactsWithin(...)])` used to) serializes, structured-clones, and rehydrates the entire
   * system twice for what is conceptually one "build this pair's diagram" request.
   */
  ringCollisionDiagram(
    self: SystemBody,
    partner: SystemBody,
    startMs: number,
    endMs: number,
    samples: number,
    horizonDays: number,
    now: number = Date.now(),
  ): { series: SeparationSample[]; contacts: CollisionWindow[] } {
    return {
      series: this.ringSeparationSeries(self, partner, startMs, endMs, samples),
      contacts: this.ringContactsWithin(self, partner, horizonDays, now),
    };
  }

  /**
   * Flags a body or ring as a "ring collision" candidate only once an actual, timed contact
   * window has been found with a ring belonging to a *different* body — either a solid body's
   * orbit passing through another body's ring ("Body on Ring") or two different bodies' rings
   * whose extents overlap in 3D ("Ring on Ring"). There is no untimed "might overlap" state:
   * per the feature request, a candidate is only ever surfaced when a genuine collision is
   * actually detected, using the same 3D orbit-crossing search {@link detectCollisionStatus}
   * runs for planet-planet collisions — just with each ring's outer radius (or a plain body's own
   * radius) as the contact threshold, and only for the two pair configurations
   * {@link resolveRingOrbitPair} can actually time (see its docs for why others, like crossing a
   * shared barycentre several levels up, are skipped rather than guessed at).
   */
  detectRingCollisionStatus(node: SystemBody, now: number = Date.now()): RingCollisionStatus {
    const candidates = this.flattenSystem(this.systemRoot(node));
    const focusIndex = candidates.indexOf(node);
    return focusIndex < 0 ? this.emptyRingCollisionStatus() : this.ringCollisionStatusesFor(candidates, now)[focusIndex];
  }

  /** One ring-collision analysis for the whole system, aligned to {@link flattenSystem}'s order. */
  detectRingCollisionStatuses(node: SystemBody, now: number = Date.now()): RingCollisionStatus[] {
    return this.ringCollisionStatusesFor(this.flattenSystem(this.systemRoot(node)), now);
  }

  private ringCollisionStatusesFor(candidates: SystemBody[], now: number): RingCollisionStatus[] {
    const statuses = candidates.map(() => this.emptyRingCollisionStatus());
    if (!candidates.some(candidate => candidate.bodyData.type === BODY_TYPE.Ring)) { return statuses; }

    // Outer-ring-first pruning: every ring under the same host shares that host's exact orbit —
    // only each ring's own inner/outer radius (and so its contact band) differs — so if the
    // *widest* ring of a multi-ring host is cheaply proven unreachable against some partner (see
    // ringPairCheaplyUnreachable's monotonic-in-maxKm argument), every narrower ring of that same
    // host is unreachable against that same partner too, and the pair can be skipped without
    // paying for its own band/orbit-pair/prefilter work at all. Hosts with only one ring get no
    // entry here, since there's nothing narrower to prune.
    const widestRingOf = new Map<SystemBody, SystemBody>();
    {
      const ringsByHost = new Map<SystemBody, SystemBody[]>();
      for (const candidate of candidates) {
        if (candidate.bodyData.type === BODY_TYPE.Ring && candidate.parent) {
          const rings = ringsByHost.get(candidate.parent);
          if (rings) { rings.push(candidate); } else { ringsByHost.set(candidate.parent, [candidate]); }
        }
      }
      for (const rings of ringsByHost.values()) {
        if (rings.length < 2) { continue; }
        widestRingOf.set(rings[0].parent!, rings.reduce((a, b) => (b.bodyData.outerRadius ?? 0) > (a.bodyData.outerRadius ?? 0) ? b : a));
      }
    }
    const widestUnreachableCache = new Map<SystemBody, Map<SystemBody, boolean>>();
    const isWidestUnreachable = (widest: SystemBody, other: SystemBody): boolean => {
      let againstOther = widestUnreachableCache.get(widest);
      if (!againstOther) { againstOther = new Map(); widestUnreachableCache.set(widest, againstOther); }
      let result = againstOther.get(other);
      if (result === undefined) {
        result = this.ringPairCheaplyUnreachable(widest, other);
        againstOther.set(other, result);
      }
      return result;
    };

    const updateBest = (subjectIndex: number, other: SystemBody, contactKm: number, contactMinKm: number, synodicDays: number, windows: CollisionWindow[]): void => {
      const current = statuses[subjectIndex];
      if (current.nextCollision && current.nextCollision.days <= windows[0].days) { return; }
      const subject = candidates[subjectIndex];
      statuses[subjectIndex] = {
        isCandidate: true,
        self: this.ringCollisionExtent(subject),
        partner: this.ringCollisionExtent(other),
        combinedRadiiKm: contactKm,
        combinedRadiiMinKm: contactMinKm,
        synodicPeriodDays: synodicDays,
        nextCollision: windows[0],
        upcomingCollisions: windows,
      };
    };

    for (let i = 0; i < candidates.length; i++) {
      const nodeA = candidates[i];
      const isRingA = nodeA.bodyData.type === BODY_TYPE.Ring;
      if (nodeA.bodyData.type === BODY_TYPE.Barycentre) { continue; }
      for (let j = i + 1; j < candidates.length; j++) {
        const nodeB = candidates[j];
        const isRingB = nodeB.bodyData.type === BODY_TYPE.Ring;
        if (!isRingA && !isRingB) { continue; }
        if (isRingA && nodeA.parent === nodeB) { continue; }
        if (isRingB && nodeB.parent === nodeA) { continue; }
        if (isRingA && isRingB && nodeA.parent === nodeB.parent) { continue; }
        if (nodeB.bodyData.type === BODY_TYPE.Barycentre) { continue; }

        const widestA = isRingA ? widestRingOf.get(nodeA.parent!) : undefined;
        if (widestA && widestA !== nodeA && isWidestUnreachable(widestA, nodeB)) { continue; }
        const widestB = isRingB ? widestRingOf.get(nodeB.parent!) : undefined;
        if (widestB && widestB !== nodeB && isWidestUnreachable(widestB, nodeA)) { continue; }

        const band = this.ringContactBand(nodeA, nodeB);
        if (!(band.maxKm > 0)) { continue; }

        // resolveRingOrbitPair rejects an out-of-reach nested side itself (see
        // nestedPairOutOfReach) before building its position functions; the 'simple' case still
        // needs its own cheap reject below, ahead of the costlier orbit-curve search.
        const pair = this.resolveRingOrbitPair(nodeA, nodeB, band.maxKm);
        if (!pair) { continue; }

        let windows: CollisionWindow[];
        let synodicDays: number;
        if (pair.kind === 'simple') {
          synodicDays = pair.synodicDays;
          const rangeA = this.orbitalRadialRange(pair.a);
          const rangeB = this.orbitalRadialRange(pair.b);
          if (rangeA && rangeB) {
            const radialGapAu = Math.max(rangeA.peri, rangeB.peri) - Math.min(rangeA.apo, rangeB.apo);
            if (radialGapAu > band.maxKm / KM_PER_AU) { continue; }
          }
          const prefilterKm = pair.a.orbitalPeriod === pair.b.orbitalPeriod
            ? this.minLockedSeparationKm(pair.a, pair.b, pair.synodicDays)
            : this.minOrbitDistanceKm(pair.a, pair.b);
          if (prefilterKm > band.maxKm) { continue; }
          windows = this.nextContacts(pair.a, pair.b, band.maxKm, pair.synodicDays, now, MAX_UPCOMING_CONTACTS, Infinity, band.minKm);
        } else {
          // The dominant recurrence driver — displayed as this pair's "synodic period" even
          // though a nested pair's true recurrence is quasi-periodic (see nestedContactWindows).
          synodicDays = pair.fastPeriodDays;
          windows = this.nestedContactWindows(pair.posA, pair.posB, pair.fastPeriodDays, pair.slowPeriodDays, band.maxKm, band.minKm, now, MAX_UPCOMING_CONTACTS, Infinity, pair.labelB);
        }
        if (windows.length === 0) { continue; }

        updateBest(i, nodeB, band.maxKm, band.minKm, synodicDays, windows);
        updateBest(j, nodeA, band.maxKm, band.minKm, synodicDays, windows);
      }
    }

    return statuses;
  }

  private emptyRingCollisionStatus(): RingCollisionStatus {
    return {
      isCandidate: false,
      self: null,
      partner: null,
      combinedRadiiKm: null,
      combinedRadiiMinKm: null,
      synodicPeriodDays: null,
      nextCollision: null,
      upcomingCollisions: [],
    };
  }

  /**
   * A ring's own `bodyData.name` is stripped down to its bare identifier at parse time (e.g.
   * "A Ring", not "<host> A Ring" — see `HomeComponent.stripParentName`), unlike a body's, which
   * keeps its full system-prefixed name. Bare, that's ambiguous once two different bodies' rings
   * are shown side by side (a "Ring on Ring" collision), so a ring is displayed under its host's
   * name instead, matching a body's own naming convention exactly (and so working the same way
   * with {@link RingCollisionDialogComponent.shortName}'s system-prefix stripping).
   */
  private ringDisplayName(node: SystemBody): string {
    return node.bodyData.type === BODY_TYPE.Ring && node.parent
      ? `${node.parent.bodyData.name} ${node.bodyData.name}`
      : node.bodyData.name;
  }

  private ringCollisionExtent(node: SystemBody): RingCollisionExtent {
    const isRing = node.bodyData.type === BODY_TYPE.Ring;
    return {
      name: this.ringDisplayName(node),
      kind: isRing ? 'ring' : 'body',
      path: bodyPathFromRoot(node),
    };
  }
}
