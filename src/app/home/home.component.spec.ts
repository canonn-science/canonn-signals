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
    expect(headers).toEqual(['Location', 'Society', 'Distances', 'Nearest DSSA', 'Nearest Nebulae']);

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

  describe('systemCompleteness', () => {
    function loadSystem(bodyCount: number | undefined, bodies: any[]) {
      const data = {
        system: {
          name: 'Test System', id64: 1, coords: { x: 0, y: 0, z: 0 },
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
});
