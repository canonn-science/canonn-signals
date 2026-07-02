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

    // Ground truth generated with the EDTS reference implementation
    // (calculate_id64 + pgnames, systems in the Blae Eock sector), one id64 per
    // mass code, plus the in-game-verified KNOWN_ID64. These anchor the absolute
    // bit layout — not just that encode and decode are mutual inverses.
    const REFERENCE_SYSTEMS = [
      { id64: KNOWN_ID64, l1: 'k', l2: 'c', l3: 'c', mcode: 'd', n1: 0, n2: 0 },
      { id64: 216480817500680n, l1: 'h', l2: 'x', l3: 'u', mcode: 'a', n1: 60, n2: 12 },
      { id64: 7268822034689n, l1: 'c', l2: 'g', l3: 'y', mcode: 'b', n1: 29, n2: 3 },
      { id64: 38841769759874n, l1: 'b', l2: 'd', l3: 'z', mcode: 'c', n1: 14, n2: 141 },
      { id64: 319731321411n, l1: 'b', l2: 'm', l3: 'm', mcode: 'd', n1: 7, n2: 9 },
      { id64: 9900533028n, l1: 'o', l2: 'd', l3: 't', mcode: 'e', n1: 3, n2: 2 },
      { id64: 700940949n, l1: 'i', l2: 'm', l3: 'w', mcode: 'f', n1: 1, n2: 1 },
      { id64: 20570446n, l1: 'e', l2: 'g', l3: 'y', mcode: 'g', n1: 0, n2: 0 },
      { id64: 36141223n, l1: 'a', l2: 'a', l3: 'a', mcode: 'h', n1: 0, n2: 4 },
    ];
    const letter = (c: string) => c.charCodeAt(0) - 'a'.charCodeAt(0);

    it('decodes and re-encodes reference id64s across all mass codes', () => {
      for (const ref of REFERENCE_SYSTEMS) {
        const sys = PGSystem.fromSystemAddress(ref.id64);
        expect(sys.regionName).toBe('Blae Eock');
        expect(sys.mid1a).toBe(letter(ref.l1));
        expect(sys.mid1b).toBe(letter(ref.l2));
        expect(sys.mid2).toBe(letter(ref.l3));
        expect(sys.sizeClass).toBe(letter(ref.mcode));
        expect(sys.mid3).toBe(ref.n1);
        expect(sys.sequence).toBe(ref.n2);
        expect(sys.toSystemAddress()).toBe(ref.id64);
      }
    });

    it('round-trips a sequence wider than 15 bits', () => {
      // The sequence field is 11 + 3*sizeClass bits; for mass code d that is 20
      // bits, so 40000 must survive decode -> encode.
      const sys = PGSystem.fromSystemAddress(KNOWN_ID64);
      sys.sequence = 40000;
      expect(PGSystem.fromSystemAddress(sys.toSystemAddress()).sequence).toBe(40000);
    });

    it('round-trips the modulated-address form losslessly', () => {
      for (const ref of REFERENCE_SYSTEMS) {
        const sys = PGSystem.fromSystemAddress(ref.id64);
        const back = PGSystem.fromModSystemAddress(sys.toModSystemAddress());
        // toPGName interpolates the region, letters, size class, n1 and n2, so
        // one comparison covers every field.
        expect(back.toPGName()).toBe(sys.toPGName());
      }
    });

    it('rejects encoding instead of emitting a wrong address', () => {
      // Unknown sector: the synthesised region origin is invalid.
      const [okUnknown, unknown] = PGSystem.tryParse('Totally Made Up XY-Z d1-2');
      expect(okUnknown).toBe(true);
      expect(() => unknown.toSystemAddress()).toThrowError(/Unknown sector/);
      expect(() => unknown.toModSystemAddress()).toThrowError(/Unknown sector/);

      // Letter code outside the sector for the size class: an h-class sector
      // holds a single boxel, so only AA-A is valid.
      const [okRange, outOfRange] = PGSystem.tryParse('Blae Eock KC-C h0-0');
      expect(okRange).toBe(true);
      expect(() => outOfRange.toSystemAddress()).toThrowError(RangeError);

      // Sequence too large for the field.
      const [okSeq, seqTooBig] = PGSystem.tryParse('Blae Eock KC-C d0-70000');
      expect(okSeq).toBe(true);
      expect(() => seqTooBig.toModSystemAddress()).toThrowError(RangeError);

      // Fragment-valid sector name that resolves outside the galaxy's 6-bit
      // y-sector range: the address fields cannot represent it.
      const [okGal, outOfGalaxy] = PGSystem.tryParse('Pyruetchoo AA-A d0');
      expect(okGal).toBe(true);
      expect(() => outOfGalaxy.toSystemAddress()).toThrowError(/does not fit/);
      expect(() => outOfGalaxy.toModSystemAddress()).toThrowError(/does not fit/);
    });

    it('encodes a parsed PG name to the known system address', () => {
      const [ok, sys] = PGSystem.tryParse('Blae Eock KC-C d0-0');
      expect(ok).toBe(true);
      expect(sys.toSystemAddress()).toBe(KNOWN_ID64);
    });

    it('encodes names in hand-authored regions with non-boxel-aligned origins', () => {
      // Real in-game systems (id64s from EDSM). Both regions have catalogued
      // origins that are not aligned to the boxel grid, so the letter code
      // legitimately reaches one boxel past sizeX/boxelSize.
      const cases = [
        { name: 'Col 285 Sector IB-X b30-0', id64: 669612516897n },
        { name: 'Cepheus Dark Region B Sector AF-Q b5-0', id64: 659412493657n },
      ];
      for (const c of cases) {
        const [ok, sys] = PGSystem.tryParse(c.name);
        expect(ok).toBe(true);
        expect(sys.toSystemAddress()).toBe(c.id64);
      }
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

    it('parses the n1-n2 form into mid3 and sequence', () => {
      // The last case checks mid3 comes from the system suffix, not from digits
      // in the sector name itself.
      const cases = [
        { name: 'Blae Eock kc-c d0-0', region: 'Blae Eock', mid3: 0, seq: 0 },
        { name: 'Synuefe EN-H d11-96', region: 'Synuefe', mid3: 11, seq: 96 },
        { name: 'Col 285 Sector IY-W b16-8', region: 'Col 285 Sector', mid3: 16, seq: 8 },
      ];
      for (const c of cases) {
        const [ok, sys] = PGSystem.tryParse(c.name);
        expect(ok).toBe(true);
        expect(sys.regionName).toBe(c.region);
        expect(sys.mid3).toBe(c.mid3);
        expect(sys.sequence).toBe(c.seq);
      }
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
