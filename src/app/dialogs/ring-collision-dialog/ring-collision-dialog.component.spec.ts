import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { RingCollisionDialogComponent, RingCollisionDialogData } from './ring-collision-dialog.component';
import { RingCollisionExtent } from '../../data/orbital-relations.service';

function extent(name: string, kind: 'body' | 'ring'): RingCollisionExtent {
  return { name, kind, path: [] };
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
      self: extent('Test 1 a', 'body'),
      partner: extent('Test 2 Ring', 'ring'),
      combinedRadiiKm: 100_000,
      combinedRadiiMinKm: 0,
      synodicPeriodDays: 5,
      nextCollision: {
        start: new Date('2026-12-15T14:00:00Z'),
        end: new Date('2026-12-15T15:30:00Z'),
        days: 170,
        minSeparationKm: 90_000,
      },
      upcomingCollisions: [
        { start: new Date('2026-12-15T14:00:00Z'), end: new Date('2026-12-15T15:30:00Z'), days: 170, minSeparationKm: 90_000 },
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
            { tMs: Date.parse('2026-01-01T00:00:00Z'), sepKm: 200_000 },
            { tMs: Date.parse('2026-12-15T14:00:00Z'), sepKm: 90_000 },
            { tMs: Date.parse('2027-01-01T00:00:00Z'), sepKm: 200_000 },
          ],
          contacts: [{ tMs: Date.parse('2026-12-15T14:00:00Z'), sepKm: 90_000 }],
        }],
      },
    });

    expect(fixture.componentInstance.heading).toBe('Predicted Ring Collision');
    expect(fixture.componentInstance.kindLabel).toBe('Body on Ring');
    expect(fixture.componentInstance.isSplitPass).toBe(false);
    expect(fixture.componentInstance.diagram).not.toBeNull();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('1 a');
    expect(el.textContent).toContain('2 Ring');
    expect(el.textContent).toContain('Body on Ring');
    expect(el.textContent).toContain('Distance over time');
    expect(el.textContent).toContain('Upcoming contacts');
    expect(el.textContent).toContain('Closest approach');
    expect(el.querySelector('svg.separation-chart')).not.toBeNull();
    // A plain combined-radii threshold — only the upper dashed line, no lower one.
    expect(el.querySelector('.threshold-min')).toBeNull();
  });

  it('labels a ring-vs-ring pair as "Ring on Ring"', () => {
    const fixture = setup({
      self: extent('Test A Ring', 'ring'),
      partner: extent('Test B Ring', 'ring'),
      combinedRadiiKm: 15_594,
      combinedRadiiMinKm: 0,
      synodicPeriodDays: 0.283064148217593,
      nextCollision: {
        start: new Date('2026-09-15T00:00:00Z'),
        end: new Date('2026-09-15T00:10:00Z'),
        days: 0.1,
        minSeparationKm: 15_500,
      },
      upcomingCollisions: [
        { start: new Date('2026-09-15T00:00:00Z'), end: new Date('2026-09-15T00:10:00Z'), days: 0.1, minSeparationKm: 15_500 },
      ],
      systemName: 'Test',
    });

    expect(fixture.componentInstance.kindLabel).toBe('Ring on Ring');
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Ring on Ring');
    // A recurring sub-day synodic period (6.79 hours) should read in hours, not "0 days".
    expect(el.textContent).toContain('Recurs every');
    expect(fixture.componentInstance.diagram).toBeNull();
  });

  it('describes a split pass as two collisions and renders the lower contact-band threshold', () => {
    const fixture = setup({
      self: extent('Test A Ring', 'ring'),
      partner: extent('Test B Ring', 'ring'),
      combinedRadiiKm: 15_594,
      combinedRadiiMinKm: 15_558,
      synodicPeriodDays: 0.283064148217593,
      nextCollision: {
        start: new Date('2026-09-15T00:00:00Z'),
        end: new Date('2026-09-15T00:05:00Z'),
        days: 0.1,
        minSeparationKm: 15_558,
        minSeparationAt: new Date('2026-09-15T00:05:00Z'),
      },
      upcomingCollisions: [
        {
          start: new Date('2026-09-15T00:00:00Z'), end: new Date('2026-09-15T00:05:00Z'), days: 0.1,
          minSeparationKm: 15_558, minSeparationAt: new Date('2026-09-15T00:05:00Z'),
        },
      ],
      systemName: 'Test',
      separationDiagram: {
        startMs: Date.parse('2026-09-15T00:00:00Z'),
        endMs: Date.parse('2026-09-15T02:00:00Z'),
        nowMs: Date.parse('2026-09-15T00:00:00Z'),
        series: [{
          partnerName: 'Test B Ring',
          combinedRadiiKm: 15_594,
          combinedRadiiMinKm: 15_558,
          samples: [
            { tMs: Date.parse('2026-09-15T00:00:00Z'), sepKm: 20_000 },
            { tMs: Date.parse('2026-09-15T00:05:00Z'), sepKm: 15_558 },
            { tMs: Date.parse('2026-09-15T00:10:00Z'), sepKm: 20_000 },
          ],
          contacts: [{ tMs: Date.parse('2026-09-15T00:05:00Z'), sepKm: 15_558 }],
        }],
      },
    });

    expect(fixture.componentInstance.isSplitPass).toBe(true);
    const el: HTMLElement = fixture.nativeElement;
    // The description should not claim the objects intersect at closest approach.
    expect(el.textContent).toContain('pass inside one another at closest approach');
    expect(el.textContent).toContain('two separate collisions');
    expect(el.textContent).toContain('Contact band');
    expect(el.querySelector('.threshold-min')).not.toBeNull();
  });

  it('strips the system name prefix from displayed names', () => {
    const fixture = setup({
      self: extent('Test 1 a', 'body'),
      partner: extent('Test 2 Ring', 'ring'),
      combinedRadiiKm: null,
      combinedRadiiMinKm: null,
      synodicPeriodDays: null,
      nextCollision: null,
      upcomingCollisions: [],
      systemName: 'Test',
    });
    expect(fixture.componentInstance.shortName('Test 1 a')).toBe('1 a');
    expect(fixture.componentInstance.shortName('Test 2 Ring')).toBe('2 Ring');
  });
});
