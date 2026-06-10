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

  describe('jetConeAngle', () => {
    it('returns null for non-positive or missing inputs', () => {
      expect(service.jetConeAngle(0, 1, 1000)).toBeNull();
      expect(service.jetConeAngle(1, 0, 1000)).toBeNull();
      expect(service.jetConeAngle(1, 1, null)).toBeNull();
    });

    it('produces a finite angle for valid neutron-star inputs', () => {
      const angle = service.jetConeAngle(2.01, 1.5, 12830)!;
      expect(angle).not.toBeNull();
      expect(Number.isFinite(angle)).toBe(true);
    });

    it('matches jetConeAngleFromSeconds after unit conversion', () => {
      const fromDays = service.jetConeAngle(1.0, 1.5, 12830);
      const fromSeconds = service.jetConeAngleFromSeconds(86400, 1.5, 12830);
      expect(fromSeconds).toBeCloseTo(fromDays!, 9);
    });
  });
});
