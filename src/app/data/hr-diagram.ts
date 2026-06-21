/**
 * Pure geometry that turns a star's effective temperature and absolute magnitude into
 * SVG-ready coordinates for a small Hertzsprung–Russell diagram. Framework-free so it
 * stays trivially unit-testable, mirroring the orbital-diagram helpers.
 *
 * Axes follow the astronomer's convention: temperature decreases left→right (hot stars
 * on the left) on a logarithmic scale, and absolute magnitude decreases bottom→top
 * (luminous stars at the top). The main-sequence band is drawn from the shared
 * SPECTRAL_CLASS_REFERENCE table so the diagram and the age assessment agree.
 */

import { MAIN_SEQUENCE_ORDER, SPECTRAL_CLASS_REFERENCE, SPECTRAL_COLORS, spectralColor, luminosityClass, isWhiteDwarf, absoluteMagnitudeFromRadiusTemp } from './stellar-reference';

export const VIEW_BOX_WIDTH = 360;
export const VIEW_BOX_HEIGHT = 260;

// Plotting rectangle inside the view box (margins leave room for axis labels).
const MARGIN_L = 46;
const MARGIN_R = 16;
const MARGIN_T = 22;
const MARGIN_B = 34;
const PLOT_X = MARGIN_L;
const PLOT_Y = MARGIN_T;
const PLOT_W = VIEW_BOX_WIDTH - MARGIN_L - MARGIN_R;
const PLOT_H = VIEW_BOX_HEIGHT - MARGIN_T - MARGIN_B;

// Axis domains.
const TEMP_MAX = 50000; // K, left edge
const TEMP_MIN = 2000;  // K, right edge
const MAG_TOP = -10;    // brightest, top edge
const MAG_BOTTOM = 18;  // faintest, bottom edge

export interface Point { x: number; y: number; }
export interface ClassTick { label: string; x: number; color: string; }
export interface MagTick { label: string; y: number; }
export interface GradientStop { offset: number; color: string; }

/**
 * One of the diagram's labelled luminosity regions — the supergiant / giant / white-dwarf
 * clouds — drawn as an ellipse and highlighted when it matches the star's luminosity class.
 * The cloud is filled with the same temperature gradient as the main-sequence band, so it
 * carries the spectral colours across its width (hot/blue on the left, cool/red on the
 * right) just like the real H-R schematic.
 */
export interface HrRegion {
  key: string;
  label: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** Label anchor (centre of the ellipse). */
  labelX: number;
  labelY: number;
  /** True when the star's luminosity class places it in this region. */
  current: boolean;
}

export interface HrPlotInput {
  surfaceTemperature?: number | null;
  absoluteMagnitude?: number | null;
  spectralClass?: string | null;
  subType?: string | null;
  luminosity?: string | null;
  /** Radius in solar radii, used to derive a magnitude when one isn't reported (white dwarfs). */
  solarRadius?: number | null;
}

export interface HrDiagram {
  viewBox: string;
  /** Plotting rectangle, for the axes frame. */
  plot: { x: number; y: number; w: number; h: number };
  /** Polyline path for the main-sequence band, hot/bright → cool/faint. */
  mainSequencePath: string;
  /** Label anchor for the main-sequence band. */
  mainSequenceLabel: Point;
  /** True when the star is itself a main-sequence (dwarf) star. */
  mainSequenceCurrent: boolean;
  /** Gradient stops (0..1 across the plot width) tinting shapes by spectral class. */
  mainSequenceStops: GradientStop[];
  /** Giant / supergiant / white-dwarf clouds; the star's own region is flagged current. */
  regions: HrRegion[];
  /** Spectral-class letters positioned along the temperature axis. */
  classTicks: ClassTick[];
  /** x positions of the vertical separators between adjacent spectral classes. */
  classSeparators: number[];
  /** Absolute-magnitude gridline labels along the vertical axis. */
  magTicks: MagTick[];
  /** The star's position, or null when temperature / magnitude are unavailable. */
  point: Point | null;
  /** The star marker's colour from its spectral class, or null when unknown. */
  pointColor: string | null;
  /** False when the star sits outside the drawn domain and had to be clamped. */
  inRange: boolean;
}

/** Round to 2 decimals so bound SVG attributes stay tidy and tests stay stable. */
function r(n: number): number {
  // `+ 0` collapses a possible -0 result to 0 so bound attributes / snapshots stay stable.
  return Math.round(n * 100) / 100 + 0;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Maps an effective temperature (K) to an x coordinate (hot on the left, log scale). */
export function temperatureToX(tempK: number): number {
  const lt = Math.log10(clamp(tempK, TEMP_MIN, TEMP_MAX));
  const frac = (Math.log10(TEMP_MAX) - lt) / (Math.log10(TEMP_MAX) - Math.log10(TEMP_MIN));
  return r(PLOT_X + frac * PLOT_W);
}

/** Maps an absolute magnitude to a y coordinate (brighter / more negative at the top). */
export function magnitudeToY(absMag: number): number {
  const frac = (clamp(absMag, MAG_TOP, MAG_BOTTOM) - MAG_TOP) / (MAG_BOTTOM - MAG_TOP);
  return r(PLOT_Y + frac * PLOT_H);
}

/** Builds the full H-R diagram geometry for a star. */
export function hrPlot(input: HrPlotInput): HrDiagram {
  const mainSequencePath = 'M ' + MAIN_SEQUENCE_ORDER
    .map((letter) => {
      const ref = SPECTRAL_CLASS_REFERENCE[letter];
      return `${temperatureToX(ref.bandTemp)} ${magnitudeToY(ref.absMagApprox)}`;
    })
    .join(' L ');

  // Which labelled region the star belongs to. White dwarfs are detected by class/subType
  // (robust even when the luminosity field is absent); everything else uses luminosity class.
  const lumClass = luminosityClass(input.luminosity);
  const regionForLum =
    isWhiteDwarf(input.spectralClass, input.subType) ? 'whitedwarfs'
    : lumClass === 'I' || lumClass === 'II' ? 'supergiants'
    : lumClass === 'III' || lumClass === 'IV' ? 'giants'
    : lumClass === 'VII' ? 'whitedwarfs'
    : 'main';

  const classTicks: ClassTick[] = MAIN_SEQUENCE_ORDER.map((letter) => ({
    label: letter,
    x: temperatureToX(SPECTRAL_CLASS_REFERENCE[letter].bandTemp),
    color: SPECTRAL_COLORS[letter],
  }));

  // Vertical separators at the temperature boundaries between adjacent classes.
  const classSeparators = MAIN_SEQUENCE_ORDER.slice(0, -1).map(
    (letter) => temperatureToX(SPECTRAL_CLASS_REFERENCE[letter].tempRange[0]),
  );

  // Gradient stops run left→right (hot→cool) so shapes read as real star colours.
  const mainSequenceStops: GradientStop[] = classTicks.map((t) => ({
    offset: r((t.x - PLOT_X) / PLOT_W),
    color: t.color,
  }));

  // The labelled luminosity clouds, in temperature (K) × absolute-magnitude space. Each is
  // an ellipse filled with the shared temperature gradient (so it shows real spectral
  // colours across its width) and positioned to echo the canonical H-R schematic:
  //   • Supergiants span the bright top; their hot-left edge overlaps the top of the main
  //     sequence (the O/B stars), so the two merge towards the highest luminosities.
  //   • Giants form a cooler clump on the right whose lower edge dips onto the main sequence
  //     around the G turn-off (the "merge towards ~10 L☉" branch) and whose top lightly
  //     touches the trailing edge of the supergiant cloud.
  //   • White dwarfs sit isolated below, hot but faint (blue-white → white).
  const ellipse = (key: string, label: string, tMin: number, tMax: number, magBright: number, magFaint: number): HrRegion => {
    const xHot = temperatureToX(tMax);
    const xCool = temperatureToX(tMin);
    const yTop = magnitudeToY(magBright);
    const yBot = magnitudeToY(magFaint);
    const cx = r((xHot + xCool) / 2);
    const cy = r((yTop + yBot) / 2);
    return { key, label, cx, cy, rx: r(Math.abs(xCool - xHot) / 2), ry: r(Math.abs(yBot - yTop) / 2), labelX: cx, labelY: cy, current: regionForLum === key };
  };
  const regions: HrRegion[] = [
    ellipse('supergiants', 'Supergiants', 2400, 42000, -9, -2.5),
    ellipse('giants', 'Giants', 2700, 6700, -4, 5),
    ellipse('whitedwarfs', 'White Dwarfs', 5000, 30000, 9, 16),
  ];

  const magTicks: MagTick[] = [-10, -5, 0, 5, 10, 15].map((m) => ({
    label: String(m),
    y: magnitudeToY(m),
  }));

  const temp = input.surfaceTemperature;
  // Use the reported absolute magnitude, falling back to one derived from radius +
  // temperature when it's missing (white dwarfs report a radius and temperature but no
  // magnitude, so this is what lets them appear as a point in their region).
  const mag = input.absoluteMagnitude != null && Number.isFinite(input.absoluteMagnitude)
    ? input.absoluteMagnitude
    : absoluteMagnitudeFromRadiusTemp(input.solarRadius, temp);
  let point: Point | null = null;
  let inRange = true;
  if (temp != null && Number.isFinite(temp) && mag != null && Number.isFinite(mag)) {
    point = { x: temperatureToX(temp), y: magnitudeToY(mag) };
    inRange = temp >= TEMP_MIN && temp <= TEMP_MAX && mag >= MAG_TOP && mag <= MAG_BOTTOM;
  }

  return {
    viewBox: `0 0 ${VIEW_BOX_WIDTH} ${VIEW_BOX_HEIGHT}`,
    plot: { x: PLOT_X, y: PLOT_Y, w: PLOT_W, h: PLOT_H },
    mainSequencePath,
    mainSequenceLabel: { x: temperatureToX(6000), y: magnitudeToY(6.5) },
    mainSequenceCurrent: regionForLum === 'main',
    mainSequenceStops,
    regions,
    classTicks,
    classSeparators,
    magTicks,
    point,
    pointColor: spectralColor(input.spectralClass, input.subType),
    inRange,
  };
}
