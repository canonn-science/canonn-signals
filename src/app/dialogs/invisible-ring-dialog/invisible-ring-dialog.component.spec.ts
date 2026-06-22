import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { InvisibleRingDialogComponent, InvisibleRingDialogData } from './invisible-ring-dialog.component';

function setup(data: InvisibleRingDialogData): ComponentFixture<InvisibleRingDialogComponent> {
  TestBed.configureTestingModule({
    imports: [InvisibleRingDialogComponent],
    providers: [provideZonelessChangeDetection(), { provide: MAT_DIALOG_DATA, useValue: data }],
  });
  const fixture = TestBed.createComponent(InvisibleRingDialogComponent);
  fixture.detectChanges();
  return fixture;
}

const BASE: InvisibleRingDialogData = {
  ringName: 'A Ring', innerRadius: 60000, outerRadius: 5000000,
  width: 4940000, area: 1e13, mass: 1, density: 0.00001, isInvisible: true,
};

describe('InvisibleRingDialogComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('shows the invisible conclusion when the ring meets the criteria', () => {
    const el: HTMLElement = setup(BASE).nativeElement;
    expect(el.querySelector('.conclusion')).toBeTruthy();
    expect(el.querySelector('.conclusion-safe')).toBeNull();
    expect(el.textContent).toContain('A Ring');
  });

  it('shows the visible conclusion when the ring fails the criteria', () => {
    const el: HTMLElement = setup({ ...BASE, isInvisible: false }).nativeElement;
    expect(el.querySelector('.conclusion-safe')).toBeTruthy();
    expect(el.querySelector('.conclusion')).toBeNull();
  });
});
