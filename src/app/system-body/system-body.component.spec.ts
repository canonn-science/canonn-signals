import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, provideZonelessChangeDetection } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import { SystemBodyComponent } from './system-body.component';
import { AppService } from '../app.service';

describe('SystemBodyComponent', () => {
  let component: SystemBodyComponent;
  let fixture: ComponentFixture<SystemBodyComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [SystemBodyComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: AppService, useValue: { codexEntries: of([]), getBodyDisplayName: (n: string) => n } },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(undefined) }) } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    fixture = TestBed.createComponent(SystemBodyComponent);
    component = fixture.componentInstance;
    // Intentionally not calling detectChanges(): the template requires a populated
    // `body` input; these tests exercise the pure orbital-mechanics helpers directly.
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('exposes Math.abs via the abs() helper', () => {
    expect(component.abs(-5)).toBe(5);
    expect(component.abs(5)).toBe(5);
  });

  it('classifies orbital eccentricity', () => {
    expect(component.getEccentricityAnalysis(0)).toBe('Circular');
    expect(component.getEccentricityAnalysis(0.2)).toBe('Nearly Circular');
    expect(component.getEccentricityAnalysis(0.6)).toBe('Eccentric');
    expect(component.getEccentricityAnalysis(0.9)).toBe('Highly Eccentric');
  });

  describe('Orbital Position Calculations', () => {
    it('should calculate correct position for circular orbit at periapsis', () => {
      // Test: Circular orbit (e=0) at 1 AU, mean anomaly = 0 (at periapsis)
      // Expected: x = 1 AU, y = 0, z = 0
      const result = (component as any).orbitalElementsToCartesian(
        1.0,   // semiMajorAxisAU
        0.0,   // eccentricity
        0.0,   // inclinationDeg
        0.0,   // argPeriapsisDeg
        0.0,   // ascendingNodeDeg
        0.0    // meanAnomalyDeg
      );

      const expectedX = 149597870.7; // 1 AU in km
      expect(result.x).toBeCloseTo(expectedX, 1);
      expect(result.y).toBeCloseTo(0, 1);
      expect(result.z).toBeCloseTo(0, 1);
    });

    it('should calculate correct position for circular orbit at 90 degrees', () => {
      // Test: Circular orbit at 1 AU, mean anomaly = 90°
      // Expected: x ≈ 0, y = 1 AU, z = 0
      const result = (component as any).orbitalElementsToCartesian(
        1.0,   // semiMajorAxisAU
        0.0,   // eccentricity
        0.0,   // inclinationDeg
        0.0,   // argPeriapsisDeg
        0.0,   // ascendingNodeDeg
        90.0   // meanAnomalyDeg
      );

      const expectedY = 149597870.7; // 1 AU in km
      expect(result.x).toBeCloseTo(0, 1);
      expect(result.y).toBeCloseTo(expectedY, 1);
      expect(result.z).toBeCloseTo(0, 1);
    });

    it('should calculate correct distance for eccentric orbit at periapsis', () => {
      // Test: Eccentric orbit (e=0.5) at periapsis (M=0)
      // Expected distance: a(1-e) = 1.0 * 0.5 = 0.5 AU
      const result = (component as any).orbitalElementsToCartesian(
        1.0,   // semiMajorAxisAU
        0.5,   // eccentricity
        0.0,   // inclinationDeg
        0.0,   // argPeriapsisDeg
        0.0,   // ascendingNodeDeg
        0.0    // meanAnomalyDeg
      );

      const expectedDistance = 0.5 * 149597870.7; // 0.5 AU in km
      const actualDistance = Math.sqrt(result.x * result.x + result.y * result.y + result.z * result.z);
      expect(actualDistance).toBeCloseTo(expectedDistance, 1);
    });

    it('should calculate correct distance for eccentric orbit at apoapsis', () => {
      // Test: Eccentric orbit (e=0.5) at apoapsis (M=180)
      // Expected distance: a(1+e) = 1.0 * 1.5 = 1.5 AU
      const result = (component as any).orbitalElementsToCartesian(
        1.0,   // semiMajorAxisAU
        0.5,   // eccentricity
        0.0,   // inclinationDeg
        0.0,   // argPeriapsisDeg
        0.0,   // ascendingNodeDeg
        180.0  // meanAnomalyDeg
      );

      const expectedDistance = 1.5 * 149597870.7; // 1.5 AU in km
      const actualDistance = Math.sqrt(result.x * result.x + result.y * result.y + result.z * result.z);
      expect(actualDistance).toBeCloseTo(expectedDistance, 1);
    });

    it('should calculate correct z-component for inclined orbit', () => {
      // Test: Circular orbit with 90° inclination at 90° mean anomaly
      // Expected: z-component should equal orbital radius (1 AU)
      const result = (component as any).orbitalElementsToCartesian(
        1.0,   // semiMajorAxisAU
        0.0,   // eccentricity
        90.0,  // inclinationDeg (perpendicular to reference plane)
        0.0,   // argPeriapsisDeg
        0.0,   // ascendingNodeDeg
        90.0   // meanAnomalyDeg
      );

      const expectedZ = 149597870.7; // 1 AU in km
      expect(result.x).toBeCloseTo(0, 1);
      expect(result.y).toBeCloseTo(0, 1);
      expect(result.z).toBeCloseTo(expectedZ, 1);
    });

    it('should maintain correct orbital radius for circular orbit at any mean anomaly', () => {
      // Test: For a circular orbit, distance should always equal semi-major axis
      const semiMajorAxisKm = 149597870.7; // 1 AU

      for (let angle = 0; angle < 360; angle += 45) {
        const result = (component as any).orbitalElementsToCartesian(
          1.0,   // semiMajorAxisAU
          0.0,   // eccentricity
          0.0,   // inclinationDeg
          0.0,   // argPeriapsisDeg
          0.0,   // ascendingNodeDeg
          angle  // meanAnomalyDeg
        );

        const distance = Math.sqrt(result.x * result.x + result.y * result.y + result.z * result.z);
        expect(distance).toBeCloseTo(semiMajorAxisKm, 1);
      }
    });

    it('should handle small semi-major axis correctly', () => {
      // Test: Small orbit (0.1 AU) to verify scaling
      const result = (component as any).orbitalElementsToCartesian(
        0.1,   // semiMajorAxisAU (Mercury-like)
        0.2,   // eccentricity
        0.0,   // inclinationDeg
        0.0,   // argPeriapsisDeg
        0.0,   // ascendingNodeDeg
        0.0    // meanAnomalyDeg
      );

      // At periapsis: distance = a(1-e) = 0.1 * 0.8 = 0.08 AU
      const expectedDistance = 0.08 * 149597870.7;
      const actualDistance = Math.sqrt(result.x * result.x + result.y * result.y + result.z * result.z);
      expect(actualDistance).toBeCloseTo(expectedDistance, 1);
    });
  });
});
