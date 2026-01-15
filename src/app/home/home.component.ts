import { HttpClient } from '@angular/common/http';
import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { AppService, EdastroData, EdastroSystem, IndependentOutpost, BodyNameOverride } from '../app.service';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { animate, style, transition, trigger } from '@angular/animations';
import { faFileCode } from '@fortawesome/free-solid-svg-icons';
import { environment } from 'src/environments/environment';
import { Observable, of, debounceTime, distinctUntilChanged, switchMap, combineLatest } from 'rxjs';
import { FormControl } from '@angular/forms';

@UntilDestroy()
@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  animations: [
    trigger('visibilityTrigger', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('400ms', style({ opacity: "1" })),
      ]),
      transition(':leave', [
        animate('200ms', style({ opacity: 0 }))
      ])
    ]),
  ]
})
export class HomeComponent implements OnInit, AfterViewInit {
  openSimbadPageRaw(ident: string) {
    if (!ident) return;
    window.open(`https://simbad.u-strasbg.fr/simbad/sim-id?Ident=${encodeURIComponent(ident)}`, '_blank');
  }
  openSimbadPage(ident: string) {
    if (!ident) return;
    const id = this.formatSimbadId(ident);
    window.open(`https://simbad.u-strasbg.fr/simbad/sim-id?Ident=${encodeURIComponent(id)}`, '_blank');
  }

  // Format RAJ2000 (degrees) to '19h 21m 45.0s' (rounded to 0.1s, padded)
  formatRAJ2000(ra: number): string {
    if (typeof ra !== 'number' || isNaN(ra)) return '';
    const totalSeconds = ra * 240; // 360deg = 24h, so 1deg = 240s
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = (totalSeconds % 60);
    // Pad minutes and seconds to 2 digits, seconds to 1 decimal
    const pad = (n: number, d = 2) => n.toString().padStart(d, '0');
    return `${hours}h ${pad(minutes)}m ${seconds.toFixed(1).padStart(4, '0')}s`;
  }

  // Format DEJ2000 (degrees) to '+21° 53′ 02.3″' (rounded to 0.1″, padded)
  formatDEJ2000(de: number): string {
    if (typeof de !== 'number' || isNaN(de)) return '';
    const sign = de >= 0 ? '+' : '-';
    const abs = Math.abs(de);
    const degrees = Math.floor(abs);
    const arcminutes = Math.floor((abs - degrees) * 60);
    const arcseconds = ((abs - degrees - arcminutes / 60) * 3600);
    // Pad arcminutes and arcseconds
    const pad = (n: number, d = 2) => n.toString().padStart(d, '0');
    return `${sign}${degrees}° ${pad(arcminutes)}′ ${arcseconds.toFixed(1).padStart(4, '0')}″`;
  }

  // Remove leading @ from Ident for SIMBAD ID
  formatSimbadId(ident: string): string {
    return ident ? ident.replace(/^@/, '') : '';
  }
  public edGalaxyData: any = null;

  fetchEdGalaxyData(systemName: string, id64: number) {
    const url = `https://edgalaxydata.space/eddn-lookup/systems.php?systemName=${encodeURIComponent(systemName)}&systemId64=${id64}&includeRejected=false&brief=true`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        this.edGalaxyData = Array.isArray(data) && data.length > 0 ? data[0] : null;
      })
      .catch(() => { this.edGalaxyData = null; });
  }

  ngOnChanges(): void {
    this.updateEdGalaxyData();
  }

  ngDoCheck(): void {
    this.updateEdGalaxyData();
  }

  updateEdGalaxyData() {
    if (this.data?.system?.name && this.data?.system?.id64) {
      if (!this.edGalaxyData || this.edGalaxyData.Name !== this.data.system.name || this.edGalaxyData.SystemAddress !== this.data.system.id64) {
        this.fetchEdGalaxyData(this.data.system.name, this.data.system.id64);
      }
    }
  }
  openSignalsPage(systemName: string) {
    const url = `/signals?system=${encodeURIComponent(systemName)}`;
    window.open(url, '_blank');
  }
  referenceSystems = [
    { name: 'Sol', coords: { x: 0, y: 0, z: 0 } },
    { name: 'Colonia', coords: { x: -9530.5, y: -910.28125, z: 19808.125 } },
    { name: 'Merope', coords: { x: -78.59375, y: -149.625, z: -340.53125 } },
    { name: 'Varati', coords: { x: -178.65625, y: 77.125, z: -87.125 } },
    { name: 'Col 70 Sector FY-N C21-3', coords: { x: 687.0625, y: -362.53125, z: -697.0625 } }
  ];

  getSystemDistances(): { name: string, distance: number }[] {
    if (!this.data?.system?.coords) return [];
    const { x, y, z } = this.data.system.coords;
    const currentName = (this.data.system.name || '').toLowerCase();
    return this.referenceSystems
      .filter(ref => ref.name.toLowerCase() !== currentName)
      .map(ref => {
        const dx = x - ref.coords.x;
        const dy = y - ref.coords.y;
        const dz = z - ref.coords.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        return { name: ref.name, distance: dist };
      })
      .sort((a, b) => a.distance - b.distance);
  }
  copyCoordinatesToClipboard(separator?: 'comma' | 'tab' | 'pipe', event?: MouseEvent) {
    if (event) {
      event.preventDefault();
    }
    if (!this.data?.system?.coords) return;
    const coords = this.data.system.coords;
    let sep = ',';
    if (separator === 'tab') sep = '\t';
    if (separator === 'pipe') sep = '|';
    const text = `${coords.x}${sep}${coords.y}${sep}${coords.z}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  }

  onCoordinatesMouseDown(event: MouseEvent) {
    // Middle click (button 1)
    if (event.button === 1) {
      event.preventDefault();
      this.copyCoordinatesToClipboard('pipe');
    }
  }
  copyId64ToClipboard() {
    if (!this.data?.system?.id64) return;
    const text = `${this.data.system.id64}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  }
  public encodeURIComponent(value: string): string {
    return encodeURIComponent(value);
  }
  public readonly faFileCode = faFileCode;
  public searching = false;
  public searchInput: string = "";
  public searchError = false;
  public searchErrorMessage: string = "";
  public data: CanonnBiostats | null = null;
  public bodies: SystemBody[] = [];
  public searchControl = new FormControl('');
  public filteredSystems: Observable<string[]> = of([]);
  public edastroData: EdastroData | null = null;
  private systemMapping: Map<string, { systemName?: string, id64?: number }> = new Map();
  private gnosisData: GnosisData | null = null;
  private gnosisLastFetched: number = 0;
  private readonly GNOSIS_CACHE_DURATION = 3600000; // 1 hour in milliseconds
  private independentOutposts: IndependentOutpost[] = [];
  @ViewChild('regionMapContainer') regionMapContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('gecImage') gecImage?: ElementRef<HTMLImageElement>;
  @ViewChild('gecContainer') gecContainer?: ElementRef<HTMLDivElement>;

  public constructor(private readonly httpClient: HttpClient,
    private readonly appService: AppService,
    private readonly router: Router,
    private readonly activatedRoute: ActivatedRoute
  ) {
  }

  public ngOnInit(): void {
    this.activatedRoute.queryParams
      .pipe(untilDestroyed(this))
      .subscribe(q => {
        if (this.searching) {
          return;
        }
        if (q["system"] && (!this.bodies || this.data?.system.name != q["system"])) {
          this.searchInput = q["system"];
          this.searchControl.setValue(q["system"]);
          this.search();
        }
      });

    this.filteredSystems = this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(value => {
        if (value && value.length >= 3) {
          return this.getSystemSuggestions(value);
        }
        return of([]);
      })
    );

    // Subscribe to independentOutposts data
    this.appService.independentOutposts
      .pipe(untilDestroyed(this))
      .subscribe(outposts => {
        this.independentOutposts = outposts;
      });
  }

  public ngAfterViewInit(): void {
    // SVG will be loaded after data is set
  }

  public search(): void {
    const input = this.searchControl.value || this.searchInput;
    if (this.searching || !input) {
      return;
    }
    this.searchInput = input.trim();
    if (this.searchInput.length <= 1) {
      return;
    }
    this.data = null;
    this.bodies = [];
    this.searching = true;
    this.searchError = false;
    this.searchErrorMessage = '';
    this.searchControl.disable();

    // Load test system
    if (this.searchInput.toLowerCase() === 'test') {
      this.httpClient.get<CanonnBiostats>('assets/test-system.json')
        .subscribe(
          data => {
            this.processBodies(data);
            this.searching = false;
            this.searchControl.enable();
          },
          error => {
            this.searchFailed();
          }
        );
      return;
    }

    if (this.isNumeric(this.searchInput)) {
      const systemAddress = parseInt(this.searchInput);
      this.searchBySystemAddress(systemAddress);
      return;
    }

    // Check EdAstro cache first (case-insensitive)
    this.appService.edastroSystems.subscribe(edastroSystems => {
      const edastroSystem = edastroSystems.find(s =>
        this.decodeHtmlEntities(s.name).toLowerCase() === this.searchInput.toLowerCase()
      );
      if (edastroSystem && edastroSystem.id64) {
        this.searchBySystemAddress(edastroSystem.id64);
        return;
      }

      // Try Spansh if not found in EdAstro
      this.httpClient.get<{ min_max: { name: string, id64: number }[] }>(`https://us-central1-canonn-api-236217.cloudfunctions.net/query/typeahead?q=${encodeURIComponent(this.searchInput)}`)
        .subscribe(
          data => {
            const systems = data.min_max || [];
            // Use case-insensitive comparison to find the system
            const system = systems.find(s => s.name.toLowerCase() === this.searchInput.toLowerCase());
            if (system && system.id64) {
              this.searchBySystemAddress(system.id64);
            } else {
              this.searchFailed();
            }
          },
          error => {
            this.searchFailed();
          }
        );
    });
  }

  private searchFailed(message: string = 'System not found'): void {
    this.searching = false;
    this.searchError = true;
    this.searchErrorMessage = message;
    this.searchControl.enable();
  }

  private searchBySystemAddress(systemAddress: number): void {
    this.httpClient.get<CanonnBiostats>(`https://us-central1-canonn-api-236217.cloudfunctions.net/query/codex/biostats?id=${systemAddress}`)
      .subscribe(
        data => {
          if (!data) {
            this.searchFailed('System not found in database');
            return;
          }
          // Check if the response indicates no spansh data or missing system info
          if (!data.system || !data.system.name) {
            this.searchFailed('No system data available for this address');
            return;
          }
          this.processBodies(data);
          this.searching = false;
          this.searchControl.enable();
        },
        error => {
          // Check for specific error messages
          const errorMessage = error?.error?.message || error?.message || '';
          if (errorMessage.toLowerCase().includes('no spansh data')) {
            this.searchFailed('System not found in Spansh database');
          } else if (error.status === 404) {
            this.searchFailed('System not found');
          } else {
            this.searchFailed('Error loading system data. Please try again.');
          }
        }
      );
  }

  private processBodies(data: CanonnBiostats): void {
    // Decode HTML entities in system name
    data.system.name = this.decodeHtmlEntities(data.system.name);

    const queryParams: Params = { system: data.system.name };

    this.router.navigate(
      [],
      {
        relativeTo: this.activatedRoute,
        queryParams,
        queryParamsHandling: 'merge', // remove to replace all query params by provided
      });
    this.searchInput = data.system.name;

    // Check if we're loading a different system
    const isDifferentSystem = !this.data || this.data.system.id64 !== data.system.id64;

    this.data = data;
    this.bodies = [];

    // Only reset edastroData if loading a different system
    if (isDifferentSystem) {
      this.edastroData = null;
    }

    this.appService.setBackgroundImage('assets/bg1.jpg');

    // Load and highlight region map immediately
    setTimeout(() => this.loadRegionMap(), 0);

    // Fetch edastro data only if we don't have it or it's a different system
    if (isDifferentSystem || !this.edastroData) {
      this.appService.getEdastroData(data.system.id64)
        .subscribe(
          edastroData => {
            if (edastroData && (edastroData.name || edastroData.summary || edastroData.mainImage)) {
              this.edastroData = edastroData;
              if (edastroData.mainImage) {
                this.appService.setBackgroundImage(edastroData.mainImage);
              }
            }
          },
          error => {
            // Silently handle error - edastro data is optional
          }
        );
    }

    const bodiesFlat: SystemBody[] = [];

    for (const systemBody of data.system.bodies) {
      const body: SystemBody = {
        bodyData: systemBody,
        subBodies: [],
        parent: null,
      };
      bodiesFlat.push(body);

      // Add belts as child bodies
      if (systemBody.belts) {
        for (const belt of systemBody.belts) {
          const beltBody: SystemBody = {
            bodyData: {
              bodyId: -1, // Temporary ID for belts
              name: this.stripParentName(belt.name, systemBody.name),
              id64: 0,
              subType: belt.type,
              type: "Belt",
              innerRadius: belt.innerRadius / 1000, // Convert m to km
              outerRadius: belt.outerRadius / 1000, // Convert m to km
              mass: belt.mass
            },
            subBodies: [],
            parent: body
          };
          body.subBodies.push(beltBody);
        }
      }

      // Add rings as child bodies
      if (systemBody.rings) {
        for (const ring of systemBody.rings) {
          const ringBody: SystemBody = {
            bodyData: {
              bodyId: -1, // Temporary ID for rings
              name: this.stripParentName(ring.name, systemBody.name),
              id64: ring.id64 || 0,
              subType: ring.type,
              type: "Ring",
              innerRadius: ring.innerRadius / 1000, // Convert m to km
              outerRadius: ring.outerRadius / 1000, // Convert m to km
              mass: ring.mass,
              signals: ring.signals ? {
                signals: ring.signals.signals,
                updateTime: ring.signals.updateTime || ''
              } : undefined
            },
            subBodies: [],
            parent: body
          };
          body.subBodies.push(ringBody);
        }
      }
    }

    for (const body of [...bodiesFlat]) {
      if (!body.bodyData.parents) {
        continue;
      }
      for (const parent of body.bodyData.parents) {
        if (typeof parent.Planet != 'undefined') {
          let parentBody = bodiesFlat.find(b => b.bodyData.bodyId === parent.Planet);
          if (!parentBody) {
            parentBody = {
              bodyData: {
                bodyId: parent.Planet,
                name: `Unknown planet (${parent.Planet})`,
                id64: 0,
                subType: "",
                type: "Planet",
              },
              subBodies: [],
              parent: null,
            };
            bodiesFlat.push(parentBody);
          }
        }
        if (typeof parent.Star != 'undefined') {
          let parentBody = bodiesFlat.find(b => b.bodyData.bodyId === parent.Star);
          if (!parentBody) {
            parentBody = {
              bodyData: {
                bodyId: parent.Star,
                name: `Unknown star (${parent.Star})`,
                id64: 0,
                subType: "",
                type: "Star",
              },
              subBodies: [],
              parent: null,
            };
            bodiesFlat.push(parentBody);
          }
        }
        if (typeof parent.Null != 'undefined') {
          let parentBody = bodiesFlat.find(b => b.bodyData.bodyId === parent.Null);
          if (!parentBody) {
            parentBody = {
              bodyData: {
                bodyId: parent.Null,
                name: `Unknown barycentre (${parent.Null})`,
                id64: 0,
                subType: "",
                type: "Barycentre",
              },
              subBodies: [],
              parent: null,
            };
            bodiesFlat.push(parentBody);
          }
        }
      }
    }

    for (let i = 0; i <= 1; i++) {
      for (const body of bodiesFlat) {
        if (body.bodyData.parents && body.bodyData.parents.length > 0) {
          let currentBody = body;
          for (const parent of body.bodyData.parents) {
            const parentBody = bodiesFlat.find(b => b.bodyData.bodyId === parent.Planet) ||
              bodiesFlat.find(b => b.bodyData.bodyId === parent.Star) ||
              bodiesFlat.find(b => b.bodyData.bodyId === parent.Null);
            if (parentBody) {
              if (!parentBody.subBodies.includes(currentBody)) {
                parentBody.subBodies.push(currentBody);
              }
              if (!currentBody.parent) {
                currentBody.parent = parentBody;
              }
              currentBody = parentBody;
              if (i === 0 || currentBody.parent) {
                break;
              }
            }
            else {
              break;
            }
          }
          continue;
        }
      }
    }

    for (const body of bodiesFlat) {
      body.subBodies.sort((a, b) => {
        const getDistance = (bodyData: CanonnBiostatsBody) => {
          if (bodyData.semiMajorAxis) return bodyData.semiMajorAxis * 149597870.7; // Convert AU to km
          if (bodyData.innerRadius) return bodyData.innerRadius; // Ring/belt inner radius
          return Number.MAX_SAFE_INTEGER; // Place bodies without orbital data at the end
        };
        return getDistance(a.bodyData) - getDistance(b.bodyData);
      });
    }
    bodiesFlat.sort((a, b) => (a.bodyData.bodyId > b.bodyData.bodyId) ? 1 : -1);

    this.bodies = bodiesFlat.filter(b => b.parent === null);
  }

  private isNumeric(value: string) {
    return /^\d+$/.test(value);
  }

  private getSystemSuggestions(query: string): Observable<string[]> {
    const spansQuery = this.httpClient.get<{ values: string[] }>(`https://us-central1-canonn-api-236217.cloudfunctions.net/query/typeahead?q=${encodeURIComponent(query)}`)
      .pipe(switchMap(response => of((response.values || []).map(name => this.decodeHtmlEntities(name)))));

    const edastroQuery = this.appService.edastroSystems.pipe(
      switchMap(systems => {
        const matchingSystems = systems
          .filter(s => s.name.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 10);

        const systemsWithId64 = matchingSystems.filter(s => s.id64);
        const systemsWithoutId64 = matchingSystems.filter(s => !s.id64);

        if (systemsWithoutId64.length === 0) {
          return of(systemsWithId64.map(s => this.decodeHtmlEntities(s.name)));
        }

        // Lookup id64 for systems without it
        const lookupPromises = systemsWithoutId64.map(system => {
          const systemName = system.galMapSearch || system.name;
          const decodedSystemName = this.decodeHtmlEntities(systemName);
          return this.appService.galMapSearch(decodedSystemName).toPromise()
            .then(result => {
              const found = result?.min_max?.find(s => s.name === decodedSystemName);
              return found ? { ...system, id64: found.id64 } : null;
            })
            .catch(() => null);
        });

        return Promise.all(lookupPromises).then(results => {
          const systemsFoundInGalMap = results.filter(s => s !== null && s.id64) as EdastroSystem[];
          const allValidSystems = [...systemsWithId64, ...systemsFoundInGalMap];
          return allValidSystems.map(s => this.decodeHtmlEntities(s.name));
        });
      })
    );

    return combineLatest([spansQuery, edastroQuery]).pipe(
      switchMap(([spansSuggestions, edastroSuggestions]) => {
        // Store mapping for EdAstro systems
        this.appService.edastroSystems.subscribe(systems => {
          systems.forEach(system => {
            const displayName = this.decodeHtmlEntities(system.name);
            const systemName = system.galMapSearch ? this.decodeHtmlEntities(system.galMapSearch) : displayName;
            this.systemMapping.set(displayName, { systemName, id64: system.id64 });
          });
        });

        const combined = [...new Set([...spansSuggestions, ...edastroSuggestions])];
        const queryLower = query.toLowerCase();

        // Sort by relevance: exact match > starts with > contains
        const sorted = combined.sort((a, b) => {
          const aLower = a.toLowerCase();
          const bLower = b.toLowerCase();

          // Exact match gets highest priority
          if (aLower === queryLower && bLower !== queryLower) return -1;
          if (bLower === queryLower && aLower !== queryLower) return 1;

          // Starts with query gets second priority
          const aStartsWith = aLower.startsWith(queryLower);
          const bStartsWith = bLower.startsWith(queryLower);
          if (aStartsWith && !bStartsWith) return -1;
          if (bStartsWith && !aStartsWith) return 1;

          // If both start with query or both don't, sort alphabetically
          return a.localeCompare(b);
        });

        return of(sorted.slice(0, 20));
      }),
      untilDestroyed(this)
    );
  }

  public onSystemSelected(displayName: string): void {
    const mapping = this.systemMapping.get(displayName);
    if (mapping && mapping.id64) {
      this.searchInput = displayName;
      this.searchBySystemAddress(mapping.id64);
    } else if (mapping && mapping.systemName) {
      this.searchInput = mapping.systemName;
      this.searchControl.setValue(mapping.systemName);
      this.search();
    } else {
      this.searchInput = displayName;
      this.search();
    }
  }

  private stripParentName(ringName: string, parentName: string): string {
    // Remove parent name from ring name, keeping only the ring identifier
    const pattern = new RegExp(`^${parentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\s*`, 'i');
    return ringName.replace(pattern, '').trim();
  }

  private decodeHtmlEntities(text: string): string {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  }

  public getTotalBodyCount(): number {
    const countBodies = (bodies: SystemBody[]): number => {
      return bodies.reduce((count, body) => {
        return count + 1 + countBodies(body.subBodies);
      }, 0);
    };
    return countBodies(this.bodies);
  }

  public trackByBody(index: number, body: SystemBody): number {
    return body.bodyData.bodyId;
  }

  public getBodyDisplayName(bodyName: string): string {
    return this.appService.getBodyDisplayName(bodyName);
  }

  private loadRegionMap(): void {
    if (!this.regionMapContainer || !this.data) {
      return;
    }

    // Check if SVG already exists
    const existingSvg = this.regionMapContainer.nativeElement.querySelector('svg');
    if (existingSvg) {
      // SVG already loaded, just update the highlighting and marker
      this.highlightRegion();
      return;
    }

    // Load the SVG from the assets folder
    this.httpClient.get('assets/EliteDangerousRegionMap/RegionMap.svg', { responseType: 'text' })
      .subscribe(
        svgContent => {
          if (this.regionMapContainer && this.regionMapContainer.nativeElement) {
            this.regionMapContainer.nativeElement.innerHTML = svgContent;

            // Remove explicit width and height attributes from SVG
            const svgElement = this.regionMapContainer.nativeElement.querySelector('svg');
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
                if (currentViewBox !== '0 0 2048 2048') {
                  event.stopPropagation();
                  svgElement.setAttribute('viewBox', '0 0 2048 2048');
                  this.updateMarkerScales(svgElement, 1);
                }
              });
            }

            this.highlightRegion();
          }
        },
        error => {
          console.error('Error loading region map:', error);
        }
      );
  }

  private highlightRegion(): void {
    if (!this.regionMapContainer || !this.data || !this.data.system.region) {
      return;
    }

    const svgElement = this.regionMapContainer.nativeElement.querySelector('svg');
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

      // Add click handler for zooming
      region.addEventListener('click', (event) => {
        const currentViewBox = svgElement.getAttribute('viewBox');
        // Only zoom in if we're not already zoomed
        if (currentViewBox === '0 0 2048 2048') {
          event.stopPropagation();
          this.zoomToRegion(region as SVGPathElement, svgElement);
        }
      });
    });

    // Highlight the current region
    const regionId = `Region_${String(this.data.system.region.region).padStart(2, '0')}`;
    console.log('Attempting to highlight region:', regionId, 'Region data:', this.data.system.region);
    const regionElement = svgElement.querySelector(`#${regionId}`);
    console.log('Found region element:', regionElement);
    if (regionElement) {
      (regionElement as HTMLElement).style.fill = '#ff9900';
      (regionElement as HTMLElement).style.fillOpacity = '0.6';
      (regionElement as HTMLElement).style.stroke = '#ff9900';
      (regionElement as HTMLElement).style.strokeOpacity = '1';
      (regionElement as HTMLElement).style.strokeWidth = '2';
    } else {
      console.warn('Region element not found for ID:', regionId);
    }

    // Add red dot at system coordinates
    this.addSystemMarker(svgElement);

    // Add known systems markers
    this.addKnownSystemMarkers(svgElement);

    // Debug GEC image sizing
    this.debugGecImageSize();
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

    console.log('=== ZOOM TO REGION DEBUG ===');
    console.log('Region ID:', regionId);
    console.log('Region Number:', regionNumber);
    console.log('Is Inner Orion Spur (region 18):', regionNumber === 18);
    console.log('============================');

    // Calculate scale factor for markers
    const scaleFactor = 2048 / size;

    // Fetch Gnosis data and add marker only if region is Inner Orion Spur (region 18)
    if (regionNumber === 18) {
      this.fetchGnosisData().subscribe(gnosisData => {
        console.log('Gnosis data received:', gnosisData);
        if (gnosisData) {
          this.addGnosisMarker(svgElement, bbox);
          // Scale the Gnosis marker after it's added
          setTimeout(() => {
            this.updateMarkerScales(svgElement, scaleFactor);
          }, 50);
        }
      });
    }

    // Update marker scales immediately and again after a short delay
    // to ensure all markers are scaled correctly
    this.updateMarkerScales(svgElement, scaleFactor);
    setTimeout(() => {
      this.updateMarkerScales(svgElement, scaleFactor);
    }, 50);

    // Add a reset button or double-click handler to zoom out
    svgElement.style.transition = 'viewBox 0.3s ease';
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
    // Get current viewBox to determine zoom level
    const viewBox = svgElement.getAttribute('viewBox');
    const viewBoxValues = viewBox ? viewBox.split(' ').map(parseFloat) : [0, 0, 2048, 2048];
    const viewBoxSize = Math.max(viewBoxValues[2], viewBoxValues[3]);
    const currentScaleFactor = 2048 / viewBoxSize;

    const knownSystems = [
      { name: 'Varati', systemName: 'Varati', x: -178.65625, y: 77.12500, z: -87.12500, zoomLevel: 'always' },
      { name: 'Canonnia', systemName: 'Canonnia', x: -9522.93750, y: -894.06250, z: 19791.87500, zoomLevel: 'always' },
      { name: 'Hotel Canonnia', systemName: 'Prua Phoe MI-B b17-5', x: -5652.84375, y: -561.06250, z: 10815.34375, zoomLevel: 'always' },
      { name: 'Miskatonic University', systemName: 'Byae Aowsy GR-N d6-52', x: 14407.6, y: 17.5, z: 44312.6, zoomLevel: 'always' },
      { name: 'Col 70 Sector FY-N C21-3', systemName: 'Col 70 Sector FY-N C21-3', x: 275.34375, y: -371.34375, z: -680.96875, zoomLevel: 'zoomed' },
      { name: "Explorer's Anchorage", systemName: 'Stuemeae FG-Y d7561', x: 28.68750, y: -19.78125, z: 25899.68750, zoomLevel: 'zoomed' }
    ];

    knownSystems.forEach(system => {
      // Apply transformation formula
      const tx = ((system.x - (-49985)) * 83 / 4096);
      const tz = ((system.z - (-24105)) * 83 / 4096);
      const finalY = 2048 - tz;

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
      circle.addEventListener('click', () => {
        this.searchInput = system.systemName;
        this.searchControl.setValue(system.systemName);
        this.search();
      });

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
        // Update rect size based on text
        const bbox = text.getBBox();
        rect.setAttribute('x', (bbox.x - 4).toString());
        rect.setAttribute('y', (bbox.y - 2).toString());
        rect.setAttribute('width', (bbox.width + 8).toString());
        rect.setAttribute('height', (bbox.height + 4).toString());

        rect.style.display = 'block';
        text.style.display = 'block';
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
    this.independentOutposts.forEach(outpost => {
      if (!outpost.coordinates || outpost.coordinates.length < 3) {
        return; // Skip if coordinates are missing
      }

      const [x, y, z] = outpost.coordinates;
      
      // Apply transformation formula
      const tx = ((x - (-49985)) * 83 / 4096);
      const tz = ((z - (-24105)) * 83 / 4096);
      const finalY = 2048 - tz;

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
      circle.addEventListener('click', () => {
        this.searchInput = outpost.galMapSearch;
        this.searchControl.setValue(outpost.galMapSearch);
        this.search();
      });

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
      text.textContent = outpost.name;

      // Create background rect for text
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('fill', 'rgba(0, 0, 0, 0.8)');
      rect.setAttribute('rx', '8');
      rect.setAttribute('pointer-events', 'none');
      rect.style.display = 'none';

      // Add hover events
      circle.addEventListener('mouseenter', () => {
        // Pre-calculate bbox to avoid delay
        const bbox = text.getBBox();
        rect.setAttribute('x', (bbox.x - 3).toString());
        rect.setAttribute('y', (bbox.y - 1).toString());
        rect.setAttribute('width', (bbox.width + 6).toString());
        rect.setAttribute('height', (bbox.height + 2).toString());

        rect.style.display = 'block';
        text.style.display = 'block';
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

  private fetchGnosisData(): Observable<GnosisData | null> {
    // Check if we have cached data and if it's still fresh
    const now = Date.now();
    console.log('=== FETCH GNOSIS DEBUG ===');
    console.log('Current time:', now);
    console.log('Last fetched:', this.gnosisLastFetched);
    console.log('Cache age (ms):', now - this.gnosisLastFetched);
    console.log('Cache duration (ms):', this.GNOSIS_CACHE_DURATION);
    console.log('Has cached data:', !!this.gnosisData);

    if (this.gnosisData && (now - this.gnosisLastFetched) < this.GNOSIS_CACHE_DURATION) {
      console.log('Using cached Gnosis data:', this.gnosisData);
      console.log('=========================');
      return of(this.gnosisData);
    }

    console.log('Fetching fresh Gnosis data from API...');
    console.log('=========================');

    // Fetch fresh data
    return this.httpClient.get<GnosisData>('https://us-central1-canonn-api-236217.cloudfunctions.net/query/gnosis')
      .pipe(
        switchMap(data => {
          console.log('Fresh Gnosis data received:', data);
          this.gnosisData = data;
          this.gnosisLastFetched = now;
          return of(data);
        }),
        untilDestroyed(this)
      );
  }

  private addGnosisMarker(svgElement: SVGSVGElement, regionBbox: DOMRect): void {
    console.log('=== ADD GNOSIS MARKER DEBUG ===');
    console.log('Gnosis data:', this.gnosisData);

    if (!this.gnosisData) {
      console.log('No Gnosis data available');
      console.log('================================');
      return;
    }

    // Remove existing Gnosis marker if any
    const existingMarker = svgElement.querySelector('#gnosis-marker');
    if (existingMarker) {
      console.log('Removing existing Gnosis marker');
      existingMarker.remove();
    }

    // Get current viewBox to determine zoom level
    const viewBox = svgElement.getAttribute('viewBox');
    const viewBoxValues = viewBox ? viewBox.split(' ').map(parseFloat) : [0, 0, 2048, 2048];
    const viewBoxSize = Math.max(viewBoxValues[2], viewBoxValues[3]);
    const currentScaleFactor = 2048 / viewBoxSize;

    const [x, y, z] = this.gnosisData.coords;

    console.log('Gnosis ED coordinates:', { x, y, z });

    // Apply transformation formula
    const tx = ((x - (-49985)) * 83 / 4096);
    const tz = ((z - (-24105)) * 83 / 4096);
    const finalY = 2048 - tz;

    console.log('Gnosis SVG coordinates:', { tx, finalY });
    console.log('Region bbox:', {
      x: regionBbox.x,
      y: regionBbox.y,
      width: regionBbox.width,
      height: regionBbox.height,
      right: regionBbox.x + regionBbox.width,
      bottom: regionBbox.y + regionBbox.height
    });

    // Check if Gnosis is within the region bounds
    const inBounds = !(tx < regionBbox.x || tx > regionBbox.x + regionBbox.width ||
      finalY < regionBbox.y || finalY > regionBbox.y + regionBbox.height);

    console.log('Gnosis in region bounds:', inBounds);

    if (!inBounds) {
      // Gnosis is not in this region, don't display it
      console.log('Gnosis is NOT in this region, skipping marker');
      console.log('================================');
      return;
    }

    console.log('Adding Gnosis marker to SVG');
    console.log('================================');

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
    circle.addEventListener('click', () => {
      this.searchInput = this.gnosisData!.system;
      this.searchControl.setValue(this.gnosisData!.system);
      this.search();
    });

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
      const bbox = text.getBBox();
      rect.setAttribute('x', (bbox.x - 4).toString());
      rect.setAttribute('y', (bbox.y - 2).toString());
      rect.setAttribute('width', (bbox.width + 8).toString());
      rect.setAttribute('height', (bbox.height + 4).toString());

      rect.style.display = 'block';
      text.style.display = 'block';
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

  private debugGecImageSize(): void {
    setTimeout(() => {
      if (this.gecContainer && this.gecImage) {
        console.log('=== GEC IMAGE DEBUG ===');

        const systemDataDiv = this.gecContainer.nativeElement.parentElement;
        console.log('Parent (system-data) dimensions:', {
          width: systemDataDiv?.clientWidth,
          height: systemDataDiv?.clientHeight,
          offsetWidth: systemDataDiv?.offsetWidth,
          offsetHeight: systemDataDiv?.offsetHeight
        });

        console.log('Container dimensions:', {
          width: this.gecContainer.nativeElement.clientWidth,
          height: this.gecContainer.nativeElement.clientHeight,
          offsetWidth: this.gecContainer.nativeElement.offsetWidth,
          offsetHeight: this.gecContainer.nativeElement.offsetHeight
        });

        console.log('Container computed style:', {
          height: getComputedStyle(this.gecContainer.nativeElement).height,
          maxHeight: getComputedStyle(this.gecContainer.nativeElement).maxHeight,
          overflow: getComputedStyle(this.gecContainer.nativeElement).overflow
        });

        console.log('Image dimensions:', {
          width: this.gecImage.nativeElement.clientWidth,
          height: this.gecImage.nativeElement.clientHeight,
          offsetWidth: this.gecImage.nativeElement.offsetWidth,
          offsetHeight: this.gecImage.nativeElement.offsetHeight,
          naturalWidth: this.gecImage.nativeElement.naturalWidth,
          naturalHeight: this.gecImage.nativeElement.naturalHeight
        });
        console.log('Image computed style:', {
          width: getComputedStyle(this.gecImage.nativeElement).width,
          height: getComputedStyle(this.gecImage.nativeElement).height,
          maxWidth: getComputedStyle(this.gecImage.nativeElement).maxWidth,
          minWidth: getComputedStyle(this.gecImage.nativeElement).minWidth,
          maxHeight: getComputedStyle(this.gecImage.nativeElement).maxHeight
        });

        const svgElement = this.regionMapContainer.nativeElement.querySelector('svg');
        if (svgElement) {
          console.log('SVG height:', svgElement.clientHeight);
        }
        console.log('======================');
      }
    }, 500);
  }

  private addSystemMarker(svgElement: SVGSVGElement): void {
    if (!this.data || !this.data.system.coords) {
      return;
    }

    // Remove any existing system marker
    const existingMarker = svgElement.querySelector('#system-marker');
    if (existingMarker) {
      existingMarker.remove();
    }

    const coords = this.data.system.coords;

    // Apply transformation formula
    // Note: The region map uses X and Z coordinates (not Y)
    // X is horizontal, Z is vertical on the 2D map
    const tx = ((coords.x - (-49985)) * 83 / 4096);
    const tz = ((coords.z - (-24105)) * 83 / 4096);

    // Invert Z coordinate for SVG (SVG Y increases downward)
    const finalY = 2048 - tz;

    console.log('=== SYSTEM MARKER DEBUG ===');
    console.log('System:', this.data.system.name);
    console.log('Original ED Coordinates:', {
      x: coords.x,
      y: coords.y,
      z: coords.z
    });
    console.log('After offset translation:', {
      'x - (-49985)': coords.x - (-49985),
      'z - (-24105)': coords.z - (-24105)
    });
    console.log('After scaling (* 83 / 4096):', {
      tx: tx,
      tz: tz
    });
    console.log('Final SVG Coordinates (with Z-inversion):', {
      cx: tx,
      cy: finalY,
      'calculation': `2048 - ${tz} = ${finalY}`
    });
    console.log('=========================');

    // Create a group for the marker
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('id', 'system-marker');

    // Check SVG dimensions and viewBox
    const viewBox = svgElement.getAttribute('viewBox');
    const width = svgElement.getAttribute('width');
    const height = svgElement.getAttribute('height');
    console.log('SVG Properties:', {
      viewBox: viewBox,
      width: width,
      height: height,
      clientWidth: svgElement.clientWidth,
      clientHeight: svgElement.clientHeight
    });

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

    // Add the marker group to the SVG, but before any known-system-marker elements
    // This ensures blue dots (known systems) are always on top
    const firstBlueMarker = svgElement.querySelector('.known-system-marker');
    if (firstBlueMarker) {
      svgElement.insertBefore(group, firstBlueMarker);
    } else {
      svgElement.appendChild(group);
    }

    // Verify the actual position after appending
    console.log('Circle element attributes:', {
      id: circle.getAttribute('id'),
      cx: circle.getAttribute('cx'),
      cy: circle.getAttribute('cy'),
      r: circle.getAttribute('r')
    });

    // Get the bounding box of the circle
    setTimeout(() => {
      const bbox = circle.getBBox();
      console.log('Circle bounding box:', {
        x: bbox.x,
        y: bbox.y,
        width: bbox.width,
        height: bbox.height
      });
    }, 100);
  }
}

interface EDSMSystemV1 {
  name: string;
  id: number;
  id64: number;
}

interface CanonnBiostats {
  system: {
    allegiance: string;
    bodies: CanonnBiostatsBody[];
    bodyCount: number;
    // controllingFaction
    coords: {
      x: number;
      y: number;
      z: number;
    };
    date: string;
    government: string | null;
    id64: number;
    name: string;
    population: number;
    // powerState
    // powers
    // primaryEconomy
    region: {
      name: string;
      region: number;
    };
    signals?: {
      anomaly?: string[];
      cloud?: string[];
    };
    // secondaryEconomy
    // security
  }
}

export interface CanonnBiostatsBody {
  absoluteMagnitude?: number;
  age?: number;
  argOfPeriapsis?: number;
  ascendingNode?: number;
  atmosphereType?: string | null;
  atmosphereComposition?: { [key: string]: number };
  axialTilt?: number;
  belts?: {
    innerRadius: number;
    mass: number;
    name: string;
    outerRadius: number;
    type: string;
  }[];
  rings?: {
    id64?: number;
    innerRadius: number;
    mass: number;
    name: string;
    outerRadius: number;
    type: string;
    signals?: {
      signals?: {
        [key: string]: number;
      };
      updateTime?: string;
    };
  }[];
  bodyId: number;
  distanceToArrival?: number;
  earthMasses?: number;
  gravity?: number;
  id64: number;
  innerRadius?: number;
  isLandable?: boolean;
  luminosity?: string;
  mainStar?: boolean;
  materials?: {
    Carbon: number;
    Chromium: number;
    Germanium: number;
    Iron: number;
    Manganese: number;
    Mercury: number;
    Nickel: number;
    Phosphorus: number;
    Ruthenium: number;
    Sulphur: number;
    Tin: number;
  };
  mass?: number;
  meanAnomaly?: number;
  name: string;
  orbitalEccentricity?: number;
  orbitalInclination?: number;
  orbitalPeriod?: number;
  outerRadius?: number;
  parents?: {
    Null?: number;
    Planet?: number;
    Star: number;
  }[];
  radius?: number;
  reserveLevel?: string;
  rotationalPeriod?: number;
  rotationalPeriodTidallyLocked?: boolean;
  semiMajorAxis?: number;
  signals?: {
    genuses?: string[];
    geology?: string[];
    guesses?: string[];
    biology?: string[];
    thargoid?: string[];
    guardian?: string[];
    signals?: {
      [key: string]: number;
    };
    updateTime: string;
  };
  solarMasses?: number;
  solarRadius?: number;
  solidComposition?: {
    Ice: number;
    Metal: number;
    Rock: number;
  },
  spectralClass?: string;
  stations?: {
    /* */
  }[];
  subType: string;
  surfacePressure?: number;
  surfaceTemperature?: number;
  terraformingState?: string;
  timestamps?: {
    distanceToArrival: string;
    meanAnomaly?: string;
  };
  type: string;
  updateTime?: string;
  volcanismType?: string;
}

export interface SystemBody {
  bodyData: CanonnBiostatsBody;
  subBodies: SystemBody[];
  parent: SystemBody | null;
}

export interface GnosisData {
  arrival: string;
  coords: [number, number, number];
  departure: string;
  desc: string;
  system: string;
}
