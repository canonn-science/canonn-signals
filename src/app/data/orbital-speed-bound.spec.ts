import { OrbitalRelationsCore } from './orbital-relations.core';
import type { CanonnBiostatsBody } from '../home/home.component';
import { swoiwnsCollisionFamily } from './fixtures/swoiwns-collision';

describe('nested collision speed bound', () => {
  const engine = () => new OrbitalRelationsCore();
  const speed = (body: CanonnBiostatsBody) => (engine() as unknown as {
    maximumOrbitalSpeed(body: CanonnBiostatsBody): number;
  }).maximumOrbitalSpeed(body);

  it('uses periapsis speed with AU/day converted to km/ms', () => {
    const circular = { ...swoiwnsCollisionFamily().bodyData, semiMajorAxis: 1, orbitalPeriod: 1, orbitalEccentricity: 0 };
    const circleSpeed = 2 * Math.PI * 149_597_870.7 / 86_400_000;
    expect(speed(circular)).toBeCloseTo(circleSpeed, 12);
    // At e=0.6 the periapsis-speed multiplier is sqrt(1.6/0.4) = 2.
    expect(speed({ ...circular, orbitalEccentricity: 0.6 })).toBeCloseTo(2 * circleSpeed, 12);
  });

  it('disables pruning when a trustworthy speed cannot be derived', () => {
    const body = swoiwnsCollisionFamily().bodyData;
    for (const invalid of [
      { orbitalPeriod: 0 }, { orbitalPeriod: NaN }, { semiMajorAxis: Infinity },
      { semiMajorAxis: -1 }, { orbitalEccentricity: 1 }, { orbitalEccentricity: NaN },
    ]) {
      expect(speed({ ...body, ...invalid })).toBe(Infinity);
    }
  });

  it('preserves Swoiwns moon contacts while rejecting thousands of unreachable minima', () => {
    const core = engine();
    const refinements = vi.spyOn(core as unknown as {
      sampledMinimum(...args: unknown[]): unknown;
    }, 'sampledMinimum');
    const root = swoiwnsCollisionFamily();
    const now = Date.parse('2026-08-17T19:39:35Z');
    const moons = [root.subBodies[0].subBodies[0], root.subBodies[1].subBodies[0]];
    const expected = [
      [
        ['2026-10-31T19:00:14.978Z', '2026-10-31T19:20:24.609Z'],
        ['2026-11-01T00:44:12.942Z', '2026-11-01T01:08:30.194Z'],
        ['2026-11-01T12:32:41.285Z', '2026-11-01T12:51:34.334Z'],
      ],
      [
        ['2026-10-31T15:01:44.901Z', '2026-10-31T15:54:51.433Z'],
        ['2026-11-01T18:29:03.503Z', '2026-11-01T19:16:33.903Z'],
      ],
    ];
    moons.forEach((moon, i) => {
      const status = core.detectCollisionStatus(moon, now);
      expect(status.isCandidate).toBe(true);
      const auntName = root.subBodies[1 - i].bodyData.name;
      const auntContacts = status.upcomingCollisions.filter(w => w.partnerName === auntName);
      expect(auntContacts.map(w => [w.start.toISOString(), w.end.toISOString()])).toEqual(expected[i]);
      // The rebased feature branch also detects contacts with the aunt's moon.
      const cousinContacts = status.upcomingCollisions.filter(w => w.partnerName === moons[1 - i].bodyData.name);
      expect(cousinContacts).toHaveLength(3);
      expect(Math.abs(cousinContacts[0].start.getTime() - Date.parse('2026-10-31T14:49:45.960Z'))).toBeLessThanOrEqual(1);
    });
    // The original aunt-only searches performed 5,572 refinements. Keep the
    // expanded searches, including cousin contacts, well below that cost.
    expect(refinements.mock.calls.length).toBeGreaterThan(0);
    expect(refinements.mock.calls.length).toBeLessThan(100);
  });
});
