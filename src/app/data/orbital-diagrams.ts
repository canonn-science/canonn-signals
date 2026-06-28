/**
 * Pure geometry helpers that turn a single orientation angle into SVG-ready
 * primitives for the small orbital / rotational diagrams shown in the body
 * detail modal. Deliberately framework-free so they stay trivially unit-testable.
 *
 * All diagrams share one square coordinate space (VIEW_BOX_SIZE) centred at
 * CENTER. SVG's y-axis points downward, so screen "up" is -y. Angles below are
 * the usual maths convention (anticlockwise from the +x axis); converting to
 * screen space therefore negates the y component (sin), and an anticlockwise
 * on-screen rotation maps to a NEGATIVE SVG `rotate()` (which turns clockwise).
 */

export const VIEW_BOX_SIZE = 120;
const CENTER = VIEW_BOX_SIZE / 2; // 60

export interface Point { x: number; y: number; }
export interface Line { x1: number; y1: number; x2: number; y2: number; }
export interface EllipseShape { cx: number; cy: number; rx: number; ry: number; rotation: number; }

export interface AxialTiltDiagram {
  center: Point;
  planetRadius: number;
  axis: Line;          // rotation axis, tilted `tiltDeg` from the vertical
  normal: Line;        // vertical reference (the orbital-plane normal)
  equator: EllipseShape;
  orbitalPlane: Line;  // horizontal reference plane
  arc: string;         // SVG path for the angle arc between normal and axis
}

export interface InclinationDiagram {
  center: Point;
  parentRadius: number;
  referencePlane: EllipseShape; // horizontal reference plane, edge-on
  orbitPlane: EllipseShape;     // orbital plane, tilted by `inclDeg`
  referenceLine: Line;
  orbitLine: Line;
  bodyPoint: Point;             // the orbiting body, sitting on the orbital plane
  parentLabel: Point;           // anchor for the central body's name
  bodyLabel: Point;             // anchor for the orbiting body's name
  arc: string;
}

export interface PeriapsisDiagram {
  focus: Point;            // parent body, sits at a focus of the ellipse
  focusRadius: number;
  ellipse: EllipseShape;   // the orbit — an ellipse, never a circle
  referenceLine: Line;     // ascending-node / reference direction
  periapsisPoint: Point;   // where the body is (its closest approach)
  parentLabel: Point;      // anchor for the central body's name
  bodyLabel: Point;        // anchor for the orbiting body's name
  arc: string;
}

/** One Lagrange point's marker position and the anchor for its "Lx" label. */
export interface LagrangeMarker {
  id: 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
  point: Point;  // where the marker (and any occupying body) is drawn
  label: Point;  // anchor for the "Lx" caption, nudged clear of the marker
}

export interface LagrangeDiagram {
  center: Point;         // the primary, at the centre of the orbit
  primaryRadius: number;
  primaryLabel: Point;   // anchor for the primary's caption
  orbitRadius: number;   // radius of the (circular) reference orbit
  secondary: Point;      // the secondary body, on the orbit at angle 0 (to the right)
  secondaryLabel: Point; // anchor for the secondary's caption
  markers: LagrangeMarker[];
}

const DEG = Math.PI / 180;

/** Round to 3 decimals so bound SVG attributes stay tidy and tests stay stable.
 *  The `+ 0` normalises -0 to 0 so rotations read cleanly. */
function r(n: number): number {
  return Math.round(n * 1000) / 1000 + 0;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** A point at `angleDeg` (anticlockwise from +x, maths convention) in screen space. */
function pointAt(cx: number, cy: number, radius: number, angleDeg: number): Point {
  const a = angleDeg * DEG;
  return { x: cx + radius * Math.cos(a), y: cy - radius * Math.sin(a) };
}

/**
 * A point on the rim of an ellipse at parameter `paramDeg`, after applying the
 * ellipse's own SVG `rotate(rotationDeg)`. Mirrors how the `<ellipse>` is rendered
 * so derived markers land exactly on the drawn curve.
 */
function ellipseRimPoint(e: EllipseShape, paramDeg: number): Point {
  const p = paramDeg * DEG;
  const lx = e.rx * Math.cos(p);
  const ly = e.ry * Math.sin(p);
  const a = e.rotation * DEG; // SVG rotate(): (x,y) -> (x·cos − y·sin, x·sin + y·cos)
  return {
    x: e.cx + lx * Math.cos(a) - ly * Math.sin(a),
    y: e.cy + lx * Math.sin(a) + ly * Math.cos(a),
  };
}

/**
 * An arc path sampled as a polyline between two maths-convention angles. Sampling
 * sidesteps SVG arc large-arc/sweep-flag ambiguity and renders identically.
 */
export function arcPath(cx: number, cy: number, radius: number, a0Deg: number, a1Deg: number, steps = 24): string {
  const pts: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0Deg + (a1Deg - a0Deg) * (i / steps);
    pts.push(pointAt(cx, cy, radius, a));
  }
  return 'M ' + pts.map((p) => `${r(p.x)} ${r(p.y)}`).join(' L ');
}

/**
 * Picks label anchors for the central body and the orbiting body so their names sit
 * on opposite halves and don't overlap near the centre: when the body is in the lower
 * half its name goes below and the central name goes up top, and vice versa.
 */
function labelAnchors(center: Point, bodyPoint: Point): { parentLabel: Point; bodyLabel: Point } {
  const bodyBelow = bodyPoint.y > center.y;
  return {
    parentLabel: { x: center.x, y: r(bodyBelow ? center.y - 22 : center.y + 26) },
    bodyLabel: { x: bodyPoint.x, y: r(bodyBelow ? bodyPoint.y + 12 : bodyPoint.y - 8) },
  };
}

/**
 * Axial tilt: a planet whose spin axis leans `tiltDeg` away from the orbital-plane
 * normal (the vertical), with the equator drawn edge-on as an ellipse.
 */
export function axialTiltDiagram(tiltDeg: number): AxialTiltDiagram {
  const tilt = Number.isFinite(tiltDeg) ? tiltDeg : 0;
  const center = { x: CENTER, y: CENTER };
  const planetRadius = 22;
  const axisLen = 42;

  // Screen "up" rotated by `tilt` toward +x: (sin t, -cos t).
  const t = tilt * DEG;
  const dir = { x: Math.sin(t), y: -Math.cos(t) };

  const axis: Line = {
    x1: r(center.x - dir.x * axisLen), y1: r(center.y - dir.y * axisLen),
    x2: r(center.x + dir.x * axisLen), y2: r(center.y + dir.y * axisLen),
  };
  const normal: Line = { x1: center.x, y1: r(center.y + axisLen), x2: center.x, y2: r(center.y - axisLen) };

  // Equator is perpendicular to the axis, so its (edge-on) ellipse tilts with it.
  const equator: EllipseShape = { cx: center.x, cy: center.y, rx: planetRadius, ry: r(planetRadius * 0.32), rotation: r(tilt) };

  const orbitalPlane: Line = { x1: 8, y1: center.y, x2: VIEW_BOX_SIZE - 8, y2: center.y };

  // Arc from the vertical (90°) toward the axis (90° - tilt).
  const arc = arcPath(center.x, center.y, 15, 90, 90 - tilt);

  return { center, planetRadius, axis, normal, equator, orbitalPlane, arc };
}

/**
 * Orbital inclination: the orbital plane (edge-on ellipse) tilted by `inclDeg`
 * relative to a horizontal reference plane, with the parent body at the centre.
 *
 * `orbitAngleDeg` (the body's argument of latitude — argument of periapsis + true
 * anomaly) places the orbiting body exactly where it is along its orbit. When it is
 * omitted the body defaults to the major-axis end (angle 0).
 */
export function inclinationDiagram(inclDeg: number, orbitAngleDeg?: number): InclinationDiagram {
  const incl = Number.isFinite(inclDeg) ? inclDeg : 0;
  const center = { x: CENTER, y: CENTER };
  const rx = 46;
  const ry = 12;

  const referencePlane: EllipseShape = { cx: center.x, cy: center.y, rx, ry, rotation: 0 };
  // Anticlockwise on-screen tilt => negative SVG rotation.
  const orbitPlane: EllipseShape = { cx: center.x, cy: center.y, rx, ry, rotation: r(-incl) };

  const referenceLine: Line = { x1: center.x - rx, y1: center.y, x2: center.x + rx, y2: center.y };

  const i = incl * DEG;
  const orbitLine: Line = {
    x1: r(center.x - rx * Math.cos(i)), y1: r(center.y + rx * Math.sin(i)),
    x2: r(center.x + rx * Math.cos(i)), y2: r(center.y - rx * Math.sin(i)),
  };

  // The orbiting body sits on the orbital-plane rim at its actual orbital angle.
  const angle = Number.isFinite(orbitAngleDeg as number) ? (orbitAngleDeg as number) : 0;
  const rim = ellipseRimPoint(orbitPlane, angle);
  const bodyPoint: Point = { x: r(rim.x), y: r(rim.y) };

  // Keep the two names from colliding near the centre: push the central body's name
  // to the half opposite the orbiting body, and the body's name to its own half.
  const { parentLabel, bodyLabel } = labelAnchors(center, bodyPoint);

  const arc = arcPath(center.x, center.y, 26, 0, incl);

  return { center, parentRadius: 5, referencePlane, orbitPlane, referenceLine, orbitLine, bodyPoint, parentLabel, bodyLabel, arc };
}

/**
 * Argument of periapsis: an elliptical orbit with the parent body at a focus and
 * the periapsis (closest point) at `argDeg` from the reference direction. The
 * ellipse shape follows the body's eccentricity (clamped so it stays drawable).
 */
export function periapsisDiagram(argDeg: number, eccentricity?: number): PeriapsisDiagram {
  const arg = Number.isFinite(argDeg) ? argDeg : 0;
  // The diagram's job is to show the periapsis *direction*, so it always reads as a
  // clear ellipse (per the design): a 0.45 floor keeps near-circular orbits visibly
  // elliptical, and a 0.85 cap keeps the apoapsis inside the view box.
  const e = clamp(Number.isFinite(eccentricity as number) ? (eccentricity as number) : 0.5, 0.45, 0.85);

  const maxApo = 46;            // apoapsis distance from the focus
  const a = maxApo / (1 + e);   // semi-major axis
  const b = a * Math.sqrt(1 - e * e);
  const c = a * e;              // focus offset from the ellipse centre

  const focus = { x: CENTER, y: CENTER };
  const phi = arg * DEG;
  const u = { x: Math.cos(phi), y: -Math.sin(phi) }; // periapsis direction (screen)

  // The focus sits offset from the ellipse centre toward the periapsis side.
  const ellipse: EllipseShape = {
    cx: r(focus.x - c * u.x), cy: r(focus.y - c * u.y), rx: r(a), ry: r(b), rotation: r(-arg),
  };

  const rp = a * (1 - e);
  const periapsisPoint: Point = { x: r(focus.x + rp * u.x), y: r(focus.y + rp * u.y) };

  const referenceLine: Line = { x1: focus.x, y1: focus.y, x2: focus.x + maxApo, y2: focus.y };

  const { parentLabel, bodyLabel } = labelAnchors(focus, periapsisPoint);

  const arc = arcPath(focus.x, focus.y, 16, 0, arg);

  return { focus, focusRadius: 4, ellipse, referenceLine, periapsisPoint, parentLabel, bodyLabel, arc };
}

/** Round a point's coordinates for tidy, test-stable SVG attributes. */
function roundPoint(p: Point): Point {
  return { x: r(p.x), y: r(p.y) };
}

/**
 * The canonical five-point Lagrange schematic of a two-body system: a primary at the
 * centre, a secondary on a circular reference orbit to the right (angle 0), and the five
 * Lagrange points in their textbook positions — L1 between the bodies, L2 just beyond the
 * secondary, L3 opposite, and L4 / L5 leading / trailing by 60°.
 *
 * The layout is fixed (it illustrates the configuration, not any one body's live angles);
 * callers drop actual bodies onto the secondary slot and the L-points, or leave them as
 * placeholders. Screen "up" is -y, so L4 (leading, +60°) sits above the axis and L5 below.
 */
export function lagrangeDiagram(): LagrangeDiagram {
  const center = { x: CENTER, y: CENTER };
  const orbitRadius = 34;

  const secondary = pointAt(center.x, center.y, orbitRadius, 0);
  const l1: Point = { x: center.x + orbitRadius - 12, y: center.y };
  const l2: Point = { x: center.x + orbitRadius + 11, y: center.y };

  const markers: LagrangeMarker[] = [
    { id: 'L1', point: roundPoint(l1), label: { x: r(l1.x), y: r(center.y - 9) } },
    { id: 'L2', point: roundPoint(l2), label: { x: r(l2.x), y: r(center.y - 9) } },
    { id: 'L3', point: roundPoint(pointAt(center.x, center.y, orbitRadius, 180)), label: { x: r(center.x - orbitRadius), y: r(center.y - 9) } },
    { id: 'L4', point: roundPoint(pointAt(center.x, center.y, orbitRadius, 60)), label: roundPoint(pointAt(center.x, center.y, orbitRadius + 13, 60)) },
    { id: 'L5', point: roundPoint(pointAt(center.x, center.y, orbitRadius, -60)), label: roundPoint(pointAt(center.x, center.y, orbitRadius + 13, -60)) },
  ];

  return {
    center,
    primaryRadius: 7,
    // Primary caption sits well below the centre and the secondary's just below its marker, so
    // the two names land on separate bands and never overlap even when both are long.
    primaryLabel: { x: center.x, y: r(center.y + 18) },
    orbitRadius,
    secondary: roundPoint(secondary),
    secondaryLabel: { x: r(secondary.x), y: r(center.y + 11) },
    markers,
  };
}
