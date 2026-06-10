// On-foot temperature estimation — ported from estimate_body_temp.py
// Based on 3,301,198 organic temperature measurements from EDSM/journal data.
// deltaT = organic_temp − surfaceTemperature; p5/p95 give ~90% coverage.

export interface TempDelta { p5: number; p95: number; }

export const DELTA_BY_SUBTYPE_ATMOSPHERE: { [key: string]: TempDelta } = {
  'High metal content world|Thin Carbon dioxide': { p5: -50.07, p95: 79.65 },
  'High metal content world|Thin Ammonia': { p5: -44.46, p95: 67.94 },
  'High metal content world|Thin Sulphur dioxide': { p5: -43.64, p95: 115.86 },
  'High metal content world|Thin Water': { p5: -152.46, p95: 144.51 },
  'High metal content world|Thin Nitrogen': { p5: -18.69, p95: 52.82 },
  'High metal content world|Thin Carbon dioxide-rich': { p5: -36.25, p95: 90.03 },
  'High metal content world|Thin Oxygen': { p5: -45.88, p95: 84.50 },
  'High metal content world|Thin Argon': { p5: -9.58, p95: 49.60 },
  'High metal content world|Thin Methane': { p5: 3.64, p95: 34.13 },
  'High metal content world|Hot thin Carbon dioxide': { p5: -176.98, p95: 244.73 },
  'High metal content world|Thin Helium': { p5: -13.49, p95: 14.96 },
  'High metal content world|Thin Methane-rich': { p5: 12.77, p95: 47.72 },
  'High metal content world|Thin Argon-rich': { p5: 5.91, p95: 87.40 },
  'High metal content world|No atmosphere': { p5: -125.65, p95: 368.60 },
  'Icy body|Thin Argon': { p5: -19.20, p95: 35.26 },
  'Icy body|Thin Methane': { p5: -17.40, p95: 39.76 },
  'Icy body|Thin Neon': { p5: -8.43, p95: 18.89 },
  'Icy body|Thin Nitrogen': { p5: -14.92, p95: 30.84 },
  'Icy body|Thin Argon-rich': { p5: -22.44, p95: 34.79 },
  'Icy body|Thin Sulphur dioxide': { p5: -50.63, p95: 78.29 },
  'Icy body|Thin Neon-rich': { p5: -16.29, p95: 25.94 },
  'Icy body|Thin Oxygen': { p5: -42.40, p95: 70.10 },
  'Icy body|Thin Helium': { p5: -1.38, p95: 5.60 },
  'Icy body|Thin Ammonia': { p5: -31.87, p95: 66.39 },
  'Metal-rich body|nan': { p5: -415.76, p95: 3363.08 },
  'Rocky Ice world|Thin Argon': { p5: -15.69, p95: 39.13 },
  'Rocky Ice world|Thin Nitrogen': { p5: -3.62, p95: 30.87 },
  'Rocky Ice world|Thin Sulphur dioxide': { p5: -8.59, p95: 84.55 },
  'Rocky Ice world|Thin Methane': { p5: -11.11, p95: 39.60 },
  'Rocky Ice world|Thin Oxygen': { p5: -4.68, p95: 77.49 },
  'Rocky Ice world|Thin Neon': { p5: -5.22, p95: 21.96 },
  'Rocky Ice world|Thin Argon-rich': { p5: 0.04, p95: 28.52 },
  'Rocky Ice world|Thin Ammonia': { p5: -50.90, p95: 67.13 },
  'Rocky Ice world|Thin Neon-rich': { p5: -19.28, p95: 17.91 },
  'Rocky Ice world|Thin Water-rich': { p5: 37.00, p95: 117.19 },
  'Rocky body|Thin Carbon dioxide': { p5: -43.91, p95: 66.45 },
  'Rocky body|Thin Ammonia': { p5: -43.06, p95: 64.20 },
  'Rocky body|Thin Water': { p5: -142.39, p95: 170.16 },
  'Rocky body|Thin Sulphur dioxide': { p5: -51.51, p95: 113.72 },
  'Rocky body|Thin Methane': { p5: -29.34, p95: 38.53 },
  'Rocky body|Thin Nitrogen': { p5: -17.54, p95: 43.52 },
  'Rocky body|Thin Oxygen': { p5: -68.40, p95: 94.47 },
  'Rocky body|Thin Carbon dioxide-rich': { p5: -24.32, p95: 93.52 },
  'Rocky body|Thin Argon': { p5: -22.75, p95: 50.47 },
  'Rocky body|Hot thin Carbon dioxide': { p5: -189.00, p95: 291.56 },
  'Rocky body|No atmosphere': { p5: -89.76, p95: 75.56 },
  'High metal content world|nan': { p5: -152.96, p95: 317.71 },
  'Icy body|nan': { p5: -43.46, p95: 77.88 },
  'Rocky Ice world|nan': { p5: -43.82, p95: 74.45 },
  'Rocky body|nan': { p5: -119.56, p95: 126.05 },
};

export const DELTA_BY_SUBTYPE_NO_ATM: { [key: string]: TempDelta } = {
  'High metal content world': { p5: -152.96, p95: 317.71 },
  'Icy body': { p5: -43.46, p95: 77.88 },
  'Metal-rich body': { p5: -415.76, p95: 3363.08 },
  'Rocky Ice world': { p5: -43.82, p95: 74.45 },
  'Rocky body': { p5: -119.56, p95: 126.05 },
};

export const DELTA_BY_SUBTYPE: { [key: string]: TempDelta } = {
  'High metal content world': { p5: -52.88, p95: 101.05 },
  'Icy body': { p5: -17.45, p95: 37.97 },
  'Metal-rich body': { p5: -415.14, p95: 3234.31 },
  'Rocky Ice world': { p5: -15.23, p95: 47.49 },
  'Rocky body': { p5: -60.29, p95: 105.96 },
};

export const DELTA_BY_ATMOSPHERE: { [key: string]: TempDelta } = {
  'Thin Carbon dioxide': { p5: -45.83, p95: 71.08 },
  'Thin Ammonia': { p5: -43.71, p95: 66.15 },
  'Thin Argon': { p5: -18.77, p95: 36.70 },
  'Thin Sulphur dioxide': { p5: -45.59, p95: 114.53 },
  'Thin Water': { p5: -144.12, p95: 168.18 },
  'Thin Methane': { p5: -22.91, p95: 39.64 },
  'Thin Nitrogen': { p5: -15.01, p95: 36.66 },
  'Thin Neon': { p5: -8.40, p95: 18.96 },
  'Thin Oxygen': { p5: -42.19, p95: 74.61 },
  'Thin Argon-rich': { p5: -22.08, p95: 35.03 },
  'Thin Neon-rich': { p5: -17.27, p95: 25.88 },
  'Thin Carbon dioxide-rich': { p5: -36.34, p95: 90.70 },
  'Thin Helium': { p5: -3.20, p95: 6.03 },
  'Thin Methane-rich': { p5: 9.31, p95: 45.49 },
  'Thin Water-rich': { p5: 7.82, p95: 116.54 },
  'Hot thin Carbon dioxide': { p5: -188.96, p95: 266.37 },
  'No atmosphere': { p5: -105.74, p95: 352.35 },
};

export const DELTA_BY_PRESSURE: { [key: string]: TempDelta } = {
  'None': { p5: -149.60, p95: 343.44 },
  'Trace': { p5: -37.56, p95: 73.00 },
  'Thin': { p5: -66.95, p95: 113.94 },
};

export const DELTA_GLOBAL: TempDelta = { p5: -51.0, p95: 98.5 };

/** A resolved temperature delta together with a human-readable description of the rule that produced it. */
export interface TempDeltaLookup {
  delta: TempDelta;
  source: string;
}

/** Coarse pressure class ("None"/"Trace"/"Thin") for a surface pressure, or null. */
function pressureClass(surfacePressure: number | null | undefined): string | null {
  if (surfacePressure == null) return null;
  if (surfacePressure === 0) return 'None';
  if (surfacePressure < 0.01) return 'Trace';
  if (surfacePressure < 0.1) return 'Thin';
  return null;
}

/**
 * Single source of truth for the temperature-delta lookup priority: most specific
 * (subtype+atmosphere) down to the global fallback. `estimateTempRange`, the badge
 * colouring and the on-foot dialog all derive from this so they can never disagree.
 */
export function lookupTempDelta(
  subType: string | null | undefined,
  atmosphereType: string | null | undefined,
  surfacePressure: number | null | undefined,
): TempDeltaLookup {
  const st = subType?.trim() || null;
  const at = atmosphereType?.trim() || null;

  // 1. (subType, atmosphereType) combined — most specific
  if (st && at) {
    const row = DELTA_BY_SUBTYPE_ATMOSPHERE[`${st}|${at}`];
    if (row) return { delta: row, source: `SubType + Atmosphere (${st} / ${at})` };
  }

  // 2. No-atmosphere: subType + confirmed zero pressure (or sentinel "nan")
  const noAtm = (surfacePressure != null && surfacePressure === 0) || at === 'nan';
  if (noAtm && st) {
    const row = DELTA_BY_SUBTYPE_NO_ATM[st];
    if (row) return { delta: row, source: `SubType + No Atmosphere (${st})` };
  }

  // 3. subType alone
  if (st) {
    const row = DELTA_BY_SUBTYPE[st];
    if (row) return { delta: row, source: `SubType (${st})` };
  }

  // 4. atmosphereType
  if (at) {
    const row = DELTA_BY_ATMOSPHERE[at];
    if (row) return { delta: row, source: `Atmosphere type (${at})` };
  }

  // 5. Pressure-class coarse fallback
  const pc = pressureClass(surfacePressure);
  if (pc) {
    const row = DELTA_BY_PRESSURE[pc];
    if (row) return { delta: row, source: `Pressure class (${pc})` };
  }

  // 6. Global fallback
  return { delta: DELTA_GLOBAL, source: 'Global fallback' };
}

export function estimateTempRange(
  surfaceTemp: number,
  subType: string | null | undefined,
  atmosphereType: string | null | undefined,
  surfacePressure: number | null | undefined,
): { min: number; max: number } {
  const { delta } = lookupTempDelta(subType, atmosphereType, surfacePressure);
  return { min: surfaceTemp + delta.p5, max: surfaceTemp + delta.p95 };
}

export function isTempSafe(temp: number): boolean {
  return temp >= 182 && temp < 700;
}
