import { of } from 'rxjs';

import { HomeComponent } from './home.component';

/**
 * HomeComponent hosts a large, Material-heavy template. Rather than wire up every
 * Material module just to render it, these tests construct the component directly
 * with lightweight stubs and exercise its pure presentation helpers.
 */
describe('HomeComponent', () => {
  let component: HomeComponent;

  beforeEach(() => {
    const httpStub: any = { get: () => of('') };
    const appServiceStub: any = {
      edastroSystems: of([]),
      independentOutposts: of([]),
      codexEntries: of([]),
      getBodyDisplayName: (n: string) => n,
    };
    const activatedRouteStub: any = { queryParams: of({}) };
    const routerStub: any = { navigate: () => Promise.resolve(true) };
    const cdrStub: any = { markForCheck: () => {}, detectChanges: () => {} };

    component = new HomeComponent(httpStub, appServiceStub, activatedRouteStub, routerStub, cdrStub);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('formats RAJ2000 degrees into an h/m/s string', () => {
    expect(component.formatRAJ2000(0)).toBe('0h 00m 00.0s');
  });

  it('formats DEJ2000 degrees with a sign', () => {
    expect(component.formatDEJ2000(0)).toContain('+0°');
    expect(component.formatDEJ2000(-1).startsWith('-')).toBe(true);
  });

  it('strips a leading @ from a SIMBAD ident', () => {
    expect(component.formatSimbadId('@Sol')).toBe('Sol');
    expect(component.formatSimbadId('Sol')).toBe('Sol');
  });
});
