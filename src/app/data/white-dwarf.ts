/**
 * White-dwarf spectral-class reference data. The Canonn API encodes the spectral type
 * in the body subType as `White Dwarf (XX)`; these maps turn that code into a short
 * atmosphere label and a longer explanatory tooltip. Kept out of the component so
 * the lookup tables can be referenced and tested independently of any view.
 */

/** Short atmosphere description shown next to a white dwarf's spectral code. */
export const WHITE_DWARF_ATMOSPHERE: { [code: string]: string } = {
  'DA':  'Hydrogen Dominated',
  'DAB': 'Hydrogen and Helium',
  'DAO': 'Hydrogen and Ionized Helium',
  'DAV': 'Hydrogen Dominated (Variable)',
  'DAZ': 'Hydrogen with Metals',
  'DAP': 'Hydrogen Dominated (Magnetic)',
  'DB':  'Helium Dominated',
  'DBV': 'Helium Dominated (Variable)',
  'DBZ': 'Helium with Metals',
  'DBP': 'Helium Dominated (Magnetic)',
  'DC':  'Featureless Spectrum',
  'DCV': 'Featureless Spectrum (Variable)',
  'DO':  'Ionized Helium',
  'DOV': 'Ionized Helium (Variable)',
  'DOP': 'Ionized Helium (Magnetic)',
  'DQ':  'Carbon Features',
  'DZ':  'Metal Dominated',
  'DZA': 'Metal Dominated (Hydrogen)',
  'DZB': 'Metal Dominated (Helium)',
  'DZQ': 'Metal and Carbon Features',
  'DX':  'Unclassified Spectrum',
};

/** Detailed tooltip describing each white-dwarf spectral classification. */
export const WHITE_DWARF_TOOLTIPS: { [code: string]: string } = {
  'DA':  'DA — Only hydrogen Balmer lines visible.\n~28.9% of white dwarfs in the galaxy.',
  'DAB': 'DAB — Hydrogen dominant with detectable helium lines.\nIntermediate between DA and DB types. ~12.9% of white dwarfs.',
  'DAO': 'DAO — Hydrogen dominant with ionized helium (He II) lines also visible.\nTransitional type between the hydrogen-rich DA and ionized-helium DO sequences.',
  'DAV': 'DAV — Pulsating hydrogen-atmosphere white dwarf.\nShows brightness variations due to non-radial oscillations. ~3.3% of white dwarfs.',
  'DAZ': 'DAZ — Hydrogen atmosphere with metal absorption lines.\nMetals likely accreted from disrupted planetesimals. ~0.5% of white dwarfs.',
  'DAP': 'DAP — Magnetic hydrogen-atmosphere white dwarf.\nMagnetic field detected via polarimetry or Zeeman splitting of hydrogen lines.',
  'DB':  'DB — Only helium I lines visible, no hydrogen.\nForms when a DA loses its hydrogen layer. ~5.2% of white dwarfs.',
  'DBV': 'DBV — Pulsating helium-atmosphere white dwarf.\nShows brightness variations due to non-radial oscillations. ~1.0% of white dwarfs.',
  'DBZ': 'DBZ — Helium atmosphere with metal absorption lines.\nMetals likely accreted from disrupted planetesimals. ~0.1% of white dwarfs.',
  'DBP': 'DBP — Magnetic helium-atmosphere white dwarf.\nMagnetic field detected via polarimetry or Zeeman splitting of helium lines.',
  'DC':  'DC — No detectable spectral lines.\nFeatureless continuum; temperature too low for spectral features. ~44.3% of white dwarfs.',
  'DCV': 'DCV — Pulsating white dwarf with no detectable spectral lines.\nVariable featureless spectrum. ~3.8% of white dwarfs.',
  'DO':  'DO — Ionized helium (He II) dominant, very hot (>45,000 K).\nTransitional type between post-AGB stars and the cooler DB sequence.',
  'DOV': 'DOV (GW Vir) — Pulsating ionized-helium white dwarf.\nAmong the hottest known pulsating stars; driven by carbon/oxygen ionization.',
  'DOP': 'DOP — Magnetic ionized-helium white dwarf.\nVery hot DO type with a detectable magnetic field.',
  'DQ':  'DQ — Carbon Swan bands or atomic carbon lines visible.\nCarbon dredged up from the core into the helium envelope. <0.1% of white dwarfs.',
  'DZ':  'DZ — Metal absorption lines only; no hydrogen or helium lines.\nMetals accreted from disrupted planetesimals; hydrogen/helium layers too thin to detect.',
  'DZA': 'DZA — Metal lines dominant with trace hydrogen also visible.\nAccreted metals with a thin residual hydrogen layer.',
  'DZB': 'DZB — Metal lines dominant with trace helium also visible.\nAccreted metals in a helium-envelope white dwarf.',
  'DZQ': 'DZQ — Metal lines with carbon features also present.\nRare combination of accreted metals and carbon dredge-up.',
  'DX':  'DX — Spectral lines present but unidentifiable.\nUsed when the spectrum cannot be classified into any standard type.',
};

/** Extracts the spectral code (e.g. `DA`) from a `White Dwarf (DA)` subType, or null. */
export function whiteDwarfSpectralCode(subType: string | null | undefined): string | null {
  if (!subType?.startsWith('White Dwarf')) { return null; }
  const match = subType.match(/White Dwarf \(([^)]+)\)/);
  return match ? match[1] : null;
}
