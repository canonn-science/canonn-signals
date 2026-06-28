import { Injectable } from '@angular/core';

const KM_PER_SOLAR_RADIUS = 695700;
const SECONDS_PER_DAY = 86400;

/**
 * Pure rotational/stellar physics extracted from SystemBodyComponent: spin-orbit
 * resonance and tangential surface velocity.
 * No Angular/DOM dependency, so it can be unit-tested directly.
 */
@Injectable({ providedIn: 'root' })
export class StellarPhysicsService {
  /**
   * Nearest simple spin-orbit resonance (e.g. "1:1", "3:2") within tolerance, or
   * 'none'. Both periods use the same unit.
   */
  spinResonance(rotationalPeriod: number | null | undefined, orbitalPeriod: number | null | undefined): string {
    if (!rotationalPeriod || !orbitalPeriod) { return 'none'; }

    // Elite stores retrograde rotation as a negative rotationalPeriod; resonance is a
    // ratio of magnitudes, so a retrograde tidally-locked body is still 1:1. Use the
    // absolute periods (matching the solar-day code in SystemBodyComponent).
    const rotationsPerOrbit = Math.abs(orbitalPeriod) / Math.abs(rotationalPeriod);
    const maxDenominator = 5;
    const tolerance = 0.01;

    for (let denom = 1; denom <= maxDenominator; denom++) {
      for (let num = 1; num <= maxDenominator; num++) {
        const candidate = num / denom;
        const relError = Math.abs(candidate - rotationsPerOrbit) / candidate;
        if (relError <= tolerance) {
          return `${num}:${denom}`;
        }
      }
    }
    return 'none';
  }

  /** Equatorial surface (tangential) velocity in km/s for a given rotation period (days) and radius (km). */
  tangentialVelocityKms(rotationalPeriodDays: number, radiusKm: number): number {
    const rotationalPeriodSeconds = rotationalPeriodDays * SECONDS_PER_DAY;
    const circumferenceM = 2 * Math.PI * radiusKm * 1000;
    return circumferenceM / rotationalPeriodSeconds / 1000;
  }

  /** Radius in km from either a km radius or a solar-radius value, or null when absent. */
  radiusKm(radius: number | null | undefined, solarRadius: number | null | undefined): number | null {
    if (radius) { return radius; }
    if (solarRadius) { return solarRadius * KM_PER_SOLAR_RADIUS; }
    return null;
  }

  /**
   * Descriptive classification of a neutron star from its mass, rotation period and
   * absolute magnitude (period in days). Returns null when any required value is
   * missing, so callers can fall back to the generic "Neutron Star" label.
   */
  classifyNeutronStar(
    solarMasses: number | null | undefined,
    rotationalPeriodDays: number | null | undefined,
    absoluteMagnitude: number | null | undefined,
  ): string | null {
    if (solarMasses === undefined || solarMasses === null ||
      rotationalPeriodDays === undefined || rotationalPeriodDays === null ||
      absoluteMagnitude === undefined || absoluteMagnitude === null) {
      return null;
    }

    const period = rotationalPeriodDays * SECONDS_PER_DAY; // seconds
    const isHighMass = solarMasses > 2.1;

    if (period < 0.01) {
      return isHighMass ? 'Hyper-Massive Millisecond Pulsar' : 'Millisecond Pulsar';
    }
    if (period < 5) {
      return isHighMass ? 'Anomalous Mass Pulsar' : 'Standard Pulsar';
    }
    if (period < 30) {
      return isHighMass ? 'Anomalous Mass Slow-Period Pulsar' : 'Slow-Period Pulsar';
    }
    if (period < 3600) {
      return absoluteMagnitude < 10 ? 'Ultra-Long Period Magnetar' : 'Ultra-Long Period Pulsar';
    }
    return 'Anomalous Slow-Rotator';
  }
}
