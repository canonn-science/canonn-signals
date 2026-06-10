import { WHITE_DWARF_ATMOSPHERE, WHITE_DWARF_TOOLTIPS, whiteDwarfSpectralCode } from './white-dwarf';

describe('whiteDwarfSpectralCode', () => {
  it('extracts the spectral code from a White Dwarf subType', () => {
    expect(whiteDwarfSpectralCode('White Dwarf (DA)')).toBe('DA');
    expect(whiteDwarfSpectralCode('White Dwarf (DAV)')).toBe('DAV');
  });

  it('returns null for non-white-dwarf subtypes', () => {
    expect(whiteDwarfSpectralCode('Neutron Star')).toBeNull();
    expect(whiteDwarfSpectralCode('Earth-like world')).toBeNull();
  });

  it('returns null for nullish/empty input', () => {
    expect(whiteDwarfSpectralCode(null)).toBeNull();
    expect(whiteDwarfSpectralCode(undefined)).toBeNull();
    expect(whiteDwarfSpectralCode('')).toBeNull();
  });

  it('returns null when the parenthesised code is absent', () => {
    expect(whiteDwarfSpectralCode('White Dwarf')).toBeNull();
  });
});

describe('white-dwarf reference maps', () => {
  it('exposes an atmosphere label and tooltip for every catalogued code', () => {
    for (const code of Object.keys(WHITE_DWARF_ATMOSPHERE)) {
      expect(WHITE_DWARF_TOOLTIPS[code]).toBeDefined();
      expect(WHITE_DWARF_ATMOSPHERE[code].length).toBeGreaterThan(0);
    }
  });

  it('maps known codes to their human-readable atmosphere', () => {
    expect(WHITE_DWARF_ATMOSPHERE['DA']).toBe('Hydrogen Dominated');
    expect(WHITE_DWARF_ATMOSPHERE['DB']).toBe('Helium Dominated');
  });
});
