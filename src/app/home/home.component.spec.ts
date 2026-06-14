import { of } from 'rxjs';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, provideZonelessChangeDetection, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';

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
        { provide: HttpClient, useValue: { get: () => of('') } },
        {
          provide: AppService,
          useValue: {
            edastroSystems: signal([]),
            independentOutposts: signal([]),
            codexEntries: signal([]),
            getBodyDisplayName: (n: string) => n,
            getEdastroData: () => of(null),
            setBackgroundImage: () => {},
            getSimbad: () => of({ name: '', system_address: 0 }),
            getBiostats: () => of(null),
            typeahead: () => of({}),
            galMapSearch: () => of({ min_max: [] }),
          },
        },
        { provide: ActivatedRoute, useValue: { queryParams: of({}) } },
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
});
