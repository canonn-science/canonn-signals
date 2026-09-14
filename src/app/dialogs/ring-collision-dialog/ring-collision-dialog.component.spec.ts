import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { RingCollisionDialogComponent, RingCollisionDialogData } from './ring-collision-dialog.component';
import { RingCollisionExtent } from '../../data/orbital-relations.service';
import { SystemBody } from '../../home/home.component';

/** A placeholder node — the dialog never dereferences it, only the extent's name/kind/rangeKm. */
const fakeNode = {} as SystemBody;

function extent(name: string, kind: 'body' | 'ring', lo: number, hi: number): RingCollisionExtent {
  return { name, kind, rangeKm: { lo, hi }, node: fakeNode };
}

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

  it('labels a body-vs-ring pair as "Body on Ring" and shows a predicted contact window with a table and chart', () => {
    const fixture = setup({
      self: extent('Test 1 a', 'body', 0, 4_495_979),
      partner: extent('Test 2 Ring', 'ring', 1_395_979, 1_595_979),
      overlapKm: { lo: 1_395_979, hi: 1_595_979 },
      combinedRadiiKm: 100_000,
      synodicPeriodDays: 5,
      nextCollision: {
        start: new Date('2026-12-15T14:00:00Z'),
        end: new Date('2026-12-15T15:30:00Z'),
        days: 170,
        minSeparationKm: 1_400_000,
      },
      upcomingCollisions: [
        { start: new Date('2026-12-15T14:00:00Z'), end: new Date('2026-12-15T15:30:00Z'), days: 170, minSeparationKm: 1_400_000 },
      ],
      systemName: 'Test',
      separationDiagram: {
        startMs: Date.parse('2026-01-01T00:00:00Z'),
        endMs: Date.parse('2027-01-01T00:00:00Z'),
        nowMs: Date.parse('2026-06-01T00:00:00Z'),
        series: [{
          partnerName: 'Test 2 Ring',
          combinedRadiiKm: 100_000,
          samples: [
            { tMs: Date.parse('2026-01-01T00:00:00Z'), sepKm: 2_000_000 },
            { tMs: Date.parse('2026-12-15T14:00:00Z'), sepKm: 1_400_000 },
            { tMs: Date.parse('2027-01-01T00:00:00Z'), sepKm: 2_000_000 },
          ],
          contacts: [{ tMs: Date.parse('2026-12-15T14:00:00Z'), sepKm: 1_400_000 }],
        }],
      },
    });

    expect(fixture.componentInstance.heading).toBe('Predicted Ring Collision');
    expect(fixture.componentInstance.kindLabel).toBe('Body on Ring');
    expect(fixture.componentInstance.diagram).not.toBeNull();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('1 a');
    expect(el.textContent).toContain('2 Ring');
    expect(el.textContent).toContain('Body on Ring');
    expect(el.textContent).toContain('Distance over time');
    expect(el.textContent).toContain('Upcoming contacts');
    expect(el.querySelector('svg.separation-chart')).not.toBeNull();
  });

  it('labels a ring-vs-ring pair as "Ring on Ring" and falls back to the static candidate status when the pair can\'t be timed', () => {
    const fixture = setup({
      self: extent('Test A Ring', 'ring', 99_900_000, 100_100_000),
      partner: extent('Test B Ring', 'ring', 100_050_000, 100_950_000),
      overlapKm: { lo: 100_050_000, hi: 100_100_000 },
      combinedRadiiKm: null,
      synodicPeriodDays: null,
      nextCollision: null,
      upcomingCollisions: [],
      systemName: 'Test',
    });

    expect(fixture.componentInstance.heading).toBe('Ring Collision Candidate');
    expect(fixture.componentInstance.kindLabel).toBe('Ring on Ring');
    expect(fixture.componentInstance.diagram).toBeNull();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Ring on Ring');
    expect(el.textContent).toContain('radial-band candidate');
    expect(el.querySelector('svg.separation-chart')).toBeNull();
  });

  it('strips the system name prefix from displayed names', () => {
    const fixture = setup({
      self: extent('Test 1 a', 'body', 0, 100),
      partner: extent('Test 2 Ring', 'ring', 0, 100),
      overlapKm: { lo: 0, hi: 100 },
      combinedRadiiKm: null,
      synodicPeriodDays: null,
      nextCollision: null,
      upcomingCollisions: [],
      systemName: 'Test',
    });
    expect(fixture.componentInstance.shortName('Test 1 a')).toBe('1 a');
    expect(fixture.componentInstance.shortName('Test 2 Ring')).toBe('2 Ring');
  });
});
