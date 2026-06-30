import { OrbitalRelationsService } from './orbital-relations.service';
import { SystemBody, CanonnBiostatsBody } from '../home/home.component';
import { BODY_TYPE } from './body-types';

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

    it('suppresses any status when the shared parent is a barycentre', () => {
      // A barycentre is the centre of mass of a binary, not a real central body, so its
      // children orbiting it (here a 180° pair that would otherwise read as L3) have no
      // Lagrange host and therefore no Trojan/Lagrange status.
      const [a, b] = makeFamily([
        { orbitalPeriod: 10, semiMajorAxis: 5, argOfPeriapsis: 0 },
        { orbitalPeriod: 10, semiMajorAxis: 5, argOfPeriapsis: 180 },
      ]);
      // With the default (Star) parent the pair is detected as L3…
      expect(service.detectTrojanStatus(a).lagrangePoint).toBe('L3');
      // …but under a barycentre parent the status — and the whole diagram — is suppressed.
      a.parent!.bodyData.type = BODY_TYPE.Barycentre;
      expect(service.detectTrojanStatus(a).lagrangePoint).toBeNull();
      expect(service.detectTrojanStatus(b).lagrangePoint).toBeNull();
      expect(service.lagrangeConfiguration(a)).toBeNull();
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

    it('matches Elite\'s convention: ED encodes the co-orbital offset in argOfPeriapsis alone', () => {
      // The true along-orbit position is mean longitude λ = Ω + ω + M, so comparing
      // argOfPeriapsis (ω) alone is only exact when siblings share ascendingNode (Ω) and
      // meanAnomaly (M). Real game data does exactly that: ED holds Ω and M identical across
      // co-orbital siblings and varies only argOfPeriapsis. These are the verbatim orbital
      // elements of Alpha Centauri's "2045 PC2" / "Lagrange" pair (e2e fixture) — a genuine
      // same-radius L3 co-orbital, the partner literally named "Lagrange". Ω and M match to
      // full precision; only argOfPeriapsis differs (by 180°).
      const [pc2, lagrange] = makeFamily([
        { orbitalPeriod: 9348.90664562031, semiMajorAxis: 9.56568437539316,
          argOfPeriapsis: 269.999997, ascendingNode: 0.0, meanAnomaly: 36.634872 },
        { orbitalPeriod: 9348.90664562031, semiMajorAxis: 9.56568437539316,
          argOfPeriapsis: 89.999999, ascendingNode: 0.0, meanAnomaly: 36.634872 },
      ]);
      expect(service.detectTrojanStatus(pc2).lagrangePoint).toBe('L3');
      expect(service.detectTrojanStatus(lagrange).lagrangePoint).toBe('L3');

      // Because ΔΩ = ΔM = 0 in ED's data, adding the shared Ω/M back into a full
      // mean-longitude comparison would not change the verdict: Δλ = Δω. Re-running the
      // same geometry without any Ω/M gives the identical L3 result, proving the
      // argOfPeriapsis-only comparison loses nothing for real game data.
      const [bareA, bareB] = makeFamily([
        { orbitalPeriod: 9348.90664562031, semiMajorAxis: 9.56568437539316, argOfPeriapsis: 269.999997 },
        { orbitalPeriod: 9348.90664562031, semiMajorAxis: 9.56568437539316, argOfPeriapsis: 89.999999 },
      ]);
      expect(service.detectTrojanStatus(bareA).lagrangePoint).toBe('L3');
      expect(service.detectTrojanStatus(bareB).lagrangePoint).toBe('L3');
    });

    // Real same-radius Trojan/Lagrange systems (genuine ±60° co-orbitals, not 180° binaries),
    // pulled verbatim from the committed biostats fixtures under e2e/fixtures/. Each pair shares
    // an identical orbitalPeriod and semiMajorAxis; ascendingNode (Ω) and meanAnomaly (M) are
    // identical between siblings (or absent on both), and the entire ±60° along-orbit offset is
    // carried by argOfPeriapsis — so the argOfPeriapsis-only test reproduces ED's own placement
    // exactly. These lock in that real Trojan data is detected, and confirm the empirical finding
    // generalises beyond the 180° binaries above. (Values verified against the fixtures.)
    describe('real game fixtures (e2e/fixtures/*.json)', () => {
      it('Pro Eurl JF-A d88 B 2/B 3 — ±60° in argOfPeriapsis, no Ω/M recorded', () => {
        // pro-eurl-jf-a-d88.json: bodies 30 & 33, asc/meanAnomaly absent on both.
        const [b2, b3] = makeFamily([
          { orbitalPeriod: 2756.17222222222, semiMajorAxis: 2.36276632726164, argOfPeriapsis: 256.983124 },
          { orbitalPeriod: 2756.17222222222, semiMajorAxis: 2.36276632726164, argOfPeriapsis: 316.983124 },
        ]);
        expect(service.detectTrojanStatus(b2).lagrangePoint).toBe('L5');
        expect(service.detectTrojanStatus(b3).lagrangePoint).toBe('L4');
      });

      it('Prooe Bli FQ-R c19-2 2/3 — ±60° in argOfPeriapsis, no Ω/M recorded', () => {
        // prooe-bli-fq-r-c19-2.json: bodies 18 & 25, asc/meanAnomaly absent on both.
        const [two, three] = makeFamily([
          { orbitalPeriod: 1323.52527777778, semiMajorAxis: 1.90290777597278, argOfPeriapsis: 213.138443 },
          { orbitalPeriod: 1323.52527777778, semiMajorAxis: 1.90290777597278, argOfPeriapsis: 273.138428 },
        ]);
        expect(service.detectTrojanStatus(two).lagrangePoint).toBe('L5');
        expect(service.detectTrojanStatus(three).lagrangePoint).toBe('L4');
      });

      it('Truecho NE-P c22-0 6/7 — ±60° across the 0° seam, shared Ω and M', () => {
        // truecho-ne-p-c22-0.json: bodies 50 & 68. Ω = 57.140393 on both; M matches to ~1e-4.
        const [six, seven] = makeFamily([
          { orbitalPeriod: 5199.37670065297, semiMajorAxis: 5.61591537457029,
            argOfPeriapsis: 55.239595, ascendingNode: 57.140393, meanAnomaly: 311.627298 },
          { orbitalPeriod: 5199.37670065297, semiMajorAxis: 5.61591537457029,
            argOfPeriapsis: 355.23958, ascendingNode: 57.140393, meanAnomaly: 311.627451 },
        ]);
        expect(service.detectTrojanStatus(six).lagrangePoint).toBe('L4');
        expect(service.detectTrojanStatus(seven).lagrangePoint).toBe('L5');
      });

      it('Pipe (stem) Sector DL-Y d17 barycentre/11 — ±60° in argOfPeriapsis, shared Ω and M', () => {
        // pipe-stem-sector-dl-y-d17.json: bodies 34 & 44. Ω = -148.301524 on both; M matches to ~1e-4.
        const [bary, eleven] = makeFamily([
          { orbitalPeriod: 2239.87114926179, semiMajorAxis: 3.56427210739919,
            argOfPeriapsis: 135.846247, ascendingNode: -148.301524, meanAnomaly: 271.037909 },
          { orbitalPeriod: 2239.87114926179, semiMajorAxis: 3.56427210739919,
            argOfPeriapsis: 75.846249, ascendingNode: -148.301524, meanAnomaly: 271.038015 },
        ]);
        expect(service.detectTrojanStatus(bary).lagrangePoint).toBe('L4');
        expect(service.detectTrojanStatus(eleven).lagrangePoint).toBe('L5');
      });

      it('Eorld Byio AA-A h539 — a host barycentre with Trojans at both L4 and L5', () => {
        // eorld-byio-aa-a-h539.json: barycentre 35 sits between A 18 (+60°) and A 19 (-60°), all
        // at the same radius with identical Ω = 128.746136 and M ≈ 280.54. The barycentre is the
        // co-orbital primary (host), not itself a Trojan.
        const [bary, a18, a19] = makeFamily([
          { orbitalPeriod: 78.8197259384144, semiMajorAxis: 1.24773884117624,
            argOfPeriapsis: 255.841558, ascendingNode: 128.746136, meanAnomaly: 280.536448 },
          { orbitalPeriod: 78.8197259384144, semiMajorAxis: 1.24773884117624,
            argOfPeriapsis: 315.841556, ascendingNode: 128.746136, meanAnomaly: 280.540582 },
          { orbitalPeriod: 78.8197259384144, semiMajorAxis: 1.24773884117624,
            argOfPeriapsis: 195.84156, ascendingNode: 128.746136, meanAnomaly: 280.539129 },
        ]);
        const host = service.detectTrojanStatus(bary);
        expect(host.isHost).toBe(true);
        expect(host.lagrangePoint).toBeNull();
        expect(service.detectTrojanStatus(a18).lagrangePoint).toBe('L4');
        expect(service.detectTrojanStatus(a19).lagrangePoint).toBe('L5');
      });
    });
  });

  describe('lagrangeConfiguration', () => {
    it('returns null when the body has no parent or no orbital period', () => {
      const [orphan] = makeFamily([{ argOfPeriapsis: 0, semiMajorAxis: 5 }]);
      orphan.parent = null;
      expect(service.lagrangeConfiguration(orphan)).toBeNull();

      const [noPeriod] = makeFamily([{ argOfPeriapsis: 0, semiMajorAxis: 5 }]);
      expect(service.lagrangeConfiguration(noPeriod)).toBeNull();
    });

    it('returns null when the body has no co-orbital relationships', () => {
      const [lonely] = makeFamily([{ orbitalPeriod: 10, semiMajorAxis: 5, argOfPeriapsis: 0 }]);
      expect(service.lagrangeConfiguration(lonely)).toBeNull();
    });

    it('resolves a host + L4/L5 family (Eorld Byio AA-A h539), flagging the focus', () => {
      // The same real host configuration used above: barycentre (host) between A 18 (L4) and A 19 (L5).
      const [bary, a18, a19] = makeFamily([
        { orbitalPeriod: 78.8197259384144, semiMajorAxis: 1.24773884117624,
          argOfPeriapsis: 255.841558, ascendingNode: 128.746136, meanAnomaly: 280.536448 },
        { orbitalPeriod: 78.8197259384144, semiMajorAxis: 1.24773884117624,
          argOfPeriapsis: 315.841556, ascendingNode: 128.746136, meanAnomaly: 280.540582 },
        { orbitalPeriod: 78.8197259384144, semiMajorAxis: 1.24773884117624,
          argOfPeriapsis: 195.84156, ascendingNode: 128.746136, meanAnomaly: 280.539129 },
      ]);

      // Opened from the host: it occupies the secondary slot (focused), Trojans fill L4 and L5.
      const fromHost = service.lagrangeConfiguration(bary)!;
      expect(fromHost.primaryName).toBe('Parent');
      expect(fromHost.secondary).toEqual({ name: 'Child 1', bodyId: 1, isFocus: true });
      expect(fromHost.points.L4).toEqual([{ name: 'Child 2', bodyId: 2, isFocus: false }]);
      expect(fromHost.points.L5).toEqual([{ name: 'Child 3', bodyId: 3, isFocus: false }]);
      expect(fromHost.points.L1).toEqual([]);
      expect(fromHost.points.L2).toEqual([]);
      expect(fromHost.points.L3).toEqual([]);

      // Opened from the L4 Trojan: same configuration, but the focus moves to the L4 occupant.
      const fromL4 = service.lagrangeConfiguration(a18)!;
      expect(fromL4.secondary).toEqual({ name: 'Child 1', bodyId: 1, isFocus: false });
      expect(fromL4.points.L4).toEqual([{ name: 'Child 2', bodyId: 2, isFocus: true }]);
      expect(service.lagrangeConfiguration(a19)!.points.L5[0].isFocus).toBe(true);
    });

    it('resolves a lone ±60° pair with no host as a placeholder secondary', () => {
      // Pro Eurl JF-A d88 B 2 / B 3: a 60°-apart pair labelled L5 / L4, with no recorded host.
      const [b2, b3] = makeFamily([
        { orbitalPeriod: 2756.17222222222, semiMajorAxis: 2.36276632726164, argOfPeriapsis: 256.983124 },
        { orbitalPeriod: 2756.17222222222, semiMajorAxis: 2.36276632726164, argOfPeriapsis: 316.983124 },
      ]);
      const config = service.lagrangeConfiguration(b2)!;
      expect(config.secondary).toBeNull(); // → drawn as a placeholder
      expect(config.points.L5).toEqual([{ name: 'Child 1', bodyId: 1, isFocus: true }]);
      expect(config.points.L4).toEqual([{ name: 'Child 2', bodyId: 2, isFocus: false }]);
    });

    it('promotes one of an L3 opposition to the secondary slot, keeping the focus at L3', () => {
      // Pro Eurl HW-W e1-1 B 3 a / B 3 b: a ~180° pair around the real planet B 3, both L3.
      // With no host, one is drawn as the secondary on the orbit and the other on L3 opposite,
      // so the diagram shows the genuine opposition instead of two dots on a single marker.
      const [a, b] = makeFamily([
        { orbitalPeriod: 2.66276909722222, semiMajorAxis: 0.00100000075736372, argOfPeriapsis: 111.912498 },
        { orbitalPeriod: 2.66276909722222, semiMajorAxis: 0.00100000075736372, argOfPeriapsis: 291.153168 },
      ]);

      // Opened from B 3 a: its sibling fills the secondary slot, the focused body stays at L3.
      const fromA = service.lagrangeConfiguration(a)!;
      expect(fromA.secondary).toEqual({ name: 'Child 2', bodyId: 2, isFocus: false });
      expect(fromA.points.L3).toEqual([{ name: 'Child 1', bodyId: 1, isFocus: true }]);

      // Opened from B 3 b: the focus moves with the clicked body, again kept on the L3 marker.
      const fromB = service.lagrangeConfiguration(b)!;
      expect(fromB.secondary).toEqual({ name: 'Child 1', bodyId: 1, isFocus: false });
      expect(fromB.points.L3).toEqual([{ name: 'Child 2', bodyId: 2, isFocus: true }]);
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

    it('reports a collision in progress when now falls inside an active contact window', () => {
      // Eoch Flyuae YK-K c10-56 — the 1 a / 1 b / 1 c trio. By 2026-10-28T15:16:05Z the
      // synodic march has reached the ~17th contact; the ~78-min window is centred at
      // ~15:14 UTC so now sits inside it. All three moons have crossing orbits with each
      // other, forming a three-body collision cluster.
      const nowHere = Date.parse('2026-10-28T15:16:05Z');
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
        { name: '1 c', orbitalPeriod: 0.154680379282407, semiMajorAxis: 0.000248899845368514,
          orbitalEccentricity: 0.001125, orbitalInclination: 0.061853,
          argOfPeriapsis: 12.874691, ascendingNode: 95.932804,
          meanAnomaly: 161.468548, radius: 800.657125,
          timestamps: { meanAnomaly: '2026-06-23T11:53:53Z' } as any },
      ]);
      const r = service.detectCollisionStatus(a, nowHere);
      expect(r.isCandidate).toBe(true);
      // 1 c has the smaller minimum separation from 1 a → it becomes the primary partner.
      expect(r.partnerName).toBe('1 c');
      expect(r.nextCollision).not.toBeNull();
      // days < 0: the contact window started before now — it is currently in progress.
      expect(r.nextCollision!.days).toBeLessThan(0);
      // The window straddles now: start is in the past, end is in the future.
      expect(r.nextCollision!.start.getTime()).toBeLessThan(nowHere);
      expect(r.nextCollision!.end.getTime()).toBeGreaterThan(nowHere);
      // All three moons have geometrically crossing orbits → 1 b is a simultaneous partner.
      expect(r.simultaneousPartners).toContain('1 b');
    });

    it('merges upcoming collisions across every crossing partner of the body', () => {
      // The same 1 a / 1 b / 1 c trio: 1 a directly crosses BOTH 1 b and 1 c, so its upcoming
      // list must interleave contacts with both siblings (a multi-body collision cluster),
      // sorted chronologically, each window naming its own partner and contact radius.
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
        { name: '1 c', orbitalPeriod: 0.154680379282407, semiMajorAxis: 0.000248899845368514,
          orbitalEccentricity: 0.001125, orbitalInclination: 0.061853,
          argOfPeriapsis: 12.874691, ascendingNode: 95.932804,
          meanAnomaly: 161.468548, radius: 800.657125,
          timestamps: { meanAnomaly: '2026-06-23T11:53:53Z' } as any },
      ]);
      const r = service.detectCollisionStatus(a, nowHere);
      expect(r.isCandidate).toBe(true);

      // The list interleaves both partners, not just the primary.
      const partners = new Set(r.upcomingCollisions.map(w => w.partnerName));
      expect(partners).toContain('1 b');
      expect(partners).toContain('1 c');

      // Chronologically ordered, and every window self-describes its pair.
      for (let i = 1; i < r.upcomingCollisions.length; i++) {
        expect(r.upcomingCollisions[i].start.getTime())
          .toBeGreaterThanOrEqual(r.upcomingCollisions[i - 1].start.getTime());
      }
      for (const w of r.upcomingCollisions) {
        expect(w.partnerName).toBeTruthy();
        expect(w.combinedRadiiKm).toBeGreaterThan(0);
        expect(w.minSeparationKm).toBeLessThanOrEqual(w.combinedRadiiKm!);
      }

      // The primary partner (soonest collision) owns the first window.
      expect(r.upcomingCollisions[0].partnerName).toBe(r.partnerName);
      expect(r.nextCollision).toBe(r.upcomingCollisions[0]);
    });
  });

  describe('simultaneousCollisionsWithin', () => {
    const DAY_MS = 86_400_000;
    // The real Eoch Flyuae YK-K c10-56 moons 1 a / 1 b / 1 c, which all share crossing orbits
    // with very short (~0.15 day) periods, so conjunctions — and multi-body pile-ups — recur
    // often within any horizon.
    const TRIO: Partial<CanonnBiostatsBody>[] = [
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
      { name: '1 c', orbitalPeriod: 0.154680379282407, semiMajorAxis: 0.000248899845368514,
        orbitalEccentricity: 0.001125, orbitalInclination: 0.061853,
        argOfPeriapsis: 12.874691, ascendingNode: 95.932804,
        meanAnomaly: 161.468548, radius: 800.657125,
        timestamps: { meanAnomaly: '2026-06-23T11:53:53Z' } as any },
    ];
    const now = Date.parse('2026-06-28T00:00:00Z');

    it('finds multi-body pile-ups across the whole horizon, each naming ≥ 2 distinct partners', () => {
      const [a] = makeFamily(TRIO);
      const clusters = service.simultaneousCollisionsWithin(a, 180, now);
      expect(clusters.length).toBeGreaterThan(0);
      for (const c of clusters) {
        expect(c.partnerNames.length).toBeGreaterThanOrEqual(2);
        for (const n of c.partnerNames) { expect(['1 b', '1 c']).toContain(n); }
        // Within the horizon, and a real interval (end strictly after start, both after now).
        expect(c.start.getTime()).toBeLessThanOrEqual(now + 180 * DAY_MS);
        expect(c.end.getTime()).toBeGreaterThan(c.start.getTime());
        expect(c.end.getTime()).toBeGreaterThan(now);
      }
    });

    it('surfaces clusters beyond the 10-row contact cap (longer horizon finds at least as many)', () => {
      const [a] = makeFamily(TRIO);
      const near = service.simultaneousCollisionsWithin(a, 20, now);
      const far = service.simultaneousCollisionsWithin(a, 180, now);
      // A wider horizon never loses clusters and, for this fast-lapping trio, finds more.
      expect(far.length).toBeGreaterThanOrEqual(near.length);
      expect(far.length).toBeGreaterThan(near.length);
    });

    it('returns [] when the body has fewer than two crossing partners', () => {
      // A 1 a / 1 b pair: 1 a has a single crossing partner, so no simultaneity is possible.
      const [a] = makeFamily([TRIO[0], TRIO[1]]);
      expect(service.simultaneousCollisionsWithin(a, 180, now)).toEqual([]);
    });
  });

  describe('separationSeries', () => {
    const sampleTime = '2026-06-01T00:00:00Z';
    const start = Date.parse(sampleTime);

    /** A body with the phase data needed to be placed in time. */
    const body = (over: Partial<CanonnBiostatsBody>): CanonnBiostatsBody => ({
      bodyId: 1, name: 'b', id64: 0n, subType: '', type: 'Planet',
      semiMajorAxis: 0.01, orbitalEccentricity: 0, orbitalInclination: 0,
      ascendingNode: 0, argOfPeriapsis: 0, meanAnomaly: 0,
      timestamps: { meanAnomaly: sampleTime } as any, ...over,
    } as CanonnBiostatsBody);

    it('returns evenly-spaced samples spanning the requested window', () => {
      const a = body({ orbitalPeriod: 10 });
      const b = body({ orbitalPeriod: 13, semiMajorAxis: 0.012 });
      const series = service.separationSeries(a, b, start, start + 20 * 86_400_000, 50);
      expect(series.length).toBe(50);
      expect(series[0].tMs).toBe(start);
      expect(series[series.length - 1].tMs).toBe(start + 20 * 86_400_000);
      // Even spacing (within float tolerance over a multi-million-ms step).
      const step = series[1].tMs - series[0].tMs;
      expect(Math.abs((series[2].tMs - series[1].tMs) - step)).toBeLessThan(1);
      // Real, positive separations that actually vary as the bodies lap each other.
      for (const s of series) { expect(s.sepKm).toBeGreaterThan(0); expect(Number.isFinite(s.sepKm)).toBe(true); }
      const seps = series.map(s => s.sepKm);
      expect(Math.max(...seps)).toBeGreaterThan(Math.min(...seps));
    });

    it('reports ~zero separation for two bodies sharing identical orbital elements', () => {
      const a = body({ orbitalPeriod: 10 });
      const b = body({ orbitalPeriod: 10, name: 'c' });
      const series = service.separationSeries(a, b, start, start + 5 * 86_400_000, 20);
      for (const s of series) { expect(s.sepKm).toBeCloseTo(0, 3); }
    });

    it('returns [] when either body lacks the phase data needed to place it in time', () => {
      const a = body({ orbitalPeriod: 10 });
      const noPhase = body({ orbitalPeriod: 13, meanAnomaly: undefined });
      expect(service.separationSeries(a, noPhase, start, start + 86_400_000, 10)).toEqual([]);
    });

    it('returns [] for a degenerate window or sample count', () => {
      const a = body({ orbitalPeriod: 10 });
      const b = body({ orbitalPeriod: 13 });
      expect(service.separationSeries(a, b, start, start, 10)).toEqual([]);       // zero-width window
      expect(service.separationSeries(a, b, start, start + 86_400_000, 1)).toEqual([]); // too few samples
    });
  });
});
