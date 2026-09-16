import { OrbitalRelationsCore } from './orbital-relations.core';

/** Exercise the numeric search separately from orbital propagation, with known minima. */
describe('periodic collision minimum refinement', () => {
  const minimum = (sep: (t: number) => number, center: number, half: number) =>
    (new OrbitalRelationsCore() as unknown as {
      periodicMinimum(sep: (t: number) => number, center: number, half: number): { t: number; sepKm: number };
    }).periodicMinimum(sep, center, half);

  it('refines a minimum between coarse samples with bounded evaluation cost', () => {
    const epoch = Date.parse('2026-08-17T19:39:35Z');
    const expected = epoch + 123_456.789;
    let evaluations = 0;
    const result = minimum(t => {
      evaluations++;
      return 15_000 + ((t - expected) / 1000) ** 2;
    }, epoch, 12_000_000);
    expect(Math.abs(result.t - expected)).toBeLessThan(1);
    expect(result.sepKm).toBeCloseTo(15_000, 6);
    // Guard the CPU improvement without relying on noisy wall-clock timing.
    expect(evaluations).toBeLessThan(2200);
  });

  it('finds a narrow deeper basin even when the broad basin has the lowest coarse sample', () => {
    const expected = 123_450.123;
    const result = minimum(t => Math.min(
      1 + ((t - expected) / 100) ** 2,
      2 + ((t + 800_000) / 100_000) ** 2,
    ), 0, 1_000_000);
    expect(Math.abs(result.t - expected)).toBeLessThan(1);
    expect(result.sepKm).toBeCloseTo(1, 4);
  });

  it('returns a finite minimum for a flat curve and a sub-second search interval', () => {
    expect(minimum(() => 42, 1_000_000, 100)).toEqual({ t: 1_000_000, sepKm: 42 });
  });
});
