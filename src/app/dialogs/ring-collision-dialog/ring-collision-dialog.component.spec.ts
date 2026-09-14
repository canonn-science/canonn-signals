import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { RingCollisionDialogComponent, RingCollisionDialogData } from './ring-collision-dialog.component';

function setup(data: RingCollisionDialogData): ComponentFixture<RingCollisionDialogComponent> {
  TestBed.configureTestingModule({
    imports: [RingCollisionDialogComponent],
    providers: [provideZonelessChangeDetection(), { provide: MAT_DIALOG_DATA, useValue: data }],
  });
  const fixture = TestBed.createComponent(RingCollisionDialogComponent);
  fixture.detectChanges();
  return fixture;
}

describe('RingCollisionDialogComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('labels a body-vs-ring pair as "Body on Ring"', () => {
    const fixture = setup({
      self: { name: 'Test 1 a', kind: 'body', rangeKm: { lo: 0, hi: 4_495_979 } },
      partner: { name: 'Test 2 Ring', kind: 'ring', rangeKm: { lo: 1_395_979, hi: 1_595_979 } },
      overlapKm: { lo: 1_395_979, hi: 1_595_979 },
      systemName: 'Test',
    });
    expect(fixture.componentInstance.heading).toBe('Ring Collision Candidate');
    expect(fixture.componentInstance.kindLabel).toBe('Body on Ring');
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('1 a');
    expect(el.textContent).toContain('2 Ring');
    expect(el.textContent).toContain('Body on Ring');
  });

  it('labels a ring-vs-ring pair as "Ring on Ring"', () => {
    const fixture = setup({
      self: { name: 'Test A Ring', kind: 'ring', rangeKm: { lo: 99_900_000, hi: 100_100_000 } },
      partner: { name: 'Test B Ring', kind: 'ring', rangeKm: { lo: 100_050_000, hi: 100_950_000 } },
      overlapKm: { lo: 100_050_000, hi: 100_100_000 },
      systemName: 'Test',
    });
    expect(fixture.componentInstance.kindLabel).toBe('Ring on Ring');
    expect(fixture.nativeElement.textContent).toContain('Ring on Ring');
  });

  it('strips the system name prefix from displayed names', () => {
    const fixture = setup({
      self: { name: 'Test 1 a', kind: 'body', rangeKm: { lo: 0, hi: 100 } },
      partner: { name: 'Test 2 Ring', kind: 'ring', rangeKm: { lo: 0, hi: 100 } },
      overlapKm: { lo: 0, hi: 100 },
      systemName: 'Test',
    });
    expect(fixture.componentInstance.shortName('Test 1 a')).toBe('1 a');
    expect(fixture.componentInstance.shortName('Test 2 Ring')).toBe('2 Ring');
  });
});
