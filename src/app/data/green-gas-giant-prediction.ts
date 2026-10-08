/**
 * Green Gas Giant (GGG) prediction — reproduces the cloud-layer model published by
 * CMDRs Arcanic and Regza at https://ed-ggg.github.io/edggg/densitydemo.html, derived from
 * and validated against CMDR Arcanic's Green Gas Giant catalogue.
 *
 * The model in one paragraph: every gas giant is rendered with **seven cloud layers**,
 * and each layer is assigned a colour from a table of temperature bands. The table only
 * accepts a temperature strictly *inside* a band — a layer whose temperature lands
 * exactly on the boundary between two bands matches neither, gets no colour, and keeps
 * the renderer's default of pure green. Those boundaries are the "cracks". A gas giant
 * with at least one cloud layer sitting exactly on a crack is a Green Gas Giant.
 *
 * The seven layers ("rungs") are evenly spaced from the surface temperature up to a top,
 * which is the lower of
 *   - the ladder's **reach**, driven by surface temperature and bulk density, and
 *   - a hard **ceiling** that depends on the surface temperature band.
 * Some classes additionally clamp the step size to a fixed range.
 *
 * Two properties of the game's maths make this an exact-equality test rather than a
 * tolerance test, and both are deliberately preserved here:
 *
 *  1. **float32.** The game keeps layer temperatures at single precision, so each rung is
 *     rounded through {@link Math.fround}. "Close to a crack" is not green; a rung has to
 *     land on it exactly. Two bodies 0.0001 K apart can differ in verdict.
 *  2. **The reach formula is evaluated in the published form.** `reach` is algebraically
 *     `722.2 x (T / 1300)^1.2 x density^0.2`, but it is computed below as the source does
 *     — `(rho / 1300 * T)^1.2 * (1/180) * (130000 / rho)` — because the two differ in
 *     their last float bits, and those bits decide the verdict.
 *
 * Do not "simplify" either of those; see `green-gas-giant-prediction.spec.ts`, which pins
 * the model against the published worked examples and the catalogue.
 *
 * The catch: some giants get a **random nudge** applied to their surface temperature
 * before the ladder is built, and that offset appears in no public data. For those the
 * model can only say "could be green" — see {@link GreenGasGiantNudge}.
 *
 * This module is intentionally free of Angular imports so it stays a pure, testable
 * data module (and could move into the collision worker if it ever needs to).
 */

/**
 * Planet-class ids the model distinguishes, matching the game's own internal numbering
 * (the same values the published demo's class selector uses). The numbers matter only as
 * stable keys for the per-class tables below.
 */
const GIANT_CLASS = {
  WaterGiant: 8,
  WaterGiantWithLife: 9,
  WaterBasedLife: 10,
  AmmoniaBasedLife: 11,
  ClassI: 12,
  ClassII: 13,
  ClassIII: 14,
  ClassIV: 15,
  ClassV: 16,
  HeliumRich: 17,
  Helium: 18,
} as const;

type GiantClass = typeof GIANT_CLASS[keyof typeof GIANT_CLASS];

/**
 * Spansh/EDSM `subType` strings mapped to the class ids above, keyed lowercase.
 * Anything absent here is not a gas or water giant and gets no prediction.
 */
const SUBTYPE_CLASS: Readonly<Record<string, GiantClass>> = {
  'water giant': GIANT_CLASS.WaterGiant,
  'water giant with life': GIANT_CLASS.WaterGiantWithLife,
  'gas giant with water-based life': GIANT_CLASS.WaterBasedLife,
  'gas giant with ammonia-based life': GIANT_CLASS.AmmoniaBasedLife,
  'class i gas giant': GIANT_CLASS.ClassI,
  'class ii gas giant': GIANT_CLASS.ClassII,
  'class iii gas giant': GIANT_CLASS.ClassIII,
  'class iv gas giant': GIANT_CLASS.ClassIV,
  'class v gas giant': GIANT_CLASS.ClassV,
  'helium-rich gas giant': GIANT_CLASS.HeliumRich,
  'helium gas giant': GIANT_CLASS.Helium,
};

/**
 * Ceiling the ladder cannot climb past, as `[minSurfaceTemp, ceiling]` in ascending
 * order: the ceiling is the last entry whose `minSurfaceTemp` the surface temperature
 * reaches.
 */
const CEILINGS: readonly (readonly [number, number])[] = [
  [0, 100], [75, 340], [330, 700], [680, 1200], [900, 1500], [1400, 5000],
];

/** Per-class `[minStep, maxStep]` clamp on the spacing between layers, in K. */
const STEP_CLAMPS: Readonly<Partial<Record<GiantClass, readonly [number, number]>>> = {
  [GIANT_CLASS.ClassII]: [5, 20],
  [GIANT_CLASS.ClassIII]: [30, 100],
  [GIANT_CLASS.ClassIV]: [50, 100],
  [GIANT_CLASS.ClassV]: [250, 1000],
};

/**
 * Per-class surface-temperature window in which the random nudge applies, as
 * `[alwaysBelow, noneAtOrAbove]`: at or above the upper bound the body is never nudged,
 * between the two it may be, and at or below the lower bound it always is.
 */
const NUDGE_WINDOWS: Readonly<Partial<Record<GiantClass, readonly [number, number]>>> = {
  [GIANT_CLASS.ClassII]: [250, 280],
  [GIANT_CLASS.ClassIII]: [365, 415],
  [GIANT_CLASS.ClassIV]: [500, 700],
  [GIANT_CLASS.ClassV]: [1000, 1500],
};

/** Band boundaries for class I and ammonia-based-life giants, in K. */
const CRACKS_CLASS_I = [115, 250, 270, 370, 700, 900, 1400] as const;
/** Band boundaries for every other gas and water giant, in K. */
const CRACKS_OTHER = [114, 210, 270, 370, 700, 900, 1400] as const;

/** Number of cloud layers the game renders on a gas giant. */
const LAYER_COUNT = 7;

/** One Earth mass, kg — the unit `earthMasses` is expressed in. */
const EARTH_MASS_KG = 5.97219e24;

/**
 * Whether the body's surface temperature is randomly offset before its ladder is built.
 *  - `none` — never nudged, so the verdict is exact.
 *  - `possible` — may be nudged; a crack hit holds only if the nudge left it alone, and a
 *    miss could still be green if the nudge moved a layer onto a crack.
 *  - `always` — always nudged, so no public data can predict it. Only a visit can tell.
 */
export type GreenGasGiantNudge = 'none' | 'possible' | 'always';

/** The model's conclusion for a body. */
export type GreenGasGiantVerdict =
  /** A cloud layer sits exactly on a crack and the body is never nudged. */
  | 'green'
  /** A layer sits exactly on a crack, but a nudge could move it off. */
  | 'green-unless-nudged'
  /** No layer hits a crack, but a nudge could move one onto it. */
  | 'possible'
  /** Always nudged — unpredictable from public data. */
  | 'unpredictable'
  /** A whole-number temperature in a record that was rounded at source, too coarse to place the layers. */
  | 'imprecise'
  /** No layer hits a crack and the body is never nudged. */
  | 'not-green';

/** The layer of the closest approach to a crack, when no layer hits one exactly. */
export interface GreenGasGiantNearest {
  /** 1-based layer index (1 is the surface itself). */
  layer: number;
  /** The layer's temperature, K. */
  temperature: number;
  /** The crack it comes closest to, K. */
  crack: number;
  /** Absolute distance from the crack, K. */
  delta: number;
  /** `delta` expressed in float32 steps (ULPs) at the crack — 1 means "as close as possible without hitting". */
  ulps: number;
}

/** The full model output for one gas giant. */
export interface GreenGasGiantPrediction {
  verdict: GreenGasGiantVerdict;
  /** Convenience flag: the model expects green, subject to `nudge`. */
  isGreen: boolean;
  nudge: GreenGasGiantNudge;
  /** The seven cloud-layer temperatures, K, coldest (the surface) first. */
  layers: readonly number[];
  /** Band boundaries that apply to this planet class, K. */
  cracks: readonly number[];
  /** 1-based index of the layer sitting exactly on a crack, or `null`. */
  hitLayer: number | null;
  /** The crack that layer sits on, K, or `null`. */
  hitCrack: number | null;
  /** Closest approach when `hitLayer` is `null`, else `null`. */
  nearest: GreenGasGiantNearest | null;
  /** Bulk density, kg/m³. */
  density: number;
  /** Spacing between layers, K, after any per-class clamp. */
  step: number;
  /** Ceiling for this surface temperature, K. */
  ceiling: number;
  /** Top the ladder reaches from temperature and density alone (before the ceiling), K. */
  reach: number;
  /** True when the reach exceeds the ceiling, so density no longer affects the step. */
  cappedByCeiling: boolean;
  /** True when density sets the step: the reach falls short of the ceiling and no clamp applied. */
  densityDriven: boolean;
}

/** The minimal body shape the model reads. */
export interface GreenGasGiantCandidate {
  subType?: string | null;
  /** Surface temperature, K. */
  surfaceTemperature?: number | null;
  /** Mass in Earth masses. */
  earthMasses?: number | null;
  /** Radius, km. */
  radius?: number | null;
  /** Atmosphere shares, %, by gas — only read to tell a rounded record from a full-precision one. */
  atmosphereComposition?: Readonly<Record<string, number>> | null;
}

/** Whether `subType` is a gas or water giant the model knows how to place on the ladder. */
export function isPredictableGiantSubType(subType: string | null | undefined): boolean {
  return giantClassOf(subType) !== null;
}

function giantClassOf(subType: string | null | undefined): GiantClass | null {
  if (!subType) { return null; }
  return SUBTYPE_CLASS[subType.trim().toLowerCase()] ?? null;
}

/** Band boundaries for a planet class: class I and ammonia-life giants use their own set. */
function cracksFor(giant: GiantClass): readonly number[] {
  return giant === GIANT_CLASS.ClassI || giant === GIANT_CLASS.AmmoniaBasedLife
    ? CRACKS_CLASS_I
    : CRACKS_OTHER;
}

function ceilingFor(surfaceTemp: number): number {
  // The table is ascending, so the last entry we reach wins. Nothing below the first
  // entry's floor (0 K) exists, but keep a sane default if that ever changes.
  let ceiling = 10000;
  for (const [floor, value] of CEILINGS) {
    if (surfaceTemp < floor) { break; }
    ceiling = value;
  }
  return ceiling;
}

/** Whether a random offset is applied to this body's surface temperature. */
function nudgeFor(giant: GiantClass, surfaceTemp: number): GreenGasGiantNudge {
  const window = NUDGE_WINDOWS[giant];
  if (window) {
    const [alwaysBelow, noneAtOrAbove] = window;
    if (surfaceTemp >= noneAtOrAbove) { return 'none'; }
    return surfaceTemp > alwaysBelow ? 'possible' : 'always';
  }
  // Every other class is nudged between 80 K and ~122.22 K (the point where
  // `t < 110 + 0.1t` stops holding), and the upper part of that window is only "possible".
  if (surfaceTemp > 80 && surfaceTemp < 110 + 0.1 * surfaceTemp) {
    return surfaceTemp > 100 ? 'possible' : 'always';
  }
  return 'none';
}

/**
 * Whether a whole-number temperature was rounded at source rather than read from a scan.
 *
 * Whole numbers are ambiguous: many confirmed Green Gas Giants really are exactly 158 K or
 * on the class III 30 K grid, but some records (old imports) were rounded wholesale, and
 * those also carry atmosphere shares to two decimals. A full-precision journal record gives
 * six, so a whole number is trusted only alongside a precise atmosphere.
 */
function isRoundedTemperature(
  surfaceTemperature: number,
  atmosphere: Readonly<Record<string, number>> | null | undefined,
): boolean {
  if (!Number.isInteger(surfaceTemperature)) { return false; }
  const shares = Object.values(atmosphere ?? {});
  // Every share a multiple of 0.01 — the chance of that by accident across two or more gases is negligible.
  return shares.length === 0 || shares.every((share) => Number.isInteger(Math.round(share * 1e6) / 1e4));
}

/** Distance from `value` to the next representable float32 above it — one ULP. */
function float32Ulp(value: number): number {
  const floats = new Float32Array([value]);
  const bits = new Uint32Array(floats.buffer);
  bits[0] += 1;
  return floats[0] - value;
}

/**
 * Runs the cloud-layer model for `body`, or returns `null` when it cannot be placed on
 * the ladder — a body that isn't a gas or water giant, or one missing the surface
 * temperature, mass or radius the ladder needs.
 *
 * A non-null result is always a complete ladder, even when the verdict is
 * `unpredictable`: the layers shown are the ones the body *would* have before its random
 * nudge, which is still worth displaying as the starting point.
 */
export function predictGreenGasGiant(body: GreenGasGiantCandidate): GreenGasGiantPrediction | null {
  const giant = giantClassOf(body.subType);
  if (giant === null) { return null; }

  const { surfaceTemperature, earthMasses, radius } = body;
  if (surfaceTemperature == null || earthMasses == null || radius == null) { return null; }
  if (!(surfaceTemperature > 0) || !(earthMasses > 0) || !(radius > 0)) { return null; }

  // The game stores the surface temperature at single precision, so every comparison
  // below has to start from the float32 value, not the float64 the API hands us.
  const surfaceTemp = Math.fround(surfaceTemperature);
  const ceiling = ceilingFor(surfaceTemp);

  const radiusMetres = radius * 1e3;
  const density = earthMasses * EARTH_MASS_KG / (4 / 3 * Math.PI * Math.pow(radiusMetres, 3));

  // Evaluated in the published form on purpose — see the file header. Algebraically this
  // is `722.2 * (surfaceTemp / 1300) ** 1.2 * density ** 0.2 + surfaceTemp`, but the two
  // disagree in the last float bits and those bits decide the verdict.
  const reach = Math.pow(density / 1300 * surfaceTemp, 1.2) * (1 / 180) * (130000 / density) + surfaceTemp;

  const top = Math.min(ceiling, reach);
  const unclampedStep = (top - surfaceTemp) * (1 / LAYER_COUNT);
  const clamp = STEP_CLAMPS[giant];
  const step = clamp
    ? Math.max(clamp[0], Math.min(unclampedStep, clamp[1]))
    : unclampedStep;

  // A surface already above its own ceiling starts the ladder at the ceiling instead.
  const bottom = Math.min(ceiling, surfaceTemp);
  const layers: number[] = [];
  for (let layer = 0; layer < LAYER_COUNT; layer++) {
    layers.push(Math.fround(step * layer + bottom));
  }

  const cracks = cracksFor(giant);
  let hitLayer: number | null = null;
  let hitCrack: number | null = null;
  let nearest: GreenGasGiantNearest | null = null;
  for (let layer = 0; layer < LAYER_COUNT; layer++) {
    const temperature = layers[layer];
    const crackIndex = cracks.indexOf(temperature);
    if (crackIndex >= 0) {
      // Keep the coldest hit: it's the layer the renderer colours green first.
      if (hitLayer === null) {
        hitLayer = layer + 1;
        hitCrack = cracks[crackIndex];
      }
      continue;
    }
    for (const crack of cracks) {
      const delta = Math.abs(temperature - crack);
      if (nearest === null || delta < nearest.delta) {
        nearest = {
          layer: layer + 1,
          temperature,
          crack,
          delta,
          ulps: Math.round(delta / float32Ulp(crack)),
        };
      }
    }
  }
  if (hitLayer !== null) { nearest = null; }

  const densityDriven = reach < ceiling && step === unclampedStep;
  const nudge = nudgeFor(giant, surfaceTemp);

  const temperatureRounded = isRoundedTemperature(surfaceTemperature, body.atmosphereComposition);
  const verdict = classify({ nudge, hasHit: hitLayer !== null, temperatureRounded });

  return {
    verdict,
    isGreen: verdict === 'green' || verdict === 'green-unless-nudged',
    nudge,
    layers,
    cracks,
    hitLayer,
    hitCrack,
    nearest,
    density,
    step,
    ceiling,
    reach,
    cappedByCeiling: reach >= ceiling,
    densityDriven,
  };
}

function classify(input: {
  nudge: GreenGasGiantNudge;
  hasHit: boolean;
  temperatureRounded: boolean;
}): GreenGasGiantVerdict {
  const { nudge, hasHit, temperatureRounded } = input;
  // An always-nudged body's own temperature is discarded before the ladder is built, so
  // whether its un-nudged layers hit a crack says nothing about the body in game.
  if (nudge === 'always') { return 'unpredictable'; }
  if (temperatureRounded) { return 'imprecise'; }
  if (hasHit) { return nudge === 'possible' ? 'green-unless-nudged' : 'green'; }
  if (nudge === 'possible') { return 'possible'; }
  return 'not-green';
}
