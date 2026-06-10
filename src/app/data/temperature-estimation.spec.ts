import {
  estimateTempRange,
  isTempSafe,
  DELTA_GLOBAL,
  DELTA_BY_SUBTYPE_ATMOSPHERE,
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
});
