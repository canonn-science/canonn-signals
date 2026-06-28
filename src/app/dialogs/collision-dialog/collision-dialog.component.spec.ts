import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { CollisionDialogComponent, CollisionDialogData, CollisionBodyInfo } from './collision-dialog.component';

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

  it('lists every crossing partner and renders a per-partner "With" column for multi-body clusters', () => {
    const windows = [
      { start: new Date('2026-07-01T00:00:00Z'), end: new Date('2026-07-01T01:00:00Z'),
        days: 3, minSeparationKm: 200, partnerName: 'Test 1 c', combinedRadiiKm: 1000 },
      { start: new Date('2026-07-05T00:00:00Z'), end: new Date('2026-07-05T01:00:00Z'),
        days: 7, minSeparationKm: 400, partnerName: 'Test 1 d', combinedRadiiKm: 800 },
    ];
    const fixture = setup({
      bodyName: 'Test 1 b', partnerName: 'Test 1 c', synodicPeriodDays: 5, combinedRadiiKm: 1000,
      upcomingCollisions: windows, bodyInfo: null, partnerInfo: null, systemPopulation: 0,
      systemName: 'Test', simultaneousPartners: ['Test 1 d'],
      nextCollision: windows[0],
    });
    const c = fixture.componentInstance;
    // Both crossing partners are surfaced for the "Bodies" line.
    expect(c.collisionPartners).toEqual(['Test 1 c', 'Test 1 d']);
    // The "Bodies" line joins consistently (commas, single "&" before the last), no mixed separators.
    expect(c.involvedBodyNames).toEqual(['Test 1 b', 'Test 1 c', 'Test 1 d']);
    expect(c.joinNames(c.involvedBodyNames)).toBe('Test 1 b, Test 1 c & Test 1 d');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Test 1 b, Test 1 c & Test 1 d');
    // Each window names its own partner (system prefix stripped).
    expect(c.windowPartner(windows[0])).toBe('1 c');
    expect(c.windowPartner(windows[1])).toBe('1 d');
    // Overlap uses the window's own combined radii, not the status-level value.
    expect(c.overlapPercentFor(windows[1])).toBeCloseTo((1 - 400 / 800) * 100, 6);
    // Both partners appear in the rendered table.
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('1 c');
    expect(el.textContent).toContain('1 d');
  });

  it('builds the prose summary for a same-type, inhabited, three-body cluster', () => {
    const rocky = (moonCount: number, hasRings: boolean, period: number): CollisionBodyInfo => ({
      subType: 'Rocky body', atmosphereType: 'Carbon dioxide', orbitalPeriodDays: period, moonCount, hasRings,
    });
    const windows = [
      { start: new Date(), end: new Date(), days: 3, minSeparationKm: 200, partnerName: 'Test 1 c', combinedRadiiKm: 1000 },
      { start: new Date(), end: new Date(), days: 7, minSeparationKm: 400, partnerName: 'Test 1 d', combinedRadiiKm: 1000 },
    ];
    const desc = setup({
      bodyName: 'Test 1 b', partnerName: 'Test 1 c', synodicPeriodDays: 6.2, combinedRadiiKm: 1000,
      upcomingCollisions: windows, bodyInfo: rocky(2, true, 5.0),
      partnerInfo: rocky(1, false, 5.02),
      partnerInfos: [
        { name: 'Test 1 c', info: rocky(1, false, 5.02) },
        { name: 'Test 1 d', info: rocky(0, false, 5.04) },
      ],
      systemPopulation: 1_500_000, systemName: 'Test', simultaneousPartners: ['Test 1 d'], nextCollision: windows[0],
    }).componentInstance.description;

    expect(desc).toContain('inhabited system (1,500,000 inhabitants)');
    expect(desc).toContain('three Rocky bodies (1 b, 1 c and 1 d)');   // all candidates listed by type
    expect(desc).toContain('carbon dioxide atmospheres');             // shared-atmosphere branch
    expect(desc).toContain('periods of 5.00, 5.02 and 5.04 days');    // >2 bodies: list all periods
    expect(desc).toContain('1 b has 2 moons');                        // moons feature
    expect(desc).toContain('1 b has rings');                          // rings feature
    expect(desc).toContain('1 c has 1 moon');                         // singular moon
    expect(desc).toContain('pass each other every 6 days');           // sub-year synodic phrasing
    expect(desc).toContain('2 collisions are predicted');             // frequency from upcoming list
    expect(desc).toContain('1 b, 1 c and 1 d all have crossing orbits'); // multi-body sentence
  });

  it('builds the prose summary for an uninhabited pair of differing types', () => {
    const bi: CollisionBodyInfo = {
      subType: 'High metal content world', atmosphereType: 'Sulphur dioxide', orbitalPeriodDays: 100, moonCount: 0, hasRings: false,
    };
    const pi: CollisionBodyInfo = {
      subType: 'Icy body', atmosphereType: null, orbitalPeriodDays: 110, moonCount: 0, hasRings: false,
    };
    const windows = Array.from({ length: 3 }, (_, i) => ({
      start: new Date(), end: new Date(), days: (i + 1) * 400, minSeparationKm: 100, partnerName: 'Test 1 c', combinedRadiiKm: 1000,
    }));
    const desc = setup({
      bodyName: 'Test 1 b', partnerName: 'Test 1 c', synodicPeriodDays: 1100, combinedRadiiKm: 1000,
      upcomingCollisions: windows, bodyInfo: bi, partnerInfo: pi, systemPopulation: 0,
      systemName: 'Test', simultaneousPartners: [], nextCollision: windows[0],
    }).componentInstance.description;

    expect(desc).toContain('uninhabited system');
    expect(desc).toContain('a High metal content world (1 b) with sulphur dioxide atmosphere'); // differing-type branch
    expect(desc).toContain('and a Icy body (1 c)');
    expect(desc).toContain('They orbit with periods of 100.00 and 110.00 days');
    expect(desc).toContain('pass each other every 3.0 years');      // multi-year synodic phrasing
  });

  it('labels overlap severity across the threshold bands', () => {
    const make = (minSeparationKm: number) => { TestBed.resetTestingModule(); return setup({
      bodyName: 'A', partnerName: 'B', synodicPeriodDays: 10, combinedRadiiKm: 1000,
      upcomingCollisions: [], bodyInfo: null, partnerInfo: null, systemPopulation: 0, systemName: '', simultaneousPartners: [],
      nextCollision: { start: new Date(), end: new Date(), days: 1, minSeparationKm },
    }).componentInstance; };

    expect(make(990).overlapLabel).toBe('Glancing blow');   //  1% overlap (<2)
    expect(make(700).overlapLabel).toBe('Minor impact');    // 30% overlap (<50)
    expect(make(100).overlapLabel).toBe('Major impact');    // 90% overlap (<98)
    expect(make(5).overlapLabel).toBe('Head-on collision'); // 99.5% overlap (>=98)
  });

  it('formats contact-window durations and degrades gracefully for sub-minute windows', () => {
    const c = setup({
      bodyName: 'A', partnerName: 'B', synodicPeriodDays: 10, combinedRadiiKm: 1000,
      upcomingCollisions: [], bodyInfo: null, partnerInfo: null, systemPopulation: 0, systemName: '', simultaneousPartners: [],
      nextCollision: { start: new Date(), end: new Date(), days: 1, minSeparationKm: 100 },
    }).componentInstance;

    const win = (ms: number) => ({ start: new Date(0), end: new Date(ms), days: 0, minSeparationKm: 0 });
    // 2 days 4 hours 5 minutes → Oxford-comma join of three units.
    expect(c.formatDuration(win((2 * 1440 + 4 * 60 + 5) * 60000))).toBe('2 days, 4 hours and 5 minutes');
    // Exactly one hour → single unit, no conjunction.
    expect(c.formatDuration(win(60 * 60000))).toBe('1 hour');
    // Two units → joined with "and".
    expect(c.formatDuration(win((60 + 1) * 60000))).toBe('1 hour and 1 minute');
    // Under a minute → fallback string.
    expect(c.formatDuration(win(20_000))).toBe('less than 1 minute');
  });

  it('groups time-overlapping windows from different partners into a simultaneous collision', () => {
    // Two partners (1 c, 1 d) whose contact windows overlap in time → a 3-body pile-up;
    // a later, isolated 1 c contact is a plain pairwise event and must not be flagged.
    const cMulti = { start: new Date('2026-07-01T00:00:00Z'), end: new Date('2026-07-01T02:00:00Z'),
      days: 3, minSeparationKm: 200, partnerName: 'Test 1 c', combinedRadiiKm: 1000 };
    const dMulti = { start: new Date('2026-07-01T01:00:00Z'), end: new Date('2026-07-01T03:00:00Z'),
      days: 3, minSeparationKm: 300, partnerName: 'Test 1 d', combinedRadiiKm: 1000 };
    const cLone = { start: new Date('2026-08-01T00:00:00Z'), end: new Date('2026-08-01T01:00:00Z'),
      days: 34, minSeparationKm: 250, partnerName: 'Test 1 c', combinedRadiiKm: 1000 };
    const fixture = setup({
      bodyName: 'Test 1 b', partnerName: 'Test 1 c', synodicPeriodDays: 6, combinedRadiiKm: 1000,
      upcomingCollisions: [cMulti, dMulti, cLone], bodyInfo: null, partnerInfo: null,
      systemPopulation: 0, systemName: 'Test', simultaneousPartners: ['Test 1 d'], nextCollision: cMulti,
    });
    const c = fixture.componentInstance;

    expect(c.multiCollisions.length).toBe(1);
    expect(c.multiCollisions[0].partners).toEqual(['1 c', '1 d']);
    expect(c.multiCollisions[0].start).toEqual(cMulti.start); // earliest start in the cluster
    expect(c.multiCollisions[0].end).toEqual(dMulti.end);     // latest end in the cluster

    // The overlapping rows are flagged; the lone later contact is not.
    expect(c.isMultiCollision(cMulti)).toBe(true);
    expect(c.isMultiCollision(dMulti)).toBe(true);
    expect(c.isMultiCollision(cLone)).toBe(false);

    // The "multi" marker and the simultaneous-collisions section render.
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('tr.multi')).not.toBeNull();
    expect(el.textContent).toContain('Simultaneous collisions');
    expect(el.textContent).toContain('Test 1 b, 1 c, 1 d');
  });

  it('reports no simultaneous collisions for a plain pairwise sequence', () => {
    const windows = Array.from({ length: 3 }, (_, i) => ({
      start: new Date(2026, 6, 1 + i * 5), end: new Date(2026, 6, 1 + i * 5, 1),
      days: i * 5, minSeparationKm: 200, partnerName: 'Test 1 c', combinedRadiiKm: 1000,
    }));
    const c = setup({
      bodyName: 'Test 1 b', partnerName: 'Test 1 c', synodicPeriodDays: 6, combinedRadiiKm: 1000,
      upcomingCollisions: windows, bodyInfo: null, partnerInfo: null, systemPopulation: 0,
      systemName: 'Test', simultaneousPartners: [], nextCollision: windows[0],
    }).componentInstance;
    expect(c.multiCollisions).toEqual([]);
    expect(c.isMultiCollision(windows[0])).toBe(false);
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
