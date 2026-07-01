import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { AnomalyDialogComponent, AnomalyDialogData } from './anomaly-dialog.component';
import { OrbitalRelationsService } from '../../data/orbital-relations.service';

function setup(data: AnomalyDialogData): ComponentFixture<AnomalyDialogComponent> {
  TestBed.configureTestingModule({
    imports: [AnomalyDialogComponent],
    providers: [provideZonelessChangeDetection(), { provide: MAT_DIALOG_DATA, useValue: data }],
  });
  const fixture = TestBed.createComponent(AnomalyDialogComponent);
  fixture.detectChanges();
  return fixture;
}

describe('AnomalyDialogComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  const baseData: AnomalyDialogData = {
    type: 'mean',
    bodyName: 'Test Body b',
    recordedMeanAnomaly: 45,
    recordedTimestamp: new Date('2026-06-01T00:00:00Z'),
    systemEpoch: new Date('2026-06-15T00:00:00Z'),
    meanAnomalyAtEpoch: 90,
    eccentricity: 0.5,
    orbitalPeriodDays: 200,
  };

  it('renders the Mean Anomaly heading and the recorded/epoch values with eccentricity present', () => {
    const fixture = setup(baseData);
    expect(fixture.componentInstance.heading).toBe('Mean Anomaly');
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Test Body b');
    expect(el.textContent).toContain('45');
    expect(el.textContent).toContain('90');
    expect(el.querySelector('svg.anomaly-diagram')).toBeTruthy();
  });

  it('renders the True Anomaly heading for type "true"', () => {
    const fixture = setup({ ...baseData, type: 'true' });
    expect(fixture.componentInstance.heading).toBe('True Anomaly');
  });

  it('derives true-anomaly values from the mean anomaly and eccentricity', () => {
    const fixture = setup(baseData);
    const expected = new OrbitalRelationsService().meanToTrueAnomaly(90, 0.5);
    expect(fixture.componentInstance.trueAnomalyAtEpoch()).toBeCloseTo(expected, 6);
  });

  it('omits the diagram and true-anomaly figures when eccentricity is unrecorded', () => {
    const fixture = setup({ ...baseData, eccentricity: undefined });
    const c = fixture.componentInstance;
    expect(c.hasEccentricity).toBe(false);
    expect(c.trueAnomalyAtEpoch()).toBeUndefined();
    expect(c.diagram()).toBeNull();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('svg.anomaly-diagram')).toBeNull();
    expect(el.textContent).toContain("can't be calculated");
  });
});
