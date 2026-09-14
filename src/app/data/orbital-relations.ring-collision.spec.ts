import { OrbitalRelationsService } from './orbital-relations.service';
import { SystemBody, CanonnBiostatsBody } from '../home/home.component';
import { BODY_TYPE } from './body-types';

/** Astronomical unit in km, matching the constant used internally by the service. */
const KM_PER_AU = 149597870.7;

describe('OrbitalRelationsService.detectRingCollisionStatus', () => {
  let service: OrbitalRelationsService;

  beforeEach(() => {
    service = new OrbitalRelationsService();
  });

  /** A minimal body node with the given partial data, parented under `parent`. */
  function makeBody(name: string, parent: SystemBody | null, data: Partial<CanonnBiostatsBody>): SystemBody {
    const body: SystemBody = {
      bodyData: { bodyId: 0, name, id64: 0n, subType: '', type: BODY_TYPE.Planet, ...data } as CanonnBiostatsBody,
      subBodies: [],
      parent,
    };
    if (parent) { parent.subBodies.push(body); }
    return body;
  }

  /** A ring node (innerRadius/outerRadius already in km, as materialised by HomeComponent). */
  function makeRing(name: string, host: SystemBody, innerRadius: number, outerRadius: number): SystemBody {
    return makeBody(name, host, { type: BODY_TYPE.Ring, innerRadius, outerRadius });
  }

  const now = Date.parse('2026-08-17T19:39:35Z');
  const ts = { meanAnomaly: '2026-08-17T19:39:35Z' } as CanonnBiostatsBody['timestamps'];

  it('flags a moon whose orbit is timed to cross its own planet\'s rings ("Body on Ring")', () => {
    const planet = makeBody('Planet', null, { type: BODY_TYPE.Star });
    const ring = makeRing('Planet Ring', planet, 100_000, 200_000);
    // Periapsis (150,000 km) sits inside the ring band, and meanAnomaly 0 places the moon at
    // periapsis right now, so it should already be in contact.
    const moon = makeBody('Moon', planet, {
      semiMajorAxis: 200_000 / KM_PER_AU, orbitalEccentricity: 0.25, orbitalPeriod: 5,
      meanAnomaly: 0, argOfPeriapsis: 0, ascendingNode: 0, orbitalInclination: 0, timestamps: ts,
    });

    const status = service.detectRingCollisionStatus(moon, now);
    expect(status.isCandidate).toBe(true);
    expect(status.partner?.name).toBe('Planet Ring');
    expect(status.partner?.kind).toBe('ring');
    expect(status.self?.kind).toBe('body');
    expect(status.combinedRadiiKm).toBe(200_000);
    expect(status.nextCollision).not.toBeNull();
    expect(status.nextCollision!.days).toBeLessThan(1);
    expect(status.upcomingCollisions.length).toBeGreaterThan(0);

    // And the ring itself reports the same collision from its side.
    const ringStatus = service.detectRingCollisionStatus(ring, now);
    expect(ringStatus.isCandidate).toBe(true);
    expect(ringStatus.partner?.name).toBe('Moon');
  });

  it('does not flag a moon whose orbit never comes close enough to the rings', () => {
    const planet = makeBody('Planet', null, { type: BODY_TYPE.Star });
    makeRing('Planet Ring', planet, 100_000, 200_000);
    const moon = makeBody('Moon', planet, {
      semiMajorAxis: 1_000_000 / KM_PER_AU, orbitalEccentricity: 0.01, orbitalPeriod: 30,
      meanAnomaly: 0, argOfPeriapsis: 0, ascendingNode: 0, orbitalInclination: 0, timestamps: ts,
    });

    expect(service.detectRingCollisionStatus(moon, now).isCandidate).toBe(false);
  });

  it('does not flag a planet against its own rings', () => {
    const planet = makeBody('Planet', null, { type: BODY_TYPE.Star });
    const ring = makeRing('Planet Ring', planet, 100_000, 200_000);
    expect(service.detectRingCollisionStatus(ring, now).isCandidate).toBe(false);
  });

  it('does not flag adjacent rings around the same host as colliding with each other', () => {
    const planet = makeBody('Planet', null, { type: BODY_TYPE.Star });
    const innerRing = makeRing('Inner Ring', planet, 100_000, 150_000);
    makeRing('Outer Ring', planet, 150_000, 200_000);
    expect(service.detectRingCollisionStatus(innerRing, now).isCandidate).toBe(false);
  });

  it('returns no candidate for a plain body-body pair (handled by planetary collision instead)', () => {
    const star = makeBody('Star', null, { type: BODY_TYPE.Star });
    const planetA = makeBody('A', star, { semiMajorAxis: 1, orbitalEccentricity: 0, orbitalPeriod: 100 });
    makeBody('B', star, { semiMajorAxis: 1, orbitalEccentricity: 0, orbitalPeriod: 150 });

    expect(service.detectRingCollisionStatus(planetA, now).isCandidate).toBe(false);
  });

  it('does not flag a collision that would require crossing a shared barycentre several levels up', () => {
    // Mirrors the feature request's original example: bodies 1 and 2 orbit a shared barycentre,
    // body 2 has rings, and 1a is a moon of body 1 (not of the barycentre directly). 1a and the
    // ring don't share an immediate parent and 1a doesn't orbit the ring's host directly, so
    // there's no single orbital frame to time this — nothing physical is being compared, so it's
    // skipped entirely rather than guessed at.
    const barycentre = makeBody('Barycentre', null, { type: BODY_TYPE.Barycentre });
    const body1 = makeBody('1', barycentre, {
      semiMajorAxis: 0.01, orbitalEccentricity: 0, orbitalPeriod: 10,
      meanAnomaly: 0, argOfPeriapsis: 0, ascendingNode: 0, timestamps: ts,
    });
    const body2 = makeBody('2', barycentre, {
      semiMajorAxis: 0.01, orbitalEccentricity: 0, orbitalPeriod: 10,
      meanAnomaly: 0, argOfPeriapsis: 180, ascendingNode: 0, timestamps: ts,
    });
    makeRing('2 Ring', body2, 50_000, 100_000);
    const moon1a = makeBody('1 a', body1, {
      semiMajorAxis: 3_000_000 / KM_PER_AU, orbitalEccentricity: 0, orbitalPeriod: 2,
      meanAnomaly: 0, argOfPeriapsis: 0, ascendingNode: 0, timestamps: ts,
    });

    expect(service.detectRingCollisionStatus(moon1a, now).isCandidate).toBe(false);
  });

  it('flags two components of a binary — same period, 180° opposed, orbiting a shared barycentre — whose rings collide near their shared periapsis', () => {
    // Real observed system values (Musca Dark Region SO-Q b5-5 1 & 2): a double-planet pair
    // orbiting a common barycentre with identical period/eccentricity/inclination, opposed by
    // 180° in argument of periapsis, so they reach periapsis simultaneously — each orbit period
    // (6.79 hours) their combined ring extents dip just inside their mutual separation.
    const barycentre = makeBody('Barycentre', null, { type: BODY_TYPE.Barycentre });
    const body1 = makeBody('1', barycentre, {
      semiMajorAxis: 0.0000468578213261962, orbitalEccentricity: 0.198392, orbitalInclination: -4.164512,
      argOfPeriapsis: 173.768076, ascendingNode: -100.3383, meanAnomaly: 233.703906,
      orbitalPeriod: 0.283064148217593, radius: 5610.1045, timestamps: ts,
    });
    const body2 = makeBody('2', barycentre, {
      semiMajorAxis: 0.0000823957132312579, orbitalEccentricity: 0.198392, orbitalInclination: -4.164512,
      argOfPeriapsis: 353.76807, ascendingNode: -100.3383, meanAnomaly: 233.703906,
      orbitalPeriod: 0.283064148217593, radius: 4723.183, timestamps: ts,
    });
    const ring1 = makeRing('1 A Ring', body1, 8452, 8454.4);
    const ring2 = makeRing('2 A Ring', body2, 7104, 7123.8);

    const status = service.detectRingCollisionStatus(ring1, now);
    expect(status.isCandidate).toBe(true);
    expect(status.partner?.name).toBe('2 A Ring');
    expect(status.combinedRadiiKm).toBeCloseTo(8454.4 + 7123.8, 5);
    // Equal periods aren't treated as "never lap" here (unlike Trojan/rosette exclusion) — the
    // shared period is the recurrence interval itself: 0.283064148217593 days ≈ 6.79 hours.
    expect(status.synodicPeriodDays).toBeCloseTo(0.283064148217593, 9);
    expect(status.nextCollision).not.toBeNull();
    // Closest approach should land near the sum of the two periapsis distances (~15,500 km),
    // comfortably inside the combined ring extent (~15,578 km).
    expect(status.nextCollision!.minSeparationKm).toBeLessThan(status.combinedRadiiKm!);
    expect(status.nextCollision!.minSeparationKm).toBeGreaterThan(15_000);
    expect(status.upcomingCollisions.length).toBeGreaterThan(0);

    // The other ring reports the same collision from its side.
    const status2 = service.detectRingCollisionStatus(ring2, now);
    expect(status2.isCandidate).toBe(true);
    expect(status2.partner?.name).toBe('1 A Ring');

    // Each close approach yields *two* collisions, not one: the rings meet on the way in, pass
    // inside one another along the connecting line at closest approach (no contact), then meet
    // again on the way out. So consecutive windows alternate short gap / long gap, and the pair
    // of windows straddling one periapsis is much closer together than one orbital period.
    const gapsHours = status.upcomingCollisions.slice(1).map(
      (w, i) => (w.start.getTime() - status.upcomingCollisions[i].end.getTime()) / 3_600_000,
    );
    const shortGap = Math.min(...gapsHours);
    const longGap = Math.max(...gapsHours);
    expect(shortGap).toBeLessThan(1);            // the two halves of a single approach
    expect(longGap).toBeGreaterThan(5);          // waiting out the rest of the 6.79 h orbit
    expect(longGap).toBeLessThan(6.79);
  });

  it('splits a close ring-on-ring pass into two contacts either side of closest approach', () => {
    // Contact along the line joining the bodies needs innerA + innerB <= D <= outerA + outerB.
    // These orbits close to 15,499.9 km at periapsis — inside the band's lower edge — so the
    // rings part company at closest approach and touch twice per approach instead of once.
    const barycentre = makeBody('Barycentre', null, { type: BODY_TYPE.Barycentre });
    const body1 = makeBody('1', barycentre, {
      semiMajorAxis: 0.0000468578213261962, orbitalEccentricity: 0.198392, orbitalInclination: -4.164512,
      argOfPeriapsis: 173.768076, ascendingNode: -100.3383, meanAnomaly: 233.703906,
      orbitalPeriod: 0.283064148217593, radius: 5610.1045, timestamps: ts,
    });
    const body2 = makeBody('2', barycentre, {
      semiMajorAxis: 0.0000823957132312579, orbitalEccentricity: 0.198392, orbitalInclination: -4.164512,
      argOfPeriapsis: 353.76807, ascendingNode: -100.3383, meanAnomaly: 233.703906,
      orbitalPeriod: 0.283064148217593, radius: 4723.183, timestamps: ts,
    });
    const ring1 = makeRing('1 B Ring', body1, 8454.5, 8470.4);
    makeRing('2 A Ring', body2, 7104, 7123.8);

    const status = service.detectRingCollisionStatus(ring1, now);
    expect(status.isCandidate).toBe(true);
    // Closest approach within a window is the band's inner edge, not the orbit's true minimum —
    // the bodies keep closing after contact breaks.
    expect(status.nextCollision!.minSeparationKm).toBeCloseTo(8454.5 + 7104, 0);
    // Each contact is short (minutes), far shorter than the 6.79 h orbit.
    const durationMinutes = (status.nextCollision!.end.getTime() - status.nextCollision!.start.getTime()) / 60_000;
    expect(durationMinutes).toBeGreaterThan(0.5);
    expect(durationMinutes).toBeLessThan(15);
  });
});
