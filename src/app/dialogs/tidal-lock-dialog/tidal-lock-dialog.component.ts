import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DecimalPipe } from '@angular/common';
import { SystemBody } from '../../home/home.component';
import { BODY_TYPE } from '../../data/body-types';
import { DialogShellComponent } from '../dialog-shell/dialog-shell.component';

/** Data passed to the tidal-lock dialog when it is opened. */
export interface TidalLockDialogData {
  body: SystemBody;
  /** Spin–orbit resonance string (e.g. '1:1', '3:2', 'none') computed by the caller. */
  resonance: string;
}

/**
 * Day/night illumination geometry for a body that keeps a fixed face toward the
 * light-source star (a true 1:1 tidal lock to the star directly, or to a
 * star-barycentre indirectly).
 *
 * Such a body has a permanent day hemisphere and a permanent night hemisphere. Its
 * axial tilt makes the sub-stellar point's LATITUDE nod by ±(effective obliquity) over
 * each orbit, so the terminator sweeps a band of the surface. Because the body does NOT
 * rotate relative to the star, the region that actually cycles between day and night is
 * NOT two polar caps — it is **two lunes centred on the dawn/dusk meridians**: pinched
 * to points at the dawn/dusk equator, widest (full ±obliquity) at the poles. The
 * fraction of the whole surface inside those lunes is exactly:
 *
 *     cycling fraction = 2·θ_rad / π  =  θ_deg / 90        (θ = swing amplitude)
 *
 * which is linear in θ (a thin terminator band), not the quadratic (1 − cos θ) a polar
 * cap would give.
 *
 * The swing amplitude θ equals the obliquity to the orbital plane, which is not known
 * exactly: the data gives axial tilt against a reference plane and the orbit's
 * inclination separately, with unknown node alignment. The obliquity therefore lies
 * between |tilt − inclination| and tilt + inclination (folded into [0,180]; a 180° tilt
 * nods no more than a 0° one), so the cycling area has a lower and an upper limit.
 */
export interface TidalCycling {
  /** True when the lock is to a star-barycentre (circumbinary); false for a direct star parent. */
  indirect: boolean;
  /** Axial tilt magnitude (degrees). */
  axialTiltDeg: number;
  /** Orbital inclination (degrees). */
  inclinationDeg: number;
  /** Orbital eccentricity used (clamped, absolute). */
  eccentricity: number;
  /** Sub-stellar latitude swing amplitude (= effective obliquity), degrees: lower/upper limit. */
  swingMinDeg: number;
  swingMaxDeg: number;
  /** Fraction (0–1) of the whole surface that cycles day↔night (= swing/90): lower/upper limit. */
  cyclingFractionMin: number;
  cyclingFractionMax: number;
  /** Area (km²) of the cycling region, or null when radius is unknown: lower/upper limit. */
  cyclingAreaMinKm2: number | null;
  cyclingAreaMaxKm2: number | null;
  /** True when any surface cycles at all (effective obliquity > 0). */
  hasCycling: boolean;
  /** True when the lower and upper limits differ (an inclination/tilt range exists). */
  hasRange: boolean;
}

@Component({
  selector: 'app-tidal-lock-dialog',
  templateUrl: './tidal-lock-dialog.component.html',
  styleUrls: ['./tidal-lock-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogShellComponent, DecimalPipe]
})
export class TidalLockDialogComponent {
  private readonly data = inject<TidalLockDialogData>(MAT_DIALOG_DATA);

  public readonly resonance = this.data.resonance;
  public readonly rotationalPeriod = this.data.body.bodyData.rotationalPeriod;
  public readonly orbitalPeriod = this.data.body.bodyData.orbitalPeriod;
  public readonly tidallyLocked = !!this.data.body.bodyData.rotationalPeriodTidallyLocked;

  /** |rotational − orbital| period, or null when either is missing. */
  public readonly difference = this.rotationalPeriod && this.orbitalPeriod
    ? Math.abs(this.rotationalPeriod - this.orbitalPeriod)
    : null;

  /**
   * Day/night cycling geometry. Only present for bodies that keep a fixed face toward
   * the star (direct or indirect star-lock); null otherwise.
   */
  public readonly tidalCycling = this.computeTidalCycling();

  /** Geometry for the pseudo-3D globe diagram, or null when there is no model. */
  public readonly cyclingDiagram = this.buildCyclingDiagram();

  /** Static schematic comparing 1:1 synchronous rotation against a 3:2 resonance. */
  public readonly scenarioDiagram = buildScenarioDiagram();

  /** Animated diagram tuned to THIS body's actual rotation-vs-orbit ratio. */
  public readonly bodyDiagram = this.buildBodyDiagram();

  /**
   * Format a low–high pair for display. Collapses to a single value when both ends
   * round to the same string at `digits` decimals — prefixed with `~` when the
   * underlying values still differ (a tiny range hidden by rounding), and with no
   * prefix when they are exactly equal. Otherwise renders `lo–hi`.
   */
  public fmtRange(lo: number, hi: number, digits: number): string {
    const fmt = (n: number) => n.toLocaleString('en-US', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    const a = fmt(lo);
    const b = fmt(hi);
    if (a === b) return (Math.abs(hi - lo) > 1e-9 ? '~' : '') + a;
    return `${a}–${b}`;
  }

  /**
   * Whether the rotation is synchronous with the orbit (rotation period ≈ orbital
   * period) — i.e. the body keeps the same face toward its immediate parent. This is
   * the real 1:1 condition, independent of the tidal-lock indicator (which can be set on a
   * body that still spins many times per orbit, e.g. Eden).
   */
  private isSynchronousWithParent(): boolean {
    const rot = this.rotationalPeriod;
    const orb = this.orbitalPeriod;
    if (!rot || !orb) return false;
    return Math.abs(Math.abs(rot) - Math.abs(orb)) <= 0.05 * Math.abs(orb);
  }

  /**
   * Whether the body keeps a fixed face toward the system's light-source star, giving a
   * permanent day/night side. Requires BOTH:
   *  1. A genuine 1:1 lock (rotation ≈ orbit) — not merely the tidal-lock indicator.
   *  2. The thing it is locked to is the star itself (direct) OR a star-barycentre it
   *     orbits from outside, such as a circumbinary pair (indirect). In both cases the
   *     light sits at the centre the body faces. A body locked to a planet/gas giant —
   *     or to a planetary barycentre — faces something other than the light, so its
   *     whole surface cycles instead and it does not qualify.
   */
  private keepsFaceToStar(): boolean {
    if (!this.isSynchronousWithParent()) return false;
    const parent = this.data.body.parent;
    if (!parent) return false;
    const type = parent.bodyData.type;
    if (type === BODY_TYPE.Star) return true;
    return type === BODY_TYPE.Barycentre && subtreeHasStar(parent);
  }

  /** True when the fixed-face lock is to a star-barycentre rather than a star directly. */
  private isIndirectStarLock(): boolean {
    return this.data.body.parent?.bodyData.type === BODY_TYPE.Barycentre;
  }

  /**
   * For a body that keeps a fixed face to the star, work out how much of the surface
   * cycles day↔night because of axial tilt. See {@link TidalCycling} for the geometry.
   * Returns null when the body does not keep a fixed face to the star.
   */
  private computeTidalCycling(): TidalCycling | null {
    if (!this.keepsFaceToStar()) return null;
    const bd = this.data.body.bodyData;

    const toDeg = 180 / Math.PI;
    const axialTiltDeg = Math.abs(bd.axialTilt ?? 0) * toDeg; // axialTilt is radians
    const inclinationDeg = Math.abs(bd.orbitalInclination ?? 0); // inclination is degrees
    const eccentricity = Math.min(Math.abs(bd.orbitalEccentricity ?? 0), 0.95);

    // The obliquity to the orbital plane is bounded by the node alignment we do not
    // have: it lies between |tilt − inclination| and tilt + inclination (folded back
    // into [0,180] — the angle between two axes cannot exceed 180°).
    const obliquityMinDeg = Math.abs(axialTiltDeg - inclinationDeg);
    let obliquityMaxDeg = axialTiltDeg + inclinationDeg;
    if (obliquityMaxDeg > 180) obliquityMaxDeg = 360 - obliquityMaxDeg;

    // The sub-stellar latitude swing equals the obliquity, folded for retrograde tilts.
    const ampA = tiltAmplitudeDeg(obliquityMinDeg);
    const ampB = tiltAmplitudeDeg(obliquityMaxDeg);
    let swingMinDeg = Math.min(ampA, ampB);
    let swingMaxDeg = Math.max(ampA, ampB);
    // If the obliquity range straddles 90° the swing can reach a full 90° (whole surface).
    if (obliquityMinDeg <= 90 && obliquityMaxDeg >= 90) swingMaxDeg = 90;

    // Cycling region = two lunes of the terminator-swept band; its fraction of the whole
    // surface is 2·θ_rad/π = θ_deg/90 (clamped at 1 when the swing reaches 90°).
    const cyclingFractionMin = Math.min(swingMinDeg / 90, 1);
    const cyclingFractionMax = Math.min(swingMaxDeg / 90, 1);

    const radiusKm = bd.radius ?? null;
    const surfaceKm2 = radiusKm ? 4 * Math.PI * radiusKm * radiusKm : null;

    return {
      indirect: this.isIndirectStarLock(),
      axialTiltDeg,
      inclinationDeg,
      eccentricity,
      swingMinDeg,
      swingMaxDeg,
      cyclingFractionMin,
      cyclingFractionMax,
      cyclingAreaMinKm2: surfaceKm2 !== null ? surfaceKm2 * cyclingFractionMin : null,
      cyclingAreaMaxKm2: surfaceKm2 !== null ? surfaceKm2 * cyclingFractionMax : null,
      hasCycling: swingMaxDeg > 1e-6,
      hasRange: swingMaxDeg - swingMinDeg > 1e-6,
    };
  }

  /**
   * Lay out the pseudo-3D globe diagram: a side-on sphere (wireframe graticule + light
   * shading from the left) with the day↔night-cycling region drawn on it. Viewed along
   * the dawn–dusk axis, that region projects to a top leaf and a bottom leaf — pinched
   * at the equator, bulging to the limbs near latitude (90°−θ), tapering at the poles —
   * which is the dawn/dusk lune seen edge-on. The guaranteed (smaller swing) and
   * possible (larger swing) extents are drawn as nested leaves. Returns null when there
   * is no cycling model.
   */
  private buildCyclingDiagram(): CyclingDiagram | null {
    const cyc = this.tidalCycling;
    if (!cyc) return null;

    const cx = 100;
    const cy = 84;
    const r = 64;

    // The globe rocks ±this angle, matching the body's real obliquity swing (no floor —
    // a 1° tilt nods 1°). Only a high safety cap keeps an extreme obliquity from rocking
    // the disk so far it looks like it is tumbling.
    const tiltDeg = cyc.hasCycling ? Math.min(45, cyc.swingMaxDeg) : 0;

    // Graticule: latitude chords (flat, side-on) and meridian half-widths for the
    // longitude ellipses that give the sphere its 3D wireframe look.
    const latitudes = [-60, -30, 0, 30, 60].map(lat => {
      const rad = lat * Math.PI / 180;
      return { y: cy - r * Math.sin(rad), half: r * Math.cos(rad) };
    });
    const meridianRx = [r, r * 0.5];

    // Star glyph in the left margin (the light source): a disc with rays radiating
    // outward, sitting clear of the globe's left limb (cx − r) and the viewBox edge.
    const sunCx = 18;
    const sunR = 8;
    const rayInner = sunR + 2.5;
    const rayOuter = sunR + 6;
    const rays = Array.from({ length: 8 }, (_, i) => {
      const a = i * Math.PI / 4;
      return {
        x1: sunCx + rayInner * Math.cos(a),
        y1: cy + rayInner * Math.sin(a),
        x2: sunCx + rayOuter * Math.cos(a),
        y2: cy + rayOuter * Math.sin(a),
      };
    });

    return {
      cx, cy, r, tiltDeg,
      latitudes,
      meridianRx,
      sun: { cx: sunCx, cy, r: sunR, rays },
      leafMinPath: cyc.hasCycling ? cyclingLeafPath(cx, cy, r, cyc.swingMinDeg) : '',
      leafMaxPath: cyc.hasCycling ? cyclingLeafPath(cx, cy, r, cyc.swingMaxDeg) : '',
      hasCycling: cyc.hasCycling,
      hasRange: cyc.hasRange,
    };
  }

  /**
   * Lay out an animated spin–orbit diagram for this specific body, using its real
   * rotation and orbital periods. The body revolves once per orbit (the arm), which
   * already carries one rotation; an inner spin adds the remaining
   * `spinsPerOrbit − 1` turns so the marker moves exactly as the body's own
   * rotation rate dictates. A 1:1 lock (spinsPerOrbit ≈ 1) needs no inner spin and
   * keeps the same face toward its parent.
   */
  private buildBodyDiagram(): BodyDiagram | null {
    const rot = this.rotationalPeriod;
    const orb = this.orbitalPeriod;
    if (!rot || !orb) return null;

    // Magnitude ratio: how many times the body spins per orbit (schematic, prograde).
    const spinsPerOrbit = Math.abs(orb) / Math.abs(rot);
    const innerSpins = spinsPerOrbit - 1;
    const locked = Math.abs(innerSpins) < 0.02;

    const orbitSec = 9;
    // Inner-spin duration scales the extra turns onto the orbit; clamp the fastest
    // visible spin so a rapid rotator animates briskly rather than as a seizure-blur.
    let spinSec = locked ? 0 : orbitSec / Math.abs(innerSpins);
    const clamped = !locked && spinSec < 1.4;
    if (clamped) spinSec = 1.4;

    const parentX = 100;
    const parentY = 90;
    const orbitR = 58;
    const bodyR = 13;
    const moonX = parentX + orbitR;
    const moonY = parentY;
    return {
      parentX, parentY, orbitR, bodyR, parentR: 15,
      moonX, moonY,
      markerX: moonX - bodyR,
      markerY: moonY,
      spinsPerOrbit,
      locked,
      spinSec,
      spinReverse: innerSpins < 0,
      clamped
    };
  }
}

/** Whether any descendant of a node is a star (used to spot a star-barycentre). */
function subtreeHasStar(node: SystemBody): boolean {
  for (const child of node.subBodies) {
    if (child.bodyData.type === BODY_TYPE.Star) return true;
    if (child.bodyData.type === BODY_TYPE.Barycentre && subtreeHasStar(child)) return true;
  }
  return false;
}

/**
 * Sub-stellar latitude swing amplitude (degrees) for an obliquity in [0,180].
 * Equals the obliquity up to 90°, then falls back toward 0 for retrograde axes (a
 * 180° tilt nods no more than a 0° tilt).
 */
function tiltAmplitudeDeg(obliquityDeg: number): number {
  return 90 - Math.abs(90 - obliquityDeg);
}

/**
 * Build the SVG path for the day↔night-cycling region in the side-on globe view, for a
 * sub-stellar swing amplitude `thetaDeg`. The region is a top leaf and a bottom leaf,
 * each running from the equator (disk centre) to a pole. At latitude φ the leaf reaches
 * out to x-offset = min(r·sinφ·tanθ, r·cosφ): the dawn/dusk lune below latitude 90°−θ,
 * then hugging the limb (the polar part where the whole latitude ring cycles).
 */
function cyclingLeafPath(cx: number, cy: number, r: number, thetaDeg: number): string {
  const theta = Math.min(thetaDeg, 89.5) * Math.PI / 180;
  const tan = Math.tan(theta);
  const steps = 18;

  const offset = (phi: number) => Math.min(r * Math.sin(phi) * tan, r * Math.cos(phi));

  // One leaf from the equator (centre) up to a pole and back: out along the left edge,
  // down along the right edge. `dir` = +1 for the top leaf, −1 for the bottom leaf.
  const leaf = (dir: number) => {
    const up: string[] = [`M ${cx.toFixed(2)} ${cy.toFixed(2)}`];
    const down: string[] = [];
    for (let i = 1; i <= steps; i++) {
      const phi = (i / steps) * (Math.PI / 2);
      const off = offset(phi);
      const y = cy - dir * r * Math.sin(phi);
      up.push(`L ${(cx - off).toFixed(2)} ${y.toFixed(2)}`);
      down.unshift(`L ${(cx + off).toFixed(2)} ${y.toFixed(2)}`);
    }
    return up.join(' ') + ' ' + down.join(' ') + ' Z';
  };

  return leaf(1) + ' ' + leaf(-1);
}

/** Layout for the pseudo-3D globe diagram (all values in SVG user units). */
interface CyclingDiagram {
  cx: number;
  cy: number;
  r: number;
  /** Illustrative globe tilt (degrees); the animation rocks the globe ±this angle. */
  tiltDeg: number;
  /** Latitude graticule chords (flat side-on lines). */
  latitudes: { y: number; half: number }[];
  /** Half-widths of the meridian (longitude) ellipses that give the 3D look. */
  meridianRx: number[];
  /** Star glyph: a disc with radiating rays, in the left margin (the light source). */
  sun: {
    cx: number;
    cy: number;
    r: number;
    rays: { x1: number; y1: number; x2: number; y2: number }[];
  };
  /** Path for the guaranteed (smaller-swing) cycling leaves; '' when none. */
  leafMinPath: string;
  /** Path for the possible (larger-swing) cycling leaves; '' when none. */
  leafMaxPath: string;
  hasCycling: boolean;
  /** True when guaranteed and possible extents differ (draw both leaves). */
  hasRange: boolean;
}

/** Animated spin–orbit layout for the specific body being viewed. */
interface BodyDiagram {
  parentX: number;
  parentY: number;
  orbitR: number;
  bodyR: number;
  parentR: number;
  moonX: number;
  moonY: number;
  markerX: number;
  markerY: number;
  /** Rotations per orbit (magnitude). ~1 for a 1:1 lock. */
  spinsPerOrbit: number;
  /** True when effectively synchronous (same face toward the parent). */
  locked: boolean;
  /** Inner-spin animation duration in seconds (0 when locked). */
  spinSec: number;
  /** True when the body rotates slower than it orbits (inner spin runs in reverse). */
  spinReverse: boolean;
  /** True when the spin was clamped to a maximum visible speed. */
  clamped: boolean;
}

/**
 * One panel of the spin–orbit schematic: a parent at the centre with a single
 * moon parked at its orbit start (the template animates it around). The marker
 * tracks one fixed surface feature, drawn on the parent-facing edge.
 */
interface ScenarioPanel {
  parentX: number;
  parentY: number;
  orbitR: number;
  /** Moon centre at orbit start (rightmost point). */
  moonX: number;
  moonY: number;
  /** Marker point on the parent-facing edge of the moon. */
  markerX: number;
  markerY: number;
}

interface ScenarioDiagram {
  bodyR: number;
  parentR: number;
  synchronous: ScenarioPanel;
  resonance: ScenarioPanel;
}

/**
 * Build the spin–orbit schematic geometry. Each panel holds a parent and a single
 * moon at its orbit start; the template animates the orbit (and, for the 3:2 panel,
 * an extra ½-turn-per-orbit spin) so one diagram shows the motion instead of four
 * frozen stations.
 */
function buildScenarioDiagram(): ScenarioDiagram {
  const orbitR = 58;
  const bodyR = 12;

  const panel = (parentX: number, parentY: number): ScenarioPanel => {
    const moonX = parentX + orbitR;
    const moonY = parentY;
    return {
      parentX,
      parentY,
      orbitR,
      moonX,
      moonY,
      // Marker on the edge facing the parent (which sits to the moon's left here).
      markerX: moonX - bodyR,
      markerY: moonY
    };
  };

  return {
    bodyR,
    parentR: 15,
    synchronous: panel(86, 92),
    resonance: panel(250, 92)
  };
}
