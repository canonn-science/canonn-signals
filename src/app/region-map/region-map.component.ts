import {
  Component, ChangeDetectionStrategy, ElementRef, Injector,
  OnChanges, afterNextRender, inject, input, output, viewChild,
} from '@angular/core';
import { AppService, IndependentOutpost } from '../app.service';
import { logger } from '../data/logger';
import { decodeHtmlEntities } from '../data/html-entities';

/** Minimal shape of the system data the region map needs. */
export interface RegionMapSystem {
  name: string;
  region?: { name: string; region: number };
  coords?: { x: number; y: number; z: number };
}

export interface GnosisData {
  arrival: string;
  coords: [number, number, number];
  departure: string;
  desc: string;
  system: string;
}

/** Galaxy-to-map transform constants for the EliteDangerousRegionMap SVG. */
const MAP_X_OFFSET = -49985;
const MAP_Z_OFFSET = -24105;
const MAP_SCALE = 83 / 4096;
const MAP_SIZE = 2048;
const FULL_VIEWBOX = `0 0 ${MAP_SIZE} ${MAP_SIZE}`;

/**
 * Renders the interactive Elite Dangerous region map: loads the SVG, highlights the
 * current system's region, and overlays the system, known-system, DSSA outpost and
 * Gnosis markers. Extracted from HomeComponent, which previously owned ~600 lines of
 * this DOM manipulation. Emits `systemSelected` when a marker is clicked.
 */
@Component({
  selector: 'app-region-map',
  template: '<div #regionMapContainer class="region-map"></div>',
  styleUrl: './region-map.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegionMapComponent implements OnChanges {
  private readonly appService = inject(AppService);
  private readonly injector = inject(Injector);

  readonly system = input<RegionMapSystem | null>(null);
  readonly outposts = input<IndependentOutpost[]>([]);
  readonly systemSelected = output<string>();

  readonly regionMapContainer = viewChild.required<ElementRef<HTMLDivElement>>('regionMapContainer');

  private gnosisData: GnosisData | null = null;
  private gnosisLastFetched = 0;
  private readonly GNOSIS_CACHE_DURATION = 3600000; // 1 hour in milliseconds
  /** Guards against issuing a second SVG fetch while the first is still in flight. */
  private svgLoading = false;

  public ngOnChanges(): void {
    // Render after the view has updated so the container element is available.
    afterNextRender(() => this.loadRegionMap(), { injector: this.injector });
  }

  private mapX(galacticX: number): number {
    return (galacticX - MAP_X_OFFSET) * MAP_SCALE;
  }

  private mapY(galacticZ: number): number {
    return MAP_SIZE - (galacticZ - MAP_Z_OFFSET) * MAP_SCALE;
  }

  private selectSystem(systemName: string): void {
    this.systemSelected.emit(systemName);
  }

  private async loadRegionMap(): Promise<void> {
    const regionMapContainer = this.regionMapContainer();
    if (!regionMapContainer || !this.system()) {
      return;
    }

    // Check if SVG already exists
    const existingSvg = regionMapContainer.nativeElement.querySelector('svg');
    if (existingSvg) {
      // SVG already loaded, just update the highlighting and marker
      this.highlightRegion();
      return;
    }

    // A fetch is already in flight; its completion re-highlights with the latest
    // inputs, so don't issue a duplicate request (which would re-inject the SVG and
    // stack duplicate listeners/markers).
    if (this.svgLoading) {
      return;
    }
    this.svgLoading = true;

    // Load the SVG from the assets folder
    let svgContent: string;
    try {
      const response = await fetch('assets/region-map/RegionMap.svg');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      svgContent = await response.text();
    } catch (error) {
      this.svgLoading = false;
      logger.error('Error loading region map:', error);
      return;
    }

    this.svgLoading = false;
    const regionMapContainerValue = this.regionMapContainer();
    if (!regionMapContainerValue || !regionMapContainerValue.nativeElement) {
      return;
    }

    // Inject and decorate the SVG. Wrapped so a DOM/parse failure is logged rather than
    // escaping this async (afterNextRender) callback as an unhandled promise rejection.
    try {
      // Trusted content: a static SVG bundled in the app's own assets. This
      // assignment is NOT Angular-sanitized, so it must never be sourced from a
      // remote/user-controlled location without sanitizing first.
      regionMapContainerValue.nativeElement.innerHTML = svgContent;

      // Remove explicit width and height attributes from SVG
      const svgElement = regionMapContainerValue.nativeElement.querySelector('svg');
      if (svgElement) {
        svgElement.removeAttribute('width');
        svgElement.removeAttribute('height');
        svgElement.style.width = '100%';
        svgElement.style.height = 'auto';
        svgElement.style.borderRadius = '8px';

        // Add click handler to reset zoom
        svgElement.addEventListener('click', (event) => {
          const currentViewBox = svgElement.getAttribute('viewBox');
          // If we're zoomed in, any click resets to full view
          if (currentViewBox !== FULL_VIEWBOX) {
            event.stopPropagation();
            svgElement.setAttribute('viewBox', FULL_VIEWBOX);
            this.updateMarkerScales(svgElement, 1);
          }
        });
      }

      this.highlightRegion();
    } catch (error) {
      logger.error('Error rendering region map:', error);
    }
  }

  private highlightRegion(): void {
    const regionMapContainer = this.regionMapContainer();
    const system = this.system();
    if (!regionMapContainer || !system || !system.region) {
      return;
    }

    const svgElement = regionMapContainer.nativeElement.querySelector('svg');
    if (!svgElement) {
      return;
    }

    // Add custom styles to override hover and hide text
    let styleElement = svgElement.querySelector('style#custom-region-styles');
    if (!styleElement) {
      styleElement = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      styleElement.id = 'custom-region-styles';
      styleElement.textContent = `
        .regionText { display: none !important; }
        .region { pointer-events: auto !important; cursor: pointer !important; }
      `;
      svgElement.insertBefore(styleElement, svgElement.firstChild);
    }

    // Reset all regions to default style and add click handlers
    const allRegions = svgElement.querySelectorAll('path[id^="Region_"]');
    allRegions.forEach(region => {
      (region as HTMLElement).style.fill = 'darkorange';
      (region as HTMLElement).style.fillOpacity = '0.1';
      (region as HTMLElement).style.stroke = 'orange';
      (region as HTMLElement).style.strokeOpacity = '1';
      (region as HTMLElement).style.strokeWidth = '';

      // Add click handler for zooming exactly once per region. The SVG is loaded
      // once and reused across searches, so without this guard each search would
      // stack another duplicate listener on every region path.
      if (!region.hasAttribute('data-zoom-bound')) {
        region.setAttribute('data-zoom-bound', 'true');
        region.addEventListener('click', (event) => {
          const currentViewBox = svgElement.getAttribute('viewBox');
          // Only zoom in if we're not already zoomed
          if (currentViewBox === FULL_VIEWBOX) {
            event.stopPropagation();
            this.zoomToRegion(region as SVGPathElement, svgElement);
          }
        });
      }
    });

    // Highlight the current region
    const regionId = `Region_${String(system.region.region).padStart(2, '0')}`;
    const regionElement = svgElement.querySelector(`#${regionId}`);
    if (regionElement) {
      (regionElement as HTMLElement).style.fill = '#ff9900';
      (regionElement as HTMLElement).style.fillOpacity = '0.6';
      (regionElement as HTMLElement).style.stroke = '#ff9900';
      (regionElement as HTMLElement).style.strokeOpacity = '1';
      (regionElement as HTMLElement).style.strokeWidth = '2';
    } else {
      logger.warn('Region element not found for ID:', regionId);
    }

    // Add red dot at system coordinates
    this.addSystemMarker(svgElement);

    // Add known systems markers
    this.addKnownSystemMarkers(svgElement);
  }

  private zoomToRegion(regionPath: SVGPathElement, svgElement: SVGSVGElement): void {
    // Get the bounding box of the region
    const bbox = regionPath.getBBox();

    // Add minimal padding (2% on each side)
    const padding = Math.max(bbox.width, bbox.height) * 0.02;

    // Calculate dimensions with padding
    const paddedWidth = bbox.width + (padding * 2);
    const paddedHeight = bbox.height + (padding * 2);

    // Use the larger dimension to create a square viewBox
    // This ensures the region touches the edges on its larger axis
    const size = Math.max(paddedWidth, paddedHeight);

    // Center the region in the square viewBox
    const x = bbox.x - padding + (paddedWidth - size) / 2;
    const y = bbox.y - padding + (paddedHeight - size) / 2;

    // Set the viewBox to a square zoom
    svgElement.setAttribute('viewBox', `${x} ${y} ${size} ${size}`);

    // Get region ID from the path element
    const regionId = regionPath.id; // e.g., "Region_01"
    const regionNumber = regionId ? parseInt(regionId.replace('Region_', ''), 10) : 0;

    // Calculate scale factor for markers
    const scaleFactor = MAP_SIZE / size;

    // Fetch Gnosis data and add marker only if region is Inner Orion Spur (region 18)
    if (regionNumber === 18) {
      this.fetchGnosisData()
        .then(gnosisData => {
          if (gnosisData) {
            this.addGnosisMarker(svgElement, bbox);
            // Scale the Gnosis marker after it's added
            setTimeout(() => {
              this.updateMarkerScales(svgElement, scaleFactor);
            }, 50);
          }
        })
        .catch(error => logger.error('Error fetching Gnosis data:', error));
    }

    // Update marker scales immediately and again after a short delay
    // to ensure all markers are scaled correctly
    this.updateMarkerScales(svgElement, scaleFactor);
    setTimeout(() => {
      this.updateMarkerScales(svgElement, scaleFactor);
    }, 50);
  }

  private updateMarkerScales(svgElement: SVGSVGElement, scaleFactor: number): void {
    // Update all marker groups to scale inversely with zoom
    const markers = svgElement.querySelectorAll('.known-system-marker, #system-marker');
    markers.forEach(marker => {
      const circle = marker.querySelector('circle');
      if (circle) {
        const cx = parseFloat(circle.getAttribute('cx') || '0');
        const cy = parseFloat(circle.getAttribute('cy') || '0');
        (marker as SVGGElement).setAttribute('transform', `translate(${cx}, ${cy}) scale(${1 / scaleFactor}) translate(${-cx}, ${-cy})`);
      }

      // Show/hide markers based on zoom level
      const zoomLevel = marker.getAttribute('data-zoom-level');
      if (zoomLevel === 'zoomed') {
        // Show zoom-only markers when zoomed in (scaleFactor > 1)
        (marker as HTMLElement).style.display = scaleFactor > 1 ? 'block' : 'none';
      }
    });
  }

  private addKnownSystemMarkers(svgElement: SVGSVGElement): void {
    // Remove markers from a previous search before re-adding. The SVG is loaded
    // once and reused, so without this every search would append another full set
    // of duplicate marker groups (and their listeners), leaking nodes over time.
    svgElement.querySelectorAll('.known-system-marker').forEach(marker => marker.remove());

    // Get current viewBox to determine zoom level
    const viewBox = svgElement.getAttribute('viewBox');
    const viewBoxValues = viewBox ? viewBox.split(' ').map(parseFloat) : [0, 0, MAP_SIZE, MAP_SIZE];
    const viewBoxSize = Math.max(viewBoxValues[2], viewBoxValues[3]);
    const currentScaleFactor = MAP_SIZE / viewBoxSize;

    const knownSystems = [
      { name: 'Varati', systemName: 'Varati', x: -178.65625, y: 77.12500, z: -87.12500, zoomLevel: 'always' },
      { name: 'Canonnia', systemName: 'Canonnia', x: -9522.93750, y: -894.06250, z: 19791.87500, zoomLevel: 'always' },
      { name: 'Hotel Canonnia', systemName: 'Prua Phoe MI-B b17-5', x: -5652.84375, y: -561.06250, z: 10815.34375, zoomLevel: 'always' },
      { name: 'Miskatonic University', systemName: 'Byae Aowsy GR-N d6-52', x: 14407.6, y: 17.5, z: 44312.6, zoomLevel: 'always' },
      { name: 'Col 70 Sector FY-N C21-3', systemName: 'Col 70 Sector FY-N C21-3', x: 275.34375, y: -371.34375, z: -680.96875, zoomLevel: 'zoomed' },
      { name: "Explorer's Anchorage", systemName: 'Stuemeae FG-Y d7561', x: 28.68750, y: -19.78125, z: 25899.68750, zoomLevel: 'zoomed' }
    ];

    knownSystems.forEach(system => {
      const tx = this.mapX(system.x);
      const finalY = this.mapY(system.z);

      // Create a group for the marker and label
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('class', 'known-system-marker');

      // Create a blue circle marker
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', tx.toString());
      circle.setAttribute('cy', finalY.toString());
      circle.setAttribute('r', '12');
      circle.setAttribute('fill', 'blue');
      circle.setAttribute('stroke', 'white');
      circle.setAttribute('stroke-width', '1.5');
      circle.setAttribute('opacity', '0.9');
      circle.style.cursor = 'pointer';

      // Add click handler to navigate to system
      circle.addEventListener('click', () => this.selectSystem(system.systemName));

      // Check viewBox to determine if we should position tooltip on left
      // When zoomed, use viewBox bounds instead of full map coordinates
      const viewBoxCenterX = viewBoxValues[0] + (viewBoxValues[2] / 2);
      const isRightSide = tx > viewBoxCenterX;
      const textX = isRightSide ? tx - 20 : tx + 20;

      // Create tooltip text element (initially hidden)
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', textX.toString());
      text.setAttribute('y', (finalY - 10).toString());
      text.setAttribute('fill', 'white');
      text.setAttribute('font-size', '80');
      text.setAttribute('font-weight', 'bold');
      text.setAttribute('pointer-events', 'none');
      text.setAttribute('text-anchor', isRightSide ? 'end' : 'start');
      text.style.display = 'none';
      text.textContent = system.name;

      // Create background rect for text
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('fill', 'rgba(0, 0, 0, 0.8)');
      rect.setAttribute('rx', '10');
      rect.setAttribute('pointer-events', 'none');
      rect.style.display = 'none';

      // Add hover events
      circle.addEventListener('mouseenter', () => {
        // Show the text first: getBBox() returns a zero rect (Chromium) or throws
        // (Firefox) for a display:none element, so it must be measured while visible.
        text.style.display = 'block';
        rect.style.display = 'block';
        // Update rect size based on text
        const bbox = text.getBBox();
        rect.setAttribute('x', (bbox.x - 4).toString());
        rect.setAttribute('y', (bbox.y - 2).toString());
        rect.setAttribute('width', (bbox.width + 8).toString());
        rect.setAttribute('height', (bbox.height + 4).toString());
      });

      circle.addEventListener('mouseleave', () => {
        rect.style.display = 'none';
        text.style.display = 'none';
      });

      // Add elements to group
      group.appendChild(circle);
      group.appendChild(rect);
      group.appendChild(text);

      // Set visibility based on zoom level
      if (system.zoomLevel === 'zoomed') {
        group.style.display = currentScaleFactor > 1 ? 'block' : 'none';
        group.setAttribute('data-zoom-level', 'zoomed');
      } else {
        group.setAttribute('data-zoom-level', 'always');
      }

      // Apply current scale immediately
      if (currentScaleFactor !== 1) {
        group.setAttribute('transform', `translate(${tx}, ${finalY}) scale(${1 / currentScaleFactor}) translate(${-tx}, ${-finalY})`);
      }

      // Add the group to the SVG
      svgElement.appendChild(group);
    });

    // Add independentOutpost markers as blue dots when zoomed in
    this.outposts().forEach(outpost => {
      if (!outpost.coordinates || outpost.coordinates.length < 3) {
        return; // Skip if coordinates are missing
      }

      const [x, , z] = outpost.coordinates;
      const tx = this.mapX(x);
      const finalY = this.mapY(z);

      // Create a group for the marker and label
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('class', 'known-system-marker');

      // Create a blue circle marker
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', tx.toString());
      circle.setAttribute('cy', finalY.toString());
      circle.setAttribute('r', '12');
      circle.setAttribute('fill', 'blue');
      circle.setAttribute('stroke', 'white');
      circle.setAttribute('stroke-width', '1.5');
      circle.setAttribute('opacity', '0.9');
      circle.style.cursor = 'pointer';

      // Add click handler to navigate to system
      circle.addEventListener('click', () => this.selectSystem(outpost.galMapSearch));

      // Check viewBox to determine tooltip position based on distance from edges
      const viewBoxLeft = viewBoxValues[0];
      const viewBoxRight = viewBoxValues[0] + viewBoxValues[2];
      const distanceFromLeft = tx - viewBoxLeft;
      const distanceFromRight = viewBoxRight - tx;
      const isRightSide = distanceFromLeft > distanceFromRight;
      const textX = isRightSide ? tx - 15 : tx + 15;

      // Create tooltip text element (initially hidden)
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', textX.toString());
      text.setAttribute('y', (finalY - 8).toString());
      text.setAttribute('fill', 'white');
      text.setAttribute('font-size', '60');
      text.setAttribute('font-weight', 'bold');
      text.setAttribute('pointer-events', 'none');
      text.setAttribute('text-anchor', isRightSide ? 'end' : 'start');
      text.style.display = 'none';
      text.textContent = decodeHtmlEntities(outpost.name);

      // Create background rect for text
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('fill', 'rgba(0, 0, 0, 0.8)');
      rect.setAttribute('rx', '8');
      rect.setAttribute('pointer-events', 'none');
      rect.style.display = 'none';

      // Add hover events
      circle.addEventListener('mouseenter', () => {
        // Show the text first: getBBox() returns a zero rect (Chromium) or throws
        // (Firefox) for a display:none element, so it must be measured while visible.
        text.style.display = 'block';
        rect.style.display = 'block';
        const bbox = text.getBBox();
        rect.setAttribute('x', (bbox.x - 3).toString());
        rect.setAttribute('y', (bbox.y - 1).toString());
        rect.setAttribute('width', (bbox.width + 6).toString());
        rect.setAttribute('height', (bbox.height + 2).toString());
      });

      circle.addEventListener('mouseleave', () => {
        rect.style.display = 'none';
        text.style.display = 'none';
      });

      // Add elements to group
      group.appendChild(circle);
      group.appendChild(rect);
      group.appendChild(text);

      // Set visibility - only show when zoomed in
      group.style.display = currentScaleFactor > 1 ? 'block' : 'none';
      group.setAttribute('data-zoom-level', 'zoomed');

      // Apply current scale immediately
      if (currentScaleFactor !== 1) {
        group.setAttribute('transform', `translate(${tx}, ${finalY}) scale(${1 / currentScaleFactor}) translate(${-tx}, ${-finalY})`);
      }

      // Add the group to the SVG
      svgElement.appendChild(group);
    });
  }

  private async fetchGnosisData(): Promise<GnosisData | null> {
    // Check if we have cached data and if it's still fresh
    const now = Date.now();

    if (this.gnosisData && (now - this.gnosisLastFetched) < this.GNOSIS_CACHE_DURATION) {
      return this.gnosisData;
    }

    // Fetch fresh data
    const data = await this.appService.getGnosis();
    this.gnosisData = data;
    this.gnosisLastFetched = now;
    return data;
  }

  private addGnosisMarker(svgElement: SVGSVGElement, regionBbox: DOMRect): void {
    if (!this.gnosisData) {
      return;
    }

    // Remove existing Gnosis marker if any
    const existingMarker = svgElement.querySelector('#gnosis-marker');
    if (existingMarker) {
      existingMarker.remove();
    }

    // Get current viewBox to determine zoom level
    const viewBox = svgElement.getAttribute('viewBox');
    const viewBoxValues = viewBox ? viewBox.split(' ').map(parseFloat) : [0, 0, MAP_SIZE, MAP_SIZE];
    const viewBoxSize = Math.max(viewBoxValues[2], viewBoxValues[3]);
    const currentScaleFactor = MAP_SIZE / viewBoxSize;

    const [x, , z] = this.gnosisData.coords;
    const tx = this.mapX(x);
    const finalY = this.mapY(z);

    // Check if Gnosis is within the region bounds
    const inBounds = !(tx < regionBbox.x || tx > regionBbox.x + regionBbox.width ||
      finalY < regionBbox.y || finalY > regionBbox.y + regionBbox.height);

    if (!inBounds) {
      // Gnosis is not in this region, don't display it
      return;
    }

    // Create a group for the marker
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('id', 'gnosis-marker');
    group.setAttribute('class', 'known-system-marker');
    group.setAttribute('data-zoom-level', 'zoomed');

    // Create a blue circle marker
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', tx.toString());
    circle.setAttribute('cy', finalY.toString());
    circle.setAttribute('r', '12');
    circle.setAttribute('fill', 'blue');
    circle.setAttribute('stroke', 'white');
    circle.setAttribute('stroke-width', '1.5');
    circle.setAttribute('opacity', '0.9');
    circle.style.cursor = 'pointer';

    // Add click handler to navigate to system
    circle.addEventListener('click', () => this.selectSystem(this.gnosisData!.system));

    // Position tooltip - use more conservative positioning for long text
    // Check if we're in the right 60% of the map (not just right half)
    const isRightSide = tx > 819; // 2048 * 0.4 = 819
    const textX = isRightSide ? tx - 20 : tx + 20;

    // Create tooltip text element
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', textX.toString());
    text.setAttribute('y', (finalY - 10).toString());
    text.setAttribute('fill', 'white');
    text.setAttribute('font-size', '80');
    text.setAttribute('font-weight', 'bold');
    text.setAttribute('pointer-events', 'none');
    text.setAttribute('text-anchor', isRightSide ? 'end' : 'start');
    text.style.display = 'none';
    text.textContent = `The Gnosis (${this.gnosisData.system})`;

    // Create background rect for text
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('fill', 'rgba(0, 0, 0, 0.8)');
    rect.setAttribute('rx', '10');
    rect.setAttribute('pointer-events', 'none');
    rect.style.display = 'none';

    // Add hover events
    circle.addEventListener('mouseenter', () => {
      // Show the text first: getBBox() returns a zero rect (Chromium) or throws
      // (Firefox) for a display:none element, so it must be measured while visible.
      text.style.display = 'block';
      rect.style.display = 'block';
      const bbox = text.getBBox();
      rect.setAttribute('x', (bbox.x - 4).toString());
      rect.setAttribute('y', (bbox.y - 2).toString());
      rect.setAttribute('width', (bbox.width + 8).toString());
      rect.setAttribute('height', (bbox.height + 4).toString());
    });

    circle.addEventListener('mouseleave', () => {
      rect.style.display = 'none';
      text.style.display = 'none';
    });

    // Add elements to group
    group.appendChild(circle);
    group.appendChild(rect);
    group.appendChild(text);

    // Apply current scale immediately if zoomed
    if (currentScaleFactor !== 1) {
      group.setAttribute('transform', `translate(${tx}, ${finalY}) scale(${1 / currentScaleFactor}) translate(${-tx}, ${-finalY})`);
    }

    // Add the group to the SVG
    svgElement.appendChild(group);
  }

  private addSystemMarker(svgElement: SVGSVGElement): void {
    const coords = this.system()?.coords;
    if (!coords) {
      return;
    }

    // Remove any existing system marker
    const existingMarker = svgElement.querySelector('#system-marker');
    if (existingMarker) {
      existingMarker.remove();
    }

    // The region map uses X and Z galactic coordinates (X horizontal, Z vertical).
    const tx = this.mapX(coords.x);
    const finalY = this.mapY(coords.z);

    // Match the inverse-zoom scaling every other marker uses, so the green marker
    // keeps a constant on-screen size when this runs while the map is already zoomed
    // (e.g. searching a new system without first resetting the viewBox).
    const viewBox = svgElement.getAttribute('viewBox');
    const viewBoxValues = viewBox ? viewBox.split(' ').map(parseFloat) : [0, 0, MAP_SIZE, MAP_SIZE];
    const viewBoxSize = Math.max(viewBoxValues[2], viewBoxValues[3]);
    const currentScaleFactor = MAP_SIZE / viewBoxSize;

    // Create a group for the marker
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('id', 'system-marker');

    // Create a larger, more visible green circle marker with glow effect
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', tx.toString());
    circle.setAttribute('cy', finalY.toString());
    circle.setAttribute('r', '24');
    circle.setAttribute('fill', 'green');
    circle.setAttribute('stroke', 'white');
    circle.setAttribute('stroke-width', '6');
    circle.setAttribute('opacity', '1');
    circle.setAttribute('filter', 'drop-shadow(0 0 16px rgba(0, 255, 0, 0.8))');

    group.appendChild(circle);

    // Apply current scale immediately if zoomed (mirrors addKnownSystemMarkers).
    if (currentScaleFactor !== 1) {
      group.setAttribute('transform', `translate(${tx}, ${finalY}) scale(${1 / currentScaleFactor}) translate(${-tx}, ${-finalY})`);
    }

    // Add the marker group to the SVG, but before any known-system-marker elements
    // This ensures blue dots (known systems) are always on top
    const firstBlueMarker = svgElement.querySelector('.known-system-marker');
    if (firstBlueMarker) {
      svgElement.insertBefore(group, firstBlueMarker);
    } else {
      svgElement.appendChild(group);
    }
  }
}
