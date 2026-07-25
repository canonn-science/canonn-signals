import { CanonnBiostatsBody, SystemBody } from '../home/home.component';
import { BODY_TYPE } from './body-types';
import { influencingStar } from './influencing-star';

function makeBody(overrides: Partial<CanonnBiostatsBody> & { bodyId: number }): CanonnBiostatsBody {
  return {
    id64: BigInt(overrides.bodyId), name: `Body ${overrides.bodyId}`, type: BODY_TYPE.Planet, subType: '',
    ...overrides,
  };
}

/** Attaches `bodyData` as a child of `parent`, wiring up the SystemBody tree links. */
function child(parent: SystemBody, bodyData: CanonnBiostatsBody): SystemBody {
  const node: SystemBody = { bodyData, subBodies: [], parent };
  parent.subBodies.push(node);
  return node;
}

/** A circular, unperturbed orbit at `semiMajorAxis` AU, positioned on the +x axis at meanAnomaly 0. */
function circularOrbit(semiMajorAxis: number): Partial<CanonnBiostatsBody> {
  return { semiMajorAxis, orbitalEccentricity: 0, orbitalInclination: 0, ascendingNode: 0, argOfPeriapsis: 0, meanAnomaly: 0 };
}

describe('influencingStar', () => {
  it('returns the only star in a single-star system, trivially', () => {
    const star: SystemBody = {
      bodyData: makeBody({ bodyId: 0, type: BODY_TYPE.Star, subType: 'G (White-Yellow) Star', solarRadius: 1, surfaceTemperature: 5800 }),
      subBodies: [], parent: null,
    };
    const planet = child(star, makeBody({ bodyId: 1, ...circularOrbit(1) }));

    expect(influencingStar(planet)).toEqual({ star, method: 'only-star', starCount: 1 });
  });

  it('returns null when the system has no stars', () => {
    const barycentre: SystemBody = { bodyData: makeBody({ bodyId: 0, type: BODY_TYPE.Barycentre }), subBodies: [], parent: null };
    const planet = child(barycentre, makeBody({ bodyId: 1 }));

    expect(influencingStar(planet)).toBeNull();
  });

  it('picks the star with the dominant flux at the real 3D distance (hypothesis N)', () => {
    // Root star A sits at the system origin; star B orbits far out. A planet close to A but
    // far from B should be dominated by A's flux even though both stars are equally bright.
    const starA: SystemBody = {
      bodyData: makeBody({ bodyId: 0, type: BODY_TYPE.Star, subType: 'G (White-Yellow) Star', solarRadius: 1, surfaceTemperature: 5800 }),
      subBodies: [], parent: null,
    };
    const starB = child(starA, makeBody({
      bodyId: 1, type: BODY_TYPE.Star, subType: 'G (White-Yellow) Star', solarRadius: 1, surfaceTemperature: 5800,
      ...circularOrbit(1000),
    }));
    const planet = child(starA, makeBody({ bodyId: 2, ...circularOrbit(1) }));

    const result = influencingStar(planet);
    expect(result?.star).toBe(starA);
    expect(result?.method).toBe('flux-3d');
    expect(result?.starCount).toBe(2);
    void starB; // present as the losing candidate
  });

  it('falls back to the characteristic orbital-scale distance (hypothesis F) when phase data is missing', () => {
    // No meanAnomaly on either star, so the real 3D distance (N) is unresolvable for both
    // candidates; F only needs semiMajorAxis, so it still correctly favours the nearer star.
    const starA: SystemBody = {
      bodyData: makeBody({ bodyId: 0, type: BODY_TYPE.Star, subType: 'G (White-Yellow) Star', solarRadius: 1, surfaceTemperature: 5800 }),
      subBodies: [], parent: null,
    };
    const starB = child(starA, makeBody({
      bodyId: 1, type: BODY_TYPE.Star, subType: 'G (White-Yellow) Star', solarRadius: 1, surfaceTemperature: 5800,
      semiMajorAxis: 1000,
    }));
    const planet = child(starA, makeBody({ bodyId: 2, semiMajorAxis: 1 }));

    const result = influencingStar(planet);
    expect(result?.star).toBe(starA);
    expect(result?.method).toBe('flux-characteristic');
    void starB;
  });

  it('applies the neutron-star boost so it can still win a flux score it would otherwise lose', () => {
    // Equal radius/temperature on both stars isolates the effect to distance alone: the planet
    // sits at 1 AU from star A and sqrt(2) AU from the neutron, so the neutron's *unboosted*
    // flux (0.5) is exactly half of star A's (1) — star A would win unboosted — but the 2.5x
    // neutron boost (see N_BOOST) lifts it to 1.25, flipping the winner to the neutron.
    const starA: SystemBody = {
      bodyData: makeBody({ bodyId: 0, type: BODY_TYPE.Star, subType: 'G (White-Yellow) Star', solarRadius: 1, surfaceTemperature: 1 }),
      subBodies: [], parent: null,
    };
    const neutron = child(starA, makeBody({
      bodyId: 1, type: BODY_TYPE.Star, subType: 'Neutron Star', solarRadius: 1, surfaceTemperature: 1,
      ...circularOrbit(1 + Math.sqrt(2)),
    }));
    const planet = child(starA, makeBody({ bodyId: 2, ...circularOrbit(1) }));

    expect(influencingStar(planet)?.star).toBe(neutron);
  });
});
