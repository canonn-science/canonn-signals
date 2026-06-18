import { WHITE_DWARF_CLASSES, WHITE_DWARF_SPECTRAL_TYPES, whiteDwarfSpectralCode, whiteDwarfSpectralTypeKey } from './white-dwarf';

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

describe('white-dwarf reference map', () => {
  it('exposes a non-empty atmosphere label and tooltip for every catalogued code', () => {
    for (const code of Object.keys(WHITE_DWARF_CLASSES)) {
      expect(WHITE_DWARF_CLASSES[code].atmosphere.length).toBeGreaterThan(0);
      expect(WHITE_DWARF_CLASSES[code].tooltip.length).toBeGreaterThan(0);
    }
  });

  it('maps known codes to their human-readable atmosphere', () => {
    expect(WHITE_DWARF_CLASSES['DA'].atmosphere).toBe('Hydrogen Dominated');
    expect(WHITE_DWARF_CLASSES['DB'].atmosphere).toBe('Helium Dominated');
  });
});

describe('whiteDwarfSpectralTypeKey', () => {
  it('maps a base code to its own row key', () => {
    expect(whiteDwarfSpectralTypeKey('D')).toBe('D');
    expect(whiteDwarfSpectralTypeKey('DA')).toBe('DA');
    expect(whiteDwarfSpectralTypeKey('DZ')).toBe('DZ');
    expect(whiteDwarfSpectralTypeKey('DX')).toBe('DX');
  });

  it('maps variant codes to their base-letter row', () => {
    expect(whiteDwarfSpectralTypeKey('DAV')).toBe('DA');
    expect(whiteDwarfSpectralTypeKey('DBV')).toBe('DB');
    expect(whiteDwarfSpectralTypeKey('DOV')).toBe('DO');
    expect(whiteDwarfSpectralTypeKey('DZA')).toBe('DZ');
  });

  it('prioritises the magnetic row for codes ending in P', () => {
    expect(whiteDwarfSpectralTypeKey('DAP')).toBe('magnetic');
    expect(whiteDwarfSpectralTypeKey('DBP')).toBe('magnetic');
    expect(whiteDwarfSpectralTypeKey('DOP')).toBe('magnetic');
  });

  it('maps polluted DA/DB codes to the polluted row', () => {
    expect(whiteDwarfSpectralTypeKey('DAZ')).toBe('polluted');
    expect(whiteDwarfSpectralTypeKey('DBZ')).toBe('polluted');
  });

  it('returns null for unknown or nullish codes', () => {
    expect(whiteDwarfSpectralTypeKey('ZZ')).toBeNull();
    expect(whiteDwarfSpectralTypeKey(null)).toBeNull();
    expect(whiteDwarfSpectralTypeKey(undefined)).toBeNull();
  });

  it('returns a key that exists in the catalogue for every catalogued code', () => {
    const keys = new Set(WHITE_DWARF_SPECTRAL_TYPES.map(t => t.key));
    for (const code of Object.keys(WHITE_DWARF_CLASSES)) {
      const key = whiteDwarfSpectralTypeKey(code);
      expect(key).not.toBeNull();
      expect(keys.has(key as string)).toBe(true);
    }
  });
});

/*
 * Verification against real game data. These are the exact white-dwarf `subType`
 * strings the Spansh dump exposes (GET /api/bodies/field_values/subtype), sampled
 * across 5 systems each — i.e. every white-dwarf classification a player can
 * actually encounter. Each maps to the badge code and the catalogue row the modal
 * should highlight.
 *
 * The generic `White Dwarf (D) Star` (e.g. van Maanen's Star) carries no
 * sub-classification; it maps to the catalogue's general "D" row.
 */
const REAL_WHITE_DWARF_SUBTYPES: { subType: string; code: string; key: string | null }[] = [
  { subType: 'White Dwarf (D) Star',   code: 'D',   key: 'D' },
  { subType: 'White Dwarf (DA) Star',  code: 'DA',  key: 'DA' },
  { subType: 'White Dwarf (DAB) Star', code: 'DAB', key: 'DA' },
  { subType: 'White Dwarf (DAV) Star', code: 'DAV', key: 'DA' },
  { subType: 'White Dwarf (DAZ) Star', code: 'DAZ', key: 'polluted' },
  { subType: 'White Dwarf (DB) Star',  code: 'DB',  key: 'DB' },
  { subType: 'White Dwarf (DBV) Star', code: 'DBV', key: 'DB' },
  { subType: 'White Dwarf (DBZ) Star', code: 'DBZ', key: 'polluted' },
  { subType: 'White Dwarf (DC) Star',  code: 'DC',  key: 'DC' },
  { subType: 'White Dwarf (DCV) Star', code: 'DCV', key: 'DC' },
  { subType: 'White Dwarf (DQ) Star',  code: 'DQ',  key: 'DQ' },
];

describe('real in-game white-dwarf subtypes (Spansh)', () => {
  for (const { subType, code, key } of REAL_WHITE_DWARF_SUBTYPES) {
    it(`extracts "${code}" and highlights "${key}" for ${subType}`, () => {
      expect(whiteDwarfSpectralCode(subType)).toBe(code);
      expect(whiteDwarfSpectralTypeKey(whiteDwarfSpectralCode(subType))).toBe(key);
    });
  }

  it('highlights a real catalogue row for every classified subtype', () => {
    const keys = new Set(WHITE_DWARF_SPECTRAL_TYPES.map(t => t.key));
    for (const { subType, key } of REAL_WHITE_DWARF_SUBTYPES) {
      if (key === null) { continue; }
      expect(keys.has(key), `${subType} -> ${key}`).toBe(true);
    }
  });
});

describe('WHITE_DWARF_SPECTRAL_TYPES catalogue', () => {
  it('has a unique key and non-empty fields for every row', () => {
    const keys = WHITE_DWARF_SPECTRAL_TYPES.map(t => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const row of WHITE_DWARF_SPECTRAL_TYPES) {
      expect(row.type.length).toBeGreaterThan(0);
      expect(row.description.length).toBeGreaterThan(0);
    }
  });
});
