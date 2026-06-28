import { StellarPhysicsService } from './stellar-physics.service';

describe('StellarPhysicsService', () => {
  let service: StellarPhysicsService;

  beforeEach(() => {
    service = new StellarPhysicsService();
  });

  describe('spinResonance', () => {
    it('detects a 1:1 (synchronous) resonance', () => {
      expect(service.spinResonance(10, 10)).toBe('1:1');
    });

    it('detects a 3:2 resonance', () => {
      // orbital / rotational = 3/2
      expect(service.spinResonance(2, 3)).toBe('3:2');
    });

    it('returns none when periods are missing', () => {
      expect(service.spinResonance(0, 10)).toBe('none');
      expect(service.spinResonance(10, undefined)).toBe('none');
    });

    it('returns none for a non-simple ratio', () => {
      expect(service.spinResonance(1, 7.13)).toBe('none');
    });

    it('detects resonance for retrograde rotators (negative rotationalPeriod)', () => {
      // Elite stores retrograde rotation as a negative period; a retrograde
      // tidally-locked body must still classify as 1:1, not silently 'none'.
      expect(service.spinResonance(-10, 10)).toBe('1:1');
      expect(service.spinResonance(-2, 3)).toBe('3:2');
    });
  });

  describe('tangentialVelocityKms', () => {
    it('computes equatorial velocity from rotation period and radius', () => {
      // radius 695700 km, period 1 day -> 2π·695700 km / 86400 s
      const expected = (2 * Math.PI * 695700) / 86400;
      expect(service.tangentialVelocityKms(1, 695700)).toBeCloseTo(expected, 6);
    });

    it('halves the velocity when the period doubles', () => {
      const v1 = service.tangentialVelocityKms(1, 100000);
      const v2 = service.tangentialVelocityKms(2, 100000);
      expect(v2).toBeCloseTo(v1 / 2, 9);
    });
  });

  describe('radiusKm', () => {
    it('prefers an explicit km radius', () => {
      expect(service.radiusKm(1500, 2)).toBe(1500);
    });

    it('falls back to solar radius', () => {
      expect(service.radiusKm(undefined, 1)).toBeCloseTo(695700, 3);
    });

    it('returns null when neither is present', () => {
      expect(service.radiusKm(null, null)).toBeNull();
    });
  });

  describe('classifyNeutronStar', () => {
    const SEC = 86400; // seconds per day; period args below are in days

    it('returns null when any required value is missing', () => {
      expect(service.classifyNeutronStar(undefined, 0.001, 8)).toBeNull();
      expect(service.classifyNeutronStar(1.5, undefined, 8)).toBeNull();
      expect(service.classifyNeutronStar(1.5, 0.001, undefined)).toBeNull();
    });

    it('classifies a sub-10ms rotator as a millisecond pulsar', () => {
      expect(service.classifyNeutronStar(1.5, 0.005 / SEC, 8)).toBe('Millisecond Pulsar');
      expect(service.classifyNeutronStar(2.5, 0.005 / SEC, 8)).toBe('Hyper-Massive Millisecond Pulsar');
    });

    it('classifies standard and anomalous-mass pulsars (< 5s)', () => {
      expect(service.classifyNeutronStar(1.5, 2 / SEC, 8)).toBe('Standard Pulsar');
      expect(service.classifyNeutronStar(2.5, 2 / SEC, 8)).toBe('Anomalous Mass Pulsar');
    });

    it('classifies slow-period pulsars (5–30s)', () => {
      expect(service.classifyNeutronStar(1.5, 10 / SEC, 8)).toBe('Slow-Period Pulsar');
      expect(service.classifyNeutronStar(2.5, 10 / SEC, 8)).toBe('Anomalous Mass Slow-Period Pulsar');
    });

    it('distinguishes magnetars from pulsars by absolute magnitude (30s–1h)', () => {
      expect(service.classifyNeutronStar(1.5, 100 / SEC, 8)).toBe('Ultra-Long Period Magnetar');
      expect(service.classifyNeutronStar(1.5, 100 / SEC, 12)).toBe('Ultra-Long Period Pulsar');
    });

    it('classifies a multi-hour rotator as an anomalous slow-rotator', () => {
      expect(service.classifyNeutronStar(1.5, 7200 / SEC, 8)).toBe('Anomalous Slow-Rotator');
    });

    it('classifies retrograde (negative period) rotators by magnitude', () => {
      // Elite stores retrograde rotation as a negative period; the sign must not
      // collapse a slow rotator into the sub-10ms "Millisecond Pulsar" branch.
      expect(service.classifyNeutronStar(1.5, -7200 / SEC, 8)).toBe('Anomalous Slow-Rotator');
      expect(service.classifyNeutronStar(1.5, -10 / SEC, 8)).toBe('Slow-Period Pulsar');
      // A genuinely fast retrograde spinner still classifies as a millisecond pulsar.
      expect(service.classifyNeutronStar(1.5, -0.005 / SEC, 8)).toBe('Millisecond Pulsar');
    });
  });
});
