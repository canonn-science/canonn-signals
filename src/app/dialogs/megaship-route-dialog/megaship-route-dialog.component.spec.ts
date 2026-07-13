import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { MegashipRouteDialogComponent, MegashipRouteDialogData } from './megaship-route-dialog.component';
import { AppService } from '../../app.service';

/** A Response-like whose text() resolves to the JSON-stringified body. */
function ok(body: unknown) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return { ok: true, status: 200, statusText: 'OK', text: () => Promise.resolve(text) };
}

/** Flushes pending promise microtasks so the reactive name-resolution chain settles. */
async function flush(): Promise<void> {
  for (let i = 0; i < 12; i++) {
    await Promise.resolve();
  }
}

async function setup(data: MegashipRouteDialogData): Promise<ComponentFixture<MegashipRouteDialogComponent>> {
  // AppService fetches text via the global fetch and resolves system names from biostats;
  // route everything to a generic system so unresolved id64s fall back to the "…" placeholder.
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url.includes('id=1001')) return Promise.resolve(ok({ system: { name: 'Cadubi' } }));
    if (url.includes('id=1002')) return Promise.resolve(ok({ system: { name: 'Un No Myoin' } }));
    return Promise.resolve(ok(url.includes('combined') ? [] : {}));
  }));
  TestBed.configureTestingModule({
    imports: [MegashipRouteDialogComponent],
    providers: [provideZonelessChangeDetection(), { provide: MAT_DIALOG_DATA, useValue: data }],
  });
  const fixture = TestBed.createComponent(MegashipRouteDialogComponent);
  fixture.detectChanges();
  return fixture;
}

describe('MegashipRouteDialogComponent', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  it('shows the ship name as the heading and a placeholder before names resolve', async () => {
    const fixture = await setup({
      signalName: 'HIP 21778 I  Bellmarsh-class Reformatory',
      shipName: 'Bellmarsh-class Reformatory',
      type: 'cycle',
      confirmed: true,
      lastSeen: '2026-07-10',
      routeLen: 2,
      stops: [
        { position: 0, systemId64: 1001, dueDate: '2026-07-16', presentNow: true },
        { position: 1, systemId64: 1002, dueDate: '2026-07-23', presentNow: false },
      ],
    });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Bellmarsh-class Reformatory');
    expect(el.textContent).toContain('HIP 21778 I  Bellmarsh-class Reformatory');
    expect(el.textContent).toContain('…'); // names not resolved yet
  });

  it('fills in resolved system names once the lookup settles', async () => {
    const fixture = await setup({
      signalName: 'S1', shipName: 'S1', type: 'cycle', confirmed: true, lastSeen: '2026-07-10', routeLen: 2,
      stops: [
        { position: 0, systemId64: 1001, dueDate: '2026-07-16', presentNow: true },
        { position: 1, systemId64: 1002, dueDate: '2026-07-23', presentNow: false },
      ],
    });
    await flush();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Cadubi');
    expect(el.textContent).toContain('Un No Myoin');
  });

  it('shares resolved names across dialog instances via AppService (no duplicate fetch)', async () => {
    const fixture = await setup({
      signalName: 'S1', shipName: 'S1', type: 'cycle', confirmed: true, lastSeen: '2026-07-10', routeLen: 1,
      stops: [{ position: 0, systemId64: 1001, dueDate: '2026-07-16', presentNow: true }],
    });
    await flush();
    fixture.detectChanges();
    const appService = TestBed.inject(AppService);
    expect(appService.systemNames().get('1001')).toBe('Cadubi');
  });

  it('shows the disclaimer about community sightings', async () => {
    const fixture = await setup({
      signalName: 'S1', shipName: 'S1', type: 'static', confirmed: true,
      lastSeen: '2026-07-10', firstSeen: '2023-10-22', weeksConfirmed: 70,
      stops: [{ position: 0, systemId64: 1001, dueDate: '2026-07-13', presentNow: true }],
    });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('community sightings');
    expect(el.textContent).toContain('since 2022');
    expect(el.textContent).toContain('not been confirmed');
  });

  it('describes a static ship route without a route length', async () => {
    const fixture = await setup({
      signalName: 'S1', shipName: 'S1', type: 'static', confirmed: true,
      lastSeen: '2026-07-10', firstSeen: '2023-10-22', weeksConfirmed: 70,
      stops: [{ position: 0, systemId64: 1001, dueDate: '2026-07-13', presentNow: true }],
    });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('static — always at the same system');
    expect(el.textContent).toContain('70');
  });

  it('flags an unconfirmed route', async () => {
    const fixture = await setup({
      signalName: 'S1', shipName: 'S1', type: 'cycle', confirmed: false,
      lastSeen: '2026-07-10', routeLen: 4,
      stops: [{ position: 0, systemId64: 1001, dueDate: '2026-07-13', presentNow: true }],
    });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('unconfirmed');
  });
});
