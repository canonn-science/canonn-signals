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

  describe('meanToTrueAnomaly', () => {
    it('returns 0° at periapsis for any eccentricity', () => {
      expect(service.meanToTrueAnomaly(0, 0)).toBeCloseTo(0, 6);
      expect(service.meanToTrueAnomaly(0, 0.6)).toBeCloseTo(0, 6);
    });

    it('returns 180° at apoapsis for any eccentricity', () => {
      expect(service.meanToTrueAnomaly(180, 0)).toBeCloseTo(180, 6);
      expect(service.meanToTrueAnomaly(180, 0.6)).toBeCloseTo(180, 6);
    });

    it('is the identity for a circular orbit', () => {
      expect(service.meanToTrueAnomaly(90, 0)).toBeCloseTo(90, 6);
      expect(service.meanToTrueAnomaly(45, 0)).toBeCloseTo(45, 6);
    });

    it('leads the mean anomaly between periapsis and apoapsis for eccentric orbits', () => {
      // True anomaly sweeps faster than mean anomaly near periapsis, so ν > M on (0, 180).
      const trueAnomaly = service.meanToTrueAnomaly(90, 0.5);
      expect(trueAnomaly).toBeGreaterThan(90);
      expect(trueAnomaly).toBeLessThan(180);
    });

    it('wraps into [0, 360) past apoapsis', () => {
      const trueAnomaly = service.meanToTrueAnomaly(270, 0.5);
      expect(trueAnomaly).toBeGreaterThan(180);
      expect(trueAnomaly).toBeLessThan(360);
    });

    it('solves high-eccentricity orbits without diverging', () => {
      const trueAnomaly = service.meanToTrueAnomaly(30, 0.9);
      expect(Number.isFinite(trueAnomaly)).toBe(true);
      expect(trueAnomaly).toBeGreaterThan(30);
    });

    it('never returns NaN for non-finite inputs', () => {
      // A NaN eccentricity or mean anomaly must not poison the solver (it would
      // otherwise silently freeze the live marker).
      expect(service.meanToTrueAnomaly(90, NaN)).toBeCloseTo(90, 6); // e falls back to 0 (circular)
      expect(Number.isFinite(service.meanToTrueAnomaly(NaN, 0.5))).toBe(true);
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

    it('returns null when the meanAnomaly timestamp is present but unparseable', () => {
      // A malformed timestamp string makes the computed date NaN; the row must be
      // suppressed rather than emit an Invalid Date that breaks the template date pipe.
      const event = service.nextOrbitalEvent(body({
        meanAnomaly: 270, orbitalPeriod: 8, orbitalEccentricity: 0.3,
        timestamps: { meanAnomaly: 'not-a-date' } as any,
      }), 'peri', sampleMs);
      expect(event).toBeNull();
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

  describe('detectCollisionStatus', () => {
    const now = Date.parse('2026-06-27T00:00:00Z');

    it('flags two crossing-orbit siblings as collision candidates of each other', () => {
      // Identical coplanar orbits, different periods, large radii → they collide at every
      // conjunction. Aligned in longitude now, so the next contact is immediate.
      const [a, b] = makeFamily([
        { orbitalPeriod: 10, semiMajorAxis: 1, orbitalEccentricity: 0.1, orbitalInclination: 0,
          radius: 60000, meanAnomaly: 0, argOfPeriapsis: 0, ascendingNode: 0,
          timestamps: { meanAnomaly: '2026-06-27T00:00:00Z' } as any },
        { orbitalPeriod: 11, semiMajorAxis: 1, orbitalEccentricity: 0.1, orbitalInclination: 0,
          radius: 60000, meanAnomaly: 0, argOfPeriapsis: 0, ascendingNode: 0,
          timestamps: { meanAnomaly: '2026-06-27T00:00:00Z' } as any },
      ]);
      const ra = service.detectCollisionStatus(a, now);
      const rb = service.detectCollisionStatus(b, now);
      expect(ra.isCandidate).toBe(true);
      expect(rb.isCandidate).toBe(true);
      expect(ra.partnerName).toBe('Child 2');
      expect(rb.partnerName).toBe('Child 1');
      // Synodic period = 1 / |1/10 − 1/11| = 110 days for both.
      expect(ra.synodicPeriodDays).toBeCloseTo(110, 6);
      expect(rb.synodicPeriodDays).toBeCloseTo(110, 6);
      // Same orbit, same position now → contact essentially immediate.
      expect(ra.nextCollision!.days).toBeLessThan(1);
    });

    it('does not flag co-orbital (equal-period) siblings — synodic period is infinite', () => {
      const [a] = makeFamily([
        { orbitalPeriod: 10, semiMajorAxis: 1, orbitalEccentricity: 0.1, argOfPeriapsis: 0, radius: 60000 },
        { orbitalPeriod: 10, semiMajorAxis: 1, orbitalEccentricity: 0.1, argOfPeriapsis: 60, radius: 60000 },
      ]);
      expect(service.detectCollisionStatus(a, now).isCandidate).toBe(false);
    });

    it('does not flag well-separated orbits whose radial ranges cannot meet', () => {
      const [a] = makeFamily([
        { orbitalPeriod: 10, semiMajorAxis: 1, orbitalEccentricity: 0.01, radius: 6000 },
        { orbitalPeriod: 20, semiMajorAxis: 5, orbitalEccentricity: 0.01, radius: 6000 },
      ]);
      expect(service.detectCollisionStatus(a, now).isCandidate).toBe(false);
    });

    it('does not flag radially-overlapping orbits that a relative tilt holds 3D-apart', () => {
      // Same distance band, but one orbit is steeply inclined and offset in node so the two
      // curves stay far apart in 3D despite the overlapping radial ranges. Small radii.
      const [a] = makeFamily([
        { orbitalPeriod: 10, semiMajorAxis: 1, orbitalEccentricity: 0.001, radius: 3000,
          orbitalInclination: 0, ascendingNode: 0, argOfPeriapsis: 0 },
        { orbitalPeriod: 11, semiMajorAxis: 1, orbitalEccentricity: 0.001, radius: 3000,
          orbitalInclination: 60, ascendingNode: 90, argOfPeriapsis: 0 },
      ]);
      expect(service.detectCollisionStatus(a, now).isCandidate).toBe(false);
    });

    it('flags the real Grae Eaec AA-A h0 D 2 c / d pair and dates the contact in 3D', () => {
      // Razor-thin nearly-circular orbits ~1825 km apart radially; the ~2700 km moons sit
      // closer than their radii sum, so they truly collide. A full 3D Kepler propagation
      // (verified independently) puts the next contact on 2026-10-18.
      const [c, d] = makeFamily([
        { name: 'D 2 c', orbitalPeriod: 1.90164928358796, semiMajorAxis: 0.0128560641816413,
          orbitalEccentricity: 8.4e-5, orbitalInclination: -0.727422, radius: 2780.05725,
          argOfPeriapsis: 201.101444, ascendingNode: -128.723473, meanAnomaly: 18.25511,
          timestamps: { meanAnomaly: '2022-05-21T02:21:30Z' } as any },
        { name: 'D 2 d', orbitalPeriod: 1.90435777659722, semiMajorAxis: 0.0128682681673058,
          orbitalEccentricity: 2.8e-5, orbitalInclination: -0.020247, radius: 2715.17175,
          argOfPeriapsis: 100.379093, ascendingNode: 25.401207, meanAnomaly: 38.691326,
          timestamps: { meanAnomaly: '2022-05-21T02:21:30Z' } as any },
      ]);
      const r = service.detectCollisionStatus(c, now);
      expect(r.isCandidate).toBe(true);
      expect(r.partnerName).toBe('D 2 d');
      expect(r.synodicPeriodDays).toBeCloseTo(1337, 0);
      expect(r.nextCollision).not.toBeNull();
      // Within a day of the independently computed 3D contact time.
      expect(r.nextCollision!.start.toISOString().slice(0, 10)).toBe('2026-10-18');
    });

    it('skips off-node near-miss conjunctions and dates the first true 3D contact', () => {
      // Two tilted orbits whose longitude conjunctions precess across the mutual node. The
      // next two conjunctions (≈2026-06-29 and ≈2026-08-27) pass 15000+ km apart — far wider
      // than the 6000 km contact distance — so they are NOT collisions. A naive
      // same-longitude model would wrongly report the imminent one; the 3D search skips both
      // and reports the first conjunction that actually lands on the node. An independent
      // brute-force propagation puts that first real contact on 2027-05-03.
      const [a] = makeFamily([
        { name: 'A', orbitalPeriod: 2.0, semiMajorAxis: 0.01, orbitalEccentricity: 0.001,
          orbitalInclination: 0, ascendingNode: 0, argOfPeriapsis: 0, meanAnomaly: 0, radius: 3000,
          timestamps: { meanAnomaly: '2026-01-01T00:00:00Z' } as any },
        { name: 'B', orbitalPeriod: 2.07, semiMajorAxis: 0.01, orbitalEccentricity: 0.001,
          orbitalInclination: 1, ascendingNode: 0, argOfPeriapsis: 0, meanAnomaly: 90, radius: 3000,
          timestamps: { meanAnomaly: '2026-01-01T00:00:00Z' } as any },
      ]);
      const r = service.detectCollisionStatus(a, now);
      expect(r.isCandidate).toBe(true);
      expect(r.nextCollision).not.toBeNull();
      // The reported contact is the real on-node one, ~10 months out — not the imminent
      // near-miss conjunction a naive model would have flagged days from now.
      expect(r.nextCollision!.days).toBeGreaterThan(180);
      expect(r.nextCollision!.start.toISOString().slice(0, 10)).toBe('2027-05-03');
    });

    it('catches a grazing contact whose minimum falls between coarse time samples', () => {
      // The bodies pass ~17949 km apart — just inside the 18000 km contact distance — at a
      // moment between the coarse scan steps. The contact time must be found by refining the
      // window minimum before the contact test, not judged against an over-wide coarse sample.
      const [a] = makeFamily([
        { name: 'A', orbitalPeriod: 10, semiMajorAxis: 0.01, orbitalEccentricity: 0,
          orbitalInclination: 0, ascendingNode: 0, argOfPeriapsis: 0, meanAnomaly: 0, radius: 9000,
          timestamps: { meanAnomaly: '2026-06-27T00:00:00Z' } as any },
        { name: 'B', orbitalPeriod: 11, semiMajorAxis: 0.01, orbitalEccentricity: 0,
          orbitalInclination: 5, ascendingNode: 0, argOfPeriapsis: 0, meanAnomaly: 50, radius: 9000,
          timestamps: { meanAnomaly: '2026-06-27T00:00:00Z' } as any },
      ]);
      const r = service.detectCollisionStatus(a, now);
      expect(r.isCandidate).toBe(true);
      expect(r.nextCollision).not.toBeNull();
      expect(r.nextCollision!.days).toBeGreaterThan(0);
      expect(r.nextCollision!.days).toBeLessThan(30);
    });

    it('flags the real Dryio Hypue RY-A e0 A 6 a / b pair (sharp minimum, multi-basin)', () => {
      // These moons' closest orbital approach (~3000 km, inside the ~3909 km radii sum) sits
      // in a narrow valley whose basin a coarse single-best grid search misses — it must be
      // found by the finer grid + multi-basin refinement. Brute-force 3D contact: 2028-08-10.
      const [a] = makeFamily([
        { name: 'A 6 a', orbitalPeriod: 2.04546135608796, semiMajorAxis: 0.0128871889270589,
          orbitalEccentricity: 0.000555, orbitalInclination: 0.025846, argOfPeriapsis: 107.388455,
          ascendingNode: 82.705832, meanAnomaly: 183.01898, radius: 2097.79225,
          timestamps: { meanAnomaly: '2023-04-07T20:50:46Z' } as any },
        { name: 'A 6 b', orbitalPeriod: 2.05459880332176, semiMajorAxis: 0.0129255400416571,
          orbitalEccentricity: 0.000999, orbitalInclination: 0.006466, argOfPeriapsis: 25.373948,
          ascendingNode: 21.680711, meanAnomaly: 53.449845, radius: 1811.117375,
          timestamps: { meanAnomaly: '2023-04-07T20:50:43Z' } as any },
      ]);
      const r = service.detectCollisionStatus(a, now);
      expect(r.isCandidate).toBe(true);
      expect(r.partnerName).toBe('A 6 b');
      expect(r.nextCollision).not.toBeNull();
      expect(r.nextCollision!.start.toISOString().slice(0, 10)).toBe('2028-08-10');
    });

    it('reports the contact window (start/end) for the real Braireau AA-A h761 1 b / c pair', () => {
      // A collision is an interval, not an instant. An independent brute-force 3D Kepler
      // propagation (combined radii 6509.6 km) puts the contact window on 2028-06-19:
      // START ≈ 07:52:57 UTC, minimum separation (≈2929 km) at 08:33:52, END ≈ 09:14:49 UTC
      // — a duration of ≈82 minutes.
      const [b1, c1] = makeFamily([
        { name: '1 b', orbitalPeriod: 3.12638586318287, semiMajorAxis: 0.0154507028533318,
          orbitalEccentricity: 0.011564, orbitalInclination: -2.461662, argOfPeriapsis: 219.533956,
          ascendingNode: -179.142714, meanAnomaly: 272.605583, radius: 3445.79375,
          timestamps: { meanAnomaly: '2023-03-19T22:33:44Z' } as any },
        { name: '1 c', orbitalPeriod: 3.17091274040509, semiMajorAxis: 0.015597059041845,
          orbitalEccentricity: 5.6e-5, orbitalInclination: -0.160679, argOfPeriapsis: 305.081614,
          ascendingNode: -78.606663, meanAnomaly: 309.399786, radius: 3063.84525,
          timestamps: { meanAnomaly: '2023-03-19T22:33:52Z' } as any },
      ]);
      const r = service.detectCollisionStatus(b1, now);
      expect(r.isCandidate).toBe(true);
      expect(r.partnerName).toBe('1 c');
      expect(r.nextCollision).not.toBeNull();
      // Contact window starts on 2028-06-19 around 07:5x UTC.
      expect(r.nextCollision!.start.toISOString().slice(0, 10)).toBe('2028-06-19');
      // The window is a genuine interval: end follows start…
      expect(r.nextCollision!.end.getTime()).toBeGreaterThan(r.nextCollision!.start.getTime());
      // …and lasts on the order of an hour and a half (≈82 minutes here).
      const durationMin = (r.nextCollision!.end.getTime() - r.nextCollision!.start.getTime()) / 60000;
      expect(durationMin).toBeGreaterThan(60);
      expect(durationMin).toBeLessThan(100);
    });

    it('treats an unbound (e ≥ 1) sibling as a non-recurring, non-candidate orbit', () => {
      const [a] = makeFamily([
        { orbitalPeriod: 10, semiMajorAxis: 1, orbitalEccentricity: 0.1, radius: 60000 },
        { orbitalPeriod: 11, semiMajorAxis: 1, orbitalEccentricity: 1.5, radius: 60000 },
      ]);
      expect(service.detectCollisionStatus(a, now).isCandidate).toBe(false);
    });

    it('still flags a geometric candidate when timing data is missing (no date)', () => {
      const [a] = makeFamily([
        { orbitalPeriod: 10, semiMajorAxis: 1, orbitalEccentricity: 0.1, orbitalInclination: 0, radius: 60000 },
        { orbitalPeriod: 11, semiMajorAxis: 1, orbitalEccentricity: 0.1, orbitalInclination: 0, radius: 60000 },
      ]);
      const r = service.detectCollisionStatus(a, now);
      expect(r.isCandidate).toBe(true);
      expect(r.synodicPeriodDays).toBeCloseTo(110, 6);
      expect(r.nextCollision).toBeNull();
    });
  });
});
