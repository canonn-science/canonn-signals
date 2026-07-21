/**
 * Pure geometry for the to-scale body-and-rings illustration shown in the Taylor/Pauper
 * ring badge dialogs. Deliberately framework-free so it stays trivially unit-testable —
 * see `orbital-diagrams.ts` for the sibling convention this follows.
 *
 * Unlike the Roche/Hill charts (which span many orders of magnitude and need a log scale),
 * a body and its own visible rings never differ by more than ~16x (the Pauper badge's outer
 * bound), so a plain linear scale is used: it's simpler, and for these two badges specifically
 * the linear "tiny body inside a wide empty ring" / "ring hugging the body" shape *is* the point
 * — the body and every ring are sized strictly in proportion to their real km radii, with no
 * flooring that would visually lie about how narrow or how distant things really are.
 */

export const RING_DIAGRAM_VIEW_BOX_SIZE = 140;
const CENTER = RING_DIAGRAM_VIEW_BOX_SIZE / 2;
const MARGIN = 14;
const AVAILABLE_RADIUS = CENTER - MARGIN;

/** Round to 3 decimals so bound SVG attributes stay tidy and tests stay stable. */
function r(n: number): number {
  return Math.round(n * 1000) / 1000 + 0;
}

export interface RingClassificationDiagramRing {
  name: string;
  /** Mid-radius (SVG units) of the stroked circle used to draw this ring's annulus. */
  radius: number;
  /** Stroke width (SVG units) spanning the ring's inner-to-outer edge. */
  strokeWidth: number;
  isFocused: boolean;
}

export interface RingClassificationDiagram {
  viewBoxSize: number;
  center: number;
  /** Body radius, SVG units. */
  bodyRadius: number;
  rings: RingClassificationDiagramRing[];
}

/**
 * Builds a to-scale, top-down illustration of a body (filled circle) and its visible rings
 * (stroked annuli), linearly scaled from real km into one shared square viewBox. Every
 * dimension is the same fraction of `outermostKm` that it is in reality — nothing is floored
 * to stay "visible", so a Pauper body genuinely renders as a speck and a Taylor ring genuinely
 * renders as a hairline.
 */
export function ringClassificationDiagram(
  bodyRadiusKm: number,
  rings: { name: string; innerRadius: number; outerRadius: number }[],
  focusedRingName: string,
): RingClassificationDiagram {
  const outermostKm = Math.max(bodyRadiusKm, ...rings.map(ring => ring.outerRadius));
  const scale = outermostKm > 0 ? AVAILABLE_RADIUS / outermostKm : 0;

  const diagramRings = rings.map(ring => {
    const innerPx = ring.innerRadius * scale;
    const outerPx = ring.outerRadius * scale;
    return {
      name: ring.name,
      radius: r((innerPx + outerPx) / 2),
      strokeWidth: r(outerPx - innerPx),
      isFocused: ring.name === focusedRingName,
    };
  });

  return {
    viewBoxSize: RING_DIAGRAM_VIEW_BOX_SIZE,
    center: CENTER,
    bodyRadius: r(bodyRadiusKm * scale),
    rings: diagramRings,
  };
}
