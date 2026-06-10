import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';

import { RegionMapComponent } from './region-map.component';

describe('RegionMapComponent', () => {
  let component: RegionMapComponent;
  let fixture: ComponentFixture<RegionMapComponent>;
  let httpGet: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    httpGet = vi.fn(() => of('<svg></svg>'));
    TestBed.configureTestingModule({
      imports: [RegionMapComponent],
      providers: [
        provideZonelessChangeDetection(),
        // Return an empty SVG document so loadRegionMap has something to parse.
        { provide: HttpClient, useValue: { get: httpGet } },
      ],
    });
    fixture = TestBed.createComponent(RegionMapComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('emits the system name when selectSystem is invoked', () => {
    const emitted: string[] = [];
    component.systemSelected.subscribe(name => emitted.push(name));
    (component as any).selectSystem('Sol');
    expect(emitted).toEqual(['Sol']);
  });

  it('maps galactic X/Z coordinates into the SVG viewBox space', () => {
    // Sol is at the galactic origin; check the documented transform constants.
    const tx = (component as any).mapX(0);
    const ty = (component as any).mapY(0);
    expect(tx).toBeCloseTo((0 - -49985) * (83 / 4096), 3);
    expect(ty).toBeCloseTo(2048 - (0 - -24105) * (83 / 4096), 3);
  });

  it('loads the region-map SVG when the system input is set', async () => {
    // Guards the refactor: setting the signal input must drive ngOnChanges →
    // afterNextRender → loadRegionMap so the map renders for a searched system.
    fixture.componentRef.setInput('system', {
      name: 'Sol',
      region: { name: 'Inner Orion Spur', region: 18 },
      coords: { x: 0, y: 0, z: 0 },
    });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(httpGet).toHaveBeenCalledWith('assets/region-map/RegionMap.svg', { responseType: 'text' });
  });
});
