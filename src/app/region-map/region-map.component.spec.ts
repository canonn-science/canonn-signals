import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal, WritableSignal } from '@angular/core';

import { GnosisData, RegionMapComponent } from './region-map.component';
import { AppService } from '../app.service';

const SVG_NS = 'http://www.w3.org/2000/svg';

describe('RegionMapComponent', () => {
  let component: RegionMapComponent;
  let fixture: ComponentFixture<RegionMapComponent>;
  let fetchMock: ReturnType<typeof vi.fn>;
  let ensureGnosis: ReturnType<typeof vi.fn>;
  let gnosisData$: WritableSignal<GnosisData | null>;

  beforeEach(() => {
    // The SVG is loaded via the global fetch; return an empty SVG so loadRegionMap has
    // something to parse.
    fetchMock = vi.fn(() => Promise.resolve({ ok: true, text: () => Promise.resolve('<svg></svg>') }));
    vi.stubGlobal('fetch', fetchMock);
    gnosisData$ = signal<GnosisData | null>(null);
    // ensureGnosis resolves once gnosisData$ has been set, mirroring AppService's real
    // "fetch, then set the signal" sequencing.
    ensureGnosis = vi.fn(() => Promise.resolve());
    TestBed.configureTestingModule({
      imports: [RegionMapComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: AppService, useValue: { ensureGnosis, gnosisData: gnosisData$ } },
      ],
    });
    fixture = TestBed.createComponent(RegionMapComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Builds a standalone SVG with a couple of region paths, ready for the private DOM helpers. */
  function buildSvg(viewBox = '0 0 2048 2048'): SVGSVGElement {
    const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
    svg.setAttribute('viewBox', viewBox);
    for (const id of ['Region_07', 'Region_18']) {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('id', id);
      // jsdom doesn't implement getBBox; provide a deterministic box for the zoom maths.
      (path as any).getBBox = () => ({ x: 100, y: 200, width: 300, height: 150 });
      svg.appendChild(path);
    }
    return svg;
  }

  /** Replaces the rendered container's contents with the given SVG and returns it. */
  function mountSvg(svg: SVGSVGElement): SVGSVGElement {
    fixture.detectChanges();
    const container = (component as any).regionMapContainer().nativeElement as HTMLElement;
    container.innerHTML = '';
    container.appendChild(svg);
    return svg;
  }

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
    expect(fetchMock).toHaveBeenCalledWith('assets/region-map/RegionMap.svg');
  });

  describe('addSystemMarker', () => {
    it('places a single green system marker at the mapped coordinates', () => {
      fixture.componentRef.setInput('system', { name: 'Sol', coords: { x: 0, y: 0, z: 0 } });
      const svg = buildSvg();
      (component as any).addSystemMarker(svg);

      const markers = svg.querySelectorAll('#system-marker');
      expect(markers.length).toBe(1);
      const circle = markers[0].querySelector('circle')!;
      expect(circle.getAttribute('fill')).toBe('green');
      expect(circle.getAttribute('cx')).toBe(String((component as any).mapX(0)));
    });

    it('replaces a previous system marker rather than stacking duplicates', () => {
      fixture.componentRef.setInput('system', { name: 'Sol', coords: { x: 0, y: 0, z: 0 } });
      const svg = buildSvg();
      (component as any).addSystemMarker(svg);
      (component as any).addSystemMarker(svg);
      expect(svg.querySelectorAll('#system-marker').length).toBe(1);
    });

    it('does nothing without coordinates', () => {
      fixture.componentRef.setInput('system', { name: 'Nowhere' });
      const svg = buildSvg();
      (component as any).addSystemMarker(svg);
      expect(svg.querySelector('#system-marker')).toBeNull();
    });
  });

  describe('addKnownSystemMarkers', () => {
    it('adds the known-system markers and clears previous ones on re-run', () => {
      const svg = buildSvg();
      (component as any).addKnownSystemMarkers(svg);
      const first = svg.querySelectorAll('.known-system-marker').length;
      expect(first).toBeGreaterThan(0);
      // Re-running must not double the markers.
      (component as any).addKnownSystemMarkers(svg);
      expect(svg.querySelectorAll('.known-system-marker').length).toBe(first);
    });

    it('navigates to a known system when its marker is clicked', () => {
      const emitted: string[] = [];
      component.systemSelected.subscribe(n => emitted.push(n));
      const svg = buildSvg();
      (component as any).addKnownSystemMarkers(svg);
      const circle = svg.querySelector('.known-system-marker circle')!;
      circle.dispatchEvent(new MouseEvent('click'));
      expect(emitted.length).toBe(1);
    });

    it('adds outpost markers and navigates via galMapSearch on click', () => {
      const emitted: string[] = [];
      component.systemSelected.subscribe(n => emitted.push(n));
      fixture.componentRef.setInput('outposts', [
        { name: 'Outpost One', galMapSearch: 'PG Sys 1', coordinates: [10, 0, 20], type: 'independentOutpost' },
        { name: 'No Coords', galMapSearch: 'PG Sys 2', coordinates: [], type: 'independentOutpost' },
      ]);
      const svg = buildSvg();
      const before = svg.querySelectorAll('.known-system-marker').length;
      (component as any).addKnownSystemMarkers(svg);
      // One outpost has no coordinates and is skipped.
      const outpostCircles = svg.querySelectorAll('.known-system-marker circle');
      // Click the last marker (the outpost) — it should emit its galMapSearch name.
      (outpostCircles[outpostCircles.length - 1] as Element).dispatchEvent(new MouseEvent('click'));
      expect(emitted).toContain('PG Sys 1');
    });
  });

  describe('updateMarkerScales', () => {
    it('inversely scales markers and toggles zoom-only markers by zoom level', () => {
      const svg = buildSvg();
      // An "always" marker and a "zoomed" marker.
      const always = document.createElementNS(SVG_NS, 'g');
      always.setAttribute('class', 'known-system-marker');
      const ac = document.createElementNS(SVG_NS, 'circle');
      ac.setAttribute('cx', '100'); ac.setAttribute('cy', '200');
      always.appendChild(ac);
      svg.appendChild(always);

      const zoomed = document.createElementNS(SVG_NS, 'g');
      zoomed.setAttribute('class', 'known-system-marker');
      zoomed.setAttribute('data-zoom-level', 'zoomed');
      const zc = document.createElementNS(SVG_NS, 'circle');
      zc.setAttribute('cx', '50'); zc.setAttribute('cy', '60');
      zoomed.appendChild(zc);
      svg.appendChild(zoomed);

      (component as any).updateMarkerScales(svg, 4);
      expect(always.getAttribute('transform')).toContain('scale(0.25)');
      expect(zoomed.style.display).toBe('block'); // visible when zoomed in

      (component as any).updateMarkerScales(svg, 1);
      expect(zoomed.style.display).toBe('none'); // hidden at full view
    });
  });

  describe('highlightRegion', () => {
    it('highlights the active region and falls back gracefully when it is absent', () => {
      fixture.componentRef.setInput('system', {
        name: 'Sol', region: { name: 'Inner Orion Spur', region: 18 }, coords: { x: 0, y: 0, z: 0 },
      });
      const svg = mountSvg(buildSvg());
      (component as any).highlightRegion();

      const active = svg.querySelector('#Region_18') as HTMLElement;
      expect(active.style.fillOpacity).toBe('0.6'); // strong highlight on the active region
      expect(active.style.strokeWidth).toBe('2');
      // A non-active region keeps the faint default orange wash.
      const other = svg.querySelector('#Region_07') as HTMLElement;
      expect(other.style.fillOpacity).toBe('0.1');
      // The system marker was added as part of highlighting.
      expect(svg.querySelector('#system-marker')).not.toBeNull();
    });

    it('binds each region zoom handler exactly once across re-highlights', () => {
      fixture.componentRef.setInput('system', {
        name: 'Sol', region: { name: 'x', region: 7 }, coords: { x: 0, y: 0, z: 0 },
      });
      const svg = mountSvg(buildSvg());
      (component as any).highlightRegion();
      (component as any).highlightRegion();
      svg.querySelectorAll('path[id^="Region_"]').forEach(p => {
        expect(p.getAttribute('data-zoom-bound')).toBe('true');
      });
    });
  });

  describe('zoomToRegion + Gnosis', () => {
    it('sets a square viewBox derived from the region bounding box', () => {
      const svg = buildSvg();
      const region = svg.querySelector('#Region_07') as unknown as SVGPathElement;
      (component as any).zoomToRegion(region, svg);
      const vb = svg.getAttribute('viewBox')!.split(' ').map(Number);
      // width === height (square) and equals the larger padded dimension.
      expect(vb[2]).toBeCloseTo(vb[3], 6);
      expect(vb[2]).toBeGreaterThan(300); // padded beyond the 300px-wide bbox
    });

    it('fetches Gnosis data only for Inner Orion Spur (region 18)', () => {
      const svg = buildSvg();
      (component as any).zoomToRegion(svg.querySelector('#Region_07') as any, svg);
      expect(ensureGnosis).not.toHaveBeenCalled();
      (component as any).zoomToRegion(svg.querySelector('#Region_18') as any, svg);
      expect(ensureGnosis).toHaveBeenCalledTimes(1);
    });

    it('reads the shared AppService.gnosisData cache instead of keeping its own', async () => {
      // Region-map no longer has a private cache; caching lives solely in AppService (see
      // app.service.extra.spec.ts), so a second zoom into region 18 just re-reads the signal
      // rather than re-fetching — ensureGnosis is still called (it's a cheap cache check).
      gnosisData$.set({ system: 'Sol', coords: [0, 0, 0], desc: '' });
      const svg = buildSvg();
      (component as any).zoomToRegion(svg.querySelector('#Region_18') as any, svg);
      (component as any).zoomToRegion(svg.querySelector('#Region_18') as any, svg);
      expect(ensureGnosis).toHaveBeenCalledTimes(2);
    });
  });

  describe('addGnosisMarker', () => {
    it('adds a clickable Gnosis marker when within the region bounds', () => {
      const svg = buildSvg();
      gnosisData$.set({ system: 'Varati', coords: [-178.65625, 0, -87.125], desc: '' });
      const tx = (component as any).mapX(-178.65625);
      const ty = (component as any).mapY(-87.125);
      const bbox = { x: tx - 50, y: ty - 50, width: 100, height: 100 } as DOMRect;

      const emitted: string[] = [];
      component.systemSelected.subscribe(n => emitted.push(n));
      (component as any).addGnosisMarker(svg, bbox);

      const marker = svg.querySelector('#gnosis-marker');
      expect(marker).not.toBeNull();
      marker!.querySelector('circle')!.dispatchEvent(new MouseEvent('click'));
      expect(emitted).toEqual(['Varati']);
    });

    it('does not add the marker when Gnosis is outside the region bounds', () => {
      const svg = buildSvg();
      gnosisData$.set({ system: 'Far', coords: [0, 0, 0], desc: '' });
      const bbox = { x: 9000, y: 9000, width: 10, height: 10 } as DOMRect;
      (component as any).addGnosisMarker(svg, bbox);
      expect(svg.querySelector('#gnosis-marker')).toBeNull();
    });

    it('does nothing when the shared Gnosis data has not resolved yet', () => {
      const svg = buildSvg();
      const bbox = { x: 0, y: 0, width: 100, height: 100 } as DOMRect;
      (component as any).addGnosisMarker(svg, bbox);
      expect(svg.querySelector('#gnosis-marker')).toBeNull();
    });
  });
});
