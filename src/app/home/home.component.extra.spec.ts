import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, provideZonelessChangeDetection } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, of, Subject, throwError } from 'rxjs';

import { HomeComponent } from './home.component';
import { AppService } from '../app.service';

describe('HomeComponent (extended coverage)', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;
  let httpResponses: Map<string, unknown>;
  let httpGet: ReturnType<typeof vi.fn<(url: string) => any>>;
  let navigate: ReturnType<typeof vi.fn>;
  let edastroSystems$: Subject<any[]>;
  let independentOutposts$: Subject<any[]>;
  let setBackgroundImage: ReturnType<typeof vi.fn>;
  let getEdastroData: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    httpResponses = new Map();
    // Returns a queued response for any URL whose key is a substring of the request URL.
    httpGet = vi.fn((url: string) => {
      for (const [key, value] of httpResponses) {
        if (url.includes(key)) {
          // An Error value is replayed as a failing request (covers error branches).
          return value instanceof Error ? throwError(() => value) : of(value);
        }
      }
      // Unmatched text requests default to an empty string; other requests to an empty object.
      return of(url.includes('readme.md') ? '' : {});
    });
    navigate = vi.fn(() => Promise.resolve(true));
    edastroSystems$ = new Subject<any[]>();
    independentOutposts$ = new Subject<any[]>();
    setBackgroundImage = vi.fn();
    getEdastroData = vi.fn(() => of(null));

    TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: HttpClient, useValue: { get: httpGet } },
        {
          provide: AppService,
          // The remote API methods delegate to the same URL-keyed httpGet mock so the
          // existing `httpResponses` fixtures (keyed by URL substring) keep driving them.
          useValue: {
            edastroSystems: edastroSystems$,
            independentOutposts: independentOutposts$,
            codexEntries: of([]),
            getBodyDisplayName: (n: string) => `${n}*`,
            getEdastroData,
            setBackgroundImage,
            galMapSearch: vi.fn((q: string) => httpGet(`/typeahead?q=${q}`)),
            typeahead: vi.fn((q: string) => httpGet(`/typeahead?q=${q}`)),
            getBiostats: vi.fn((id: number) => httpGet(`/codex/biostats?id=${id}&caller=Signals`)),
            getSimbad: vi.fn((id: number, name: string) => httpGet(`/simbad?system_address=${id}&name=${name}`)),
          },
        },
        { provide: ActivatedRoute, useValue: { queryParams: of({}) } },
        { provide: Router, useValue: { navigate } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('formatting helpers', () => {
    it('formats right ascension and declination from degrees', () => {
      expect(component.formatRAJ2000(290.5)).toMatch(/^\d+h \d{2}m [\d.]+s$/);
      expect(component.formatRAJ2000(NaN)).toBe('');
      expect(component.formatDEJ2000(21.884)).toMatch(/^\+21° \d{2}′ [\d.]+″$/);
      expect(component.formatDEJ2000(-5).startsWith('-')).toBe(true);
      expect(component.formatDEJ2000(NaN)).toBe('');
    });

    it('resolves a procedural-generation name from a known system address', () => {
      const name = component.getPGName(10577693187);
      expect(name.length).toBeGreaterThan(0);
      expect(name).toMatch(/[A-Z]{2}-[A-Z] [a-z]\d/); // mass-code + index segment
    });

    it('returns an empty PG name for an invalid address', () => {
      expect(component.getPGName('not-a-number')).toBe('');
    });

    it('decodes HTML entities and tests numeric strings', () => {
      expect((component as any).decodeHtmlEntities('Col&nbsp;285')).toContain('Col');
      expect((component as any).isNumeric('12345')).toBe(true);
      expect((component as any).isNumeric('12a')).toBe(false);
    });

    it('strips a parent name prefix from a ring name', () => {
      expect((component as any).stripParentName('Test 1 A Ring', 'Test 1')).toBe('A Ring');
    });

    it('exposes the build-time generated credits HTML', () => {
      expect(component.creditsHtml).toContain('<ul>');
      expect(component.creditsHtml).toContain('<a href="');
    });

    it('counts the Voyager Golden Record pulsars', () => {
      component.data = { system: { name: 'Vela Pulsar' } } as any;
      expect(component.isVoyagerGoldenRecordSystem()).toBe(true);
      component.data = { system: { name: 'Sol' } } as any;
      expect(component.isVoyagerGoldenRecordSystem()).toBe(false);
    });
  });

  describe('ngOnInit wiring', () => {
    it('reacts to the outpost feed', () => {
      component.ngOnInit();

      component.data = { system: { name: 'Sol', id64: 1, coords: { x: 0, y: 0, z: 0 } } } as any;
      independentOutposts$.next([{ name: 'Near', galMapSearch: 'Near', coordinates: [1, 1, 1], type: 'independentOutpost' }]);
      expect(component.independentOutposts.length).toBe(1);
      expect(component.getNearestOutposts().length).toBe(1);
    });

    it('maintains the display-name -> systemName/id64 map from the EdAstro feed', () => {
      component.ngOnInit();
      edastroSystems$.next([{ name: 'Display Name', galMapSearch: 'Real Sys', id64: 42 }]);
      expect((component as any).systemMapping.get('Display Name')).toEqual({ systemName: 'Real Sys', id64: 42 });
    });
  });

  describe('search flow', () => {
    it('loads the bundled test system for the "test" query', () => {
      httpResponses.set('assets/test-system.json', {
        system: { name: 'Test System', id64: 42, coords: { x: 1, y: 2, z: 3 }, bodies: [
          { bodyId: 0, name: 'A', type: 'Star', subType: '', id64: 1 },
        ] },
      });
      httpResponses.set('/simbad?', { system_address: 42, name: 'Test System' });
      component.searchControl.setValue('test');
      component.search();
      expect(component.data?.system.name).toBe('Test System');
      expect(component.bodies.length).toBe(1);
      expect(component.searching).toBe(false);
    });

    it('searches by numeric system address', () => {
      httpResponses.set('/biostats?id=999', {
        system: { name: 'Numeric Sys', id64: 999, coords: { x: 0, y: 0, z: 0 }, bodies: [] },
      });
      component.searchControl.setValue('999');
      component.search();
      expect(component.data?.system.id64).toBe(999);
    });

    it('passes a 64-bit system address through as a string (no parseInt precision loss)', () => {
      // 18 digits — beyond Number.MAX_SAFE_INTEGER, where parseInt would round.
      const big = '123456789012345678';
      httpResponses.set(`/biostats?id=${big}`, {
        system: { name: 'Big Addr', id64: 1, coords: { x: 0, y: 0, z: 0 }, bodies: [] },
      });
      component.searchControl.setValue(big);
      component.search();
      expect((TestBed.inject(AppService) as any).getBiostats).toHaveBeenCalledWith(big);
    });

    it('reports a not-found system address gracefully', () => {
      httpResponses.set('/biostats?id=111', { system: null });
      component.searchControl.setValue('111');
      component.search();
      expect(component.searchError).toBe(true);
      expect(component.searchErrorMessage).toContain('not found');
    });

    it('resolves a name via the EdAstro cache', () => {
      httpResponses.set('/biostats?id=555', {
        system: { name: 'Cached Sys', id64: 555, coords: { x: 0, y: 0, z: 0 }, bodies: [] },
      });
      component.searchControl.setValue('Cached Sys');
      // Provide the cached system synchronously when search subscribes.
      queueMicrotask(() => edastroSystems$.next([{ name: 'Cached Sys', id64: 555 }]));
      component.search();
      edastroSystems$.next([{ name: 'Cached Sys', id64: 555 }]);
      expect(component.data?.system.id64).toBe(555);
    });

    it('resolves a name via the Spansh typeahead when not in the EdAstro cache', () => {
      httpResponses.set('/typeahead', { min_max: [{ name: 'Found Sys', id64: 777 }] });
      httpResponses.set('/biostats?id=777', {
        system: { name: 'Found Sys', id64: 777, coords: { x: 0, y: 0, z: 0 }, bodies: [] },
      });
      component.searchControl.setValue('Found Sys');
      component.search();
      edastroSystems$.next([]); // not in cache -> falls through to Spansh
      expect(component.data?.system.id64).toBe(777);
    });

    it('reports a system that Spansh cannot find', () => {
      httpResponses.set('/typeahead', { min_max: [] });
      component.searchControl.setValue('Ghost Sys');
      component.search();
      edastroSystems$.next([]);
      expect(component.searchError).toBe(true);
    });

    it('surfaces a 404 from the biostats API as a not-found error', () => {
      httpResponses.set('/biostats?id=404', Object.assign(new Error('nope'), { status: 404 }));
      component.searchControl.setValue('404');
      component.search();
      expect(component.searchError).toBe(true);
      expect(component.searchErrorMessage).toContain('not found');
    });

    it('attaches belts as child bodies when processing a system', () => {
      const data = {
        system: {
          name: 'Belt Sys', id64: 88, coords: { x: 0, y: 0, z: 0 },
          bodies: [{
            bodyId: 0, name: 'Belt Sys A', type: 'Star', subType: '', id64: 1,
            belts: [{ name: 'Belt Sys A Belt', type: 'Rocky', innerRadius: 2000, outerRadius: 4000, mass: 9 }],
          }],
        },
      };
      (component as any).processBodies(data);
      const belt = component.bodies[0].subBodies.find(b => b.bodyData.type === 'Belt');
      expect(belt).toBeTruthy();
      expect(belt!.bodyData.innerRadius).toBe(2); // metres -> km
    });

    it('defers a request issued while a search is in flight, then drains it', () => {
      (component as any)._searching = true;
      (component as any).pendingSystemRequest = 'Deferred';
      component.data = { system: { name: 'Other' } } as any;
      const loadSpy = vi.spyOn(component as any, 'loadSystem');
      component.searching = false; // setter should drain the pending request
      expect(loadSpy).toHaveBeenCalledWith('Deferred');
    });
  });

  describe('getSystemSuggestions', () => {
    /** Subscribes to a suggestions observable and resolves with its first emission. */
    function firstSuggestion(obs: Observable<string[]>): Promise<string[]> {
      return new Promise(resolve => {
        const sub = obs.subscribe(v => { resolve(v); queueMicrotask(() => sub.unsubscribe()); });
      });
    }

    it('merges Spansh and EdAstro suggestions and de-duplicates them', async () => {
      httpResponses.set('/typeahead', { values: ['Synuefe Two', 'Synuefe One'] });
      const result$ = (component as any).getSystemSuggestions('Synuefe') as Observable<string[]>;
      const promise = firstSuggestion(result$);
      edastroSystems$.next([{ name: 'Synuefe One', id64: 1 }]);
      const suggestions = await promise;
      expect(suggestions).toContain('Synuefe One');
      expect(suggestions).toContain('Synuefe Two');
      expect(new Set(suggestions).size).toBe(suggestions.length); // de-duplicated
    });

    it('looks up missing id64s via gal-map search and caches the query', async () => {
      httpResponses.set('/typeahead', { values: [] });
      (TestBed.inject(AppService) as any).galMapSearch = vi.fn(() => of({ min_max: [{ name: 'No Id Sys', id64: 5 }] }));
      const result$ = (component as any).getSystemSuggestions('No Id') as Observable<string[]>;
      const promise = firstSuggestion(result$);
      edastroSystems$.next([{ name: 'No Id Sys', galMapSearch: 'No Id Sys' }]);
      await promise;
      // Second call for the same query returns the cached observable instance.
      expect((component as any).getSystemSuggestions('No Id')).toBe(result$);
    });
  });

  describe('selection & navigation helpers', () => {
    it('routes a known system selection straight to its address', () => {
      httpResponses.set('/biostats?id=7', { system: { name: 'Mapped', id64: 7, coords: { x: 0, y: 0, z: 0 }, bodies: [] } });
      (component as any).systemMapping.set('Mapped Display', { id64: 7 });
      component.onSystemSelected('Mapped Display');
      expect(component.data?.system.id64).toBe(7);
    });

    it('falls back to a name search for an unmapped selection', () => {
      const searchSpy = vi.spyOn(component, 'search').mockImplementation(() => {});
      component.onSystemSelected('Totally Unknown');
      expect(component.searchInput).toBe('Totally Unknown');
      expect(searchSpy).toHaveBeenCalled();
    });

    it('loads a system when a map marker is selected', () => {
      const loadSpy = vi.spyOn(component as any, 'loadSystem');
      component.onMarkerSelected('Colonia');
      expect(loadSpy).toHaveBeenCalledWith('Colonia');
    });

    it('reloads a broken GIF after a delay', () => {
      const img = { src: 'assets/Orbit2.gif' } as HTMLImageElement;
      component.onGecImageError({ target: img } as unknown as Event);
      vi.runOnlyPendingTimers();
      expect(img.src).toContain('?t=');
    });

    it('delegates the display name to AppService and tracks bodies by id', () => {
      expect(component.getBodyDisplayName('Foo')).toBe('Foo*');
      expect(component.trackByBody(0, { bodyData: { bodyId: 8 } } as any)).toBe(8);
    });
  });

  describe('clipboard & external links', () => {
    let openSpy: ReturnType<typeof vi.fn>;
    beforeEach(() => {
      openSpy = vi.fn();
      vi.stubGlobal('open', openSpy);
    });
    afterEach(() => vi.unstubAllGlobals());

    it('copies coordinates with the requested separator', () => {
      const writeText = vi.fn(() => Promise.resolve());
      vi.stubGlobal('navigator', { clipboard: { writeText } });
      component.data = { system: { id64: 5, coords: { x: 1, y: 2, z: 3 } } } as any;
      component.copyCoordinatesToClipboard('pipe');
      expect(writeText).toHaveBeenCalledWith('1|2|3');
      component.copyId64ToClipboard();
      expect(writeText).toHaveBeenCalledWith('5');
    });

    it('copies via middle-click mouse-down', () => {
      const writeText = vi.fn(() => Promise.resolve());
      vi.stubGlobal('navigator', { clipboard: { writeText } });
      component.data = { system: { id64: 5, coords: { x: 1, y: 2, z: 3 } } } as any;
      component.onCoordinatesMouseDown({ button: 1, preventDefault: () => {} } as MouseEvent);
      expect(writeText).toHaveBeenCalled();
    });

    it('opens SIMBAD and signals pages in a new tab', () => {
      component.openSimbadPageRaw('NGC 1');
      component.openSimbadPage('@NGC 1');
      component.openSignalsPage('Sol');
      expect(openSpy).toHaveBeenCalledTimes(3);
      component.openSimbadPage('');
      expect(openSpy).toHaveBeenCalledTimes(3); // empty ident is a no-op
    });

    it('encodes URI components', () => {
      expect(component.encodeURIComponent('a b')).toBe('a%20b');
    });
  });

  describe('fetchEdGalaxyData', () => {
    it('uses the PG fallback for procedurally-generated systems without calling SIMBAD', () => {
      component.fetchEdGalaxyData('Pru Aescs NC-M d7-192', 10577693187);
      expect(component.edGalaxyData?.Simbad).toBeUndefined();
      expect(component.edGalaxyData?.PGName.length).toBeGreaterThan(0);
    });

    it('maps a SIMBAD API response for a hand-named system', () => {
      httpResponses.set('/simbad?', {
        system_address: 10477373803, name: 'Sol', simbad_name: 'Sol', simbad_ident: '@Sol',
        ra_j2000: 0, dec_j2000: 0,
      });
      component.fetchEdGalaxyData('Sol', 10477373803);
      expect(component.edGalaxyData?.Simbad?.Name).toBe('Sol');
    });
  });
});
