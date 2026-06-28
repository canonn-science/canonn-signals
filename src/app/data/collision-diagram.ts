/**
 * Pure geometry helper that turns the centre-to-centre distance-over-time samples of a
 * collision pair (or multi-body cluster) into SVG-ready primitives for the synodic-period
 * diagram shown in the collision dialog. Framework-free so it stays trivially unit-testable.
 *
 * The chart plots separation (y, log scale) against time (x, linear). Distance oscillates
 * once per synodic period, dipping to a minimum at each conjunction; a dip that crosses the
 * contact threshold (the sum of the two bodies' radii) is a collision. A log y-axis is
 * essential here: opposition separations are AU-scale (~10^8 km) while the contact threshold
 * is only thousands of km, so a linear axis would flatten every dip onto the baseline.
 */

/** One body's distance-to-this-body curve plus its contact threshold and known collisions. */
export interface DistanceSeriesInput {
  /** Full name of the partner body this curve measures the distance to. */
  partnerName: string;
  /** Contact threshold (km) for this pair — the sum of the two bodies' radii. */
  combinedRadiiKm: number;
  /** Evenly-spaced (time, separation) samples spanning the diagram window. */
  samples: { tMs: number; sepKm: number }[];
  /** Known collision minima (from the upcoming-contacts list) to mark on the curve. */
  contacts: { tMs: number; sepKm: number }[];
}

export interface SynodicDiagramInput {
  /** Window start (epoch ms) — the left edge of the time axis. */
  startMs: number;
  /** Window end (epoch ms) — the right edge of the time axis. */
  endMs: number;
  /** "Now" (epoch ms); drawn as a vertical marker when it falls within the window. */
  nowMs: number;
  /** One entry per involved partner; each becomes a coloured curve. */
  series: DistanceSeriesInput[];
}

/** A laid-out curve: its polyline points, threshold line, collision markers and colour. */
export interface DiagramSeries {
  partnerName: string;
  /** Stroke colour for the curve, threshold line, markers and legend swatch. */
  color: string;
  /** SVG `points` for the distance polyline. */
  points: string;
  /** y of the horizontal contact-threshold line (clamped to the plot). */
  thresholdY: number;
  /** Marker centres for the known collisions on this curve. */
  markers: { cx: number; cy: number }[];
}

export interface SynodicDiagram {
  width: number;
  height: number;
  /** Plot rectangle (inside the axis margins). */
  plot: { x: number; y: number; w: number; h: number };
  series: DiagramSeries[];
  /**
   * Time-axis ticks: x position, the instant each represents (for date formatting) and a text
   * anchor so the wider end labels stay inside the plot instead of clipping at the edges.
   */
  xTicks: { x: number; tMs: number; anchor: 'start' | 'middle' | 'end' }[];
  /** y positions of the distance-axis ticks (log decades), with a compact label. */
  yTicks: { y: number; label: string }[];
  /** x of the "now" marker, or null when now is outside the window. */
  nowX: number | null;
}

export const COLLISION_DIAGRAM_WIDTH = 360;
export const COLLISION_DIAGRAM_HEIGHT = 200;
const MARGIN = { left: 48, right: 14, top: 12, bottom: 26 };

/** Distinct, colour-blind-friendly curve colours, cycled when there are more partners than entries. */
const PALETTE = ['#5ab1ff', '#ffb14e', '#7ee081', '#ff6f91', '#c792ea'];

/** Round to 2 decimals (and normalise -0 to 0) so bound SVG attributes stay tidy and tests stable. */
function r(n: number): number {
  return Math.round(n * 100) / 100 + 0;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Compact label for a power-of-ten kilometre value: "100 km", "1k km", "10M km". */
function kmLabel(km: number): string {
  if (km >= 1e6) { return `${Math.round(km / 1e6)}M km`; }
  if (km >= 1e3) { return `${Math.round(km / 1e3)}k km`; }
  return `${Math.round(km)} km`;
}

/**
 * Lays out the distance-over-time diagram. Returns null when there is nothing plottable
 * (no series with at least two finite samples), so the caller can hide the chart entirely.
 */
export function synodicDistanceDiagram(input: SynodicDiagramInput): SynodicDiagram | null {
  const { startMs, endMs, nowMs } = input;
  if (!(endMs > startMs)) { return null; }

  const plot = {
    x: MARGIN.left,
    y: MARGIN.top,
    w: COLLISION_DIAGRAM_WIDTH - MARGIN.left - MARGIN.right,
    h: COLLISION_DIAGRAM_HEIGHT - MARGIN.top - MARGIN.bottom,
  };

  // Collect every positive distance (samples, contacts and thresholds) to size the log axis.
  const values: number[] = [];
  let hasFiniteSample = false;
  for (const s of input.series) {
    for (const p of s.samples) { if (Number.isFinite(p.sepKm) && p.sepKm > 0) { values.push(p.sepKm); hasFiniteSample = true; } }
    for (const c of s.contacts) { if (Number.isFinite(c.sepKm) && c.sepKm > 0) { values.push(c.sepKm); } }
    if (s.combinedRadiiKm > 0) { values.push(s.combinedRadiiKm); }
  }
  if (!hasFiniteSample || values.length === 0) { return null; }

  // Pad the range by ~10% in log space so the curve peaks and the lowest threshold aren't
  // pinned to the plot edges.
  let minKm = Math.min(...values) / 1.1;
  let maxKm = Math.max(...values) * 1.1;
  if (!(minKm > 0)) { minKm = 1; }
  if (!(maxKm > minKm)) { maxKm = minKm * 10; }

  const lo = Math.log10(minKm);
  const hi = Math.log10(maxKm);
  const span = hi - lo;

  const xOf = (tMs: number): number => plot.x + plot.w * ((tMs - startMs) / (endMs - startMs));
  const yOf = (km: number): number => {
    const v = km > 0 ? Math.log10(km) : lo;
    return plot.y + plot.h * (1 - clamp((v - lo) / span, 0, 1));
  };

  const series: DiagramSeries[] = input.series.map((s, i) => {
    const contacts = s.contacts.filter(c => c.tMs >= startMs && c.tMs <= endMs && Number.isFinite(c.sepKm) && c.sepKm > 0);
    // Thread the known contact minima into the sampled curve (time-sorted) so the dips reach
    // the true closest approach. The uniform samples under-resolve the narrow conjunction
    // valley, so without this the drawn curve bottoms out short of the collision markers.
    const points = [...s.samples.filter(p => Number.isFinite(p.sepKm) && p.sepKm > 0), ...contacts]
      .sort((p, q) => p.tMs - q.tMs)
      .map(p => `${r(xOf(p.tMs))},${r(yOf(p.sepKm))}`)
      .join(' ');
    const markers = contacts.map(c => ({ cx: r(xOf(c.tMs)), cy: r(yOf(c.sepKm)) }));
    return {
      partnerName: s.partnerName,
      color: PALETTE[i % PALETTE.length],
      points,
      thresholdY: r(yOf(s.combinedRadiiKm)),
      markers,
    };
  });

  // y ticks: one per log decade within the range; fall back to the two endpoints when the
  // range is narrower than a single decade (so the axis is never blank).
  const yTicks: { y: number; label: string }[] = [];
  const firstExp = Math.ceil(lo);
  const lastExp = Math.floor(hi);
  if (lastExp >= firstExp) {
    for (let exp = firstExp; exp <= lastExp; exp++) {
      const km = Math.pow(10, exp);
      yTicks.push({ y: r(yOf(km)), label: kmLabel(km) });
    }
  } else {
    yTicks.push({ y: r(yOf(maxKm)), label: kmLabel(maxKm) });
    yTicks.push({ y: r(yOf(minKm)), label: kmLabel(minKm) });
  }

  // x ticks: four evenly-spaced instants across the window (formatted as dates by the template).
  // The first/last ticks anchor inward (start/end) so the dated labels don't clip at the edges.
  const xTicks: { x: number; tMs: number; anchor: 'start' | 'middle' | 'end' }[] = [];
  const X_TICK_COUNT = 4;
  for (let i = 0; i < X_TICK_COUNT; i++) {
    const tMs = startMs + ((endMs - startMs) * i) / (X_TICK_COUNT - 1);
    const anchor = i === 0 ? 'start' : i === X_TICK_COUNT - 1 ? 'end' : 'middle';
    xTicks.push({ x: r(xOf(tMs)), tMs, anchor });
  }

  const nowX = nowMs >= startMs && nowMs <= endMs ? r(xOf(nowMs)) : null;

  return { width: COLLISION_DIAGRAM_WIDTH, height: COLLISION_DIAGRAM_HEIGHT, plot, series, xTicks, yTicks, nowX };
}
