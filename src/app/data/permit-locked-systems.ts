/**
 * Static list of permit-locked Elite Dangerous systems and regions.
 *
 * The Canonn biostats API does not report whether a system requires a permit
 * (even Sol, which is permit-locked in game, returns no permit field), so this is
 * a hand-maintained list, sourced from the community "Elite Dangerous — Permit
 * Database" spreadsheet. When that sheet changes, regenerate these arrays from it.
 *
 * Two kinds of entry:
 *  - SYSTEMS: matched by exact (case/whitespace-insensitive) name.
 *  - REGIONS: nebulae / clusters / proc-gen sectors whose permit covers a whole
 *    area. There is no per-system region-permit flag in the data, so membership is
 *    inferred from the system name: a system is in the region when its name equals,
 *    or begins with, the region's name (e.g. "Col 121 Sector AB-C d1-2" → "Col 121",
 *    "Bleia Flyuae DH-U e3-26" → "Bleia"). This is best-effort: a region label that
 *    is not a real in-game name prefix simply matches nothing.
 *
 * The sheet's permit-locked *bodies* (Diso 5 C, Lave 2, Sol's Moon/Triton) are
 * intentionally omitted — their systems are otherwise open, so a system-level permit
 * flag would be wrong (Sol is already covered as a system).
 */

/** Lower-cased, trimmed name used as the lookup key. */
function normalizeSystemName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Canonical names of permit-locked systems. Stored normalized so lookups are
 * case- and whitespace-insensitive.
 */
const PERMIT_LOCKED_NAMES_RAW = [
  '4 Sextantis',
  'Achenar',
  'Alioth',
  'Alpha Hydri',
  'Bellica',
  'Beta Hydri',
  'CD-43 11917',
  'CD-44 1695',
  'Crom',
  'Dryio Flyuae IC-B c1-377',
  'Exbeur',
  'Facece',
  'HIP 10332',
  'HIP 104941',
  'HIP 22182',
  'HIP 22460',
  'HIP 39425',
  'HIP 51073',
  'HIP 54530',
  'HIP 87621',
  'HR 4413',
  'Hodack',
  'Hors',
  'Isinor',
  'Jotun',
  'Kamba',
  'LFT 509',
  'LHS 2894',
  'LHS 2921',
  'LHS 3091',
  'LTT 198',
  'Luyten 347-14',
  'Mbooni',
  'Mingfu',
  'Nastrond',
  'PLX 695',
  'Peregrina',
  'Phekda',
  'Pi Mensae',
  'Plaa Ain HA-Z d46',
  'Polaris',
  'Ross 128',
  'Ross 354',
  'Scheau Bli NB-O d6-1409',
  'Shinrarta Dezhra',
  'Sirius',
  'Sol',
  'Summerland',
  'Terra Mater',
  'Tiliala',
  'Vega',
  "Witch's Reach",
  'Wolf 262',
  "van Maanen's Star",
] as const;

export const PERMIT_LOCKED_SYSTEM_NAMES: ReadonlySet<string> = new Set(
  PERMIT_LOCKED_NAMES_RAW.map(normalizeSystemName),
);

/**
 * Permit-locked region name prefixes (normalized). A system is in one of these
 * regions when its name equals, or starts with, the prefix. Grouped sheet labels
 * are collapsed to the real in-game name stem: "Bleia1"–"Bleia5" → "Bleia", and
 * "Praei1"–"Praei6" → "Praea" (the actual systems are named "Praea …", not "Praei…").
 */
const PERMIT_LOCKED_REGION_PREFIXES: readonly string[] = [
  'bleia',
  'bovomit',
  'col 121',
  'col 70',
  'col 97',
  'cone sector',
  'dryman',
  'froadik',
  'horsehead dark region',
  'hyponia',
  'ic 4673',
  'm41',
  'ngc 1647',
  'ngc 2264',
  'ngc 2286',
  'ngc 3603',
  'praea',
  'regor',
  'sidgoir',
].map(prefix => prefix.toLowerCase());

/** True when the named system falls within a permit-locked region (by name prefix). */
export function isPermitLockedRegion(name: string): boolean {
  if (!name) return false;
  const normalized = normalizeSystemName(name);
  // Require an exact match or a whole-token prefix (followed by a space) so e.g.
  // "Col 121" never matches "Col 1219 …" and "Col 70" never matches "Col 700 …".
  return PERMIT_LOCKED_REGION_PREFIXES.some(
    prefix => normalized === prefix || normalized.startsWith(`${prefix} `),
  );
}

/**
 * True when the named system requires a permit — either a specific permit-locked
 * system, or a system inside a permit-locked region.
 */
export function isPermitLockedSystem(name: string): boolean {
  if (!name) return false;
  return PERMIT_LOCKED_SYSTEM_NAMES.has(normalizeSystemName(name)) || isPermitLockedRegion(name);
}
