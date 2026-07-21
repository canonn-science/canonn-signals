import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, provideZonelessChangeDetection, signal, WritableSignal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { HomeComponent } from './home.component';
import { AppService } from '../app.service';

/**
 * Flushes pending promise microtasks so chained `.then(...)` callbacks (e.g.
 * galMapSearch → getBiostats → processBodies) settle before assertions. The HTTP
 * layer is promise-based, so a synchronous assert right after `search()` would race it.
 */
async function flushPromises(): Promise<void> {
  for (let i = 0; i < 12; i++) {
    await Promise.resolve();
  }
}

describe('HomeComponent (extended coverage)', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;
  let httpResponses: Map<string, unknown>;
  let httpGet: ReturnType<typeof vi.fn<(url: string) => any>>;
  let navigate: ReturnType<typeof vi.fn>;
  let edastroSystems$: WritableSignal<any[]>;
  let independentOutposts$: WritableSignal<any[]>;
  let nebulae$: WritableSignal<any[]>;
  let megashipSchedule$: WritableSignal<any>;
  let systemNames$: WritableSignal<ReadonlyMap<string, string>>;
  let setBackgroundImage: ReturnType<typeof vi.fn>;
  let getEdastroData: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    httpResponses = new Map();
    // Returns a queued response for any URL whose key is a substring of the request URL.
    httpGet = vi.fn((url: string) => {
      for (const [key, value] of httpResponses) {
        if (url.includes(key)) {
          // An Error value is replayed as a rejected request (covers error branches).
          return value instanceof Error ? Promise.reject(value) : Promise.resolve(value);
        }
      }
      // Unmatched text requests default to an empty string; other requests to an empty object.
      return Promise.resolve(url.includes('readme.md') ? '' : {});
    });
    // The "test" system path loads a bundled asset via the global fetch; serve it from the
    // same URL-keyed fixtures (as a Response-like with json()).
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      for (const [key, value] of httpResponses) {
        if (url.includes(key)) {
          if (value instanceof Error) {
            return Promise.resolve({ ok: false, status: (value as any).status ?? 500 });
          }
          return Promise.resolve({ ok: true, json: () => Promise.resolve(value), text: () => Promise.resolve(String(value)) });
        }
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve('') });
    }));
    navigate = vi.fn(() => Promise.resolve(true));
    edastroSystems$ = signal<any[]>([]);
    independentOutposts$ = signal<any[]>([]);
    nebulae$ = signal<any[]>([]);
    megashipSchedule$ = signal<any>(null);
    systemNames$ = signal<ReadonlyMap<string, string>>(new Map());
    setBackgroundImage = vi.fn();
    getEdastroData = vi.fn(() => Promise.resolve(null));

    TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: AppService,
          // The remote API methods delegate to the same URL-keyed httpGet mock so the
          // existing `httpResponses` fixtures (keyed by URL substring) keep driving them.
          useValue: {
            edastroSystems: edastroSystems$,
            independentOutposts: independentOutposts$,
            nebulae: nebulae$,
            ensureNebulae: vi.fn(),
            codexEntries: signal([]),
            getBodyDisplayName: (n: string) => `${n}*`,
            getEdastroData,
            setBackgroundImage,
            galMapSearch: vi.fn((q: string) => httpGet(`/typeahead?q=${q}`)),
            typeahead: vi.fn((q: string) => httpGet(`/typeahead?q=${q}`)),
            getBiostats: vi.fn((id: number) => httpGet(`/codex/biostats?id=${id}&caller=Signals`)),
            getSimbad: vi.fn((id: number, name: string) => httpGet(`/simbad?system_address=${id}&name=${name}`)),
            megashipSchedule: megashipSchedule$,
            ensureMegaships: vi.fn(),
            systemNames: systemNames$,
            requestSystemName: vi.fn(),
            resolveSystemName: vi.fn(() => Promise.resolve('')),
            nowOverride: signal<number | null>(null),
            gnosisData: signal(null),
            ensureGnosis: vi.fn(),
          },
        },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
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
    vi.unstubAllGlobals();
  });

  describe('formatting helpers', () => {
    it('formats right ascension and declination from degrees', () => {
      expect(component.formatRAJ2000(290.5)).toMatch(/^\d+h \d{2}m [\d.]+s$/);
      expect(component.formatRAJ2000(NaN)).toBe('');
      expect(component.formatDEJ2000(21.884)).toMatch(/^\+21° \d{2}′ [\d.]+″$/);
      expect(component.formatDEJ2000(-5).startsWith('-')).toBe(true);
      expect(component.formatDEJ2000(NaN)).toBe('');
    });

    it('carries rounded seconds into the next unit instead of rendering a 60.0 field', () => {
      // RA: 119.98s ≡ 1m 59.98s, which rounds up to a full extra minute → 0h 02m 00.0s.
      const ra = component.formatRAJ2000(119.98 / 240);
      expect(ra).not.toContain('60.0');
      expect(ra).toBe('0h 02m 00.0s');

      // Dec: 1′ 59.98″ rounds up the same way → +0° 02′ 00.0″.
      const de = component.formatDEJ2000(119.98 / 3600);
      expect(de).not.toContain('60.0');
      expect(de).toBe('+0° 02′ 00.0″');
    });

    it('resolves a procedural-generation name from a known system address', () => {
      // N1 is zero for this system, so ED omits it: "…d0", not "…d0-0".
      const name = component.getPGName(10577693187);
      expect(name).toBe('Blae Eock KC-C d0');
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
      component.data.set({ system: { name: 'Vela Pulsar' } } as any);
      expect(component.isVoyagerGoldenRecordSystem()).toBe(true);
      component.data.set({ system: { name: 'Sol' } } as any);
      expect(component.isVoyagerGoldenRecordSystem()).toBe(false);
    });
  });

  describe('ngOnInit wiring', () => {
    it('reacts to the outpost feed', () => {
      component.ngOnInit();

      component.data.set({ system: { name: 'Sol', id64: 1, coords: { x: 0, y: 0, z: 0 } } } as any);
      independentOutposts$.set([{ name: 'Near', galMapSearch: 'Near', coordinates: [1, 1, 1], type: 'independentOutpost' }]);
      expect(component.independentOutposts().length).toBe(1);
      expect(component.getNearestOutposts().length).toBe(1);
    });

    it('derives the display-name -> systemName/id64 map from the EdAstro feed', () => {
      edastroSystems$.set([{ name: 'Display Name', galMapSearch: 'Real Sys', id64: 42 }]);
      expect((component as any).systemMapping().get('Display Name')).toEqual({ systemName: 'Real Sys', id64: 42 });
    });

    it('lists the three nearest nebulae from the catalogue, nearest first', () => {
      component.data.set({ system: { name: 'Sol', id64: 1, coords: { x: 0, y: 0, z: 0 } } } as any);
      nebulae$.set([
        { name: 'Far', system: 'Far Sys', x: 100, y: 0, z: 0, type: 'planetary' },
        { name: 'Close', system: 'Close Sys', x: 1, y: 0, z: 0, type: 'real' },
        { name: 'Mid', system: 'Mid Sys', x: 10, y: 0, z: 0, type: 'planetary' },
        { name: 'Furthest', system: 'Furthest Sys', x: 1000, y: 0, z: 0, type: 'procgen' },
      ]);
      const nearest = component.getNearestNebulae();
      expect(nearest.map(n => n.name)).toEqual(['Close', 'Mid', 'Far']);
      expect(nearest[0].distance).toBeCloseTo(1, 10);
    });

    it('returns no nearest nebulae before the catalogue has loaded', () => {
      component.data.set({ system: { name: 'Sol', id64: 1, coords: { x: 0, y: 0, z: 0 } } } as any);
      expect(component.getNearestNebulae()).toEqual([]);
    });
  });

  describe('search flow', () => {
    it('loads the bundled test system for the "test" query', async () => {
      httpResponses.set('assets/test-system.json', {
        system: { name: 'Test System', id64: 42, coords: { x: 1, y: 2, z: 3 }, bodies: [
          { bodyId: 0, name: 'A', type: 'Star', subType: '', id64: 1 },
        ] },
      });
      httpResponses.set('/simbad?', { system_address: 42, name: 'Test System' });
      component.searchControl.setValue('test');
      component.search();
      await flushPromises();
      expect(component.data()?.system.name).toBe('Test System');
      expect(component.bodies().length).toBe(1);
      expect(component.searching).toBe(false);
    });

    it('searches by numeric system address', async () => {
      httpResponses.set('/biostats?id=999', {
        system: { name: 'Numeric Sys', id64: 999, coords: { x: 0, y: 0, z: 0 }, bodies: [] },
      });
      component.searchControl.setValue('999');
      component.search();
      await flushPromises();
      expect(component.data()?.system.id64).toBe(999);
    });

    it('passes a 64-bit system address through as a string (no parseInt precision loss)', async () => {
      // 18 digits — beyond Number.MAX_SAFE_INTEGER, where parseInt would round.
      const big = '123456789012345678';
      httpResponses.set(`/biostats?id=${big}`, {
        system: { name: 'Big Addr', id64: 1, coords: { x: 0, y: 0, z: 0 }, bodies: [] },
      });
      component.searchControl.setValue(big);
      component.search();
      await flushPromises();
      expect((TestBed.inject(AppService) as any).getBiostats).toHaveBeenCalledWith(big);
    });

    it('reports a not-found system address gracefully', async () => {
      httpResponses.set('/biostats?id=111', { system: null });
      component.searchControl.setValue('111');
      component.search();
      await flushPromises();
      expect(component.searchError()).toBe(true);
      expect(component.searchErrorMessage()).toContain('not found');
    });

    it('resolves a name via the EdAstro cache', async () => {
      httpResponses.set('/biostats?id=555', {
        system: { name: 'Cached Sys', id64: 555, coords: { x: 0, y: 0, z: 0 }, bodies: [] },
      });
      // Seed the EdAstro cache before searching; search() reads the current snapshot.
      edastroSystems$.set([{ name: 'Cached Sys', id64: 555 }]);
      component.searchControl.setValue('Cached Sys');
      component.search();
      await flushPromises();
      expect(component.data()?.system.id64).toBe(555);
    });

    it('resolves a name via the Canonn typeahead when not in the EdAstro cache', async () => {
      httpResponses.set('/typeahead', { min_max: [{ name: 'Found Sys', id64: 777 }] });
      httpResponses.set('/biostats?id=777', {
        system: { name: 'Found Sys', id64: 777, coords: { x: 0, y: 0, z: 0 }, bodies: [] },
      });
      edastroSystems$.set([]); // not in cache -> falls through to the Canonn typeahead
      component.searchControl.setValue('Found Sys');
      component.search();
      await flushPromises();
      expect(component.data()?.system.id64).toBe(777);
    });

    it('reports a system that the Canonn API cannot find', async () => {
      httpResponses.set('/typeahead', { min_max: [] });
      edastroSystems$.set([]);
      component.searchControl.setValue('Ghost Sys');
      component.search();
      await flushPromises();
      expect(component.searchError()).toBe(true);
    });

    it('surfaces a 404 from the biostats API as a not-found error', async () => {
      httpResponses.set('/biostats?id=404', Object.assign(new Error('nope'), { status: 404 }));
      component.searchControl.setValue('404');
      component.search();
      await flushPromises();
      expect(component.searchError()).toBe(true);
      expect(component.searchErrorMessage()).toContain('not found');
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
      const belt = component.bodies()[0].subBodies.find(b => b.bodyData.type === 'Belt');
      expect(belt).toBeTruthy();
      expect(belt!.bodyData.innerRadius).toBe(2); // metres -> km
    });

    it('defers a request issued while a search is in flight, then drains it', () => {
      (component as any)._searching.set(true);
      (component as any).pendingSystemRequest = 'Deferred';
      component.data.set({ system: { name: 'Other' } } as any);
      const loadSpy = vi.spyOn(component as any, 'loadSystem');
      component.searching = false; // setter should drain the pending request
      expect(loadSpy).toHaveBeenCalledWith('Deferred');
    });
  });

  describe('getSystemSuggestions', () => {
    it('merges Canonn and EdAstro suggestions and de-duplicates them', async () => {
      httpResponses.set('/typeahead', { values: ['Synuefe Two', 'Synuefe One'] });
      edastroSystems$.set([{ name: 'Synuefe One', id64: 1 }]);
      const suggestions = await ((component as any).getSystemSuggestions('Synuefe') as Promise<string[]>);
      expect(suggestions).toContain('Synuefe One');
      expect(suggestions).toContain('Synuefe Two');
      expect(new Set(suggestions).size).toBe(suggestions.length); // de-duplicated
    });

    it('suggests EdAstro matches without firing a per-system gal-map lookup, and caches the query', async () => {
      // Regression guard: typing a query must NOT trigger one typeahead/galMapSearch HTTP
      // call per matching system (the old fan-out). The id64 is resolved lazily on
      // selection (onSystemSelected → search()), not while building suggestions.
      httpResponses.set('/typeahead', { values: [] });
      const galMap = vi.fn(() => Promise.resolve({ min_max: [{ name: 'No Id Sys', id64: 5 }] }));
      (TestBed.inject(AppService) as any).galMapSearch = galMap;
      edastroSystems$.set([{ name: 'No Id Sys', galMapSearch: 'No Id Sys' }]);
      const result = (component as any).getSystemSuggestions('No Id') as Promise<string[]>;
      expect(await result).toContain('No Id Sys');
      expect(galMap).not.toHaveBeenCalled(); // no per-system id64 resolution at suggestion time
      // Second call for the same (non-empty) query returns the cached promise instance.
      expect((component as any).getSystemSuggestions('No Id')).toBe(result);
    });

    it('does not cache an empty result (often a transient failure) so it can be retried', async () => {
      httpResponses.set('/typeahead', { values: [] });
      edastroSystems$.set([]); // no matches this keystroke → empty suggestions
      const first = (component as any).getSystemSuggestions('Nothing') as Promise<string[]>;
      expect(await first).toEqual([]);
      // The empty entry was evicted, so a later call recomputes (new promise instance)
      // rather than returning the cached empty list forever.
      expect((component as any).getSystemSuggestions('Nothing')).not.toBe(first);
    });
  });

  describe('selection & navigation helpers', () => {
    it('routes a known system selection straight to its address', async () => {
      httpResponses.set('/biostats?id=7', { system: { name: 'Mapped', id64: 7, coords: { x: 0, y: 0, z: 0 }, bodies: [] } });
      edastroSystems$.set([{ name: 'Mapped Display', id64: 7 }]);
      component.onSystemSelected('Mapped Display');
      await flushPromises();
      expect(component.data()?.system.id64).toBe(7);
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
      component.data.set({ system: { id64: 5, coords: { x: 1, y: 2, z: 3 } } } as any);
      component.copyCoordinatesToClipboard('pipe');
      expect(writeText).toHaveBeenCalledWith('1|2|3');
      component.copyId64ToClipboard();
      expect(writeText).toHaveBeenCalledWith('5');
    });

    it('copies via middle-click mouse-down', () => {
      const writeText = vi.fn(() => Promise.resolve());
      vi.stubGlobal('navigator', { clipboard: { writeText } });
      component.data.set({ system: { id64: 5, coords: { x: 1, y: 2, z: 3 } } } as any);
      component.onCoordinatesMouseDown({ button: 1, preventDefault: () => {} } as MouseEvent);
      expect(writeText).toHaveBeenCalled();
    });

    it('opens SIMBAD and signals pages in a new tab', () => {
      component.openSimbadPageRaw('NGC 1');
      component.openSignalsPage('Sol');
      expect(openSpy).toHaveBeenCalledTimes(2);
      component.openSimbadPageRaw('');
      expect(openSpy).toHaveBeenCalledTimes(2); // empty ident is a no-op
    });

    it('encodes URI components', () => {
      expect(component.encodeURIComponent('a b')).toBe('a%20b');
    });
  });

  describe('fetchEdGalaxyData', () => {
    it('uses the PG fallback for procedurally-generated systems without calling SIMBAD', async () => {
      component.fetchEdGalaxyData('Pru Aescs NC-M d7-192', 10577693187n);
      await flushPromises();
      expect(component.edGalaxyData()?.Simbad).toBeUndefined();
      expect(component.edGalaxyData()?.PGName.length).toBeGreaterThan(0);
    });

    it('maps a SIMBAD API response for a hand-named system', async () => {
      httpResponses.set('/simbad?', {
        system_address: 10477373803, name: 'Sol', simbad_name: 'Sol', simbad_ident: '@Sol',
        ra_j2000: 0, dec_j2000: 0,
      });
      component.fetchEdGalaxyData('Sol', 10477373803n);
      await flushPromises();
      expect(component.edGalaxyData()?.Simbad?.Name).toBe('Sol');
    });
  });

  describe('stale-response guards', () => {
    it('drops a slow SIMBAD response once another system has been selected', async () => {
      const svc = TestBed.inject(AppService) as any;
      let resolveAlpha!: (v: unknown) => void;
      svc.getSimbad = vi.fn()
        // First (system Alpha) hangs; the later call (Beta) resolves immediately.
        .mockReturnValueOnce(new Promise(res => { resolveAlpha = res; }))
        .mockImplementation(() => Promise.resolve({
          system_address: 20n, name: 'Beta', simbad_name: 'Beta Star', simbad_ident: '@Beta',
          ra_j2000: 1, dec_j2000: 2,
        }));

      component.fetchEdGalaxyData('Alpha', 10n);
      component.fetchEdGalaxyData('Beta', 20n);
      await flushPromises();
      expect(component.edGalaxyData()?.Simbad?.Name).toBe('Beta Star');

      // Alpha's response finally arrives — it must not clobber Beta.
      resolveAlpha({
        system_address: 10n, name: 'Alpha', simbad_name: 'Alpha Star', simbad_ident: '@Alpha',
        ra_j2000: 9, dec_j2000: 9,
      });
      await flushPromises();
      expect(component.edGalaxyData()?.Simbad?.Name).toBe('Beta Star');
    });

    it('drops a slow EDAstro response (summary + background) after switching systems', async () => {
      const svc = TestBed.inject(AppService) as any;
      let resolveAlpha!: (v: unknown) => void;
      svc.getEdastroData = vi.fn()
        .mockReturnValueOnce(new Promise(res => { resolveAlpha = res; }))
        .mockImplementation(() => Promise.resolve({
          name: 'Beta POI', summary: 'Beta summary', mainImage: 'https://example.com/beta.png',
        }));

      (component as any).processBodies({ system: { name: 'Alpha', id64: 111, coords: { x: 0, y: 0, z: 0 }, bodies: [] } });
      (component as any).processBodies({ system: { name: 'Beta', id64: 222, coords: { x: 0, y: 0, z: 0 }, bodies: [] } });
      await flushPromises();
      expect(component.edastroData()?.name).toBe('Beta POI');

      setBackgroundImage.mockClear();
      // Alpha's EDAstro payload resolves late — must not overwrite Beta's data or background.
      resolveAlpha({ name: 'Alpha POI', summary: 'Alpha summary', mainImage: 'https://example.com/alpha.png' });
      await flushPromises();
      expect(component.edastroData()?.name).toBe('Beta POI');
      expect(setBackgroundImage).not.toHaveBeenCalledWith('https://example.com/alpha.png');
    });
  });

  describe('autocomplete suggestions', () => {
    it('debounces input and populates the suggestions signal', async () => {
      httpResponses.set('/typeahead', { values: ['Synuefe AB', 'Synuefe CD'] });
      component.searchControl.setValue('Synuefe');
      component.onSearchInput();
      // Nothing yet: the lookup is debounced by 300ms.
      expect(component.filteredSystems()).toEqual([]);
      vi.advanceTimersByTime(300);
      await flushPromises();
      expect(component.filteredSystems()).toContain('Synuefe AB');
      expect(component.filteredSystems()).toContain('Synuefe CD');
    });

    it('suppresses suggestions for queries shorter than three characters', async () => {
      component.searchControl.setValue('ab');
      component.onSearchInput();
      vi.advanceTimersByTime(300);
      await flushPromises();
      expect(component.filteredSystems()).toEqual([]);
    });

    it('skips a repeated debounced query (distinctUntilChanged)', async () => {
      const typeahead = (TestBed.inject(AppService) as any).typeahead as ReturnType<typeof vi.fn>;
      httpResponses.set('/typeahead', { values: ['Sol System'] });
      component.searchControl.setValue('Sol System');
      component.onSearchInput();
      vi.advanceTimersByTime(300);
      await flushPromises();
      const callsAfterFirst = typeahead.mock.calls.length;
      // Same value again — the debounced query is unchanged, so no new lookup runs.
      component.onSearchInput();
      vi.advanceTimersByTime(300);
      await flushPromises();
      expect(typeahead.mock.calls.length).toBe(callsAfterFirst);
    });

    it('drops a stale lookup that resolves after a newer query (switchMap cancellation)', async () => {
      // The first lookup stays in flight; the second resolves immediately. Only when the
      // first resolves LAST can this test distinguish a working generation guard from none.
      let resolveFirst!: (v: string[]) => void;
      const first = new Promise<string[]>(r => { resolveFirst = r; });
      const getSuggestions = vi.spyOn(component as any, 'getSystemSuggestions')
        .mockReturnValueOnce(first)
        .mockReturnValueOnce(Promise.resolve(['FRESH']));

      const p1 = (component as any).runSuggestions('Query One'); // in flight
      const p2 = (component as any).runSuggestions('Query Two'); // supersedes it
      await p2;
      expect(component.filteredSystems()).toEqual(['FRESH']);

      // The stale first lookup now resolves — its write must be dropped by the guard.
      resolveFirst(['STALE']);
      await p1;
      expect(component.filteredSystems()).toEqual(['FRESH']);
      getSuggestions.mockRestore();
    });

    it('drops an in-flight lookup superseded by a suppressed/short query', async () => {
      // Regression guard: a short/suppressed query must still cancel an earlier in-flight
      // lookup, or a slow result repopulates the panel after the user backspaced away.
      let resolveFirst!: (v: string[]) => void;
      const first = new Promise<string[]>(r => { resolveFirst = r; });
      const getSuggestions = vi.spyOn(component as any, 'getSystemSuggestions')
        .mockReturnValueOnce(first);

      const p1 = (component as any).runSuggestions('Sol'); // real lookup, in flight
      const p2 = (component as any).runSuggestions('So');   // backspaced: suppressed (len < 3)
      await p2;
      expect(component.filteredSystems()).toEqual([]);

      resolveFirst(['Sol System']);
      await p1;
      // The superseded 'Sol' result must NOT reopen the panel.
      expect(component.filteredSystems()).toEqual([]);
      expect(getSuggestions).toHaveBeenCalledTimes(1); // 'So' was suppressed before any lookup
      getSuggestions.mockRestore();
    });
  });

  describe('query-param navigation', () => {
    it('loads the system named in the initial route snapshot', () => {
      const route = TestBed.inject(ActivatedRoute);
      (route.snapshot.queryParamMap as any).get = () => 'Deep Link Sys';
      const loadSpy = vi.spyOn(component as any, 'loadSystem').mockImplementation(() => {});
      component.ngOnInit();
      expect(loadSpy).toHaveBeenCalledWith('Deep Link Sys');
    });

    it('reacts to browser back/forward via popstate', () => {
      component.ngOnInit();
      const loadSpy = vi.spyOn(component as any, 'loadSystem').mockImplementation(() => {});
      const original = window.location.search;
      window.history.pushState({}, '', '?system=Popped Sys');
      try {
        window.dispatchEvent(new PopStateEvent('popstate'));
        expect(loadSpy).toHaveBeenCalledWith('Popped Sys');
      } finally {
        window.history.pushState({}, '', original || '/');
      }
    });

    it('removes the popstate listener and clears the debounce timer on destroy', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      component.ngOnInit();
      component.onSearchInput(); // schedule a debounce timer to be cleared
      component.ngOnDestroy();
      expect(removeSpy).toHaveBeenCalledWith('popstate', expect.any(Function));
    });
  });
});
