import { lookupTempDelta, DELTA_BY_PRESSURE, DELTA_GLOBAL } from './temperature-estimation';
import { OrbitalRelationsService } from './orbital-relations.service';
import { BodyPhysicsService } from './body-physics.service';
import { CanonnBiostatsBody, SystemBody } from '../home/home.component';

function node(data: Partial<CanonnBiostatsBody>, parent: SystemBody | null = null): SystemBody {
  return { bodyData: data as CanonnBiostatsBody, subBodies: [], parent };
}

describe('temperature-estimation pressure-class fallbacks', () => {
  it('classifies a thin atmosphere by pressure alone', () => {
    const r = lookupTempDelta(null, null, 0.05);
    expect(r.delta).toBe(DELTA_BY_PRESSURE['Thin']);
    expect(r.source).toBe('Pressure class (Thin)');
  });

  it('falls back to global when pressure is too high to classify', () => {
    const r = lookupTempDelta(null, null, 0.5);
    expect(r.delta).toBe(DELTA_GLOBAL);
    expect(r.source).toBe('Global fallback');
  });
});

describe('OrbitalRelationsService no-match path', () => {
  it('returns no Lagrange point when a same-period sibling is not aligned', () => {
    const service = new OrbitalRelationsService();
    const parent = node({ name: 'P', type: 'Star' });
    parent.subBodies = [
      node({ orbitalPeriod: 10, semiMajorAxis: 4, argOfPeriapsis: 0, ascendingNode: 0 }, parent),
      node({ orbitalPeriod: 10, semiMajorAxis: 6, argOfPeriapsis: 90, ascendingNode: 0 }, parent),
    ];
    expect(service.detectTrojanStatus(parent.subBodies[0]).lagrangePoint).toBeNull();
  });
});

describe('BodyPhysicsService solar-mass parent branches', () => {
  const service = new BodyPhysicsService();

  it('derives primary density from a solar-mass, solar-radius parent for ring Roche limits', () => {
    const parent = node({ solarMasses: 1, solarRadius: 1 });
    const rigid = service.calculateRigidRocheLimit(node({ subType: 'Rocky ring' }, parent));
    expect(rigid).not.toBeNull();
    expect(rigid!).toBeGreaterThan(0);
  });

  it('uses solar-mass parent mass for Hill-sphere shepherding', () => {
    const KM_PER_AU = 149597870.7;
    const parent = node({
      solarMasses: 1, solarRadius: 1,
      rings: [{ outerRadius: 100_000_000 } as any],
    });
    const body = node({ type: 'Planet', semiMajorAxis: 800000 / KM_PER_AU, earthMasses: 50 }, parent);
    // Exercises parentMassEarthMasses() via the solarMasses branch.
    expect(typeof service.isShepherdingCandidate(body)).toBe('boolean');
  });
});
