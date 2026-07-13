import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { AppService } from './app.service';

/**
 * AppService fetches text and parses it with a BigInt-aware parser, so these tests stub
 * the global `fetch` with a routable mock that returns Response-likes. The service is
 * promise-based, so assertions await the calls rather than flushing an HttpTestingController.
 */
describe('AppService (HTTP-driven coverage)', () => {
  let service: AppService;
  let fetchMock: ReturnType<typeof vi.fn>;
  /** Per-test router: maps a request URL to a Response-like (see ok()/fail()). */
  let route: (url: string) => { ok: boolean; status: number; statusText: string; text: () => Promise<string> };

  /** A 2xx Response-like; objects are JSON-stringified, strings passed through verbatim. */
  function ok(body: unknown) {
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return { ok: true, status: 200, statusText: 'OK', text: () => Promise.resolve(text) };
  }

  /** A failing Response-like with the given status. */
  function fail(status: number, body = 'error') {
    return { ok: false, status, statusText: `HTTP ${status}`, text: () => Promise.resolve(body) };
  }

  /** Flushes pending promise microtasks so chained .then(...) callbacks settle. */
  async function flush(): Promise<void> {
    for (let i = 0; i < 12; i++) {
      await Promise.resolve();
    }
  }

  /** Creates the service (firing the constructor feeds) and lets them settle. */
  async function init(): Promise<void> {
    service = TestBed.inject(AppService);
    await flush();
  }

  /** True if the global fetch was called with a URL containing `fragment`. */
  function calledWith(fragment: string): boolean {
    return fetchMock.mock.calls.some(([url]) => String(url).includes(fragment));
  }

  beforeEach(() => {
    // Default router: satisfies the two constructor feeds (codex ref + edastro combined).
    route = (url: string) => {
      if (url.includes('/codex/ref')) return ok({});
      if (url.includes('combined')) return ok([]);
      return ok({});
    };
    fetchMock = vi.fn((url: string) => Promise.resolve(route(url)));
    vi.stubGlobal('fetch', fetchMock);

    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('publishes codex entries and derived independent outposts from the constructor feeds', async () => {
    route = (url: string) => {
      if (url.includes('/codex/ref')) return ok({});
      if (url.includes('combined')) return ok([
        { name: 'Outpost Alpha', id64: 1, type: 'independentOutpost', coordinates: [1, 2, 3], galMapSearch: 'Alpha' },
        { name: 'Retired Base', id64: 2, type: 'independentOutpost', coordinates: [0, 0, 0] },
        { name: 'Some Station', id64: 3, type: 'station', coordinates: [4, 5, 6] },
      ]);
      return ok({});
    };
    await init();

    const outposts = service.independentOutposts();
    expect(outposts.length).toBe(1); // 'Retired' filtered out, non-outpost type filtered out
    expect(outposts[0].name).toBe('Outpost Alpha');
    expect(outposts[0].galMapSearch).toBe('Alpha');

    const systems = service.edastroSystems();
    expect(systems.length).toBe(3);
  });

  it('fetches per-system EdAstro data on demand', async () => {
    await init();
    route = (url: string) => url.includes('/id64/12345') ? ok({ name: 'Sys', summary: 'hi' }) : ok({});
    const result = await service.getEdastroData(12345);
    expect(result.name).toBe('Sys');
  });

  it('runs a gal-map typeahead search', async () => {
    await init();
    route = (url: string) => url.includes('/typeahead') && url.includes('Sol')
      ? ok({ min_max: [{ name: 'Sol', id64: 10477373803 }] }) : ok({});
    const result = await service.galMapSearch('Sol');
    expect(result.min_max![0].name).toBe('Sol');
  });

  it('updates the background image signal', async () => {
    await init();
    service.setBackgroundImage('assets/bg2.jpg');
    expect(service.backgroundImage()).toBe('assets/bg2.jpg');
  });

  it('loads per-system biostats', async () => {
    await init();
    route = (url: string) => url.includes('/codex/biostats?id=999') ? ok({ system: { name: 'Sys', id64: 999 } }) : ok({});
    const result = await service.getBiostats(999);
    expect(result.system.name).toBe('Sys');
  });

  it('preserves a 64-bit body id64 as an exact BigInt (no float64 rounding)', async () => {
    await init();
    // 1080864266413281122 rounds to 1080864266413281200 when parsed as a JS number.
    const rawText = '{"system":{"name":"Phraa Eaec ER-I c11-1","id64":355844362082,'
      + '"bodies":[{"bodyId":30,"id64":1080864266413281122,"name":"Phraa Eaec ER-I c11-1 11"}]}}';
    route = (url: string) => url.includes('id=355844362082') ? ok(rawText) : ok({});
    const result: any = await service.getBiostats('355844362082');

    const id64 = result.system.bodies[0].id64;
    expect(typeof id64).toBe('bigint');
    expect(id64).toBe(1080864266413281122n);
    // Guard against the exact rounding the bug produced.
    expect(id64).not.toBe(1080864266413281200n);
    // Smaller ids are lifted to bigint too, for a uniform type.
    expect(result.system.id64).toBe(355844362082n);
  });

  it('builds the Simbad URL with and without coordinates', async () => {
    await init();
    await service.getSimbad(42, 'Sol');
    expect(calledWith('/simbad?')).toBe(true);
    expect(calledWith('system_address=42')).toBe(true);

    await service.getSimbad(42, 'Sol', { x: 1, y: 2, z: 3 });
    expect(calledWith('&x=1&y=2&z=3')).toBe(true);
  });

  it('fetches the Gnosis location', async () => {
    await init();
    route = (url: string) => url.includes('/gnosis') ? ok({ system: 'Varati' }) : ok({});
    const result = await service.getGnosis();
    expect(result.system).toBe('Varati');
  });

  it('exposes typeahead suggestion values', async () => {
    await init();
    route = (url: string) => url.includes('/typeahead') && url.includes('Syn') ? ok({ values: ['Synuefe'] }) : ok({});
    const result = await service.typeahead('Syn');
    expect(result.values).toEqual(['Synuefe']);
  });

  it('does NOT retry a 4xx client error (surfaces it immediately)', async () => {
    await init();
    let biostatsCalls = 0;
    route = (url: string) => {
      if (url.includes('id=404')) {
        biostatsCalls++;
        return fail(404, 'nope');
      }
      return ok({});
    };
    let error: any;
    await service.getBiostats(404).catch(e => (error = e));
    // A single request is made; the 404 is surfaced without a retry.
    expect(biostatsCalls).toBe(1);
    expect(error?.status).toBe(404);
  });

  it('retries a 5xx error with backoff, then succeeds', async () => {
    vi.useFakeTimers();
    try {
      await init();
      let gnosisCalls = 0;
      route = (url: string) => {
        if (url.includes('/gnosis')) {
          gnosisCalls++;
          return gnosisCalls === 1 ? fail(500, 'boom') : ok({ system: 'Sol' });
        }
        return ok({});
      };
      const promise = service.getGnosis();
      // First attempt fails (500); the first backoff is ~1000ms before the retry.
      await vi.advanceTimersByTimeAsync(1100);
      const result = await promise;
      expect(gnosisCalls).toBe(2);
      expect(result.system).toBe('Sol');
    } finally {
      vi.useRealTimers();
    }
  });

  it('lazily loads the megaship schedule asset and memoises the fetch', async () => {
    await init();
    let scheduleCalls = 0;
    const schedule = { anchor: '2023-12-28T07:00:00+00:00', week_seconds: 604800, generated_at: 'x', ships: [] };
    route = (url: string) => {
      if (url.includes('megaship-schedule.json')) {
        scheduleCalls++;
        return ok(schedule);
      }
      return ok({});
    };
    expect(service.megashipSchedule()).toBeNull();
    service.ensureMegaships();
    service.ensureMegaships(); // second call before the first resolves must not fire a second fetch
    await flush();
    expect(scheduleCalls).toBe(1);
    expect(service.megashipSchedule()).toEqual(schedule);
  });

  it('leaves the megaship schedule null and retryable when the asset fetch fails', async () => {
    await init();
    let scheduleCalls = 0;
    route = (url: string) => {
      if (url.includes('megaship-schedule.json')) {
        scheduleCalls++;
        return fail(500, 'boom');
      }
      return ok({});
    };
    service.ensureMegaships();
    await flush();
    expect(service.megashipSchedule()).toBeNull();
    expect(scheduleCalls).toBeGreaterThanOrEqual(1);
  });

  it('resolves a system name via biostats and caches it in systemNames', async () => {
    await init();
    let biostatsCalls = 0;
    route = (url: string) => {
      if (url.includes('/codex/biostats?id=555')) {
        biostatsCalls++;
        return ok({ system: { name: 'Croatigae' } });
      }
      return ok({});
    };
    expect(service.systemNames().get('555')).toBeUndefined();
    service.requestSystemName(555);
    service.requestSystemName(555); // deduped: must not fire a second request
    await flush();
    expect(biostatsCalls).toBe(1);
    expect(service.systemNames().get('555')).toBe('Croatigae');
  });

  it('caches a failed lookup as the raw id64 fallback (not retried)', async () => {
    await init();
    let biostatsCalls = 0;
    route = (url: string) => {
      if (url.includes('/codex/biostats?id=777')) {
        biostatsCalls++;
        return fail(404, 'not found');
      }
      return ok({});
    };
    service.requestSystemName(777);
    await flush();
    service.requestSystemName(777);
    await flush();
    expect(biostatsCalls).toBe(1); // failure is cached too; no retry storm
    expect(service.systemNames().get('777')).toBe('777');
  });

  it('resolveSystemName dedupes concurrent in-flight lookups for the same id64', async () => {
    await init();
    let biostatsCalls = 0;
    route = (url: string) => {
      if (url.includes('/codex/biostats?id=888')) {
        biostatsCalls++;
        return ok({ system: { name: 'Varati' } });
      }
      return ok({});
    };
    const [a, b] = await Promise.all([service.resolveSystemName(888), service.resolveSystemName(888)]);
    expect(biostatsCalls).toBe(1);
    expect(a).toBe('Varati');
    expect(b).toBe('Varati');
  });
});
