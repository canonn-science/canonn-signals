import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { OnFootSafetyDialogComponent, OnFootSafetyDialogData } from './on-foot-safety-dialog.component';

const BASE: OnFootSafetyDialogData = {
  bodyName: 'Test Body', subType: 'Rocky body', atmosphereType: 'Thin Argon', surfacePressure: 0.01,
  surfaceTemperature: 250, gravity: 0.5, estimatedMin: 200, estimatedMax: 300, badgeClass: 'badge-green',
  lookupSource: 'subtype+atmosphere: Rocky body | Argon', p5Delta: -50, p95Delta: 50,
};

function setup(data: OnFootSafetyDialogData): ComponentFixture<OnFootSafetyDialogComponent> {
  TestBed.configureTestingModule({
    imports: [OnFootSafetyDialogComponent],
    providers: [provideZonelessChangeDetection(), { provide: MAT_DIALOG_DATA, useValue: data }],
  });
  const fixture = TestBed.createComponent(OnFootSafetyDialogComponent);
  fixture.detectChanges();
  return fixture;
}

describe('OnFootSafetyDialogComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('builds the body-specific heading and shows the safe verdict', () => {
    const fixture = setup(BASE);
    expect(fixture.componentInstance.heading).toBe('On-Foot Safety Analysis — Test Body');
    expect(fixture.nativeElement.querySelector('.safety-green')).toBeTruthy();
  });

  it('shows the high-gravity verdict when gravity exceeds the ceiling', () => {
    const el: HTMLElement = setup({ ...BASE, gravity: 5, badgeClass: 'badge-red' }).nativeElement;
    expect(el.textContent).toContain('Cannot disembark');
  });

  it('downloads the reference CSV without throwing', () => {
    const fixture = setup(BASE);
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    (URL as any).createObjectURL = () => 'blob:test';
    (URL as any).revokeObjectURL = () => {};
    try {
      expect(() => fixture.componentInstance.downloadReferenceData()).not.toThrow();
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
  });
});
