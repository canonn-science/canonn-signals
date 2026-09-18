import { OrbitalRelationsCore } from './orbital-relations.core';

/** Exercise the numeric search separately from orbital propagation, with known minima. */
describe('sampled collision minimum refinement', () => {
  const minimum = (sep: (t: number) => number, center: number, half: number) =>
    (new OrbitalRelationsCore() as unknown as {
      sampledMinimum(sep: (t: number) => number, center: number, half: number): { t: number; sepKm: number };
    }).sampledMinimum(sep, center, half);

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

/** The coarse scan's global cap can widen a bracket across many fast orbits. */
describe('nested collision search resolution', () => {
  it.each([false, true])('uses wide refinement only when the sample cap widens the bracket (capped=%s)', capped => {
    const core = new OrbitalRelationsCore() as unknown as {
      sampledMinimum(sep: (t: number) => number, center: number, half: number): { t: number; sepKm: number };
      zoomToMinimum(sep: (t: number) => number, center: number, half: number): { t: number; sepKm: number };
      nestedContactWindows(
        a: (t: number) => { x: number; y: number; z: number },
        b: (t: number) => { x: number; y: number; z: number },
        fastDays: number, slowDays: number, maxKm: number, minKm: number,
        now: number, count: number, horizonMs: number, name: string,
      ): unknown[];
    };
    const sampled = vi.spyOn(core, 'sampledMinimum');
    const wide = vi.spyOn(core, 'zoomToMinimum');
    const day = 86_400_000;
    // A smooth separation with a minimum inside the next day and a finite contact.
    const position = (t: number) => ({ x: 100 + 10 * Math.cos(2 * Math.PI * t / day), y: 0, z: 0 });
    const windows = core.nestedContactWindows(
      position, () => ({ x: 0, y: 0, z: 0 }), 1, capped ? 100 : 1,
      91, 0, 0, 1, Infinity, 'partner',
    );
    expect(windows).toHaveLength(1);
    expect(sampled.mock.calls.length > 0).toBe(!capped);
    expect(wide.mock.calls.length > 0).toBe(capped);
  });
});
