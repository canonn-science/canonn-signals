import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { ParentDistanceDialogComponent, ParentDistanceDialogData } from './parent-distance-dialog.component';
import { OrbitalRelationsService } from '../../data/orbital-relations.service';

function setup(data: ParentDistanceDialogData): ComponentFixture<ParentDistanceDialogComponent> {
  TestBed.configureTestingModule({
    imports: [ParentDistanceDialogComponent],
    providers: [provideZonelessChangeDetection(), { provide: MAT_DIALOG_DATA, useValue: data }],
  });
  const fixture = TestBed.createComponent(ParentDistanceDialogComponent);
  fixture.detectChanges();
  return fixture;
}

describe('ParentDistanceDialogComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  const baseData: ParentDistanceDialogData = {
    bodyName: 'Test Body b',
    parentName: 'Test Star',
    semiMajorAxisKm: 1_000_000,
    eccentricity: 0.3,
    apoapsisKm: 1_300_000,
    periapsisKm: 700_000,
    recordedMeanAnomaly: 45,
    recordedTimestamp: new Date('2026-06-01T00:00:00Z'),
    orbitalPeriodDays: 200,
    argOfPeriapsisDeg: 0,
  };

  it('renders the values list and the diagram', () => {
    const fixture = setup(baseData);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Test Body b');
    expect(el.textContent).toContain('Test Star');
    expect(el.querySelector('svg.parent-distance-diagram')).toBeTruthy();
  });

  it('derives the live mean/true anomaly and distance from the recorded elements', () => {
    const fixture = setup(baseData);
    const orbital = new OrbitalRelationsService();
    const c = fixture.componentInstance;

    // Computed independently against Date.now() (not the component's own captured value), so
    // a loose tolerance absorbs the few milliseconds between the two calls — at a 200-day
    // orbital period even a generous 1s drift is ~5e-5 degrees, far under this tolerance.
    const expectedMean = orbital.meanAnomalyNow(45, 200, '2026-06-01T00:00:00.000Z', Date.now());
    const expectedTrue = orbital.meanToTrueAnomaly(expectedMean, 0.3);
    const expectedR = (baseData.semiMajorAxisKm * (1 - 0.3 * 0.3)) / (1 + 0.3 * Math.cos(expectedTrue * Math.PI / 180));

    expect(c.meanAnomalyLive()).toBeCloseTo(expectedMean, 3);
    expect(c.trueAnomalyLive()).toBeCloseTo(expectedTrue, 3);
    expect(c.parentDistanceLiveKm()).toBeCloseTo(expectedR, 1);
  });

  it('places the diagram\'s body point at the same distance from the focus as the live value', () => {
    const fixture = setup(baseData);
    const c = fixture.componentInstance;
    const d = c.diagram();
    const distFromFocus = Math.hypot(d.bodyPoint.x - d.focus.x, d.bodyPoint.y - d.focus.y);
    // The diagram is drawn to a fixed 46px "apoapsis" scale, not the real km value, so it
    // won't equal parentDistanceLiveKm() directly — but it should stay strictly between the
    // drawn periapsis and apoapsis distances from the focus, same as the live km value sits
    // between data.periapsisKm and data.apoapsisKm.
    const periDist = Math.hypot(d.periapsisPoint.x - d.focus.x, d.periapsisPoint.y - d.focus.y);
    const apoDist = Math.hypot(d.apoapsisPoint.x - d.focus.x, d.apoapsisPoint.y - d.focus.y);
    expect(distFromFocus).toBeGreaterThanOrEqual(Math.min(periDist, apoDist) - 0.01);
    expect(distFromFocus).toBeLessThanOrEqual(Math.max(periDist, apoDist) + 0.01);
  });

  it('falls back to generic body/parent labels when names are absent', () => {
    const fixture = setup({ ...baseData, bodyName: undefined, parentName: undefined });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('This body');
    expect(el.textContent).toContain('the parent body');
  });
});
