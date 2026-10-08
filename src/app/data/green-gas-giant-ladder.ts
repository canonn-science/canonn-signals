/**
 * Pure geometry for the cloud-layer ("ladder") illustration in the Green Gas Giant dialog.
 * Framework-free so it stays trivially unit-testable — see `ring-classification-diagram.ts`
 * for the sibling convention this follows.
 *
 * The picture has two halves that share one vertical temperature scale:
 *  - a **ladder** on the left: the seven cloud-layer temperatures as rungs, with the band
 *    boundaries ("cracks") drawn across them and the ceiling marked, and
 *  - a **planet** on the right: the same seven layers as horizontal stripes, coloured by
 *    the band each one falls in, with any layer sitting exactly on a crack drawn green.
 *
 * The scale is linear in kelvin and is chosen from the data, so the rung that lands on a
 * crack visibly coincides with it rather than merely being near it. Stripe colours are
 * illustrative — the real renderer's palette isn't public — so the module emits a band
 * *index* per stripe and leaves the actual colours to the stylesheet.
 */

import { GreenGasGiantPrediction } from './green-gas-giant-prediction';

/** Width of the diagram's viewBox, SVG units. */
export const LADDER_VIEW_WIDTH = 680;
/** Height of the diagram's viewBox, SVG units. */
export const LADDER_VIEW_HEIGHT = 360;

/** Horizontal extent of the ladder's rungs. */
const RUNG_LEFT = 150;
const RUNG_RIGHT = 250;
/** Where crack lines and the ceiling start — they span the ladder and stop before the planet. */
const LINE_LEFT = 150;
const LINE_RIGHT = 330;
/** The planet disc. */
const PLANET_CENTER_X = 500;
const PLANET_CENTER_Y = LADDER_VIEW_HEIGHT / 2;
const PLANET_RADIUS = 120;
/** Vertical padding inside the plot area, SVG units. */
const TOP_MARGIN = 26;
const BOTTOM_MARGIN = 40;

/** Round to 3 decimals so bound SVG attributes stay tidy and tests stay stable. */
function r(n: number): number {
  return Math.round(n * 1000) / 1000 + 0;
}

/** One of the seven cloud layers, as a rung on the ladder. */
export interface LadderRung {
  /** 1-based layer index; 1 is the surface itself. */
  layer: number;
  /** The layer's temperature, K. */
  temperature: number;
  y: number;
  /** True when this layer sits exactly on a crack — the reason the planet renders green. */
  isHit: boolean;
}

/** A band boundary drawn across the ladder. */
export interface LadderCrack {
  temperature: number;
  y: number;
  /** True when a cloud layer sits exactly on this boundary. */
  isHit: boolean;
}

/** One cloud layer as a stripe across the planet disc. */
export interface LadderStripe {
  layer: number;
  y: number;
  height: number;
  /**
   * Index of the temperature band this layer falls in, counting up from the coldest.
   * Drives the illustrative stripe colour. `null` when the layer is on a crack and so
   * belongs to no band at all — that stripe is the green one.
   */
  band: number | null;
  isHit: boolean;
}

/** The complete diagram, in SVG user units. */
export interface GreenGasGiantLadderDiagram {
  viewWidth: number;
  viewHeight: number;
  rungLeft: number;
  rungRight: number;
  lineLeft: number;
  lineRight: number;
  planetCenterX: number;
  planetCenterY: number;
  planetRadius: number;
  rungs: LadderRung[];
  cracks: LadderCrack[];
  stripes: LadderStripe[];
  /** The ceiling line, or `null` when it falls outside the plotted temperature range. */
  ceiling: { temperature: number; y: number } | null;
  /** The reach line, drawn only when the reach — not the ceiling — set the step. */
  reach: { temperature: number; y: number } | null;
  /** Coldest temperature plotted, K. */
  minTemperature: number;
  /** Hottest temperature plotted, K. */
  maxTemperature: number;
  /** True when at least one layer sits on a crack. */
  isGreen: boolean;
}

/**
 * Builds the ladder-and-planet illustration for `prediction`.
 *
 * The plotted range always covers all seven layers; it also takes in the ceiling and any
 * crack within a short reach of the layers, so the nearest boundaries stay visible and the
 * hit is shown in the context of the bands around it. Cracks far outside the body's own
 * temperature range are dropped rather than compressing the scale to nothing.
 */
export function greenGasGiantLadderDiagram(
  prediction: GreenGasGiantPrediction,
): GreenGasGiantLadderDiagram {
  const layers = prediction.layers;
  const coldestLayer = layers[0];
  const hottestLayer = layers[layers.length - 1];
  const layerSpan = Math.max(hottestLayer - coldestLayer, 1);

  // Keep cracks that sit within the layers' own span (plus a margin) on either side; a
  // 1,400 K boundary has nothing to say about a 130 K giant.
  const margin = layerSpan * 0.35;
  const relevantCracks = prediction.cracks.filter(
    crack => crack >= coldestLayer - margin && crack <= hottestLayer + margin,
  );

  const ceilingInRange = prediction.ceiling <= hottestLayer + margin;
  const candidates = [coldestLayer, hottestLayer, ...relevantCracks];
  if (ceilingInRange) { candidates.push(prediction.ceiling); }
  // Only worth plotting when the reach is what capped the ladder.
  const showReach = !prediction.cappedByCeiling && prediction.reach <= hottestLayer + margin;
  if (showReach) { candidates.push(prediction.reach); }

  const rawMin = Math.min(...candidates);
  const rawMax = Math.max(...candidates);
  // A flat ladder (every layer at the same temperature, e.g. a clamped step of 0) would
  // divide by zero; give it an arbitrary but sane 1 K window.
  const pad = Math.max((rawMax - rawMin) * 0.08, 0.5);
  const minTemperature = rawMin - pad;
  const maxTemperature = rawMax + pad;

  const plotTop = TOP_MARGIN;
  const plotHeight = LADDER_VIEW_HEIGHT - TOP_MARGIN - BOTTOM_MARGIN;
  const span = maxTemperature - minTemperature;
  /** Temperature to y: hotter is higher on screen. */
  const y = (temperature: number) =>
    r(plotTop + (maxTemperature - temperature) / span * plotHeight);

  const hitTemperature = prediction.hitCrack;
  const rungs: LadderRung[] = layers.map((temperature, index) => ({
    layer: index + 1,
    temperature,
    y: y(temperature),
    isHit: prediction.hitLayer === index + 1,
  }));

  const cracks: LadderCrack[] = relevantCracks.map(crack => ({
    temperature: crack,
    y: y(crack),
    isHit: crack === hitTemperature,
  }));

  // The stripes divide the disc into seven equal bands, coldest at the bottom, so the
  // planet reads the same way round as the ladder beside it.
  const stripeHeight = (PLANET_RADIUS * 2) / layers.length;
  const stripes: LadderStripe[] = layers.map((temperature, index) => ({
    layer: index + 1,
    y: r(PLANET_CENTER_Y + PLANET_RADIUS - (index + 1) * stripeHeight),
    height: r(stripeHeight),
    band: bandOf(temperature, prediction.cracks),
    isHit: prediction.hitLayer === index + 1,
  }));

  return {
    viewWidth: LADDER_VIEW_WIDTH,
    viewHeight: LADDER_VIEW_HEIGHT,
    rungLeft: RUNG_LEFT,
    rungRight: RUNG_RIGHT,
    lineLeft: LINE_LEFT,
    lineRight: LINE_RIGHT,
    planetCenterX: PLANET_CENTER_X,
    planetCenterY: PLANET_CENTER_Y,
    planetRadius: PLANET_RADIUS,
    rungs,
    cracks,
    stripes,
    ceiling: ceilingInRange ? { temperature: prediction.ceiling, y: y(prediction.ceiling) } : null,
    reach: showReach ? { temperature: prediction.reach, y: y(prediction.reach) } : null,
    minTemperature,
    maxTemperature,
    isGreen: prediction.hitLayer !== null,
  };
}

/**
 * Which temperature band `temperature` falls in, counting up from the coldest, or `null`
 * when it lands exactly on a boundary and so belongs to neither of its neighbours — the
 * whole point of the model.
 */
function bandOf(temperature: number, cracks: readonly number[]): number | null {
  let band = 0;
  for (const crack of cracks) {
    if (temperature === crack) { return null; }
    if (temperature > crack) { band++; }
  }
  return band;
}
