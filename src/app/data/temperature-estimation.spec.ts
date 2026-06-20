import {
  estimateTempRange,
  isTempSafe,
  lookupTempDelta,
  DELTA_GLOBAL,
  DELTA_BY_SUBTYPE_ATMOSPHERE,
  DELTA_BY_SUBTYPE_NO_ATM,
  DELTA_BY_SUBTYPE,
  DELTA_BY_ATMOSPHERE,
  DELTA_BY_PRESSURE,
} from './temperature-estimation';

describe('temperature-estimation', () => {
  describe('isTempSafe', () => {
    it('treats the on-foot safe band [182, 700) Kelvin as safe', () => {
      expect(isTempSafe(182)).toBe(true);
      expect(isTempSafe(300)).toBe(true);
      expect(isTempSafe(699)).toBe(true);
    });

    it('treats temperatures below 182K or at/above 700K as unsafe', () => {
      expect(isTempSafe(181)).toBe(false);
      expect(isTempSafe(700)).toBe(false);
      expect(isTempSafe(1500)).toBe(false);
    });
  });

  describe('estimateTempRange', () => {
    it('uses the most specific (subType + atmosphere) delta when available', () => {
      const delta = DELTA_BY_SUBTYPE_ATMOSPHERE['Rocky body|Thin Carbon dioxide'];
      const r = estimateTempRange(200, 'Rocky body', 'Thin Carbon dioxide', 0.005);
      expect(r.min).toBeCloseTo(200 + delta.p5, 2);
      expect(r.max).toBeCloseTo(200 + delta.p95, 2);
    });

    it('falls back to the global delta when nothing else matches', () => {
      const r = estimateTempRange(100, null, null, null);
      expect(r.min).toBeCloseTo(100 + DELTA_GLOBAL.p5, 2);
      expect(r.max).toBeCloseTo(100 + DELTA_GLOBAL.p95, 2);
    });

    it('always returns min <= max', () => {
      const r = estimateTempRange(250, 'Icy body', 'Thin Argon', 0.01);
      expect(r.min).toBeLessThanOrEqual(r.max);
    });

    it('trims whitespace on inputs before matching', () => {
      const exact = estimateTempRange(200, 'Rocky body', 'Thin Carbon dioxide', 0.005);
      const padded = estimateTempRange(200, '  Rocky body  ', ' Thin Carbon dioxide ', 0.005);
      expect(padded.min).toBeCloseTo(exact.min, 5);
      expect(padded.max).toBeCloseTo(exact.max, 5);
    });
  });

  describe('lookupTempDelta', () => {
    it('reports the subType + atmosphere rule as the most specific source', () => {
      const r = lookupTempDelta('Rocky body', 'Thin Carbon dioxide', 0.005);
      expect(r.delta).toBe(DELTA_BY_SUBTYPE_ATMOSPHERE['Rocky body|Thin Carbon dioxide']);
      expect(r.source).toBe('SubType + Atmosphere (Rocky body / Thin Carbon dioxide)');
    });

    it('uses the no-atmosphere subType rule when pressure is zero', () => {
      const r = lookupTempDelta('Rocky body', null, 0);
      expect(r.delta).toBe(DELTA_BY_SUBTYPE_NO_ATM['Rocky body']);
      expect(r.source).toBe('SubType + No Atmosphere (Rocky body)');
    });

    it('matches the subType + "nan" combined rule before the generic no-atmosphere rule', () => {
      // Every no-atmosphere subType also has a specific "<subType>|nan" combined entry,
      // which is more specific and therefore wins.
      const r = lookupTempDelta('Icy body', 'nan', null);
      expect(r.delta).toBe(DELTA_BY_SUBTYPE_ATMOSPHERE['Icy body|nan']);
    });

    it('treats the "nan" sentinel as no atmosphere when no combined rule exists', () => {
      // Unknown subType: step 1 misses, so the "nan" sentinel routes to the pressure
      // path rather than an atmosphere-type match.
      const r = lookupTempDelta('Unknown world', 'nan', null);
      expect(r.source).toBe('Global fallback');
    });

    it('falls back to subType alone', () => {
      const r = lookupTempDelta('Icy body', 'Some unknown atmosphere', 5);
      expect(r.delta).toBe(DELTA_BY_SUBTYPE['Icy body']);
      expect(r.source).toBe('SubType (Icy body)');
    });

    it('falls back to atmosphere type when subType is unknown', () => {
      const r = lookupTempDelta('Unknown world', 'Thin Argon', 0.005);
      expect(r.delta).toBe(DELTA_BY_ATMOSPHERE['Thin Argon']);
      expect(r.source).toBe('Atmosphere type (Thin Argon)');
    });

    it('falls back to a pressure class when only pressure is known', () => {
      const r = lookupTempDelta(null, null, 0.005);
      expect(r.delta).toBe(DELTA_BY_PRESSURE['Trace']);
      expect(r.source).toBe('Pressure class (Trace)');
    });

    it('falls back to the global delta when nothing matches', () => {
      const r = lookupTempDelta(null, null, null);
      expect(r.delta).toBe(DELTA_GLOBAL);
      expect(r.source).toBe('Global fallback');
    });

    it('agrees with estimateTempRange', () => {
      const surfTemp = 250;
      const { delta } = lookupTempDelta('Icy body', 'Thin Argon', 0.01);
      const range = estimateTempRange(surfTemp, 'Icy body', 'Thin Argon', 0.01);
      expect(range.min).toBeCloseTo(surfTemp + delta.p5, 5);
      expect(range.max).toBeCloseTo(surfTemp + delta.p95, 5);
    });
  });
});
