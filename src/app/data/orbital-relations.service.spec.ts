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
        {
          orbitalPeriod: 10, semiMajorAxis: 1, orbitalEccentricity: 0.1, orbitalInclination: 0,
          radius: 60000, meanAnomaly: 0, argOfPeriapsis: 0, ascendingNode: 0,
          timestamps: { meanAnomaly: '2026-06-27T00:00:00Z' } as any
        },
        {
          orbitalPeriod: 11, semiMajorAxis: 1, orbitalEccentricity: 0.1, orbitalInclination: 0,
          radius: 60000, meanAnomaly: 0, argOfPeriapsis: 0, ascendingNode: 0,
          timestamps: { meanAnomaly: '2026-06-27T00:00:00Z' } as any
        },
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
        {
          orbitalPeriod: 10, semiMajorAxis: 1, orbitalEccentricity: 0.001, radius: 3000,
          orbitalInclination: 0, ascendingNode: 0, argOfPeriapsis: 0
        },
        {
          orbitalPeriod: 11, semiMajorAxis: 1, orbitalEccentricity: 0.001, radius: 3000,
          orbitalInclination: 60, ascendingNode: 90, argOfPeriapsis: 0
        },
      ]);
      expect(service.detectCollisionStatus(a, now).isCandidate).toBe(false);
    });

    it('skips off-node near-miss conjunctions and dates the first true 3D contact', () => {
      // Two tilted orbits whose longitude conjunctions precess across the mutual node. The
      // next two conjunctions (≈2026-06-29 and ≈2026-08-27) pass 15000+ km apart — far wider
      // than the 6000 km contact distance — so they are NOT collisions. A naive
      // same-longitude model would wrongly report the imminent one; the 3D search skips both
      // and reports the first conjunction that actually lands on the node. An independent
      // brute-force propagation puts that first real contact on 2027-05-03.
      const [a] = makeFamily([
        {
          name: 'A', orbitalPeriod: 2.0, semiMajorAxis: 0.01, orbitalEccentricity: 0.001,
          orbitalInclination: 0, ascendingNode: 0, argOfPeriapsis: 0, meanAnomaly: 0, radius: 3000,
          timestamps: { meanAnomaly: '2026-01-01T00:00:00Z' } as any
        },
        {
          name: 'B', orbitalPeriod: 2.07, semiMajorAxis: 0.01, orbitalEccentricity: 0.001,
          orbitalInclination: 1, ascendingNode: 0, argOfPeriapsis: 0, meanAnomaly: 90, radius: 3000,
          timestamps: { meanAnomaly: '2026-01-01T00:00:00Z' } as any
        },
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
        {
          name: 'A', orbitalPeriod: 10, semiMajorAxis: 0.01, orbitalEccentricity: 0,
          orbitalInclination: 0, ascendingNode: 0, argOfPeriapsis: 0, meanAnomaly: 0, radius: 9000,
          timestamps: { meanAnomaly: '2026-06-27T00:00:00Z' } as any
        },
        {
          name: 'B', orbitalPeriod: 11, semiMajorAxis: 0.01, orbitalEccentricity: 0,
          orbitalInclination: 5, ascendingNode: 0, argOfPeriapsis: 0, meanAnomaly: 50, radius: 9000,
          timestamps: { meanAnomaly: '2026-06-27T00:00:00Z' } as any
        },
      ]);
      const r = service.detectCollisionStatus(a, now);
      expect(r.isCandidate).toBe(true);
      expect(r.nextCollision).not.toBeNull();
      expect(r.nextCollision!.days).toBeGreaterThan(0);
      expect(r.nextCollision!.days).toBeLessThan(30);
    });

    it('treats an unbound (e ≥ 1) sibling as a non-recurring, non-candidate orbit', () => {
      const [a] = makeFamily([
        { orbitalPeriod: 10, semiMajorAxis: 1, orbitalEccentricity: 0.1, radius: 60000 },
        { orbitalPeriod: 11, semiMajorAxis: 1, orbitalEccentricity: 1.5, radius: 60000 },
      ]);
      const r = service.detectCollisionStatus(a, now);
      expect(r.isCandidate).toBe(false);
      // A non-candidate carries no contact threshold.
      expect(r.combinedRadiiKm).toBeNull();
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
      // Combined radii is known even without a contact date (geometry alone).
      expect(r.combinedRadiiKm).toBeCloseTo(120000, 6);
    });

    it('flags the real Synuefe WH-F c0 1 a / b pair and dates the imminent contact', () => {
      // Near-coplanar moons ~6 days from now. Independent brute-force 3D propagation
      // puts the contact window on 2026-07-04 starting around 04:01 UTC, duration ≈ 38 minutes.
      const [a] = makeFamily([
        {
          name: '1 a', orbitalPeriod: 0.182371165740741, semiMajorAxis: 0.000114146463747094,
          orbitalEccentricity: 0.000819, orbitalInclination: -0.00868,
          argOfPeriapsis: 85.004453, ascendingNode: -175.272971,
          meanAnomaly: 292.52391, radius: 266.94259375,
          timestamps: { meanAnomaly: '2026-06-24T21:03:13Z' } as any
        },
        {
          name: '1 b', orbitalPeriod: 0.186598776944444, semiMajorAxis: 0.000115903765964946,
          orbitalEccentricity: 0.010975, orbitalInclination: -0.288085,
          argOfPeriapsis: 288.301807, ascendingNode: -112.192793,
          meanAnomaly: 255.227269, radius: 279.1435,
          timestamps: { meanAnomaly: '2026-06-24T21:03:13Z' } as any
        },
      ]);
      const r = service.detectCollisionStatus(a, now);
      expect(r.isCandidate).toBe(true);
      expect(r.partnerName).toBe('1 b');
      expect(r.combinedRadiiKm).toBeCloseTo(266.94259375 + 279.1435, 3);
      expect(r.nextCollision).not.toBeNull();
      expect(r.nextCollision!.start.toISOString().slice(0, 10)).toBe('2026-07-04');
      // Duration ≈ 38 minutes.
      const durationMin = (r.nextCollision!.end.getTime() - r.nextCollision!.start.getTime()) / 60000;
      expect(durationMin).toBeGreaterThan(30);
      expect(durationMin).toBeLessThan(50);
      expect(r.nextCollision!.minSeparationKm).toBeGreaterThan(0);
      expect(r.nextCollision!.minSeparationKm).toBeLessThanOrEqual(r.combinedRadiiKm!);
    });

    it('finds no collision within 50 years for Skaude GY-H b14-7 11 b / c but locates the 2118 contact', () => {
      // Inclined pair (inclinations 0.45° vs −5.09°) with a ~32.9-year synodic period. The
      // orbits only cross near the mutual node, so the vast majority of conjunctions miss.
      // Independent brute-force propagation confirms no contact within 50 years and a first
      // contact in 2118.
      const [b] = makeFamily([
        {
          name: '11 b', orbitalPeriod: 23.8474230799421, semiMajorAxis: 0.0227235368266319,
          orbitalEccentricity: 0.003436, orbitalInclination: 0.45116,
          argOfPeriapsis: 338.964329, ascendingNode: 139.535984,
          meanAnomaly: 273.963893, radius: 2774.97075,
          timestamps: { meanAnomaly: '2023-05-23T22:45:49Z' } as any
        },
        {
          name: '11 c', orbitalPeriod: 23.8948170509606, semiMajorAxis: 0.0227536332179197,
          orbitalEccentricity: 0.001169, orbitalInclination: -5.089446,
          argOfPeriapsis: 293.983397, ascendingNode: 167.875825,
          meanAnomaly: 217.580026, radius: 3129.24675,
          timestamps: { meanAnomaly: '2023-05-23T22:45:50Z' } as any
        },
      ]);
      const r = service.detectCollisionStatus(b, now);
      expect(r.isCandidate).toBe(true);
      expect(r.partnerName).toBe('11 c');
      expect(r.nextCollision).not.toBeNull();
      // No collision in the next 50 years.
      expect(r.nextCollision!.days).toBeGreaterThan(50 * 365.25);
      // First contact lands in 2118.
      expect(r.nextCollision!.start.getUTCFullYear()).toBe(2118);
    });

    it('flags the real Smojue DL-P d5-44 AB 1 c / d pair and dates the 2041 contact', () => {
      // Near-coplanar Rocky bodies with a ~81-day synodic period. Independent brute-force 3D
      // propagation puts the first contact on 2041-01-01 around 19:00 UTC, duration ≈ 3h 11m.
      const [c] = makeFamily([
        {
          name: '1 c', orbitalPeriod: 4.85803952648148, semiMajorAxis: 0.00835478762578843,
          orbitalEccentricity: 0.001308, orbitalInclination: 0.141992,
          argOfPeriapsis: 228.054248, ascendingNode: -150.269448,
          meanAnomaly: 117.514434, radius: 826.2893125,
          timestamps: { meanAnomaly: '2022-05-21T17:33:42Z' } as any
        },
        {
          name: '1 d', orbitalPeriod: 4.86092200434028, semiMajorAxis: 0.00835809222445321,
          orbitalEccentricity: 0.002665, orbitalInclination: 0.014977,
          argOfPeriapsis: 292.281177, ascendingNode: 61.240818,
          meanAnomaly: 332.438311, radius: 877.591875,
          timestamps: { meanAnomaly: '2022-05-21T17:33:44Z' } as any
        },
      ]);
      const r = service.detectCollisionStatus(c, now);
      expect(r.isCandidate).toBe(true);
      expect(r.partnerName).toBe('1 d');
      expect(r.nextCollision).not.toBeNull();
      expect(r.nextCollision!.start.toISOString().slice(0, 10)).toBe('2041-01-01');
      // The contact is a genuine interval of several hours.
      const durationMin = (r.nextCollision!.end.getTime() - r.nextCollision!.start.getTime()) / 60000;
      expect(durationMin).toBeGreaterThan(0);
      expect(durationMin).toBeLessThan(600);
      expect(r.nextCollision!.minSeparationKm).toBeGreaterThan(0);
      expect(r.nextCollision!.minSeparationKm).toBeLessThanOrEqual(r.combinedRadiiKm!);
    });

    it('flags the real Col 285 Sector GA-S b19-0 8 a / b pair and dates the 2031 contact', () => {
      // Synodic period ≈ 435 days. Confirmed by Elite Observatory and the deployed app:
      // first contact 2031-02-25 ~15:31 UTC, duration ≈ 4h 19m (259 minutes), min separation
      // ≈ 12.9% of combined radii. The earlier "2030-11-19" estimate from a separate
      // brute-force run was incorrect.
      const [a] = makeFamily([
        { name: '8 a', orbitalPeriod: 2.25117230028935, semiMajorAxis: 0.00363219539572259,
          orbitalEccentricity: 0.000088, orbitalInclination: 0.113794,
          argOfPeriapsis: 153.599312, ascendingNode: 50.21538,
          meanAnomaly: 327.54246, radius: 1050.1225,
          timestamps: { meanAnomaly: '2025-03-25T03:50:15Z' } as any },
        { name: '8 b', orbitalPeriod: 2.26288854524306, semiMajorAxis: 0.00364478705615213,
          orbitalEccentricity: 0.000375, orbitalInclination: 0.424045,
          argOfPeriapsis: 136.319344, ascendingNode: 30.938978,
          meanAnomaly: 282.401135, radius: 982.592125,
          timestamps: { meanAnomaly: '2025-03-25T03:50:17Z' } as any },
      ]);
      const r = service.detectCollisionStatus(a, now);
      expect(r.isCandidate).toBe(true);
      expect(r.partnerName).toBe('8 b');
      expect(r.nextCollision).not.toBeNull();
      expect(r.nextCollision!.start.toISOString().slice(0, 10)).toBe('2031-02-25');
      // Duration ≈ 4h 19m = 259 minutes.
      const durationMin = (r.nextCollision!.end.getTime() - r.nextCollision!.start.getTime()) / 60000;
      expect(durationMin).toBeGreaterThan(230);
      expect(durationMin).toBeLessThan(290);
      expect(r.nextCollision!.minSeparationKm).toBeGreaterThan(0);
      expect(r.nextCollision!.minSeparationKm).toBeLessThanOrEqual(r.combinedRadiiKm!);
    });

    it('flags the real KOI 232 2 / 3 pair and dates the imminent contact', () => {
      // Near-identical orbits (same semiMajorAxis, inclination, ascending node) with a
      // ~27-day synodic period. The collision is ~1.75 days after now.
      // Independent brute-force 3D propagation: 2026-06-28, duration ≈ 1h 8m (68 minutes).
      const [body2] = makeFamily([
        { name: 'KOI 232 2', orbitalPeriod: 12.4660706906366, semiMajorAxis: 0.189000125790628,
          orbitalEccentricity: 0, orbitalInclination: 88.239996,
          argOfPeriapsis: 217.884004, ascendingNode: 0,
          meanAnomaly: 84.268807, radius: 71231.28,
          timestamps: { meanAnomaly: '2026-05-14T15:40:42Z' } as any },
        { name: 'KOI 232 3', orbitalPeriod: 21.5873791387731, semiMajorAxis: 0.189000125790628,
          orbitalEccentricity: 0, orbitalInclination: 88.239996,
          argOfPeriapsis: 299.264202, ascendingNode: 0,
          meanAnomaly: 356.239342, radius: 71231.28,
          timestamps: { meanAnomaly: '2026-05-14T15:41:08Z' } as any },
      ]);
      const r = service.detectCollisionStatus(body2, now);
      expect(r.isCandidate).toBe(true);
      expect(r.partnerName).toBe('KOI 232 3');
      expect(r.nextCollision).not.toBeNull();
      expect(r.nextCollision!.start.toISOString().slice(0, 10)).toBe('2026-06-28');
      // Duration ≈ 1h 8m = 68 minutes.
      const durationMin = (r.nextCollision!.end.getTime() - r.nextCollision!.start.getTime()) / 60000;
      expect(durationMin).toBeGreaterThan(50);
      expect(durationMin).toBeLessThan(100);
      expect(r.nextCollision!.minSeparationKm).toBeGreaterThan(0);
      expect(r.nextCollision!.minSeparationKm).toBeLessThanOrEqual(r.combinedRadiiKm!);
    });

    it('flags the real Eoch Flyuae YK-K c10-56 1 a / b pair and dates the imminent contact', () => {
      // Near-coplanar moons of gas giant "1", synodic period ≈ 6.86 days.
      // Contact confirmed by Elite Observatory: 2026-07-03 ~23:07 UTC, duration ≈ 1h 18m
      // (78 minutes). Parameters from Spansh dump id64 15463257612378.
      // nowHere is set to 2026-06-28 (the date the front-end was observed): the preceding
      // synodic contact falls at ~2026-06-27T02:29 UTC and ends ~03:47 UTC, so it is already
      // over by 2026-06-28T00:00 and the algorithm correctly returns the 2026-07-03 window.
      const nowHere = Date.parse('2026-06-28T00:00:00Z');
      const [a] = makeFamily([
        { name: '1 a', orbitalPeriod: 0.157127550081019, semiMajorAxis: 0.000251518168059788,
          orbitalEccentricity: 3.3e-05, orbitalInclination: 0.013618,
          argOfPeriapsis: 237.157193, ascendingNode: 113.296374,
          meanAnomaly: 332.120793, radius: 622.7360625,
          timestamps: { meanAnomaly: '2026-06-23T11:53:53Z' } as any },
        { name: '1 b', orbitalPeriod: 0.153610475914352, semiMajorAxis: 0.000247750778161951,
          orbitalEccentricity: 0.000216, orbitalInclination: 0.00413,
          argOfPeriapsis: 200.490883, ascendingNode: 41.825083,
          meanAnomaly: 33.450288, radius: 450.6381875,
          timestamps: { meanAnomaly: '2026-06-23T11:53:53Z' } as any },
      ]);
      const r = service.detectCollisionStatus(a, nowHere);
      expect(r.isCandidate).toBe(true);
      expect(r.partnerName).toBe('1 b');
      expect(r.nextCollision).not.toBeNull();
      expect(r.nextCollision!.start.toISOString().slice(0, 10)).toBe('2026-07-03');
      // Duration ≈ 1h 18m = 78 minutes.
      const durationMin = (r.nextCollision!.end.getTime() - r.nextCollision!.start.getTime()) / 60000;
      expect(durationMin).toBeGreaterThan(65);
      expect(durationMin).toBeLessThan(90);
      expect(r.nextCollision!.minSeparationKm).toBeGreaterThan(0);
      expect(r.nextCollision!.minSeparationKm).toBeLessThanOrEqual(r.combinedRadiiKm!);
    });
  });
});
