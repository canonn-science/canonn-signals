import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { CollisionDialogComponent, CollisionDialogData } from './collision-dialog.component';

function setup(data: CollisionDialogData): ComponentFixture<CollisionDialogComponent> {
  TestBed.configureTestingModule({
    imports: [CollisionDialogComponent],
    providers: [provideZonelessChangeDetection(), { provide: MAT_DIALOG_DATA, useValue: data }],
  });
  const fixture = TestBed.createComponent(CollisionDialogComponent);
  fixture.detectChanges();
  return fixture;
}

describe('CollisionDialogComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('shows the predicted-collision heading, both UTC and local times, and the caveat', () => {
    const fixture = setup({
      bodyName: 'Test 1 b',
      partnerName: 'Test 1 c',
      synodicPeriodDays: 400,
      combinedRadiiKm: 5000,
      upcomingCollisions: [],
      bodyInfo: null,
      partnerInfo: null,
      systemPopulation: 0,
      systemName: 'Test',
      simultaneousPartners: [],
      nextCollision: {
        start: new Date('2026-12-15T14:00:00Z'),
        end: new Date('2026-12-15T15:30:00Z'),
        days: 170,
        minSeparationKm: 1000,
      },
    });
    expect(fixture.componentInstance.heading).toBe('Predicted Collision');
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Test 1 c');
    // Both a UTC and a local rendering of the start time are present.
    expect(el.textContent).toContain('UTC');
    expect(el.textContent).toContain('your time');
    // The caveat text must be shown verbatim-ish.
    expect(el.textContent).toContain('pass straight through each other');
    expect(el.textContent).toContain('Frontier manually writes it into a server update');
  });

  it('computes overlap depth and its severity label from separation and combined radii', () => {
    const fixture = setup({
      bodyName: 'A', partnerName: 'B', synodicPeriodDays: 10, combinedRadiiKm: 1000,
      upcomingCollisions: [], bodyInfo: null, partnerInfo: null, systemPopulation: 0, systemName: '', simultaneousPartners: [],
      nextCollision: { start: new Date(), end: new Date(), days: 1, minSeparationKm: 100 },
    });
    const c = fixture.componentInstance;
    // 100 km apart with 1000 km combined radii → 90% overlap → "Major impact".
    expect(c.overlapPercent).toBeCloseTo(90, 6);
    expect(c.overlapLabel).toBe('Major impact');
  });

  it('clamps overlap at 0% when the bodies merely graze (separation ≥ combined radii)', () => {
    const fixture = setup({
      bodyName: 'A', partnerName: 'B', synodicPeriodDays: 10, combinedRadiiKm: 1000,
      upcomingCollisions: [], bodyInfo: null, partnerInfo: null, systemPopulation: 0, systemName: '', simultaneousPartners: [],
      nextCollision: { start: new Date(), end: new Date(), days: 1, minSeparationKm: 1000 },
    });
    expect(fixture.componentInstance.overlapPercent).toBeCloseTo(0, 6);
    expect(fixture.componentInstance.overlapLabel).toBe('Glancing blow');
  });

  it('expresses the collision-frequency span in days when all contacts fall within a year', () => {
    // Short-synodic moon pair: 10 contacts spanning ~62 days must not read "0 years".
    const windows = Array.from({ length: 10 }, (_, i) => ({
      start: new Date(), end: new Date(), days: (i + 1) * 6.2, minSeparationKm: 100,
    }));
    const fixture = setup({
      bodyName: 'A', partnerName: 'B', synodicPeriodDays: 6.2, combinedRadiiKm: 1000,
      upcomingCollisions: windows, bodyInfo: null, partnerInfo: null, systemPopulation: 0,
      systemName: '', simultaneousPartners: [],
      nextCollision: windows[0],
    });
    const desc = fixture.componentInstance.description;
    expect(desc).toContain('10 collisions are predicted over the next 62 days.');
    expect(desc).not.toContain('0 years');
  });

  it('expresses the collision-frequency span in years when contacts span multiple years', () => {
    const windows = Array.from({ length: 5 }, (_, i) => ({
      start: new Date(), end: new Date(), days: (i + 1) * 400, minSeparationKm: 100,
    }));
    const fixture = setup({
      bodyName: 'A', partnerName: 'B', synodicPeriodDays: 400, combinedRadiiKm: 1000,
      upcomingCollisions: windows, bodyInfo: null, partnerInfo: null, systemPopulation: 0,
      systemName: '', simultaneousPartners: [],
      nextCollision: windows[0],
    });
    // 5 contacts, last at 2000 days ≈ 5.5 years → rounds to "5 years".
    expect(fixture.componentInstance.description).toContain('5 collisions are predicted over the next 5 years.');
  });

  it('shows the candidate heading and an explanatory note when timing data is missing', () => {
    const fixture = setup({
      bodyName: 'A', partnerName: 'B', synodicPeriodDays: 10, combinedRadiiKm: 1000,
      upcomingCollisions: [], bodyInfo: null, partnerInfo: null, systemPopulation: 0, systemName: '', simultaneousPartners: [],
      nextCollision: null,
    });
    expect(fixture.componentInstance.heading).toBe('Collision Candidate');
    expect(fixture.componentInstance.overlapPercent).toBeNull();
    expect(fixture.componentInstance.durationMinutes).toBeNull();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain("can't be");
  });
});
