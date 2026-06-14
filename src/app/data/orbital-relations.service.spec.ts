import { OrbitalRelationsService } from './orbital-relations.service';
import { SystemBody, CanonnBiostatsBody } from '../home/home.component';

describe('OrbitalRelationsService', () => {
  let service: OrbitalRelationsService;

  beforeEach(() => {
    service = new OrbitalRelationsService();
  });

  /** Builds a parent body whose children share the given partial body-data. */
  function makeFamily(children: Partial<CanonnBiostatsBody>[]): SystemBody[] {
    const parent: SystemBody = {
      bodyData: { bodyId: 0, name: 'Parent', id64: 0n, subType: '', type: 'Star' } as CanonnBiostatsBody,
      subBodies: [],
      parent: null,
    };
    parent.subBodies = children.map((c, i) => ({
      bodyData: { bodyId: i + 1, name: `Child ${i + 1}`, id64: 0n, subType: '', type: 'Planet', ...c } as CanonnBiostatsBody,
      subBodies: [],
      parent,
    }));
    return parent.subBodies;
  }

  describe('detectTrojanStatus', () => {
    it('returns no status when orbital data is missing', () => {
      const [only] = makeFamily([{ orbitalPeriod: 10 }]);
      const r = service.detectTrojanStatus(only);
      expect(r.lagrangePoint).toBeNull();
      expect(r.isHost).toBe(false);
    });

    it('labels a +60° co-orbital body as L4 and −60° as L5', () => {
      const [host, leading, trailing] = makeFamily([
        { orbitalPeriod: 10, semiMajorAxis: 5, argOfPeriapsis: 100 },
        { orbitalPeriod: 10, semiMajorAxis: 5, argOfPeriapsis: 160 }, // +60
        { orbitalPeriod: 10, semiMajorAxis: 5, argOfPeriapsis: 40 },  // −60
      ]);
      expect(service.detectTrojanStatus(leading).lagrangePoint).toBe('L4');
      expect(service.detectTrojanStatus(trailing).lagrangePoint).toBe('L5');
      // The body with Trojans on both sides is the host, not a Trojan.
      const hostResult = service.detectTrojanStatus(host);
      expect(hostResult.isHost).toBe(true);
      expect(hostResult.lagrangePoint).toBeNull();
    });

    it('labels a 180° co-orbital body as L3', () => {
      const [, opposite] = makeFamily([
        { orbitalPeriod: 10, semiMajorAxis: 5, argOfPeriapsis: 0 },
        { orbitalPeriod: 10, semiMajorAxis: 5, argOfPeriapsis: 180 },
      ]);
      expect(service.detectTrojanStatus(opposite).lagrangePoint).toBe('L3');
    });

    it('distinguishes L1 (inner) from L2 (outer) for aligned same-period bodies', () => {
      const [inner, outer] = makeFamily([
        { orbitalPeriod: 10, semiMajorAxis: 4, argOfPeriapsis: 30, ascendingNode: 50 },
        { orbitalPeriod: 10, semiMajorAxis: 6, argOfPeriapsis: 30, ascendingNode: 50 },
      ]);
      expect(service.detectTrojanStatus(inner).lagrangePoint).toBe('L1');
      expect(service.detectTrojanStatus(outer).lagrangePoint).toBe('L2');
    });

    it('detects L1/L2 alignment across the 0°/360° seam', () => {
      // periapsis 1° vs 359° (2° apart) and nodes 2° vs 358° (4° apart) are aligned.
      const [inner, outer] = makeFamily([
        { orbitalPeriod: 10, semiMajorAxis: 4, argOfPeriapsis: 1, ascendingNode: 2 },
        { orbitalPeriod: 10, semiMajorAxis: 6, argOfPeriapsis: 359, ascendingNode: 358 },
      ]);
      expect(service.detectTrojanStatus(inner).lagrangePoint).toBe('L1');
      expect(service.detectTrojanStatus(outer).lagrangePoint).toBe('L2');
    });
  });

  describe('detectRosetteStatus', () => {
    it('detects three evenly-spaced co-orbital bodies as a rosette', () => {
      const children = makeFamily([
        { orbitalPeriod: 10, semiMajorAxis: 5, argOfPeriapsis: 0 },
        { orbitalPeriod: 10, semiMajorAxis: 5, argOfPeriapsis: 120 },
        { orbitalPeriod: 10, semiMajorAxis: 5, argOfPeriapsis: 240 },
      ]);
      expect(service.detectRosetteStatus(children[0])).toBe('Rosette (3)');
    });

    it('returns null when spacing is uneven', () => {
      const children = makeFamily([
        { orbitalPeriod: 10, semiMajorAxis: 5, argOfPeriapsis: 0 },
        { orbitalPeriod: 10, semiMajorAxis: 5, argOfPeriapsis: 90 },
        { orbitalPeriod: 10, semiMajorAxis: 5, argOfPeriapsis: 240 },
      ]);
      expect(service.detectRosetteStatus(children[0])).toBeNull();
    });

    it('returns null for fewer than three co-orbital bodies', () => {
      const children = makeFamily([
        { orbitalPeriod: 10, semiMajorAxis: 5, argOfPeriapsis: 0 },
        { orbitalPeriod: 10, semiMajorAxis: 5, argOfPeriapsis: 180 },
      ]);
      expect(service.detectRosetteStatus(children[0])).toBeNull();
    });
  });

  describe('meanAnomalyNow', () => {
    const sampleTime = '2026-01-01T00:00:00Z';
    const sampleMs = new Date(sampleTime).getTime();

    it('returns the recorded mean anomaly at the sample instant', () => {
      expect(service.meanAnomalyNow(90, 10, sampleTime, sampleMs)).toBeCloseTo(90, 6);
    });

    it('advances 180° after half an orbital period', () => {
      const halfPeriod = sampleMs + 5 * 24 * 60 * 60 * 1000; // 5 of 10 days
      expect(service.meanAnomalyNow(0, 10, sampleTime, halfPeriod)).toBeCloseTo(180, 6);
    });

    it('wraps a full orbit back into [0, 360)', () => {
      const fullPeriod = sampleMs + 10 * 24 * 60 * 60 * 1000;
      expect(service.meanAnomalyNow(0, 10, sampleTime, fullPeriod)).toBeCloseTo(0, 6);
    });

    it('normalises a negative mean anomaly into [0, 360)', () => {
      // A negative recorded mean anomaly must not leak a negative result (JS `%` keeps sign).
      expect(service.meanAnomalyNow(-90, 10, sampleTime, sampleMs)).toBeCloseTo(270, 6);
    });

    it('normalises into [0, 360) when `now` precedes the sample instant', () => {
      const beforeSample = sampleMs - 5 * 24 * 60 * 60 * 1000; // -half a period
      expect(service.meanAnomalyNow(0, 10, sampleTime, beforeSample)).toBeCloseTo(180, 6);
    });
  });

  describe('degreesToEvent', () => {
    it('measures the angle to apoapsis from 180°', () => {
      expect(service.degreesToEvent(0, 'apo')).toBe(180);
      expect(service.degreesToEvent(270, 'apo')).toBe(270); // (180-270) -> -90 -> +360
    });

    it('measures the angle to periapsis from 360°/0°', () => {
      expect(service.degreesToEvent(0, 'peri')).toBe(0);
      expect(service.degreesToEvent(90, 'peri')).toBe(270);
    });
  });

  describe('nextOrbitalEvent', () => {
    const sampleTime = '2026-01-01T00:00:00Z';
    const sampleMs = new Date(sampleTime).getTime();

    function body(extra: Partial<CanonnBiostatsBody>): CanonnBiostatsBody {
      return { bodyId: 1, name: 'B', id64: 0n, subType: '', type: 'Planet', ...extra } as CanonnBiostatsBody;
    }

    it('returns null when orbital elements are missing or the orbit is circular', () => {
      expect(service.nextOrbitalEvent(body({}), 'peri')).toBeNull();
      expect(service.nextOrbitalEvent(body({
        meanAnomaly: 90, orbitalPeriod: 10, orbitalEccentricity: 0, timestamps: { meanAnomaly: sampleTime } as any,
      }), 'peri')).toBeNull();
    });

    it('computes the days and date to the next periapsis', () => {
      // At the sample instant, mean anomaly 270° is 90° (= quarter period) short of periapsis.
      const event = service.nextOrbitalEvent(body({
        meanAnomaly: 270, orbitalPeriod: 8, orbitalEccentricity: 0.3,
        timestamps: { meanAnomaly: sampleTime } as any,
      }), 'peri', sampleMs);
      expect(event).not.toBeNull();
      expect(event!.days).toBeCloseTo(2, 6); // 90/360 * 8 days
      expect(event!.date.getTime()).toBeCloseTo(sampleMs + 2 * 24 * 60 * 60 * 1000, -2);
    });

    it('computes the next apoapsis half an orbit away from periapsis', () => {
      // meanAnomaly 360 ≡ 0° at the sample instant (180° short of apoapsis).
      const event = service.nextOrbitalEvent(body({
        meanAnomaly: 360, orbitalPeriod: 12, orbitalEccentricity: 0.5,
        timestamps: { meanAnomaly: sampleTime } as any,
      }), 'apo', sampleMs);
      expect(event!.days).toBeCloseTo(6, 6); // 180/360 * 12 days
    });

    it('treats a meanAnomaly of exactly 0 as a valid value (body at periapsis), not missing', () => {
      // A body recorded exactly at periapsis has meanAnomaly === 0; it must not be
      // mistaken for missing data (the old `!bd.meanAnomaly` falsy guard did this).
      const event = service.nextOrbitalEvent(body({
        meanAnomaly: 0, orbitalPeriod: 12, orbitalEccentricity: 0.5,
        timestamps: { meanAnomaly: sampleTime } as any,
      }), 'apo', sampleMs);
      expect(event).not.toBeNull();
      expect(event!.days).toBeCloseTo(6, 6); // 180° to apoapsis → 180/360 * 12 days
    });

    it('locks the Alpha Centauri apsis dates (now-independent; matches the rendered tooltip)', () => {
      // Real orbital elements for the Alpha Centauri G star (e2e fixture body 2).
      const alphaCentauri = body({
        meanAnomaly: 36.634872, orbitalPeriod: 9348.90664562031, orbitalEccentricity: 0.5179,
        timestamps: { meanAnomaly: '2026-06-12T19:06:36Z' } as any,
      });
      // Format a Date exactly like the template tooltip's `date:'yyyy-MM-dd HH:mm'`, in UTC.
      const tip = (d: Date) => d.toISOString().slice(0, 16).replace('T', ' ');

      // An apsis is a fixed physical event: its *date* is independent of `now` — only the
      // day-count shrinks as `now` advances. Evaluate at two very different instants.
      const apoNow = service.nextOrbitalEvent(alphaCentauri, 'apo', Date.parse('2026-06-14T00:00:00Z'))!;
      const apoLater = service.nextOrbitalEvent(alphaCentauri, 'apo', Date.parse('2030-01-01T00:00:00Z'))!;
      // 2036-08-21 20:55 UTC == 2036-08-21 22:55 CEST — the known-good value.
      expect(tip(apoNow.date)).toBe('2036-08-21 20:55');
      expect(tip(apoLater.date)).toBe('2036-08-21 20:55');
      expect(apoLater.days).not.toBeCloseTo(apoNow.days, 0); // day-count differs…
      expect(apoLater.date.getTime()).toBe(apoNow.date.getTime()); // …but the date is identical

      const peri = service.nextOrbitalEvent(alphaCentauri, 'peri', Date.parse('2026-06-14T00:00:00Z'))!;
      expect(tip(peri.date)).toBe('2049-06-09 07:48');
    });
  });
});
