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
    const ring = makeRing('Ring', planet, 100_000, 200_000);
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
    // Ring outer radius + the moon's (unset) radius, plus the ring's half-thickness reach.
    expect(status.combinedRadiiKm).toBe(200_007.5);
    expect(status.nextCollision).not.toBeNull();
    expect(status.nextCollision!.days).toBeLessThan(1);
    expect(status.upcomingCollisions.length).toBeGreaterThan(0);

    // And the ring itself reports the same collision from its side.
    const ringStatus = service.detectRingCollisionStatus(ring, now);
    expect(ringStatus.isCandidate).toBe(true);
    expect(ringStatus.partner?.name).toBe('Moon');
  });

  it('names the ring, not its host body, in the CollisionWindow.partnerName of a direct body-on-ring contact', () => {
    // resolveRingOrbitPair's direct-orbit branch stands the ring's host in as a stationary
    // reference point — its display name must still be the ring's own (ringDisplayName-derived)
    // name, not the host body's bare name, since a ring's own bodyData.name is already stripped
    // of that host prefix at parse time (see ringCollisionExtent's docs).
    const planet = makeBody('Planet', null, { type: BODY_TYPE.Star });
    makeRing('Ring', planet, 100_000, 200_000);
    const moon = makeBody('Moon', planet, {
      semiMajorAxis: 200_000 / KM_PER_AU, orbitalEccentricity: 0.25, orbitalPeriod: 5,
      meanAnomaly: 0, argOfPeriapsis: 0, ascendingNode: 0, orbitalInclination: 0, timestamps: ts,
    });

    const windows = service.ringContactsWithin(moon, planet.subBodies[0], 30, now);
    expect(windows.length).toBeGreaterThan(0);
    expect(windows[0].partnerName).toBe('Planet Ring');
  });

  it('extends a body-on-ring contact by the body\'s own radius, unlike a ring-on-ring pair', () => {
    // A solid body isn't confined to a plane the way a ring is, so it can reach a ring's inner
    // edge from its far side too. Periapsis (≈97,000 km) sits just inside the ring's inner edge
    // (100,000 km) — a bare centre-distance test would call this a near-miss below the band — but
    // is within reach once the moon's own 5,000 km radius is added: 97,000 + 5,000 = 102,000 km,
    // comfortably past the inner edge. So contact should stay one continuous window through
    // periapsis, not split into two around it. Apoapsis (210,000 km) is well past the outer edge
    // (200,000 km — also widened by the moon's own radius, to 205,007.5 km) so the window still
    // closes normally on both sides rather than never breaking contact at all.
    const planet = makeBody('Planet', null, { type: BODY_TYPE.Star });
    makeRing('Ring', planet, 100_000, 200_000);
    const moon = makeBody('Moon', planet, {
      semiMajorAxis: (97_000 + 210_000) / 2 / KM_PER_AU,
      orbitalEccentricity: (210_000 - 97_000) / (210_000 + 97_000), orbitalPeriod: 5,
      radius: 5_000,
      meanAnomaly: 0, argOfPeriapsis: 0, ascendingNode: 0, orbitalInclination: 0, timestamps: ts,
    });

    const status = service.detectRingCollisionStatus(moon, now);
    expect(status.isCandidate).toBe(true);
    expect(status.nextCollision).not.toBeNull();
    // The window's own true minimum (periapsis), not a band edge — confirming it wasn't clipped.
    expect(status.nextCollision!.minSeparationKm).toBeCloseTo(97_000, 0);
  });

  it('does not flag a moon whose orbit never comes close enough to the rings', () => {
    const planet = makeBody('Planet', null, { type: BODY_TYPE.Star });
    makeRing('Ring', planet, 100_000, 200_000);
    const moon = makeBody('Moon', planet, {
      semiMajorAxis: 1_000_000 / KM_PER_AU, orbitalEccentricity: 0.01, orbitalPeriod: 30,
      meanAnomaly: 0, argOfPeriapsis: 0, ascendingNode: 0, orbitalInclination: 0, timestamps: ts,
    });

    expect(service.detectRingCollisionStatus(moon, now).isCandidate).toBe(false);
  });

  it('does not flag a planet against its own rings', () => {
    const planet = makeBody('Planet', null, { type: BODY_TYPE.Star });
    const ring = makeRing('Ring', planet, 100_000, 200_000);
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

  it('flags a moon of one binary component reaching into the rings of the other ("nested" — exact orbit superposition)', () => {
    // The exact #151 scenario: bodies 1 and 2 orbit a shared barycentre, body 2 has rings, and 1a
    // is a moon of body 1 (not of the barycentre directly). 1a's absolute motion is the exact
    // superposition of its own orbit and body 1's (see nestedPositionFunction) — tracked directly,
    // not approximated by widening the contact band with 1a's periapsis/apoapsis reach the way an
    // earlier, reverted version of this feature did, which counted *any* body1-body2 conjunction
    // as a hit regardless of where 1a actually was at that moment.
    const barycentre = makeBody('Barycentre', null, { type: BODY_TYPE.Barycentre });
    const body1 = makeBody('1', barycentre, {
      semiMajorAxis: 0.0000468578213261962, orbitalEccentricity: 0.198392, orbitalInclination: -4.164512,
      argOfPeriapsis: 173.768076, ascendingNode: -100.3383, meanAnomaly: 233.703906,
      orbitalPeriod: 0.283064148217593, timestamps: ts,
    });
    const body2 = makeBody('2', barycentre, {
      semiMajorAxis: 0.0000823957132312579, orbitalEccentricity: 0.198392, orbitalInclination: -4.164512,
      argOfPeriapsis: 353.76807, ascendingNode: -100.3383, meanAnomaly: 233.703906,
      orbitalPeriod: 0.283064148217593, timestamps: ts,
    });
    // Body 1 & 2's own separation dips to ≈15,499.9 km at their shared periapsis (see the binary
    // test above) and rises to ≈23,172.2 km at apoapsis. 1a orbits body 1 in the *same* orbital
    // plane, at mean anomaly 180° from body 1's own periapsis direction — i.e. pointing the
    // opposite way, toward body 2 — with a 1,000 km circular radius, so right at body 1/2's own
    // periapsis its full 1,000 km reach subtracts from their 15,499.9 km separation, landing at
    // ≈14,501 km: inside the ring's [14,000, 15,000] band. 1a's own period (10 days) is
    // deliberately long relative to the ~2.4 h until that periapsis so its phase barely drifts
    // from 180° by the time it matters (confirmed numerically: minimum separation 14,501 km).
    makeRing('Ring', body2, 14_000, 15_000);
    const moon1a = makeBody('1 a', body1, {
      semiMajorAxis: 1_000 / KM_PER_AU, orbitalEccentricity: 0,
      argOfPeriapsis: 173.768076, ascendingNode: -100.3383, orbitalInclination: -4.164512,
      meanAnomaly: 180, orbitalPeriod: 10, timestamps: ts,
    });

    const status = service.detectRingCollisionStatus(moon1a, now);
    expect(status.isCandidate).toBe(true);
    expect(status.partner?.name).toBe('2 Ring');
    expect(status.self?.kind).toBe('body');
    expect(status.nextCollision).not.toBeNull();
    // The window opens ≈0.084 days (≈2 h) from now, well short of body 1 & 2's own periapsis at
    // ≈0.099 days — matching the moon's own 1,000 km reach extending the contact earlier.
    expect(status.nextCollision!.days).toBeGreaterThan(0.05);
    expect(status.nextCollision!.days).toBeLessThan(0.15);
  });

  it('does not flag a collision needing a shared ancestor above the two supported single-frame cases', () => {
    // A moon of a moon of body 1, reaching toward body 2's rings — one hop further than the
    // nested case above resolves. Still nothing physical is being compared at that remove, so
    // it's skipped entirely rather than guessed at.
    const barycentre = makeBody('Barycentre', null, { type: BODY_TYPE.Barycentre });
    const body1 = makeBody('1', barycentre, {
      semiMajorAxis: 0.01, orbitalEccentricity: 0, orbitalPeriod: 10,
      meanAnomaly: 0, argOfPeriapsis: 0, ascendingNode: 0, timestamps: ts,
    });
    const body2 = makeBody('2', barycentre, {
      semiMajorAxis: 0.01, orbitalEccentricity: 0, orbitalPeriod: 10,
      meanAnomaly: 0, argOfPeriapsis: 180, ascendingNode: 0, timestamps: ts,
    });
    makeRing('Ring', body2, 50_000, 100_000);
    const moon1a = makeBody('1 a', body1, { semiMajorAxis: 3_000_000 / KM_PER_AU, orbitalEccentricity: 0 });
    const moon1aMoon = makeBody('1 a 1', moon1a, { semiMajorAxis: 1_000 / KM_PER_AU, orbitalEccentricity: 0 });

    expect(service.detectRingCollisionStatus(moon1aMoon, now).isCandidate).toBe(false);
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
    const ring1 = makeRing('A Ring', body1, 8452, 8454.4);
    const ring2 = makeRing('A Ring', body2, 7104, 7123.8);

    const status = service.detectRingCollisionStatus(ring1, now);
    expect(status.isCandidate).toBe(true);
    expect(status.partner?.name).toBe('2 A Ring');
    // Both rings' outer edges, each reaching half a ring thickness further out.
    expect(status.combinedRadiiKm).toBeCloseTo(8454.4 + 7123.8 + 15, 5);
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

  it('flags a real "nested" system (Eoch Flyuae KS-V b18-2): a moon crossing its planet\'s binary sibling\'s rings', () => {
    // Real observed system values: bodies 1 & 2 are a locked binary pair (identical period, 180°
    // opposed argument of periapsis, sharing a barycentre — the same shape as the test above), and
    // 1 a is a real moon of body 1, not of the barycentre. Numerically confirmed offline (by
    // propagating both component orbits with this same math) to swing within a few hundred km of
    // body 2's rings every close approach, repeatedly, well inside the contact band.
    const barycentre = makeBody('Barycentre', null, { type: BODY_TYPE.Barycentre });
    const body1 = makeBody('1', barycentre, {
      semiMajorAxis: 0.0000476744237542346, orbitalEccentricity: 0.0869, orbitalInclination: -3.691517,
      argOfPeriapsis: 246.910533, ascendingNode: -16.844281, meanAnomaly: 46.56284,
      orbitalPeriod: 0.228280919016204, radius: 6363.211, timestamps: ts,
    });
    const body2 = makeBody('2', barycentre, {
      semiMajorAxis: 0.0000816701119758518, orbitalEccentricity: 0.0869, orbitalInclination: -3.691517,
      argOfPeriapsis: 66.910538, ascendingNode: -16.844281, meanAnomaly: 46.56284,
      orbitalPeriod: 0.228280919016204, radius: 5415.574, timestamps: ts,
    });
    makeRing('A Ring', body2, 8155.4, 8158.6);
    makeRing('B Ring', body2, 8158.7, 8173.0);
    const moon1a = makeBody('1 a', body1, {
      semiMajorAxis: 0.0000667281981855909, orbitalEccentricity: 0.000926, orbitalInclination: 5.715068,
      argOfPeriapsis: 356.875202, ascendingNode: -159.524488, meanAnomaly: 161.705977,
      orbitalPeriod: 0.106452093634259, radius: 337.0178125, timestamps: ts,
    });

    const status = service.detectRingCollisionStatus(moon1a, now);
    expect(status.isCandidate).toBe(true);
    expect(status.self?.kind).toBe('body');
    expect(['2 A Ring', '2 B Ring']).toContain(status.partner?.name);
    expect(status.nextCollision).not.toBeNull();
    // The next close approach is under one binary orbit (6.79 h ≈ 0.228 d) away.
    expect(status.nextCollision!.days).toBeGreaterThan(0);
    expect(status.nextCollision!.days).toBeLessThan(0.228280919016204);
    expect(status.upcomingCollisions.length).toBeGreaterThan(0);
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
    const ring1 = makeRing('B Ring', body1, 8454.5, 8470.4);
    makeRing('A Ring', body2, 7104, 7123.8);

    const status = service.detectRingCollisionStatus(ring1, now);
    expect(status.isCandidate).toBe(true);
    // Closest approach within a window is the band's inner edge, not the orbit's true minimum —
    // the bodies keep closing after contact breaks. Both rings' edges reach half a ring thickness
    // inward, so the edge sits 15 km below the bare sum of the inner radii.
    expect(status.nextCollision!.minSeparationKm).toBeCloseTo(8454.5 + 7104 - 15, 0);
    // Each contact is short (minutes), far shorter than the 6.79 h orbit.
    const durationMinutes = (status.nextCollision!.end.getTime() - status.nextCollision!.start.getTime()) / 60_000;
    expect(durationMinutes).toBeGreaterThan(0.5);
    expect(durationMinutes).toBeLessThan(15);
  });
});
