import { CanonnBiostatsBody } from '../home/home.component';
import { BODY_TYPE } from './body-types';

/**
 * Tooltip shown on a speculative body's subtype (see {@link applySpeculativeBodies}).
 */
export const SPECULATIVE_BODY_TOOLTIP =
  'Extrapolated from analysis of the system image on the Thargoid device — not confirmed data.';

/** Real id64 of Col 70 Sector FY-N c21-3. Spansh has no body data for it — GH issue #93. */
const COL_70_FY_N_C21_3_ID64 = 909626806858n;

/** Real id64 of Merope. Unlike Col 70 Sector FY-N c21-3, Merope has real, complete Spansh data. */
const MEROPE_ID64 = 224644818084n;

/** Col 70 Sector FY-N c21-3's real region — Spansh's dump for it carries no region field. */
const COL_70_FY_N_C21_3_REGION = { name: 'Inner Orion Spur', region: 18 };

/**
 * Wraps `text` in a link to the Canonn Codex's "The Unknown Device" article (the source of
 * the Thargoid map) — used once, on the first reference to "the map" in each system's
 * info-panel paragraphs below, so readers can go straight to the write-up without the
 * repeated links elsewhere in the text becoming distracting.
 */
function unknownDeviceLink(text: string): string {
  return `<a href="https://canonn.science/codex/the-unknown-device/" target="_blank" rel="noopener noreferrer">${text}</a>`;
}

/** Background shown in an info panel on Col 70 Sector FY-N c21-3's system page. */
const COL_70_FY_N_C21_3_INFO = [
  `Col 70 Sector FY-N C21-3 is a system within the permit-locked Col 70 Sector, identified as having special significance to the Thargoids. It appears alongside Merope on the ${unknownDeviceLink('Thargoid map')}, and the distance between the two systems forms the base unit the Thargoids use to measure distance.`,
  "When triggered, Thargoid links transmit messages that can be trilaterated using this unit, resolving the position of a fourth, unknown system relative to the message's origin.",
  "Beyond the map, little is known about the system itself, other than its spectral class and luminosity, and that it is young, between 1 and 10 million years old, though the lack of a belt suggests it is likely to be older than 5 million years old. The map depicts eight orbits extending outward from the star's surface, spaced on roughly a log scale. All but one orbit holds a single body; the exception is a pair orbiting a shared barycentre. Body radii are also assumed to follow a log scale. This page is a reconstruction based on that system map, with suggested body types that might fit the profile shown.",
];

/** Background shown in an info panel on Merope's system page. */
const MEROPE_INFO = [
  `Merope is a system in the Pleiades Nebula, and one of only two systems depicted on the ${unknownDeviceLink('Thargoid map')}. The distance between Merope and Col 70 Sector FY-N C21-3 forms the base unit the Thargoids use to measure distance in messages transmitted over Thargoid links.`,
  "Merope's significance to the Thargoids is well established by other means. It was above Merope 5 C that the first Thargoid Barnacles were discovered, and the decoded Thargoid Probe transmission was found to be directed at an unknown receiver on that same body. Its appearance on the map alongside a system deep inside permit-locked space suggests the pair were chosen as reference points, one marking the edge of human space and the other something of comparable importance to the Thargoids themselves.",
  "For the purposes of this reconstruction, Merope serves a second and more practical role. The map depicts most of the bodies in the system, and because Merope is fully surveyed and openly accessible, its real system data can be compared directly against what the map shows.",
];

/** Info-panel paragraphs, keyed by system id64, for every system with a Thargoid-map tie-in. */
const SYSTEM_INFO_PANELS: ReadonlyMap<bigint, readonly string[]> = new Map([
  [COL_70_FY_N_C21_3_ID64, COL_70_FY_N_C21_3_INFO],
  [MEROPE_ID64, MEROPE_INFO],
]);

/**
 * Info-panel paragraphs for a system with a Thargoid-map tie-in (currently Col 70 Sector
 * FY-N c21-3 and Merope), or `null` for every other system.
 */
export function getSpeculativeSystemInfo(id64: bigint): readonly string[] | null {
  return SYSTEM_INFO_PANELS.get(id64) ?? null;
}

/** A system's own map image (the right-hand image in the info panel) and its caption. */
export interface SystemMapImage {
  path: string;
  caption: string;
}

/** Per-system map image, keyed by system id64 — the right-hand image in the info panel. */
const SYSTEM_MAP_IMAGES: ReadonlyMap<bigint, SystemMapImage> = new Map([
  [COL_70_FY_N_C21_3_ID64, { path: 'assets/col-70-system-map.png', caption: 'Col 70 Sector FY-N c21-3 system map' }],
  [MEROPE_ID64, { path: 'assets/merope-system-map.webp', caption: 'Merope system map' }],
]);

/**
 * The system-specific map image for the info panel's right-hand side (see
 * {@link getSpeculativeSystemInfo}), or `null` for every other system.
 */
export function getSystemMapImage(id64: bigint): SystemMapImage | null {
  return SYSTEM_MAP_IMAGES.get(id64) ?? null;
}

/**
 * True for a system whose body list is itself a speculative reconstruction (currently just
 * Col 70 Sector FY-N c21-3) — as opposed to a system that merely carries an info panel (see
 * {@link getSpeculativeSystemInfo}) alongside its own real body data, e.g. Merope. Also
 * used to decide whether the system should default to showing only its main star expanded
 * (every other body being a guess, unlike a real system's).
 */
export function isSpeculativeBodySystem(id64: bigint): boolean {
  return id64 === COL_70_FY_N_C21_3_ID64;
}

/**
 * System Completeness override for a system whose body list is a speculative
 * reconstruction (currently just Col 70 Sector FY-N c21-3), or `null` for every other
 * system (which use the normal known/total scan count). None of this system's 10 bodies
 * are real scan data — every one is a guess read off the Thargoid device's map — so
 * completeness is hardcoded to 0/10 rather than counting the speculative bodies as "known".
 */
export function getSpeculativeSystemCompleteness(
  id64: bigint,
): { known: number; total: number; percent: number } | null {
  return isSpeculativeBodySystem(id64) ? { known: 0, total: 10, percent: 0 } : null;
}

function speculativeBody(
  bodyId: number,
  nameSuffix: string,
  buildFields: (systemName: string) => Omit<CanonnBiostatsBody, 'bodyId' | 'id64' | 'name' | 'speculative'>,
): (systemName: string) => CanonnBiostatsBody {
  return systemName => ({
    bodyId,
    id64: 0n,
    name: `${systemName}${nameSuffix}`,
    speculative: true,
    ...buildFields(systemName),
  });
}

/**
 * Col 70 Sector FY-N c21-3's speculative body layout: ring count, orbit ordering, body
 * radii, the one ringed planet and the one binary pair, all read off the system map shown
 * on the in-game Thargoid device (see GH issue #93 for the full derivation). Only the main
 * star's classification (subtype, spectral class, luminosity) is treated as known for
 * certain — everywhere else, values are educated guesses, so every body is flagged
 * `speculative` (or, for the star, the narrower `speculativeValues`, which leaves its
 * classification/image unmarked) so the renderer marks every displayed value with a "?".
 */
const COL_70_FY_N_C21_3_BODIES: ((systemName: string) => CanonnBiostatsBody)[] = [
  systemName => ({
    bodyId: 0,
    id64: 0n,
    name: systemName,
    type: BODY_TYPE.Star,
    subType: 'T Tauri Star',
    spectralClass: 'TTS3',
    luminosity: 'Va',
    mainStar: true,
    solarMasses: 0.69,
    solarRadius: 2.4,
    distanceToArrival: 0,
    speculativeValues: true,
  }),
  speculativeBody(1, ' 1', () => ({
    type: BODY_TYPE.Planet,
    subType: 'High metal content world',
    parents: [{ Star: 0 }],
    radius: 17644,
    semiMajorAxis: 0.038192,
    argOfPeriapsis: 206.2,
    orbitalPeriod: 3.28,
    orbitalEccentricity: 0.02,
    orbitalInclination: 0.0,
    distanceToArrival: 19,
  })),
  speculativeBody(2, ' 2', systemName => ({
    type: BODY_TYPE.Planet,
    subType: 'High metal content world',
    parents: [{ Star: 0 }],
    radius: 3000,
    semiMajorAxis: 0.097151,
    argOfPeriapsis: 101.9,
    orbitalPeriod: 13.31,
    orbitalEccentricity: 0.02,
    orbitalInclination: 0.0,
    distanceToArrival: 48,
    rings: [{
      name: `${systemName} 2 A Ring`,
      type: 'Rocky',
      // The merge pipeline treats these as Spansh's raw (metres) convention and divides by
      // 1000 for display, so ×1000 here to land on the intended 5,100 / 9,600 km.
      innerRadius: 5100 * 1000,
      outerRadius: 9600 * 1000,
      mass: 12000000000.0,
    }],
  })),
  speculativeBody(3, ' 3', () => ({
    type: BODY_TYPE.Planet,
    subType: 'High metal content world',
    parents: [{ Star: 0 }],
    radius: 5005,
    semiMajorAxis: 0.22142,
    argOfPeriapsis: 306.0,
    orbitalPeriod: 45.81,
    orbitalEccentricity: 0.02,
    orbitalInclination: 0.0,
    distanceToArrival: 110,
  })),
  speculativeBody(4, ' 4', () => ({
    type: BODY_TYPE.Planet,
    subType: 'High metal content world',
    parents: [{ Star: 0 }],
    radius: 4448,
    semiMajorAxis: 0.452152,
    argOfPeriapsis: 14.2,
    orbitalPeriod: 133.69,
    orbitalEccentricity: 0.02,
    orbitalInclination: 0.0,
    distanceToArrival: 226,
  })),
  speculativeBody(5, ' 7', () => ({
    type: BODY_TYPE.Planet,
    subType: 'High metal content world',
    parents: [{ Star: 0 }],
    radius: 16963,
    semiMajorAxis: 2.621374,
    argOfPeriapsis: 53.7,
    orbitalPeriod: 1866.2,
    orbitalEccentricity: 0.02,
    orbitalInclination: 0.0,
    distanceToArrival: 1308,
  })),
  speculativeBody(6, ' 8', () => ({
    type: BODY_TYPE.Planet,
    subType: 'Class III gas giant',
    parents: [{ Star: 0 }],
    radius: 33129,
    semiMajorAxis: 7.442265,
    argOfPeriapsis: 143.9,
    orbitalPeriod: 8927.37,
    orbitalEccentricity: 0.02,
    orbitalInclination: 0.0,
    distanceToArrival: 3714,
  })),
  speculativeBody(7, ' 9', () => ({
    type: BODY_TYPE.Planet,
    subType: 'Class II gas giant',
    parents: [{ Star: 0 }],
    radius: 40337,
    semiMajorAxis: 20.0,
    argOfPeriapsis: 353.9,
    orbitalPeriod: 39328.8,
    orbitalEccentricity: 0.02,
    orbitalInclination: 0.0,
    distanceToArrival: 9980,
  })),
  // The barycentre deliberately carries no `parents` — same as a real Spansh barycentre —
  // and is attached to the star indirectly via bodies 9/10's own ancestor chain below.
  speculativeBody(8, ' 5-6 Barycentre', () => ({
    type: BODY_TYPE.Barycentre,
    subType: '',
    semiMajorAxis: 1.15016,
    argOfPeriapsis: 243.2,
    orbitalPeriod: 542.38,
    distanceToArrival: 574,
  })),
  // The binary pair: two bodies orbiting their own barycentre (bodyId 8), which in turn
  // orbits the main star — `parents` lists the full nearest-first ancestor chain.
  speculativeBody(9, ' 5', () => ({
    type: BODY_TYPE.Planet,
    subType: 'Class I gas giant',
    parents: [{ Null: 8 }, { Star: 0 }],
    radius: 70000,
    semiMajorAxis: 1.3e-05,
    argOfPeriapsis: 250.0,
    orbitalPeriod: 0.0,
    orbitalEccentricity: 0.01,
    orbitalInclination: 0.0,
    distanceToArrival: 574,
  })),
  speculativeBody(10, ' 6', () => ({
    type: BODY_TYPE.Planet,
    subType: 'High metal content world',
    parents: [{ Null: 8 }, { Star: 0 }],
    radius: 6094,
    semiMajorAxis: 0.02,
    argOfPeriapsis: 236.4,
    orbitalPeriod: 1.24,
    orbitalEccentricity: 0.01,
    orbitalInclination: 0.0,
    distanceToArrival: 574,
  })),
];

/**
 * When Spansh has no body data for a system we special-case (currently just Col 70 Sector
 * FY-N c21-3), replaces the system's empty body list with its speculative layout, mapped
 * onto the system's real name, and fills in its region (Spansh's dump omits one). Does
 * nothing for every other system, and does nothing if the system unexpectedly already has
 * body data — so real Spansh data, should it ever appear, is never overwritten by the
 * speculative one.
 */
export function applySpeculativeBodies(system: {
  id64: bigint;
  name: string;
  bodies: CanonnBiostatsBody[];
  region?: { name: string; region: number };
}): void {
  if (system.id64 !== COL_70_FY_N_C21_3_ID64 || system.bodies.length > 0) {
    return;
  }
  system.bodies = COL_70_FY_N_C21_3_BODIES.map(build => build(system.name));
  system.region ??= COL_70_FY_N_C21_3_REGION;
}
