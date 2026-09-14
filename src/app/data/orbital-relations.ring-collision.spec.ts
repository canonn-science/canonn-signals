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

  it('flags a moon whose orbit crosses its own planet\'s rings ("Body on Ring")', () => {
    const planet = makeBody('Planet', null, { type: BODY_TYPE.Star });
    const ring = makeRing('Planet Ring', planet, 100_000, 200_000);
    // Moon's periapsis/apoapsis (150,000 - 250,000 km) overlaps the ring band.
    const moonSMA = 200_000 / KM_PER_AU;
    const moon = makeBody('Moon', planet, { semiMajorAxis: moonSMA, orbitalEccentricity: 0.25, orbitalPeriod: 5 });

    const status = service.detectRingCollisionStatus(moon);
    expect(status.isCandidate).toBe(true);
    expect(status.partner?.name).toBe('Planet Ring');
    expect(status.partner?.kind).toBe('ring');
    expect(status.self?.kind).toBe('body');
    expect(status.overlapKm).not.toBeNull();

    // And the ring itself reports the same collision from its side.
    const ringStatus = service.detectRingCollisionStatus(ring);
    expect(ringStatus.isCandidate).toBe(true);
    expect(ringStatus.partner?.name).toBe('Moon');
  });

  it('does not flag a moon whose orbit stays well clear of the rings', () => {
    const planet = makeBody('Planet', null, { type: BODY_TYPE.Star });
    makeRing('Planet Ring', planet, 100_000, 200_000);
    // Moon orbits far beyond the ring, with a tiny eccentricity — no overlap.
    const moonSMA = 1_000_000 / KM_PER_AU;
    const moon = makeBody('Moon', planet, { semiMajorAxis: moonSMA, orbitalEccentricity: 0.01, orbitalPeriod: 30 });

    expect(service.detectRingCollisionStatus(moon).isCandidate).toBe(false);
  });

  it('does not flag a planet against its own rings', () => {
    const planet = makeBody('Planet', null, { type: BODY_TYPE.Star, semiMajorAxis: 1, orbitalEccentricity: 0, orbitalPeriod: 100 });
    const ring = makeRing('Planet Ring', planet, 100_000, 200_000);
    expect(service.detectRingCollisionStatus(ring).isCandidate).toBe(false);
  });

  it('does not flag adjacent rings around the same host as colliding with each other', () => {
    const planet = makeBody('Planet', null, { type: BODY_TYPE.Star });
    const innerRing = makeRing('Inner Ring', planet, 100_000, 150_000);
    makeRing('Outer Ring', planet, 150_000, 200_000);
    expect(service.detectRingCollisionStatus(innerRing).isCandidate).toBe(false);
  });

  it('flags a moon of one barycentre component crossing into the rings of the other ("Body on Ring" across a shared ancestor)', () => {
    // Mirrors the feature request's example: bodies 1 and 2 orbit a shared barycentre, body 2
    // has rings, and 1a (a moon of body 1) is close enough to reach into them.
    const barycentre = makeBody('Barycentre', null, { type: BODY_TYPE.Barycentre });
    const body1 = makeBody('1', barycentre, { semiMajorAxis: 0.01, orbitalEccentricity: 0, orbitalPeriod: 10 });
    const body2 = makeBody('2', barycentre, { semiMajorAxis: 0.01, orbitalEccentricity: 0, orbitalPeriod: 10 });
    const ring = makeRing('2 Ring', body2, 50_000, 100_000);
    // 1a's own orbit around body 1 is wide enough that, combined with body 1's distance from the
    // barycentre, its reach overlaps body 2's ring band.
    const moon1a = makeBody('1 a', body1, { semiMajorAxis: 3_000_000 / KM_PER_AU, orbitalEccentricity: 0, orbitalPeriod: 2 });

    const status = service.detectRingCollisionStatus(moon1a);
    expect(status.isCandidate).toBe(true);
    expect(status.partner?.name).toBe('2 Ring');
    expect(status.partner?.kind).toBe('ring');
  });

  it('does not flag a barycentre-sibling\'s moon whose reach falls well short of the other\'s rings', () => {
    const barycentre = makeBody('Barycentre', null, { type: BODY_TYPE.Barycentre });
    // Very different radial distances from the barycentre, so even the widened envelope for
    // 1a's own small orbit can't reach across to body 2's rings.
    const body1 = makeBody('1', barycentre, { semiMajorAxis: 0.01, orbitalEccentricity: 0, orbitalPeriod: 10 });
    const body2 = makeBody('2', barycentre, { semiMajorAxis: 1, orbitalEccentricity: 0, orbitalPeriod: 1000 });
    makeRing('2 Ring', body2, 50_000, 100_000);
    // A tiny, tight moon orbit nowhere near reaching across to body 2's rings.
    const moon1a = makeBody('1 a', body1, { semiMajorAxis: 10_000 / KM_PER_AU, orbitalEccentricity: 0, orbitalPeriod: 2 });

    expect(service.detectRingCollisionStatus(moon1a).isCandidate).toBe(false);
  });

  it('flags two sibling planets\' rings that overlap while the planets themselves stay clear ("Ring on Ring")', () => {
    const star = makeBody('Star', null, { type: BODY_TYPE.Star });
    const planetA = makeBody('A', star, { semiMajorAxis: 100_000_000 / KM_PER_AU, orbitalEccentricity: 0, orbitalPeriod: 100 });
    const planetB = makeBody('B', star, { semiMajorAxis: 100_500_000 / KM_PER_AU, orbitalEccentricity: 0, orbitalPeriod: 105 });
    const ringA = makeRing('A Ring', planetA, 50_000, 100_000);
    // B's ring extends far enough sunward to reach into A's ring band, even though the planets'
    // own orbital distances (400,000 km apart) don't overlap.
    makeRing('B Ring', planetB, 50_000, 450_000);

    const status = service.detectRingCollisionStatus(ringA);
    expect(status.isCandidate).toBe(true);
    expect(status.partner?.name).toBe('B Ring');
    expect(status.partner?.kind).toBe('ring');
    expect(status.self?.kind).toBe('ring');
  });

  it('returns no candidate for a plain body-body pair (handled by planetary collision instead)', () => {
    const star = makeBody('Star', null, { type: BODY_TYPE.Star });
    const planetA = makeBody('A', star, { semiMajorAxis: 1, orbitalEccentricity: 0, orbitalPeriod: 100 });
    makeBody('B', star, { semiMajorAxis: 1, orbitalEccentricity: 0, orbitalPeriod: 150 });

    expect(service.detectRingCollisionStatus(planetA).isCandidate).toBe(false);
  });
});
