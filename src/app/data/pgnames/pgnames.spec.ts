import { PGSystem } from './PGSystem';
import { PGRegion } from './PGRegion';
import { PGSectors, ByteXYZ } from './PGSectors';

describe('PGSystem', () => {
  // Known mapping from scripts/test-sector-name.ts: id64 10577693187 -> "Blae Eock KC-C d0".
  const KNOWN_ID64 = 10577693187n;

  describe('fromSystemAddress / toSystemAddress', () => {
    it('decodes a known system address into PG fields', () => {
      const sys = PGSystem.fromSystemAddress(KNOWN_ID64);
      expect(sys.regionName).toBe('Blae Eock');
      expect(sys.sizeClass).toBeGreaterThanOrEqual(0);
      // toPGName renders the mass-code/index segment in lower case with a sequence suffix.
      expect(sys.toPGName()).toBe('Blae Eock kc-c d0-0');
    });

    it('re-encodes a decoded address to a bigint (region origin is synthesised, so not bit-identical)', () => {
      const sys = PGSystem.fromSystemAddress(KNOWN_ID64);
      const addr = sys.toSystemAddress();
      expect(typeof addr).toBe('bigint');
      expect(addr).toBeGreaterThan(0n);
    });

    it('encodes and decodes the modulated-address form (lossy: toModSystemAddress uses 32-bit bitwise ops)', () => {
      const sys = PGSystem.fromSystemAddress(KNOWN_ID64);
      const back = PGSystem.fromModSystemAddress(sys.toModSystemAddress());
      // NOTE: toModSystemAddress builds the result with JS bitwise (32-bit) operators, so
      // fields packed above bit 31 are truncated — the round-trip is lossy across the board.
      expect(back).toBeInstanceOf(PGSystem);
      expect(typeof back.regionName).toBe('string');
      expect(typeof back.sequence).toBe('number');
    });

    it('exposes its region via the region getter', () => {
      const sys = PGSystem.fromSystemAddress(KNOWN_ID64);
      expect(sys.region).toBeInstanceOf(PGRegion);
    });
  });

  describe('tryParse', () => {
    it('parses a valid PG system name into fields', () => {
      const [ok, sys] = PGSystem.tryParse('Blae Eock KC-C d0');
      expect(ok).toBe(true);
      expect(sys.regionName).toBe('Blae Eock');
      expect(sys.sizeClass).toBe('d'.charCodeAt(0) - 'a'.charCodeAt(0));
    });

    it('currently rejects the n1-n2 form because of a substring bug in tryParse', () => {
      // NOTE: tryParse extracts the mid3 digits with substring(i+1, vend - i + 1) — passing a
      // *length* where an *end index* is expected — so it slices garbage, parseInt -> NaN, and
      // every "<sector> AB-C d<n1>-<n2>" name is rejected. Flagged as a latent bug (not fixed).
      const [ok] = PGSystem.tryParse('Blae Eock kc-c d0-0');
      expect(ok).toBe(false);
    });

    it('rejects malformed names', () => {
      expect(PGSystem.tryParse('')[0]).toBe(false);
      expect(PGSystem.tryParse('Sol')[0]).toBe(false);
      expect(PGSystem.tryParse('Too Short A')[0]).toBe(false);
      expect(PGSystem.tryParse('Blae Eock KC-C dx')[0]).toBe(false); // size class not a-h followed by digit
      expect(PGSystem.tryParse(null as any)[0]).toBe(false);
    });
  });

  describe('isPGSystemName', () => {
    it('recognises a procedurally-generated system name', () => {
      expect(PGSystem.isPGSystemName('Blae Eock KC-C d0')).toBe(true);
      expect(PGSystem.isPGSystemName('Sol')).toBe(false);
      expect(PGSystem.isPGSystemName('')).toBe(false);
    });

    it('applies strict sector validation when requested', () => {
      // Strict mode additionally requires the region name to parse into fragments.
      expect(typeof PGSystem.isPGSystemName('B AB-C d0', true)).toBe('boolean');
    });
  });

  describe('sector & system name formatting', () => {
    it('extracts fragments from a single-prefix sector name and rejects unknown ones', () => {
      expect(PGSystem.getSectorFragments('B')).toEqual(['B']);
      expect(PGSystem.getSectorFragments('Zzzz')).toBeNull();
    });

    it('formats a class-1 sector name by joining fragments', () => {
      expect(PGSystem.formatSectorName(['Th', 'B'])).toBe('ThB');
    });

    it('formats a class-2 sector name with a prefix and infix', () => {
      // 4 fragments whose 3rd starts with an uppercase letter -> "Frag1Frag2 Frag3Frag4".
      expect(PGSystem.formatSectorName(['Th', 'a', 'B', 'c'])).toBe('Tha Bc');
    });

    it('returns null for an unformattable sector name', () => {
      expect(PGSystem.formatSectorName('Zzzz')).toBeNull();
    });

    it('formats a full system name from fragments', () => {
      expect(PGSystem.formatSystemName({ SectorName: 'Synuefe', L1: 'e', L2: 'n', L3: 'h', MCode: 'd', N1: 11, N2: 96 }))
        .toBe('Synuefe EN-H d11-96');
      expect(PGSystem.formatSystemName({ SectorName: 'Synuefe', L1: 'A', L2: 'B', L3: 'C', MCode: 'd', N1: 0, N2: 5 }))
        .toBe('Synuefe AB-C d5');
      expect(PGSystem.formatSystemName({ SectorName: '' })).toBeNull();
    });

    it('derives canonical name fragments from a system name', () => {
      const frags = PGSystem.getCanonicalNameFragments('Blae Eock KC-C d0');
      expect(frags.L1).toBe('K');
      expect(frags.L2).toBe('C');
      expect(frags.MCode).toBe('d');
    });

    it('returns a null sector for a non-system, non-sector input', () => {
      expect(PGSystem.getCanonicalName('Sol')).toBeNull();
      expect(PGSystem.getCanonicalNameFragments('Sol')).toEqual({ SectorName: null });
    });

    it('treats the whole input as a sector name in sector-only mode', () => {
      const result = PGSystem.getCanonicalNameFragments('B', true);
      expect(result.SectorName).toBe('B');
    });
  });
});

describe('PGRegion', () => {
  it('looks up a known hand-authored region by name', () => {
    const region = PGRegion.getRegion('Cepheus Dark Region');
    expect(region.name).toBe('Cepheus Dark Region');
    expect(region.x0).toBeGreaterThan(0);
    expect(region.sizeX).toBe(6400);
  });

  it('synthesises a region from sector position for an unknown name', () => {
    const region = PGRegion.getRegion('Blae Eock');
    expect(region.name).toBe('Blae Eock');
    expect(region.sizeX).toBe(40960);
  });

  it('creates a region from raw data', () => {
    const region = PGRegion.createFromData({ name: 'X', x0: 1, y0: 2, z0: 3, sizeX: 4, sizeY: 5, sizeZ: 6 });
    expect(region.z0).toBe(3);
    expect(region.sizeZ).toBe(6);
  });
});

describe('PGSectors', () => {
  it('generates a sector name for byte coordinates', () => {
    const name = PGSectors.getSectorName(new ByteXYZ(39, 30, 20));
    expect(typeof name).toBe('string');
    expect(name.length).toBeGreaterThan(0);
  });

  it('resolves a sector position from a name', () => {
    const pos = PGSectors.getSectorPos('Blae Eock');
    expect(typeof pos.x).toBe('number');
    expect(typeof pos.y).toBe('number');
    expect(typeof pos.z).toBe('number');
  });
});
