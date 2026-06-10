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
