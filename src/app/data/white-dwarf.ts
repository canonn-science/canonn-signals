/**
 * White-dwarf spectral-class reference data. The Canonn API encodes the spectral type
 * in the body subType as `White Dwarf (XX)`; this map turns that code into a short
 * atmosphere label and a longer explanatory tooltip. Kept out of the component so
 * the lookup table can be referenced and tested independently of any view.
 */

/** Per-code white-dwarf reference: the short atmosphere label and its detailed tooltip. */
export interface WhiteDwarfClass {
  /** Short atmosphere description shown next to a white dwarf's spectral code. */
  atmosphere: string;
  /** Detailed tooltip describing the spectral classification. */
  tooltip: string;
}

/** Atmosphere label + tooltip for each white-dwarf spectral code. */
export const WHITE_DWARF_CLASSES: { [code: string]: WhiteDwarfClass } = {
  'D':   { atmosphere: 'Unspecified Composition',           tooltip: 'D — Degenerate (white dwarf) class.\nNo specific spectral subtype has been determined.' },
  'DA':  { atmosphere: 'Hydrogen Dominated',                tooltip: 'DA — Only hydrogen Balmer lines visible.\n~28.9% of white dwarfs in the galaxy.' },
  'DAB': { atmosphere: 'Hydrogen and Helium',               tooltip: 'DAB — Hydrogen dominant with detectable helium lines.\nIntermediate between DA and DB types. ~12.9% of white dwarfs.' },
  'DAO': { atmosphere: 'Hydrogen and Ionized Helium',       tooltip: 'DAO — Hydrogen dominant with ionized helium (He II) lines also visible.\nTransitional type between the hydrogen-rich DA and ionized-helium DO sequences.' },
  'DAV': { atmosphere: 'Hydrogen Dominated (Variable)',     tooltip: 'DAV — Pulsating hydrogen-atmosphere white dwarf.\nShows brightness variations due to non-radial oscillations. ~3.3% of white dwarfs.' },
  'DAZ': { atmosphere: 'Hydrogen with Metals',              tooltip: 'DAZ — Hydrogen atmosphere with metal absorption lines.\nMetals likely accreted from disrupted planetesimals. ~0.5% of white dwarfs.' },
  'DAP': { atmosphere: 'Hydrogen Dominated (Magnetic)',     tooltip: 'DAP — Magnetic hydrogen-atmosphere white dwarf.\nMagnetic field detected via polarimetry or Zeeman splitting of hydrogen lines.' },
  'DB':  { atmosphere: 'Helium Dominated',                  tooltip: 'DB — Only helium I lines visible, no hydrogen.\nForms when a DA loses its hydrogen layer. ~5.2% of white dwarfs.' },
  'DBV': { atmosphere: 'Helium Dominated (Variable)',       tooltip: 'DBV — Pulsating helium-atmosphere white dwarf.\nShows brightness variations due to non-radial oscillations. ~1.0% of white dwarfs.' },
  'DBZ': { atmosphere: 'Helium with Metals',                tooltip: 'DBZ — Helium atmosphere with metal absorption lines.\nMetals likely accreted from disrupted planetesimals. ~0.1% of white dwarfs.' },
  'DBP': { atmosphere: 'Helium Dominated (Magnetic)',       tooltip: 'DBP — Magnetic helium-atmosphere white dwarf.\nMagnetic field detected via polarimetry or Zeeman splitting of helium lines.' },
  'DC':  { atmosphere: 'Featureless Spectrum',              tooltip: 'DC — No detectable spectral lines.\nFeatureless continuum; temperature too low for spectral features. ~44.3% of white dwarfs.' },
  'DCV': { atmosphere: 'Featureless Spectrum (Variable)',   tooltip: 'DCV — Pulsating white dwarf with no detectable spectral lines.\nVariable featureless spectrum. ~3.8% of white dwarfs.' },
  'DO':  { atmosphere: 'Ionized Helium',                    tooltip: 'DO — Ionized helium (He II) dominant, very hot (>45,000 K).\nTransitional type between post-AGB stars and the cooler DB sequence.' },
  'DOV': { atmosphere: 'Ionized Helium (Variable)',         tooltip: 'DOV (GW Vir) — Pulsating ionized-helium white dwarf.\nAmong the hottest known pulsating stars; driven by carbon/oxygen ionization.' },
  'DOP': { atmosphere: 'Ionized Helium (Magnetic)',         tooltip: 'DOP — Magnetic ionized-helium white dwarf.\nVery hot DO type with a detectable magnetic field.' },
  'DQ':  { atmosphere: 'Carbon Features',                   tooltip: 'DQ — Carbon Swan bands or atomic carbon lines visible.\nCarbon dredged up from the core into the helium envelope. <0.1% of white dwarfs.' },
  'DZ':  { atmosphere: 'Metal Dominated',                   tooltip: 'DZ — Metal absorption lines only; no hydrogen or helium lines.\nMetals accreted from disrupted planetesimals; hydrogen/helium layers too thin to detect.' },
  'DZA': { atmosphere: 'Metal Dominated (Hydrogen)',        tooltip: 'DZA — Metal lines dominant with trace hydrogen also visible.\nAccreted metals with a thin residual hydrogen layer.' },
  'DZB': { atmosphere: 'Metal Dominated (Helium)',          tooltip: 'DZB — Metal lines dominant with trace helium also visible.\nAccreted metals in a helium-envelope white dwarf.' },
  'DZQ': { atmosphere: 'Metal and Carbon Features',         tooltip: 'DZQ — Metal lines with carbon features also present.\nRare combination of accreted metals and carbon dredge-up.' },
  'DX':  { atmosphere: 'Unclassified Spectrum',             tooltip: 'DX — Spectral lines present but unidentifiable.\nUsed when the spectrum cannot be classified into any standard type.' },
};

/** Extracts the spectral code (e.g. `DA`) from a `White Dwarf (DA)` subType, or null. */
export function whiteDwarfSpectralCode(subType: string | null | undefined): string | null {
  if (!subType?.startsWith('White Dwarf')) { return null; }
  const match = subType.match(/White Dwarf \(([^)]+)\)/);
  return match ? match[1] : null;
}

/** One row of the white-dwarf spectral-type reference table shown in the modal. */
export interface WhiteDwarfSpectralType {
  /** Stable identifier used to match a star's code to its row. */
  key: string;
  /** Type label shown in the table (may cover several related codes). */
  type: string;
  /** Plain-language description of the spectral classification. */
  description: string;
}

/** The full white-dwarf spectral-type catalogue, in the order shown in the modal. */
export const WHITE_DWARF_SPECTRAL_TYPES: WhiteDwarfSpectralType[] = [
  { key: 'D', type: 'D', description: 'Degenerate (white dwarf) class. The leading "D" marks the star as degenerate and is normally followed by a letter giving the spectral type; shown alone when no specific type has been determined.' },
  { key: 'DA', type: 'DA', description: 'Hydrogen-dominated atmosphere. Most common type (~80%). Strong hydrogen Balmer lines.' },
  { key: 'DB', type: 'DB', description: 'Helium-dominated atmosphere (neutral helium). No hydrogen lines visible.' },
  { key: 'DC', type: 'DC', description: 'Featureless spectrum. No strong absorption lines detected; usually very cool white dwarfs.' },
  { key: 'DO', type: 'DO', description: 'Helium-dominated atmosphere (ionized helium). Very hot white dwarfs.' },
  { key: 'DQ', type: 'DQ', description: 'Carbon features present. Carbon lines or molecular carbon (C₂) visible in the spectrum.' },
  { key: 'DZ', type: 'DZ', description: 'Metal-rich atmosphere. Shows absorption lines from elements such as calcium, magnesium, or iron, usually from accreted debris.' },
  { key: 'DX', type: 'DX', description: 'Unclassified or unusual spectrum. Does not fit neatly into other categories.' },
  { key: 'polluted', type: 'DAZ / DBZ / etc.', description: 'Polluted variants. A normal DA or DB white dwarf plus metal lines ("Z" indicates metals).' },
  { key: 'magnetic', type: 'DAP / DBP', description: 'Magnetic white dwarfs. "P" indicates polarization caused by strong magnetic fields.' },
];

/**
 * Maps a spectral code (e.g. `DAV`, `DAZ`, `DBP`) to the `key` of the catalogue row
 * that best represents it, so the modal can highlight the star's type. Magnetic (`P`)
 * and polluted DA/DB (`Z`) variants take priority over the base-letter match.
 */
export function whiteDwarfSpectralTypeKey(code: string | null | undefined): string | null {
  if (!code) { return null; }
  if (code.endsWith('P')) { return 'magnetic'; }       // DAP, DBP, DOP
  if (code === 'DAZ' || code === 'DBZ') { return 'polluted'; }
  const base = code.slice(0, 2);
  return WHITE_DWARF_SPECTRAL_TYPES.some(t => t.key === base) ? base : null;
}
