/**
 * Unit-conversion tables, the dialog row builder, and the dynamic-by-magnitude inline
 * formatters used across the body/star property displays. Pure functions with no Angular
 * or DI dependency (mirrors the stateless reference modules such as `white-dwarf.ts` and
 * `temperature-estimation.ts`) so the conversion maths is trivially testable and shared
 * between the inline displays and the unit-conversion dialog.
 */

// --- Length (base: km) ---
export const KM_PER_AU = 149597870.7;
export const KM_PER_SOLAR_RADIUS = 695700;
export const KM_PER_LIGHT_SECOND = 299792.458; // speed of light (m/s) / 1000
export const KM_PER_LIGHT_YEAR = 9.4607304725808e12; // KM_PER_LIGHT_SECOND × 86400 × 365.25
export const M_PER_KM = 1000;

// --- Duration (base: days) ---
export const MINUTES_PER_DAY = 1440;
export const HOURS_PER_DAY = 24;
export const WEEKS_PER_DAY = 1 / 7;
export const DAYS_PER_YEAR = 365.25;

// --- Mass (base: kg) ---
export const KG_PER_EARTH_MASS = 5.972e24;
export const KG_PER_SOLAR_MASS = 1.989e30;
// Elite's body/ring "megatonne" field is 1e12 kg (a teragram). Kept consistent with the
// existing physics maths (density, Roche limits) rather than the SI 1e9 kg megatonne, so
// the "Megatonnes" conversion cross-references the rendered ring mass exactly.
export const KG_PER_MEGATONNE = 1e12;

// --- Velocity (base: km/s) ---
export const SPEED_OF_LIGHT_KM_S = 299792.458;

// --- Pressure (base: atm) ---
export const KPA_PER_ATM = 101.325;
export const PA_PER_ATM = 101325;
export const PSI_PER_ATM = 14.6959488;

// 1 Mt/cm³ = 1e12 kg ÷ 1e-6 m³ = 1e18 kg/m³ (uses the teragram megatonne above).
const KG_M3_PER_MT_CM3 = 1e18;
// km² in one square light-second.
const KM2_PER_LS2 = KM_PER_LIGHT_SECOND * KM_PER_LIGHT_SECOND;

/** The kinds of quantity a value can be converted between, each with a fixed base unit. */
export type QuantityKind = 'length' | 'duration' | 'mass' | 'velocity' | 'density' | 'area' | 'pressure';

/** One scale-unit row shown in the conversion dialog. */
export interface ConversionRow {
  /** Unit label (e.g. "AU", "Light seconds"). */
  unit: string;
  /** Readable, rounded value for display. */
  display: string;
  /** Full-precision plain numeric value for copying to the clipboard. */
  copyText: string;
}

/**
 * The scale units for each quantity kind, listed largest-unit-first (descending by unit
 * magnitude, so the value at the top is the smallest count), with the multiplier that
 * turns the kind's base value into that unit. The order is declared here, not sorted at
 * runtime. Density and area factors are derived from the named constants above.
 */
const CONVERSIONS: Record<QuantityKind, { unit: string; factor: number }[]> = {
  length: [
    { unit: 'Light Years', factor: 1 / KM_PER_LIGHT_YEAR },
    { unit: 'AU', factor: 1 / KM_PER_AU },
    { unit: 'Solar Radii', factor: 1 / KM_PER_SOLAR_RADIUS },
    { unit: 'Light seconds', factor: 1 / KM_PER_LIGHT_SECOND },
    { unit: 'km', factor: 1 },
    { unit: 'm', factor: M_PER_KM },
  ],
  duration: [
    { unit: 'Years', factor: 1 / DAYS_PER_YEAR },
    { unit: 'Weeks', factor: WEEKS_PER_DAY },
    { unit: 'Days', factor: 1 },
    { unit: 'Hours', factor: HOURS_PER_DAY },
    { unit: 'Minutes', factor: MINUTES_PER_DAY },
  ],
  mass: [
    { unit: 'Solar Masses', factor: 1 / KG_PER_SOLAR_MASS },
    { unit: 'Earth Masses', factor: 1 / KG_PER_EARTH_MASS },
    { unit: 'Megatonnes', factor: 1 / KG_PER_MEGATONNE },
  ],
  velocity: [
    { unit: 'c (fraction of light)', factor: 1 / SPEED_OF_LIGHT_KM_S },
    { unit: 'km/s', factor: 1 },
  ],
  density: [
    { unit: 'Mt/cm³', factor: 1 / KG_M3_PER_MT_CM3 },
    { unit: 'g/cm³', factor: 1 / 1000 },
    { unit: 'kg/m³', factor: 1 },
  ],
  area: [
    { unit: 'Ls²', factor: 1 / KM2_PER_LS2 },
    { unit: 'km²', factor: 1 },
  ],
  pressure: [
    { unit: 'atm', factor: 1 },
    { unit: 'psi', factor: PSI_PER_ATM },
    { unit: 'kPa', factor: KPA_PER_ATM },
    { unit: 'Pa', factor: PA_PER_ATM },
  ],
};

/** Readable number: grouped with ≤4 fraction digits for ordinary magnitudes, exponential for extremes. */
function formatDisplayNumber(value: number): string {
  if (!Number.isFinite(value)) { return '—'; }
  const abs = Math.abs(value);
  if (abs !== 0 && (abs < 1e-4 || abs >= 1e15)) {
    return value.toExponential(4);
  }
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

/** Plain numeric value for pasting: ~12 significant figures, trailing zeros dropped. */
function formatCopyNumber(value: number): string {
  if (!Number.isFinite(value)) { return ''; }
  if (value === 0) { return '0'; }
  return Number(value.toPrecision(12)).toString();
}

/** Builds the full set of scale-unit rows for a base value of the given kind. */
export function buildConversions(kind: QuantityKind, baseValue: number): ConversionRow[] {
  return CONVERSIONS[kind].map(({ unit, factor }) => {
    const value = baseValue * factor;
    return { unit, display: formatDisplayNumber(value), copyText: formatCopyNumber(value) };
  });
}

/** A light-hearted "this mass is roughly N of these" scale comparison. */
export interface MassComparison {
  /** Plural object name (e.g. "African bush elephants"). */
  label: string;
  /** Formatted count, e.g. "≈ 1.7460e+18". */
  display: string;
}

// Approximate masses (kg) of familiar objects, for the "just for fun" comparisons. Body
// and ring masses are astronomically large, so these counts are intentionally absurd.
const MASS_REFERENCES: { label: string; kg: number }[] = [
  { label: 'African bush elephants', kg: 6.0e3 },
  { label: 'blue whales', kg: 1.5e5 },
  { label: 'large cruise ships', kg: 1.0e8 },
  { label: 'Great Pyramids of Giza', kg: 5.9e9 },
];

/** Builds the silly everyday-object mass comparisons for a mass given in kilograms. */
export function buildMassComparisons(kg: number): MassComparison[] {
  if (!Number.isFinite(kg) || kg <= 0) { return []; }
  return MASS_REFERENCES.map(ref => ({
    label: ref.label,
    display: `≈ ${formatDisplayNumber(kg / ref.kg)}`,
  }));
}

/** Two-decimal grouped number, matching the existing `| number:'0.2-2'` inline style. */
function fixed2(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Inline length display (km base), choosing m / km / ls / ly by magnitude. Thresholds are
 * sensible defaults tuned for in-system distances; AU is intentionally skipped inline (it
 * is available in the conversion dialog) per the requested km-first display.
 */
export function formatDynamicLength(km: number): string {
  if (!Number.isFinite(km)) { return '—'; }
  return formatLengthInUnit(km, pickInlineLengthUnit(km));
}

/** An inline length unit: abbreviation shown inline, matching dialog-row label, and km multiplier. */
export interface InlineLengthUnit {
  /** Inline abbreviation (e.g. "km", "ls"). */
  unit: string;
  /** Matching conversion-dialog row label (e.g. "Light seconds"). */
  label: string;
  /** Multiplier turning a km value into this unit. */
  perKm: number;
}

/**
 * Picks the inline length unit (m / km / ls / ly) suiting a representative magnitude, using
 * the same thresholds as {@link formatDynamicLength}. AU is intentionally skipped inline.
 * Exposed so a group of related lengths (e.g. semi-major axis, apoapsis, periapsis) can be
 * shown in one shared unit chosen from the group's representative value.
 */
export function pickInlineLengthUnit(km: number): InlineLengthUnit {
  const abs = Math.abs(km);
  if (!Number.isFinite(km) || abs === 0) { return { unit: 'km', label: 'km', perKm: 1 }; }
  if (abs < 1) { return { unit: 'm', label: 'm', perKm: M_PER_KM }; }
  if (abs < 1e6) { return { unit: 'km', label: 'km', perKm: 1 }; }
  if (abs < 0.1 * KM_PER_LIGHT_YEAR) { return { unit: 'ls', label: 'Light seconds', perKm: 1 / KM_PER_LIGHT_SECOND }; }
  return { unit: 'ly', label: 'Light Years', perKm: 1 / KM_PER_LIGHT_YEAR };
}

/** Formats a km value in a pre-chosen length unit (for a group sharing one unit). */
export function formatLengthInUnit(km: number, choice: InlineLengthUnit): string {
  if (!Number.isFinite(km)) { return '—'; }
  return `${fixed2(km * choice.perKm)} ${choice.unit}`;
}

/** Dialog-row label for the inline length unit chosen at this magnitude. */
export function dynamicLengthUnitLabel(km: number): string {
  return Number.isFinite(km) ? pickInlineLengthUnit(km).label : '';
}

/** Dialog-row label for the inline distance-to-arrival unit chosen at this magnitude (km base). */
export function dynamicDistanceUnitLabel(km: number): string {
  if (!Number.isFinite(km)) { return ''; }
  return Math.abs(km) < 0.1 * KM_PER_LIGHT_YEAR ? 'Light seconds' : 'Light Years';
}

/**
 * Inline distance-to-arrival display (light-second base), staying in light-seconds — down
 * to fractions — and switching to light-years only for Hutton-Orbital-scale spans.
 */
export function formatDynamicDistanceLs(ls: number): string {
  if (!Number.isFinite(ls)) { return '—'; }
  const lyThresholdLs = (0.1 * KM_PER_LIGHT_YEAR) / KM_PER_LIGHT_SECOND; // 0.1 ly in ls
  if (Math.abs(ls) < lyThresholdLs) { return `${fixed2(ls)} ls`; }
  return `${fixed2((ls * KM_PER_LIGHT_SECOND) / KM_PER_LIGHT_YEAR)} ly`;
}

/** Inline mass unit: abbreviation shown inline, matching dialog-row label, and kg multiplier. */
interface InlineMassUnit { unit: string; label: string; perKg: number; }

/**
 * Picks the inline mass unit (Mt / Earth masses / Solar masses) by magnitude, so a small
 * ring reads in Earth masses rather than a huge Mt count. Single source for both the inline
 * display ({@link formatDynamicMass}) and the dialog accent label ({@link dynamicMassUnitLabel}).
 */
function pickInlineMassUnit(kg: number): InlineMassUnit {
  const abs = Math.abs(kg);
  if (abs < 1e-3 * KG_PER_EARTH_MASS) { return { unit: 'Mt', label: 'Megatonnes', perKg: 1 / KG_PER_MEGATONNE }; }
  if (abs < 0.1 * KG_PER_SOLAR_MASS) { return { unit: 'Earth masses', label: 'Earth Masses', perKg: 1 / KG_PER_EARTH_MASS }; }
  return { unit: 'Solar masses', label: 'Solar Masses', perKg: 1 / KG_PER_SOLAR_MASS };
}

/** Inline mass display (kg base). */
export function formatDynamicMass(kg: number): string {
  if (!Number.isFinite(kg)) { return '—'; }
  const u = pickInlineMassUnit(kg);
  return `${fixed2(kg * u.perKg)} ${u.unit}`;
}

/** Dialog-row label for the inline mass unit chosen at this magnitude. */
export function dynamicMassUnitLabel(kg: number): string {
  return Number.isFinite(kg) ? pickInlineMassUnit(kg).label : '';
}

/** Inline area unit: abbreviation shown inline, matching dialog-row label, and km² multiplier. */
interface InlineAreaUnit { unit: string; label: string; perKm2: number; }

/** Picks the inline area unit (km² / ls²) by magnitude. Single source for display and label. */
function pickInlineAreaUnit(km2: number): InlineAreaUnit {
  if (Math.abs(km2) < KM2_PER_LS2) { return { unit: 'km²', label: 'km²', perKm2: 1 }; }
  return { unit: 'ls²', label: 'Ls²', perKm2: 1 / KM2_PER_LS2 };
}

/** Inline area display (km² base). */
export function formatDynamicArea(km2: number): string {
  if (!Number.isFinite(km2)) { return '—'; }
  const u = pickInlineAreaUnit(km2);
  return `${fixed2(km2 * u.perKm2)} ${u.unit}`;
}

/** Dialog-row label for the inline area unit chosen at this magnitude. */
export function dynamicAreaUnitLabel(km2: number): string {
  return Number.isFinite(km2) ? pickInlineAreaUnit(km2).label : '';
}
