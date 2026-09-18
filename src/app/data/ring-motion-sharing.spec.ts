import { OrbitalRelationsCore, CollisionWindow } from './orbital-relations.core';
import { SystemBody, CanonnBiostatsBody } from '../home/home.component';
import { BODY_TYPE } from './body-types';
import { createCollisionApi } from './collision-worker-api';
import { serializeSystemTree } from './collision-request';

type Position = (t: number) => { x: number; y: number; z: number };
interface Band { contactKm: number; minContactKm: number; partnerName: string; }
interface SearchInternals {
  nestedContactWindowsForBands(
    a: Position, b: Position, fast: number, slow: number, bands: Band[],
    now: number, count: number, horizon: number, speed: number,
  ): CollisionWindow[][];
  sampledMinimum(sep: (t: number) => number, center: number, half: number): { t: number; sepKm: number };
}

describe('shared nested ring motion', () => {
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

  function eoch(): SystemBody {
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
    makeBody('1 a', body1, {
      semiMajorAxis: 0.0000667281981855909, orbitalEccentricity: 0.000926, orbitalInclination: 5.715068,
      argOfPeriapsis: 356.875202, ascendingNode: -159.524488, meanAnomaly: 161.705977,
      orbitalPeriod: 0.106452093634259, radius: 337.0178125, timestamps: ts,
    });

    return barycentre;
  }

  it('shares Eoch minima while preserving each ring and the worker DTO results', () => {
    const root = eoch();
    const shared = new OrbitalRelationsCore();
    const separate = new OrbitalRelationsCore();
    const sharedInternal = shared as unknown as SearchInternals;
    const separateInternal = separate as unknown as SearchInternals;
    const original = separateInternal.nestedContactWindowsForBands.bind(separateInternal);
    vi.spyOn(separateInternal, 'nestedContactWindowsForBands').mockImplementation(
      (a, b, fast, slow, bands, epoch, count, horizon, speed) => bands.flatMap(band =>
        original(a, b, fast, slow, [band], epoch, count, horizon, speed)));
    const sharedMinima = vi.spyOn(sharedInternal, 'sampledMinimum');
    const separateMinima = vi.spyOn(separateInternal, 'sampledMinimum');
    const expected = separate.detectRingCollisionStatuses(root, now);
    const actual = shared.detectRingCollisionStatuses(root, now);
    expect(actual).toEqual(expected);
    expect(sharedMinima.mock.calls.length).toBeLessThan(separateMinima.mock.calls.length);
    const rings = actual.filter(status => status.self?.kind === 'ring');
    expect(rings).toHaveLength(2);
    expect(rings.every(status => status.upcomingCollisions.length === 10)).toBe(true);
    expect(rings[0].upcomingCollisions[0].start).not.toEqual(rings[1].upcomingCollisions[0].start);
    const dto = structuredClone(serializeSystemTree(root)!);
    expect(createCollisionApi(new OrbitalRelationsCore()).detectRingCollisionStatuses(dto, now)).toEqual(actual);
    // Results from a later request must not reuse the previous epoch's samples or minima.
    expect(shared.detectRingCollisionStatuses(root, now + 86_400_000))
      .toEqual(separate.detectRingCollisionStatuses(root, now + 86_400_000));
  });

  it('keeps split contacts, suppressed bands, misses and window limits independent', () => {
    const core = new OrbitalRelationsCore() as unknown as SearchInternals;
    const day = 86_400_000;
    let evaluations = 0;
    const position: Position = t => {
      evaluations++;
      return { x: 100 + 10 * Math.cos(2 * Math.PI * t / day), y: 0, z: 0 };
    };
    const origin: Position = () => ({ x: 0, y: 0, z: 0 });
    const bands: Band[] = [
      { contactKm: 120, minContactKm: 0, partnerName: 'always inside, unresolved' },
      { contactKm: 91, minContactKm: 0, partnerName: 'brief contact' },
      { contactKm: 100, minContactKm: 95, partnerName: 'split contact' },
      { contactKm: 80, minContactKm: 0, partnerName: 'miss' },
    ];
    const scan = (selected: Band[]) => core.nestedContactWindowsForBands(
      position, origin, 1, 1, selected, day / 2, 3, 4 * day, 20 * Math.PI / day);
    const expected = bands.flatMap(band => scan([band]));
    const separateEvaluations = evaluations;
    evaluations = 0;
    const actual = scan(bands);
    expect(actual).toEqual(expected);
    expect(evaluations).toBeLessThan(separateEvaluations);
    expect(actual.map(windows => windows.length)).toEqual([0, 3, 3, 0]);
    expect(actual[1][0].start.getTime()).toBeLessThan(day / 2); // already in progress
    expect(actual[1][0].end.getTime()).toBeGreaterThan(day / 2);
    expect(actual[2].every(window => window.minSeparationKm === 95)).toBe(true);
    expect(scan([...bands].reverse())).toEqual([...actual].reverse());
  });
});
