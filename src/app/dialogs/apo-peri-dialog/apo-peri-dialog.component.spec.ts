import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { ApoPeriDialogComponent, ApoPeriDialogData } from './apo-peri-dialog.component';

function setup(data: ApoPeriDialogData): ComponentFixture<ApoPeriDialogComponent> {
  TestBed.configureTestingModule({
    imports: [ApoPeriDialogComponent],
    providers: [provideZonelessChangeDetection(), { provide: MAT_DIALOG_DATA, useValue: data }],
  });
  const fixture = TestBed.createComponent(ApoPeriDialogComponent);
  fixture.detectChanges();
  return fixture;
}

describe('ApoPeriDialogComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renders the apoapsis heading and the mean-anomaly steps when elements are present', () => {
    const fixture = setup({
      type: 'apo', date: new Date('2026-06-22T00:00:00Z'), days: 12.3, distanceKm: 1000,
      meanAnomaly: 45, orbitalPeriod: 200, timestamp: new Date('2026-06-01T00:00:00Z'),
      currentMeanAnomaly: 90, degreesToEvent: 90,
    });
    expect(fixture.componentInstance.heading).toBe('Next Apoapsis');
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('ol')).toBeTruthy();
    expect(el.textContent).toContain('Apoapsis');
  });

  it('renders the periapsis heading and the no-data note when elements are missing', () => {
    const fixture = setup({ type: 'peri', date: new Date('2026-06-22T00:00:00Z'), days: 5 });
    expect(fixture.componentInstance.heading).toBe('Next Periapsis');
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('ol')).toBeNull();
    expect(el.textContent).toContain('requires a recorded mean anomaly');
  });
});
