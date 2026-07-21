import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, provideZonelessChangeDetection, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';

import { HomeComponent } from './home.component';
import { AppService } from '../app.service';

/**
 * HomeComponent hosts a large, Material-heavy template. These tests create the
 * component via TestBed with lightweight provider stubs (without rendering the
 * template) and exercise its pure presentation helpers.
 */
describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: AppService,
          useValue: {
            edastroSystems: signal([]),
            independentOutposts: signal([]),
            nebulae: signal([]),
            ensureNebulae: () => {},
            codexEntries: signal([]),
            getBodyDisplayName: (n: string) => n,
            getEdastroData: () => Promise.resolve(null),
            setBackgroundImage: () => {},
            getSimbad: () => Promise.resolve({ name: '', system_address: 0 }),
            getBiostats: () => Promise.resolve(null),
            typeahead: () => Promise.resolve({}),
            galMapSearch: () => Promise.resolve({ min_max: [] }),
            megashipSchedule: signal(null),
            ensureMegaships: () => {},
            systemNames: signal(new Map()),
            requestSystemName: vi.fn(),
            resolveSystemName: () => Promise.resolve(''),
            nowOverride: signal(null),
            gnosisData: signal(null),
            ensureGnosis: vi.fn(),
          },
        },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
        { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    // Intentionally not calling detectChanges(): these tests exercise the pure
    // presentation helpers directly rather than rendering the Material template.
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the loading shell (real chrome + value-only shimmer) with an accessible status while searching', () => {
    // Drive the `@else if (searching)` branch: no system data yet, a search in flight.
    fixture.detectChanges();
    (component as unknown as { _searching: { set(v: boolean): void } })._searching.set(true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const shell = el.querySelector('.system-loading');
    expect(shell).not.toBeNull();

    // Accessible loading status for assistive tech; the decorative shell is hidden from AT.
    expect(shell!.querySelector('[role="status"]')?.textContent).toContain('Loading');
    expect(shell!.querySelector('.system-info-box')?.getAttribute('aria-hidden')).toBe('true');

    // Static section headers render as real text (identical for every system) and in order.
    const headers = Array.from(shell!.querySelectorAll('.system-data-section-header')).map((h) =>
      h.textContent?.trim(),
    );
    expect(headers).toEqual(['Location', 'Society', 'Distances', 'Nearest DSSA', 'Nearest Nebulae', 'Megaships']);

    // A labelled row: the label cell is real text, only the value cell to its right shimmers.
    const firstEntry = shell!.querySelector('.system-data-entry') as HTMLElement;
    const cells = firstEntry.querySelectorAll(':scope > div');
    expect(cells[0].textContent?.trim()).toBe('PG Name');
    expect(cells[0].querySelector('.skeleton')).toBeNull();
    expect(cells[1].querySelector('.skeleton')).not.toBeNull();

    // Bodies are unknown until data arrives, so the body tree stays a fixed set of generic rows.
    expect(shell!.querySelectorAll('.loading-body-row').length).toBe(6);
  });

  it('formats RAJ2000 degrees into an h/m/s string', () => {
    expect(component.formatRAJ2000(0)).toBe('0h 00m 00.0s');
  });

  it('formats DEJ2000 degrees with a sign', () => {
    expect(component.formatDEJ2000(0)).toContain('+0°');
    expect(component.formatDEJ2000(-1).startsWith('-')).toBe(true);
  });

  it('publishes the PGName synchronously so its row never blanks while Simbad loads', async () => {
    // Merope is a hand-named system, so it routes through the async Simbad lookup rather than the
    // synchronous PG-system fallback. Hold the Simbad promise open to observe the pre-resolve state.
    const id64 = 396316991853421732n;
    let resolveSimbad!: (v: unknown) => void;
    const appService = TestBed.inject(AppService) as unknown as {
      getSimbad: (...args: unknown[]) => Promise<unknown>;
    };
    appService.getSimbad = () => new Promise((res) => { resolveSimbad = res; });

    component.fetchEdGalaxyData('Merope', id64);

    // Before Simbad settles, edGalaxyData already carries the PGName (previously it stayed null for
    // the whole request, which blanked the "PG Name" row after the skeleton handed over).
    const pending = component.edGalaxyData();
    expect(pending).not.toBeNull();
    expect(pending!.PGName).toBeTruthy();
    expect(pending!.Simbad).toBeUndefined();

    // Once Simbad resolves it merges in, without ever clearing the PGName row.
    resolveSimbad({ name: 'Merope', system_address: id64, simbad_name: '23 Tau', ra_j2000: 10, dec_j2000: 20 });
    await Promise.resolve();
    await Promise.resolve();
    const resolved = component.edGalaxyData();
    expect(resolved!.PGName).toBe(pending!.PGName);
    expect(resolved!.Simbad?.Name).toBe('23 Tau');
  });

  it('defers a marker/query request while a search is already in flight', () => {
    // Simulate an in-flight search without driving the HTTP path.
    (component as any)._searching.set(true);
    component.onMarkerSelected('Colonia');
    // The request is queued, not applied to the search box yet.
    expect((component as any).pendingSystemRequest).toBe('Colonia');
    expect(component.searchControl.value).not.toBe('Colonia');
  });

  describe('processBodies tree-building', () => {
    function systemWith(bodies: any[]) {
      return {
        system: {
          name: 'Test System',
          id64: 1,
          coords: { x: 0, y: 0, z: 0 },
          region: { name: 'Inner Orion Spur', region: 18 },
          population: 0,
          bodies,
        },
      };
    }

    it('nests a planet under its parent star', () => {
      const data = systemWith([
        { bodyId: 0, name: 'Test A', type: 'Star', subType: '', id64: 1 },
        { bodyId: 1, name: 'Test 1', type: 'Planet', subType: '', id64: 2, semiMajorAxis: 1, parents: [{ Star: 0 }] },
      ]);

      (component as any).processBodies(data);

      // Only the root star is top-level; the planet hangs off it.
      expect(component.bodies().length).toBe(1);
      expect(component.bodies()[0].bodyData.bodyId).toBe(0);
      expect(component.bodies()[0].subBodies.map(b => b.bodyData.bodyId)).toContain(1);
      expect(component.getTotalBodyCount()).toBe(2);
    });

    it('attaches rings as child bodies of their planet', () => {
      const data = systemWith([
        { bodyId: 0, name: 'Test A', type: 'Star', subType: '', id64: 1 },
        {
          bodyId: 1, name: 'Test 1', type: 'Planet', subType: '', id64: 2, semiMajorAxis: 1, parents: [{ Star: 0 }],
          rings: [{ name: 'Test 1 A Ring', type: 'Icy', innerRadius: 1000, outerRadius: 2000, mass: 1 }],
        },
      ]);

      (component as any).processBodies(data);

      const planet = component.bodies()[0].subBodies.find(b => b.bodyData.bodyId === 1)!;
      expect(planet).toBeTruthy();
      const ring = planet.subBodies.find(b => b.bodyData.type === 'Ring');
      expect(ring).toBeTruthy();
      // Radii are converted from metres to km when attached.
      expect(ring!.bodyData.innerRadius).toBe(1);
    });

    it('synthesises a placeholder for an unknown parent body', () => {
      const data = systemWith([
        { bodyId: 5, name: 'Lonely Moon', type: 'Planet', subType: '', id64: 9, semiMajorAxis: 1, parents: [{ Planet: 2 }] },
      ]);

      (component as any).processBodies(data);

      // The missing parent (bodyId 2) is synthesised and becomes the root.
      const root = component.bodies().find(b => b.bodyData.bodyId === 2);
      expect(root).toBeTruthy();
      expect(root!.subBodies.some(b => b.bodyData.bodyId === 5)).toBe(true);
    });
  });

  describe('processBodies applying the Col 70 Sector FY-N c21-3 speculative override', () => {
    const COL_70_ID64 = 909626806858n;

    function systemNamed(id64: bigint, bodies: any[]) {
      return {
        system: {
          name: 'Col 70 Sector FY-N c21-3',
          id64,
          coords: { x: 0, y: 0, z: 0 },
          population: 0,
          bodies,
        },
      };
    }

    it('fills in the speculative body list and region when Spansh reports no bodies', () => {
      const data = systemNamed(COL_70_ID64, []);

      (component as any).processBodies(data);

      // 11 synthesized bodies (star + 7 direct planets + barycentre + binary pair).
      expect(data.system.bodies.length).toBe(11);
      expect((data.system as any).region).toEqual({ name: 'Inner Orion Spur', region: 18 });
      // The tree still builds correctly off the synthesized list: only the star is a
      // root, and the barycentre (attached indirectly via the binary pair's ancestor
      // chain) ends up nested under it rather than as a stray second root.
      expect(component.bodies().length).toBe(1);
      expect(component.bodies()[0].bodyData.bodyId).toBe(0);
      const barycentre = component.bodies()[0].subBodies.find(b => b.bodyData.bodyId === 8);
      expect(barycentre).toBeTruthy();
      expect(barycentre!.subBodies.map(b => b.bodyData.bodyId).sort((a, b) => a - b)).toEqual([9, 10]);
    });

    it('does not overwrite real body data for Col 70 Sector FY-N c21-3', () => {
      const realBody = { bodyId: 0, name: 'Col 70 Sector FY-N c21-3', type: 'Star', subType: '', id64: 1 };
      const data = systemNamed(COL_70_ID64, [realBody]);

      (component as any).processBodies(data);

      expect(data.system.bodies).toEqual([realBody]);
    });
  });

  describe('systemCompleteness', () => {
    function loadSystem(bodyCount: number | undefined, bodies: any[], id64: number | bigint = 1) {
      const data = {
        system: {
          name: 'Test System', id64, coords: { x: 0, y: 0, z: 0 },
          region: { name: 'Inner Orion Spur', region: 18 }, population: 0,
          bodyCount, bodies,
        },
      };
      (component as any).processBodies(data);
      component.data.set(data as any);
    }

    it('reports the known/total ratio as a percentage', () => {
      loadSystem(5, [
        { bodyId: 0, name: 'Star', type: 'Star', subType: '', id64: 1 },
      ]);
      // 1 known body out of 5 reported → 20%.
      expect(component.systemCompleteness()).toEqual({ known: 1, total: 5, percent: 20 });
    });

    it('caps the percentage at 100 when more bodies are known than reported', () => {
      loadSystem(1, [
        { bodyId: 0, name: 'Star', type: 'Star', subType: '', id64: 1 },
        { bodyId: 1, name: 'Planet', type: 'Planet', subType: '', id64: 2, semiMajorAxis: 1, parents: [{ Star: 0 }] },
      ]);
      // 2 known / 1 reported would be 200%, clamped to 100%.
      expect(component.systemCompleteness()).toEqual({ known: 2, total: 1, percent: 100 });
    });

    it('returns a null percentage when the system JSON has no body count', () => {
      loadSystem(undefined, []);
      expect(component.systemCompleteness()).toEqual({ known: 0, total: null, percent: null });
    });

    it('excludes belts, rings and barycentres from the known count', () => {
      loadSystem(4, [
        { bodyId: 0, name: 'Star', type: 'Star', subType: '', id64: 1 },
        { bodyId: 1, name: 'Planet', type: 'Planet', subType: '', id64: 2, semiMajorAxis: 1, parents: [{ Star: 0 }] },
        { bodyId: 2, name: 'A Belt', type: 'Belt', subType: '', id64: 3 },
        { bodyId: 3, name: 'Barycentre', type: 'Barycentre', subType: '', id64: 4 },
      ]);
      // Only the star and planet are real bodies → 2 of 4 → 50%.
      expect(component.systemCompleteness()).toEqual({ known: 2, total: 4, percent: 50 });
    });

    it('hardcodes 0/10 for Col 70 Sector FY-N c21-3 regardless of bodies/bodyCount', () => {
      // Real bodyCount + known bodies that would otherwise compute a very different
      // ratio (2 known / 21 reported ≈ 10%), to prove the override wins outright.
      loadSystem(21, [
        { bodyId: 0, name: 'Star', type: 'Star', subType: '', id64: 1 },
        { bodyId: 1, name: 'Planet', type: 'Planet', subType: '', id64: 2, semiMajorAxis: 1, parents: [{ Star: 0 }] },
      ], 909626806858n);
      expect(component.systemCompleteness()).toEqual({ known: 0, total: 10, percent: 0 });
    });
  });

  describe('isPermitLocked', () => {
    function loadSystemNamed(name: string, id64: bigint) {
      component.data.set({
        system: {
          name, id64, coords: { x: 0, y: 0, z: 0 },
          region: { name: 'Inner Orion Spur', region: 18 }, population: 0, bodies: [],
        },
      } as any);
    }

    it('is true for a permit-locked system', () => {
      loadSystemNamed('Sol', 10477373803n);
      expect(component.isPermitLocked()).toBe(true);
    });

    it('is false for an open system', () => {
      loadSystemNamed('Maia', 224644818084n);
      expect(component.isPermitLocked()).toBe(false);
    });

    it('is false when no system is loaded', () => {
      component.data.set(null);
      expect(component.isPermitLocked()).toBe(false);
    });
  });

  describe('systemEconomyDisplay', () => {
    it('joins primary and secondary economies', () => {
      expect(component.systemEconomyDisplay({ primaryEconomy: 'Refinery', secondaryEconomy: 'Service' } as any))
        .toBe('Refinery / Service');
    });

    it('shows only the primary when the secondary is "None" or a duplicate', () => {
      expect(component.systemEconomyDisplay({ primaryEconomy: 'Industrial', secondaryEconomy: 'None' } as any))
        .toBe('Industrial');
      expect(component.systemEconomyDisplay({ primaryEconomy: 'Extraction', secondaryEconomy: 'Extraction' } as any))
        .toBe('Extraction');
    });

    it('returns an empty string when there is no economy', () => {
      expect(component.systemEconomyDisplay({ primaryEconomy: 'None', secondaryEconomy: 'None' } as any)).toBe('');
      expect(component.systemEconomyDisplay({ primaryEconomy: null, secondaryEconomy: null } as any)).toBe('');
    });
  });

  describe('formatUpdated', () => {
    it('renders local wall-clock time in a stable YYYY-MM-DD HH:mm layout', () => {
      expect(component.formatUpdated('2026-06-19 16:46:17+00')).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });

    it('honors the source UTC offset (the same instant renders identically)', () => {
      // 16:46 UTC and 18:46+02 are the same moment, so both map to the same local time
      // whatever the host time zone — proving the offset is applied, not the raw digits.
      expect(component.formatUpdated('2026-06-19 18:46:17+02'))
        .toBe(component.formatUpdated('2026-06-19 16:46:17+00'));
    });

    it('returns an empty string for a missing date', () => {
      expect(component.formatUpdated('')).toBe('');
      expect(component.formatUpdated(null)).toBe('');
    });
  });

  describe('formatUpdatedTooltip', () => {
    it('shows the local time (with offset) on the first line and UTC on the second', () => {
      const tip = component.formatUpdatedTooltip('2026-06-19 16:46:17+00');
      const [localLine, utcLine] = tip.split('\n');
      expect(localLine).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} local time \(UTC[+-]\d{2}:\d{2}\)$/);
      expect(utcLine).toBe('2026-06-19 16:46:17 UTC');
    });

    it('reflects the source UTC offset (same instant → same tooltip)', () => {
      expect(component.formatUpdatedTooltip('2026-06-19 18:46:17+02'))
        .toBe(component.formatUpdatedTooltip('2026-06-19 16:46:17+00'));
    });

    it('returns an empty string for a missing date', () => {
      expect(component.formatUpdatedTooltip('')).toBe('');
      expect(component.formatUpdatedTooltip(null)).toBe('');
    });
  });

  describe('showBodyHistogram', () => {
    it('does nothing when no system is loaded', async () => {
      const dialog = TestBed.inject(MatDialog);
      const open = vi.spyOn(dialog, 'open');
      component.data.set(null);

      await component.showBodyHistogram();

      expect(open).not.toHaveBeenCalled();
    });

    it('opens the histogram dialog with the system name and bodies', async () => {
      const dialog = TestBed.inject(MatDialog);
      const open = vi.spyOn(dialog, 'open').mockReturnValue({} as never);
      const bodies = [{ type: 'Star', subType: 'M Star' }];
      component.data.set({
        system: {
          name: 'Sol', id64: 1, coords: { x: 0, y: 0, z: 0 },
          region: { name: 'Inner Orion Spur', region: 18 }, population: 0, bodyCount: 8, bodies,
        },
      } as never);

      await component.showBodyHistogram();

      expect(open).toHaveBeenCalledTimes(1);
      const [, config] = open.mock.calls[0];
      // The histogram now opens through the lazy-dialog host, which wraps the real data and
      // defaults focus to the dialog container so it survives the skeleton-to-body swap.
      expect((config?.data as { data: unknown }).data).toEqual({ systemName: 'Sol', bodies, totalBodyCount: 8 });
      expect(config?.autoFocus).toBe('dialog');
    });
  });

  describe('Megaships panel (issue #114)', () => {
    const SYSTEM_A = 1000;
    const SYSTEM_B = 2000;
    const ANCHOR = '2023-12-28T07:00:00+00:00'; // slot 0

    const schedule = {
      anchor: ANCHOR,
      week_seconds: 604800,
      generated_at: 'x',
      ships: [
        {
          signal_name: 'CYCLER I', ship_name: 'Test-class Cycler', type: 'cycle' as const,
          route_len: 2, confirmed: true, positions: { '0': SYSTEM_A, '1': SYSTEM_B }, last_seen: '2026-07-01',
        },
      ],
    };

    function appService() {
      return TestBed.inject(AppService) as unknown as {
        megashipSchedule: { set(v: unknown): void };
        systemNames: { set(v: ReadonlyMap<string, string>): void };
        nowOverride: { set(v: number | null): void };
        requestSystemName: ReturnType<typeof vi.fn>;
        gnosisData: { set(v: unknown): void };
      };
    }

    it('shows "Present" for a ship currently at the loaded system', () => {
      appService().nowOverride.set(Date.parse(ANCHOR)); // slot 0 -> CYCLER I is at SYSTEM_A
      appService().megashipSchedule.set(schedule);
      component.data.set({ system: { id64: SYSTEM_A, coords: { x: 0, y: 0, z: 0 }, bodies: [] } } as never);

      const rows = component.megashipRows();
      expect(rows).toEqual([{ signalName: 'CYCLER I', shipName: 'Test-class Cycler', locationLabel: 'Present' }]);
    });

    it('requests and displays the resolved current-location name for a ship due elsewhere', () => {
      appService().nowOverride.set(Date.parse(ANCHOR)); // slot 0 -> ship is at SYSTEM_A, not SYSTEM_B
      appService().megashipSchedule.set(schedule);
      component.data.set({ system: { id64: SYSTEM_B, coords: { x: 0, y: 0, z: 0 }, bodies: [] } } as never);
      fixture.detectChanges(); // flushes the reactive name-request effect

      // Reactive lookup requested for the ship's actual current location.
      expect(appService().requestSystemName).toHaveBeenCalledWith(SYSTEM_A);
      expect(component.megashipRows()[0].locationLabel).toBe('…');

      appService().systemNames.set(new Map([[String(SYSTEM_A), 'Croatigae']]));
      expect(component.megashipRows()[0].locationLabel).toBe('Croatigae');
    });

    it('returns no rows for a system no tracked ship visits', () => {
      appService().megashipSchedule.set(schedule);
      component.data.set({ system: { id64: 9999, coords: { x: 0, y: 0, z: 0 }, bodies: [] } } as never);
      expect(component.megashipRows()).toEqual([]);
    });

    it('opens the route dialog with the ship\'s full route on click', () => {
      appService().nowOverride.set(Date.parse(ANCHOR));
      appService().megashipSchedule.set(schedule);
      component.data.set({ system: { id64: SYSTEM_A, coords: { x: 0, y: 0, z: 0 }, bodies: [] } } as never);

      const dialog = TestBed.inject(MatDialog);
      const open = vi.spyOn(dialog, 'open').mockReturnValue({} as never);

      component.openMegashipRouteDialog('CYCLER I');

      expect(open).toHaveBeenCalledTimes(1);
      const [, config] = open.mock.calls[0];
      const data = (config?.data as { data: unknown }).data as {
        signalName: string; shipName: string; type: string; routeLen: number;
        stops: { position: number; systemId64: number; presentNow: boolean }[];
      };
      expect(data.signalName).toBe('CYCLER I');
      expect(data.shipName).toBe('Test-class Cycler');
      expect(data.type).toBe('cycle');
      expect(data.routeLen).toBe(2);
      expect(data.stops).toEqual([
        { position: 0, systemId64: SYSTEM_A, dueDate: expect.any(String), presentNow: true },
        { position: 1, systemId64: SYSTEM_B, dueDate: expect.any(String), presentNow: false },
      ]);
    });

    it('does nothing when the signal name has no match in the loaded schedule', () => {
      appService().megashipSchedule.set(schedule);
      component.data.set({ system: { id64: SYSTEM_A, coords: { x: 0, y: 0, z: 0 }, bodies: [] } } as never);
      const dialog = TestBed.inject(MatDialog);
      const open = vi.spyOn(dialog, 'open');

      component.openMegashipRouteDialog('NO SUCH SHIP');

      expect(open).not.toHaveBeenCalled();
    });
  });

  describe('Gnosis route (issue #121)', () => {
    function appService() {
      return TestBed.inject(AppService) as unknown as {
        gnosisData: { set(v: unknown): void };
        nowOverride: { set(v: number | null): void };
        ensureGnosis: ReturnType<typeof vi.fn>;
      };
    }

    it('shows the tube-map card only on one of the Gnosis\'s 8 route stops', () => {
      component.data.set({ system: { id64: 1, name: 'Varati', coords: { x: 0, y: 0, z: 0 }, bodies: [] } } as never);
      expect(component.showGnosisRoute()).toBe(true);

      component.data.set({ system: { id64: 2, name: 'Sol', coords: { x: 0, y: 0, z: 0 }, bodies: [] } } as never);
      expect(component.showGnosisRoute()).toBe(false);
    });

    it('adds a Gnosis row to the Megaships table on a route stop, "…" before position data arrives', () => {
      component.data.set({ system: { id64: 1, name: 'HIP 17862', coords: { x: 0, y: 0, z: 0 }, bodies: [] } } as never);
      expect(component.megashipRows()).toEqual([
        { signalName: 'The Gnosis', shipName: 'The Gnosis', locationLabel: '…' },
      ]);
    });

    it('shows "Present" when the live Gnosis position matches the loaded system', () => {
      component.data.set({ system: { id64: 1, name: 'HIP 17862', coords: { x: 0, y: 0, z: 0 }, bodies: [] } } as never);
      // The live API returns only { system, coords, desc } — no arrival/departure timestamp.
      appService().gnosisData.set({ system: 'hip 17862', coords: [0, 0, 0], desc: '' });
      expect(component.megashipRows()[0].locationLabel).toBe('Present');
    });

    it('shows the Gnosis\'s actual current stop when it differs from the loaded system', () => {
      component.data.set({ system: { id64: 1, name: 'HIP 17862', coords: { x: 0, y: 0, z: 0 }, bodies: [] } } as never);
      appService().gnosisData.set({ system: 'Varati', coords: [0, 0, 0], desc: '' });
      expect(component.megashipRows()[0].locationLabel).toBe('Varati');
    });

    it('does not add a Gnosis row for a system it never visits', () => {
      component.data.set({ system: { id64: 1, name: 'Sol', coords: { x: 0, y: 0, z: 0 }, bodies: [] } } as never);
      expect(component.megashipRows()).toEqual([]);
    });

    it('opens the route dialog with all 8 stops, highlighting the live-tracked position', () => {
      component.data.set({ system: { id64: 1, name: 'Varati', coords: { x: 0, y: 0, z: 0 }, bodies: [] } } as never);
      // The live API returns only { system, coords, desc } — no jump timestamp (issue: clicking
      // "The Gnosis" threw when the dialog tried to read a nonexistent `.arrival` field). The
      // current weekly slot is instead derived from "now", pinned here to a Thursday 07:00 UTC.
      appService().gnosisData.set({ system: 'Kappa-1 Volantis', coords: [0, 0, 0], desc: '' });
      appService().nowOverride.set(Date.parse('2026-07-09T07:00:00Z'));

      const dialog = TestBed.inject(MatDialog);
      const open = vi.spyOn(dialog, 'open').mockReturnValue({} as never);

      component.openMegashipRouteDialog('The Gnosis');

      expect(open).toHaveBeenCalledTimes(1);
      const [, config] = open.mock.calls[0];
      const data = (config?.data as { data: unknown }).data as {
        signalName: string; shipName: string; type: string; routeLen: number; disclaimer: string; lastSeen: string;
        stops: { position: number; systemName: string; dueDate: string | null; presentNow: boolean }[];
      };
      expect(data.signalName).toBe('The Gnosis');
      expect(data.routeLen).toBe(8);
      expect(data.stops.length).toBe(8);
      expect(data.stops[0].systemName).toBe('Varati');
      expect(data.stops[data.stops.length - 1].systemName).toBe('Epsilon Indi');
      const current = data.stops.find(s => s.presentNow);
      expect(current?.systemName).toBe('Kappa-1 Volantis');
      expect(current?.dueDate).toBe('2026-07-09'); // the current weekly slot's start
      expect(data.lastSeen).toBe('2026-07-09');
      expect(data.stops.filter(s => s.presentNow).length).toBe(1);
      // Every other stop's date is inferred from the current one, a whole number of weeks out —
      // Epsilon Indi is the very next stop after Kappa-1 Volantis, one week later.
      expect(data.stops.find(s => s.systemName === 'Epsilon Indi')?.dueDate).toBe('2026-07-16');
      expect(data.stops.every(s => s.dueDate !== null)).toBe(true);
      expect(data.disclaimer).toContain('live-tracked');
    });

    it('does not throw when the live Gnosis fetch has not resolved yet (no timestamp to rely on)', () => {
      component.data.set({ system: { id64: 1, name: 'Varati', coords: { x: 0, y: 0, z: 0 }, bodies: [] } } as never);
      // gnosisData is still null — regression guard for the crash this triggered when the dialog
      // builder assumed a `gnosis.arrival` field the live API doesn't actually return.
      const dialog = TestBed.inject(MatDialog);
      const open = vi.spyOn(dialog, 'open').mockReturnValue({} as never);

      expect(() => component.openMegashipRouteDialog('The Gnosis')).not.toThrow();
      expect(open).toHaveBeenCalledTimes(1);
    });

    describe('ensureGnosis gating on system load', () => {
      function systemWith(name: string) {
        return {
          system: {
            name, id64: 1, coords: { x: 0, y: 0, z: 0 },
            region: { name: 'Inner Orion Spur', region: 18 },
            population: 0,
            bodies: [],
          },
        };
      }

      it('kicks off the Gnosis fetch when the loaded system is one of its 8 route stops', () => {
        (component as any).processBodies(systemWith('Varati'));
        expect(appService().ensureGnosis).toHaveBeenCalled();
      });

      it('does not fetch Gnosis data for a system it never visits (the region map fetches it independently if needed)', () => {
        (component as any).processBodies(systemWith('Sol'));
        expect(appService().ensureGnosis).not.toHaveBeenCalled();
      });
    });
  });
});
