import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AppService } from './app.service';

describe('AppService (HTTP-driven coverage)', () => {
  let service: AppService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(AppService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  /** Flushes the two requests fired from the constructor (codex ref + edastro combined). */
  function flushConstructorRequests(edastroSystems: any[] = []): void {
    httpMock.expectOne(req => req.url.includes('/codex/ref')).flush({});
    httpMock.expectOne(req => req.url.includes('edastro') && req.url.includes('combined')).flush(edastroSystems);
  }

  it('publishes codex entries and derived independent outposts from the constructor feeds', async () => {
    flushConstructorRequests([
      { name: 'Outpost Alpha', id64: 1, type: 'independentOutpost', coordinates: [1, 2, 3], galMapSearch: 'Alpha' },
      { name: 'Retired Base', id64: 2, type: 'independentOutpost', coordinates: [0, 0, 0] },
      { name: 'Some Station', id64: 3, type: 'station', coordinates: [4, 5, 6] },
    ]);

    const outposts = await firstValue(service.independentOutposts);
    expect(outposts.length).toBe(1); // 'Retired' filtered out, non-outpost type filtered out
    expect(outposts[0].name).toBe('Outpost Alpha');
    expect(outposts[0].galMapSearch).toBe('Alpha');

    const systems = await firstValue(service.edastroSystems);
    expect(systems.length).toBe(3);
  });

  it('fetches per-system EdAstro data on demand', () => {
    flushConstructorRequests();
    let result: any;
    service.getEdastroData(12345).subscribe(d => (result = d));
    httpMock.expectOne(req => req.url.includes('/id64/12345')).flush({ name: 'Sys', summary: 'hi' });
    expect(result.name).toBe('Sys');
  });

  it('runs a gal-map typeahead search', () => {
    flushConstructorRequests();
    let result: any;
    service.galMapSearch('Sol').subscribe(r => (result = r));
    const req = httpMock.expectOne(r => r.url.includes('/typeahead') && r.url.includes('Sol'));
    req.flush({ min_max: [{ name: 'Sol', id64: 10477373803 }] });
    expect(result.min_max[0].name).toBe('Sol');
  });

  it('updates the background image stream', async () => {
    flushConstructorRequests();
    service.setBackgroundImage('assets/bg2.jpg');
    expect(await firstValue(service.backgroundImage$)).toBe('assets/bg2.jpg');
  });

  it('loads per-system biostats', () => {
    flushConstructorRequests();
    let result: any;
    service.getBiostats(999).subscribe(r => (result = r));
    httpMock.expectOne(r => r.url.includes('/codex/biostats?id=999')).flush({ system: { name: 'Sys', id64: 999 } });
    expect(result.system.name).toBe('Sys');
  });

  it('builds the Simbad URL with and without coordinates', () => {
    flushConstructorRequests();
    service.getSimbad(42, 'Sol').subscribe();
    httpMock.expectOne(r => r.url.includes('/simbad?') && r.url.includes('system_address=42') && !r.url.includes('&x=')).flush({});

    service.getSimbad(42, 'Sol', { x: 1, y: 2, z: 3 }).subscribe();
    httpMock.expectOne(r => r.url.includes('&x=1&y=2&z=3')).flush({});
  });

  it('fetches the Gnosis location', () => {
    flushConstructorRequests();
    let result: any;
    service.getGnosis().subscribe(r => (result = r));
    httpMock.expectOne(r => r.url.includes('/gnosis')).flush({ system: 'Varati' });
    expect(result.system).toBe('Varati');
  });

  it('exposes typeahead suggestion values', () => {
    flushConstructorRequests();
    let result: any;
    service.typeahead('Syn').subscribe(r => (result = r));
    httpMock.expectOne(r => r.url.includes('/typeahead') && r.url.includes('Syn')).flush({ values: ['Synuefe'] });
    expect(result.values).toEqual(['Synuefe']);
  });

  it('does NOT retry a 4xx client error (surfaces it immediately)', () => {
    flushConstructorRequests();
    let error: any;
    service.getBiostats(404).subscribe({ error: e => (error = e) });
    // A single request is made; the 404 is surfaced without a retry.
    httpMock.expectOne(r => r.url.includes('id=404')).flush('nope', { status: 404, statusText: 'Not Found' });
    expect(error?.status).toBe(404);
  });

  it('retries a 5xx error with backoff, then succeeds', () => {
    vi.useFakeTimers();
    try {
      flushConstructorRequests();
      let result: any;
      service.getGnosis().subscribe(r => (result = r));
      httpMock.expectOne(r => r.url.includes('/gnosis')).flush('boom', { status: 500, statusText: 'Server Error' });
      vi.advanceTimersByTime(1100); // first backoff is ~1000ms
      httpMock.expectOne(r => r.url.includes('/gnosis')).flush({ system: 'Sol' });
      expect(result.system).toBe('Sol');
    } finally {
      vi.useRealTimers();
    }
  });

  afterEach(() => httpMock.verify());
});

/** Reads the current value of a BehaviorSubject-backed observable. */
function firstValue<T>(obs: { subscribe: (fn: (v: T) => void) => { unsubscribe(): void } }): Promise<T> {
  return new Promise<T>(resolve => {
    const sub = obs.subscribe(v => {
      resolve(v);
      queueMicrotask(() => sub.unsubscribe());
    });
  });
}
