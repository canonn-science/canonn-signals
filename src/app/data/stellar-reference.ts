/**
 * Main-sequence stellar reference data and pure helpers for judging whether a star's
 * age is plausible for where it sits on the Hertzsprung–Russell diagram.
 *
 * Elite Dangerous generates stars procedurally and sometimes assigns an `age` that is
 * implausible for the star's spectral / luminosity class (a hot O- or B-type star that
 * is several Gyr old, for instance, when such stars burn out in a few million years).
 * These helpers turn the raw stellar fields into a simple assessment the UI can show.
 *
 * IMPORTANT — these are order-of-magnitude astrophysics approximations, not exact ages.
 * The main-sequence lifetime uses the standard t_MS ≈ 10 Gyr · (M/M☉)^−2.5 relation, and
 * the per-class temperature / mass / lifetime ranges are textbook figures. The feature
 * flags *implausibility*, never an exact true age — wording stays "expected"/"typical".
 */

/** Reference figures for one main-sequence spectral class (luminosity V). */
export interface SpectralClassData {
  /** Effective-temperature range in Kelvin, [min, max]. */
  tempRange: [number, number];
  /** Stellar-mass range in solar masses, [min, max]. */
  massRange: [number, number];
  /** Representative effective temperature (K) used to place the class on the H-R band. */
  bandTemp: number;
  /** Representative V-band absolute magnitude used for the H-R main-sequence band. */
  absMagApprox: number;
  /** Approximate main-sequence lifetime range in millions of years, [min, max]. */
  msLifetimeRange: [number, number];
  /** True for substellar brown dwarfs (L/T/Y) that never sustain hydrogen fusion. */
  brownDwarf?: boolean;
}

/**
 * Per-class reference data. Temperatures/masses are standard main-sequence figures;
 * lifetime ranges are order-of-magnitude (M-dwarf upper bound exceeds the age of the
 * universe many times over and is capped at a representative large value).
 */
export const SPECTRAL_CLASS_REFERENCE: { [letter: string]: SpectralClassData } = {
  // letter   tempRange (K)      massRange (M☉)   bandTemp  absMag   msLifetime (Myr)
  O: { tempRange: [30000, 50000], massRange: [16, 90],     bandTemp: 38000, absMagApprox: -5,   msLifetimeRange: [1, 10] },
  B: { tempRange: [10000, 30000], massRange: [2.1, 16],    bandTemp: 20000, absMagApprox: -1,   msLifetimeRange: [10, 400] },
  A: { tempRange: [7500, 10000],  massRange: [1.4, 2.1],   bandTemp: 8700,  absMagApprox: 1.5,  msLifetimeRange: [400, 3000] },
  F: { tempRange: [6000, 7500],   massRange: [1.04, 1.4],  bandTemp: 6700,  absMagApprox: 3,    msLifetimeRange: [3000, 7000] },
  G: { tempRange: [5200, 6000],   massRange: [0.8, 1.04],  bandTemp: 5600,  absMagApprox: 4.7,  msLifetimeRange: [7000, 15000] },
  K: { tempRange: [3700, 5200],   massRange: [0.45, 0.8],  bandTemp: 4400,  absMagApprox: 7,    msLifetimeRange: [15000, 70000] },
  M: { tempRange: [2400, 3700],   massRange: [0.08, 0.45], bandTemp: 3000,  absMagApprox: 12,   msLifetimeRange: [70000, 10000000] },
  // Brown dwarfs — substellar, no sustained fusion; included so they can still be placed.
  L: { tempRange: [1300, 2400],   massRange: [0.013, 0.08], bandTemp: 1850, absMagApprox: 15.5, msLifetimeRange: [0, 0], brownDwarf: true },
  T: { tempRange: [600, 1300],    massRange: [0.013, 0.08], bandTemp: 1000, absMagApprox: 17,   msLifetimeRange: [0, 0], brownDwarf: true },
  Y: { tempRange: [250, 600],     massRange: [0.005, 0.013], bandTemp: 450, absMagApprox: 19,   msLifetimeRange: [0, 0], brownDwarf: true },
};

/** Main-sequence classes in order from hottest to coolest (used for the H-R band). */
export const MAIN_SEQUENCE_ORDER = ['O', 'B', 'A', 'F', 'G', 'K', 'M'] as const;

/**
 * Spectrum colours for each spectral class, used to tint the H-R diagram's main-sequence
 * band, the luminosity-region clouds and the star marker. They follow the real stellar
 * colour sequence — blue (O) → blue-white (B) → white (A/F) → yellow (G) → orange (K) →
 * red (M) — punched up in saturation so the bands read clearly against the dark background.
 * There is deliberately no green: stars never appear green, so blue runs straight into
 * white. The L/T/Y brown dwarfs trail off into magenta/purple by convention.
 */
export const SPECTRAL_COLORS: { [letter: string]: string } = {
  O: '#3d5fff',
  B: '#7aa0ff',
  A: '#e9eeff',
  F: '#fef8e7',
  G: '#ffdc4a',
  K: '#ff9a3c',
  M: '#ff4e35',
  L: '#d62a5a',
  T: '#a83bb0',
  Y: '#7a3bc0',
};

/**
 * The star's class letter from its `spectralClass`, falling back to the `subType` label
 * (e.g. `"B (Blue-White) Star"` → `"B"`) because Elite Dangerous frequently omits
 * `spectralClass` even for ordinary stars. Returns null when no class can be determined
 * (neutron stars, black holes, "White Dwarf (…)", "Wolf-Rayet …", carbon stars, etc.).
 */
export function starClassLetter(
  spectralClass: string | null | undefined,
  subType?: string | null,
): string | null {
  const direct = spectralLetter(spectralClass);
  if (direct) { return direct; }
  const m = subType?.match(/^([OBAFGKMLTY]) \(/);
  return m ? m[1] : null;
}

/**
 * True for a white dwarf, detected from a `White Dwarf (…)` subType or a `D…` spectral
 * class (DA, DB, DQ, …). No ordinary stellar / brown-dwarf class begins with `D`, so the
 * spectral-class prefix is an unambiguous signal when the subType is absent.
 */
export function isWhiteDwarf(
  spectralClass: string | null | undefined,
  subType?: string | null,
): boolean {
  if (subType?.startsWith('White Dwarf')) { return true; }
  return /^D/i.test(spectralClass?.trim() ?? '');
}

/**
 * True when the star's class is one the H-R diagram actually depicts — the main sequence
 * O–M (and giants/subgiants of those classes) plus white dwarfs (their own region cloud).
 * Excludes brown dwarfs (L/T/Y), Wolf-Rayet, carbon stars, neutron stars and black holes,
 * none of which the diagram draws.
 */
export function isPlottableStarClass(
  spectralClass: string | null | undefined,
  subType?: string | null,
): boolean {
  if (isWhiteDwarf(spectralClass, subType)) { return true; }
  const letter = starClassLetter(spectralClass, subType);
  return letter != null && (MAIN_SEQUENCE_ORDER as readonly string[]).includes(letter);
}

/** The colour for a star's spectral class, or null when the class is unknown. */
export function spectralColor(
  spectralClass: string | null | undefined,
  subType?: string | null,
): string | null {
  const letter = starClassLetter(spectralClass, subType);
  return letter ? (SPECTRAL_COLORS[letter] ?? null) : null;
}

/** How far past the expected lifetime an age must fall before it's called anomalous. */
const TOLERANCE = 1.25;

/**
 * How many main-sequence lifetimes old an evolved star may be before its age is
 * implausible. Post-main-sequence phases are short (~10% of the MS lifetime), so a giant
 * more than ~2× its MS lifetime old cannot exist for that class — generous enough to avoid
 * false positives while still catching wildly inconsistent ages.
 */
const GIANT_MAX_FACTOR = 2;

/** Extracts the leading spectral letter from a class string (`"K5"` → `"K"`); null-safe. */
export function spectralLetter(spectralClass: string | null | undefined): string | null {
  if (!spectralClass) { return null; }
  const m = spectralClass.trim().match(/^([OBAFGKMLTY])/i);
  return m ? m[1].toUpperCase() : null;
}

/** Extracts the Roman-numeral luminosity class (`"Va"` → `"V"`, `"VII"` → `"VII"`); null-safe. */
export function luminosityClass(luminosity: string | null | undefined): string | null {
  if (!luminosity) { return null; }
  const m = luminosity.trim().match(/^([IVX]+)/i);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Estimated main-sequence lifetime in millions of years for a star of `solarMasses`.
 * Uses the standard scaling t_MS ≈ 10 Gyr · (M/M☉)^−2.5 (the Sun, M = 1, gives ~10 Gyr).
 * Returns null for a non-positive / non-finite mass.
 */
export function mainSequenceLifetimeMyr(solarMasses: number | null | undefined): number | null {
  if (solarMasses == null || !Number.isFinite(solarMasses) || solarMasses <= 0) { return null; }
  return 10000 * Math.pow(solarMasses, -2.5);
}

/** Solar effective temperature (K) and bolometric absolute magnitude, for the relation below. */
const SOLAR_TEFF_K = 5772;
const SOLAR_ABS_MAG_BOL = 4.74;

/**
 * Absolute (bolometric) magnitude from a star's radius and effective temperature, via the
 * Stefan–Boltzmann luminosity L/L☉ = (R/R☉)² · (T/T☉)⁴ and M = M☉ − 2.5·log10(L/L☉).
 * Used to place bodies that lack a reported absolute magnitude — notably white dwarfs,
 * which carry a radius and temperature but no magnitude. Returns null for non-positive /
 * non-finite inputs. Order-of-magnitude only: it mixes bolometric with the diagram's
 * roughly-V-band band, which is acceptable for this schematic.
 */
export function absoluteMagnitudeFromRadiusTemp(
  solarRadius: number | null | undefined,
  tempK: number | null | undefined,
): number | null {
  if (solarRadius == null || !Number.isFinite(solarRadius) || solarRadius <= 0) { return null; }
  if (tempK == null || !Number.isFinite(tempK) || tempK <= 0) { return null; }
  const luminosity = solarRadius * solarRadius * Math.pow(tempK / SOLAR_TEFF_K, 4);
  return SOLAR_ABS_MAG_BOL - 2.5 * Math.log10(luminosity);
}

/**
 * Human-readable age / lifetime in the same "N million years" unit the body detail screen
 * uses for a star's age, so every age and lifetime figure across the UI reads in one unit.
 * Rounds to a whole million years and groups thousands, e.g. `2,920 million years`.
 */
export function formatMillionYears(myr: number): string {
  if (!Number.isFinite(myr)) { return '—'; }
  return `${Math.round(myr).toLocaleString('en-US')} million years`;
}

export type AgeStatus = 'old' | 'young' | 'typical' | 'evolved' | 'unknown';

export interface StellarAgeInput {
  spectralClass?: string | null;
  /** Body subType label, used to recover the class letter when spectralClass is absent. */
  subType?: string | null;
  luminosity?: string | null;
  solarMasses?: number | null;
  ageMyr?: number | null;
}

export interface StellarAgeAssessment {
  status: AgeStatus;
  ageMyr: number | null;
  /** Lower bound an evolved star's age is compared against (its main-sequence lifetime). */
  expectedMinMyr: number | null;
  /** Upper bound a main-sequence star's age is compared against (its lifetime). */
  expectedMaxMyr: number | null;
  /** Full-scale value of the inline age bar, or null when no bar should be drawn. */
  barMaxMyr: number | null;
  /** Marker position along the bar, 0..1, or null when no bar should be drawn. */
  barFraction: number | null;
  /** True when the age falls outside the plausible range (drives the warning styling). */
  outOfRange: boolean;
  /** Short badge label, e.g. `old for class`; empty when not anomalous. */
  label: string;
  /** One-sentence explanation suitable for a tooltip / dialog. */
  message: string;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/**
 * Judges a star's age against what its spectral / luminosity class implies.
 *
 * - Main-sequence stars (luminosity V, or unknown class): the plausible range is
 *   0 → main-sequence lifetime; an age beyond that means the star should already have
 *   evolved off the main sequence ⇒ `old`.
 * - Giants / subgiants / supergiants (luminosity I–IV): the star must have completed its
 *   main-sequence phase before reaching this stage, so its age should be at least the
 *   main-sequence lifetime implied by its mass; younger than that ⇒ `young`, otherwise
 *   `evolved`. This uses the *current* mass as a proxy for the progenitor mass. That holds
 *   well for low-mass red giants (III/IV lose little mass before the giant phase) but is
 *   only approximate for massive supergiants (I/II), which shed a real fraction of their
 *   mass to stellar winds — so for them the bound is an order-of-magnitude floor, not exact.
 * - White dwarfs (VII) and bare remnants carry a post-collapse mass unrelated to the
 *   progenitor, so a lifetime comparison would be meaningless ⇒ `evolved` (informational).
 */
export function assessStellarAge(input: StellarAgeInput): StellarAgeAssessment {
  const letter = starClassLetter(input.spectralClass, input.subType);
  const ref = letter ? SPECTRAL_CLASS_REFERENCE[letter] : undefined;
  const lumClass = luminosityClass(input.luminosity);
  const ageMyr = input.ageMyr;

  const base: StellarAgeAssessment = {
    status: 'unknown', ageMyr: null, expectedMinMyr: null, expectedMaxMyr: null,
    barMaxMyr: null, barFraction: null, outOfRange: false, label: '', message: '',
  };

  if (ageMyr == null || !Number.isFinite(ageMyr)) {
    return { ...base, message: 'Age is unavailable, so it cannot be compared to its class.' };
  }
  base.ageMyr = ageMyr;

  const mass = input.solarMasses;
  const massLifetime = mainSequenceLifetimeMyr(mass);

  // Brown dwarfs are substellar — they never join the hydrogen-burning main sequence,
  // so a main-sequence lifetime comparison is meaningless (and their tabulated lifetime
  // is zero, which would otherwise misflag them or divide by zero).
  if (ref?.brownDwarf) {
    return { ...base, status: 'evolved', message: 'A substellar brown dwarf — it never joins the hydrogen-burning main sequence, so a main-sequence age comparison does not apply.' };
  }

  // White dwarfs and bare remnants: post-collapse mass ≠ progenitor mass, so skip the
  // lifetime comparison entirely and just note the star is an evolved end state.
  if (lumClass === 'VII' || (!letter && !lumClass)) {
    return { ...base, status: 'evolved', message: 'A stellar remnant — its present mass is unrelated to its progenitor, so a main-sequence age comparison does not apply.' };
  }

  const isGiant = lumClass === 'I' || lumClass === 'II' || lumClass === 'III' || lumClass === 'IV';

  if (isGiant) {
    const expectedMin = massLifetime ?? (ref ? ref.msLifetimeRange[0] : null);
    const classLabel = letter ? letter + '-type ' : '';
    if (expectedMin != null && expectedMin > 0) {
      const barFraction = clamp01(ageMyr / expectedMin);
      if (ageMyr < expectedMin / TOLERANCE) {
        return {
          ...base, status: 'young', expectedMinMyr: expectedMin,
          barMaxMyr: expectedMin, barFraction, outOfRange: true,
          label: 'young for class',
          message: `Younger than expected: an evolved ${classLabel}star should be at least its main-sequence lifetime (~${formatMillionYears(expectedMin)}) old before reaching this stage.`,
        };
      }
      if (ageMyr > expectedMin * GIANT_MAX_FACTOR) {
        return {
          ...base, status: 'old', expectedMinMyr: expectedMin,
          barMaxMyr: expectedMin, barFraction: 1, outOfRange: true,
          label: 'old for class',
          message: `Older than even an evolved ${classLabel}star should be (~${formatMillionYears(expectedMin)} main-sequence lifetime); its age is implausible for this class.`,
        };
      }
      return {
        ...base, status: 'evolved', expectedMinMyr: expectedMin,
        barMaxMyr: expectedMin, barFraction, outOfRange: false,
        message: `An evolved ${classLabel}star at or past its ~${formatMillionYears(expectedMin)} main-sequence lifetime; its age is consistent with that stage.`,
      };
    }
    return { ...base, status: 'evolved', message: 'An evolved star that has left the main sequence; its age is consistent with that stage.' };
  }

  // Main sequence (luminosity V, subdwarf VI, or unknown luminosity with a known class).
  const expectedMax = massLifetime ?? (ref ? ref.msLifetimeRange[1] : null);
  if (expectedMax == null || expectedMax <= 0) {
    return { ...base, message: 'Insufficient data to compare its age to its class.' };
  }

  if (ageMyr > expectedMax * TOLERANCE) {
    return {
      ...base, status: 'old', expectedMaxMyr: expectedMax,
      barMaxMyr: expectedMax, barFraction: 1, outOfRange: true,
      label: 'old for class',
      message: `Older than a ${letter ?? 'main-sequence'}-class star should be (~${formatMillionYears(expectedMax)} main-sequence lifetime); it should already have left the main sequence.`,
    };
  }

  return {
    ...base, status: 'typical', expectedMaxMyr: expectedMax,
    barMaxMyr: expectedMax, barFraction: clamp01(ageMyr / expectedMax), outOfRange: false,
    label: '',
    message: `Consistent with a ${letter ?? 'main-sequence'}-class main-sequence star (lifetime ~${formatMillionYears(expectedMax)}).`,
  };
}
