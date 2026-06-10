import { HttpClient } from '@angular/common/http';
import { Component, OnInit, DestroyRef, ChangeDetectorRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppService, EdastroData, EdastroSystem, IndependentOutpost } from '../app.service';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { animate, style, transition, trigger } from '@angular/animations';
import { faFileCode } from '@fortawesome/free-solid-svg-icons';
import { Observable, of, debounceTime, distinctUntilChanged, switchMap, map, combineLatest, take, firstValueFrom } from 'rxjs';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { PGSystem } from 'src/assets/pgnames/PGSystem';
import { MatFormField, MatLabel, MatError } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatAutocompleteTrigger, MatAutocomplete, MatOption } from '@angular/material/autocomplete';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { SystemBodyComponent } from '../system-body/system-body.component';
import { RegionMapComponent } from '../region-map/region-map.component';
import { AsyncPipe, DecimalPipe } from '@angular/common';
import { BODY_TYPE } from '../data/body-types';

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
    ],
    imports: [MatFormField, MatLabel, MatInput, ReactiveFormsModule, MatAutocompleteTrigger, MatAutocomplete, MatOption, MatError, MatButton, MatIcon, SystemBodyComponent, RegionMapComponent, AsyncPipe, DecimalPipe]
})
export class HomeComponent implements OnInit {
  private readonly httpClient = inject(HttpClient);
  readonly appService = inject(AppService);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  private lastSimbadSystemName: string | null = null;
  private lastSimbadId64: number | null = null;
  public creditsHtml: string = '';
  // In-memory cache for typeahead suggestions
  private systemSuggestionsCache: Map<string, Observable<string[]>> = new Map();

  /**
   * Builds the credits HTML from the bundled (trusted) readme.md. The result is bound
   * via [innerHTML], which Angular sanitizes; the markdown source is a local asset, not
   * user input. Only simple links and list items are emitted.
   */
  private parseCreditsSection(markdown: string): string {
    // Extract #Credits or ##Credits section (robust)
    const creditsMatch = markdown.match(/^#{1,2}\s*Credits\s*$([\s\S]*)/m);
    if (!creditsMatch) {
      return '';
    }
    let creditsText = creditsMatch[1].trim();
    // Convert markdown links to HTML links
    creditsText = creditsText.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    // Convert markdown list to HTML
    let html = creditsText.replace(/\* (.+)/g, '<li>$1</li>');
    if (/^<li>/.test(html)) {
      html = `<ul>${html}</ul>`;
    }
    return html;
  }

  private loadCredits(): void {
    this.httpClient.get('assets/readme.md', { responseType: 'text' }).subscribe({
      next: md => {
        this.creditsHtml = this.parseCreditsSection(md);
        this.cdr.markForCheck();
      },
      error: () => { },
    });
  }
  openSimbadPageRaw(ident: string) {
    if (!ident) return;
    window.open(`https://simbad.harvard.edu/simbad/sim-id?Ident=@${encodeURIComponent(ident)}`, '_blank', 'noopener,noreferrer');
  }
  openSimbadPage(ident: string) {
    if (!ident) return;
    const id = this.formatSimbadId(ident);
    window.open(`https://simbad.harvard.edu/simbad/sim-id?Ident=@${encodeURIComponent(id)}`, '_blank', 'noopener,noreferrer');
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
  public edGalaxyData: EdGalaxyData | null = null;
  // Simbad cache and file loading logic removed (now using API)

  // Convert id64 to PGName using PGSystem, formatted for Elite Dangerous
  getPGName(id64: string | number): string {
    try {
      // Accept id64 as string or number, always convert via string to preserve precision
      const id64BigInt = BigInt(typeof id64 === 'string' ? id64 : id64.toString());

      const pgSystem = PGSystem.fromSystemAddress(id64BigInt);

      // Format with canonical casing:
      // Region name: title case
      // System ID: uppercase letters, lowercase mass code
      const titleCasedRegion = pgSystem.regionName
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

      const mid1a = String.fromCharCode('A'.charCodeAt(0) + pgSystem.mid1a);
      const mid1b = String.fromCharCode('A'.charCodeAt(0) + pgSystem.mid1b);
      const mid2 = String.fromCharCode('A'.charCodeAt(0) + pgSystem.mid2);
      const mcode = String.fromCharCode('a'.charCodeAt(0) + pgSystem.sizeClass);
      const mid3 = Math.trunc(pgSystem.mid3);
      const seq = Math.trunc(pgSystem.sequence);

      const result = `${titleCasedRegion} ${mid1a}${mid1b}-${mid2} ${mcode}${mid3}-${seq}`;
      return result;
    } catch (e) {
      console.error('[getPGName] Error:', e);
      return '';
    }
  }

  fetchEdGalaxyData(systemName: string, id64: number, coords?: { x: number, y: number, z: number }) {
    const pgName = this.getPGName(id64);

    // Fallback used whenever we don't (or can't) resolve Simbad data.
    const setFallback = () => {
      this.edGalaxyData = { PGName: pgName, SystemAddress: id64, Name: systemName, Simbad: undefined };
      this.cdr.markForCheck();
    };

    // Skip the Simbad lookup for procedurally-generated systems: when the
    // PGName matches the system name, the name is a valid PG name, or it
    // contains "Sector". Simbad only has hand-authored systems.
    if (pgName.toLowerCase() === systemName.toLowerCase()
      || PGSystem.isPGSystemName(systemName)
      || systemName.toLowerCase().includes('sector')) {
      setFallback();
      return;
    }

    // Call the API for Simbad data
    let url = `https://us-central1-canonn-api-236217.cloudfunctions.net/query/simbad?system_address=${id64}&name=${encodeURIComponent(systemName)}`;
    if (coords) {
      url += `&x=${coords.x}&y=${coords.y}&z=${coords.z}`;
    }
    this.httpClient.get<SimbadApiResponse>(url).subscribe({
      next: result => {
        // Remap API response to expected structure for edGalaxyData
        const hasSimbad = result.simbad_name || result.simbad_ident
          || result.ra_j2000 !== undefined || result.dec_j2000 !== undefined;
        this.edGalaxyData = {
          PGName: pgName,
          SystemAddress: result.system_address,
          Name: result.name,
          Simbad: hasSimbad ? {
            Name: result.simbad_name,
            Ident: result.simbad_ident,
            RAJ2000: result.ra_j2000,
            DEJ2000: result.dec_j2000
          } : undefined
        };
        this.cdr.markForCheck();
      },
      // Even if the Simbad API fails, still populate edGalaxyData with PGName.
      error: () => setFallback(),
    });
  }

  updateEdGalaxyData() {
    if (!this.data?.system?.name || !this.data?.system?.id64) {
      return;
    }
    const currentName = this.data.system.name;
    const currentId64 = this.data.system.id64;
    if (this.lastSimbadSystemName === currentName && this.lastSimbadId64 === currentId64) {
      return;
    }
    // Clear previous data immediately when switching systems
    this.edGalaxyData = null;
    this.cdr.markForCheck();
    this.lastSimbadSystemName = currentName;
    this.lastSimbadId64 = currentId64;
    this.fetchEdGalaxyData(currentName, currentId64, this.data.system.coords);
  }
  openSignalsPage(systemName: string) {
    const url = `?system=${encodeURIComponent(systemName)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  referenceSystems = [
    { name: 'Sol', coords: { x: 0, y: 0, z: 0 } },
    { name: 'Colonia', coords: { x: -9530.5, y: -910.28125, z: 19808.125 } },
    { name: 'Merope', coords: { x: -78.59375, y: -149.625, z: -340.53125 } },
    { name: 'Varati', coords: { x: -178.65625, y: 77.125, z: -87.125 } },
    { name: 'Col 70 Sector FY-N C21-3', coords: { x: 687.0625, y: -362.53125, z: -697.0625 } }
  ];

  // Systems featured on the Voyager Golden Record cover (pulsars used for triangulation)
  private readonly voyagerGoldenRecordSystems = [
    'PSR J1935+1616', // in elite
    'PSR J1932+1059', //in elite
    'PSR J1645-0317', // not in spansh, closest is J1643-1224 at ~40ly
    'PSR J1731-4744', // not in spansh, closest is J1730-3350 at ~50ly
    'PSR J1456-6843', //in elite
    'PSR J1243-6423', //in elite
    'Vela Pulsar', //J0835-4510
    'PSR J0953+0755',// in elite
    'PSR J0826+2637',// in elite
    'Crab Pulsar', //J0534+2200
    'PSR J0528+2200', // not in spansh, closest is J0528-2505 at ~50ly
    'PSR J0332+5434', //in  elite
    'PSR J2219+4754', // not in spansh, closest is J2225+6535 at ~30ly
    'PSR J2018+2839' // in elite
  ];



  isVoyagerGoldenRecordSystem(): boolean {
    if (!this.data?.system?.name) return false;
    const systemName = this.data.system.name;
    return this.voyagerGoldenRecordSystems.some(name =>
      name.toLowerCase() === systemName.toLowerCase()
    );
  }

  // These are bound directly in the template, so they must be cheap and return a
  // stable reference (the @for blocks track by object identity). They are computed
  // once via recomputeDerivedSystemData() whenever their inputs change rather than
  // on every change-detection pass.
  private _systemDistances: { name: string, distance: number }[] = [];
  private _nearestOutposts: { name: string, systemName: string, distance: number }[] = [];
  private _totalBodyCount = 0;

  getSystemDistances(): { name: string, distance: number }[] {
    return this._systemDistances;
  }

  getNearestOutposts(): { name: string, systemName: string, distance: number }[] {
    return this._nearestOutposts;
  }

  /**
   * Recomputes the cached system distances, nearest outposts and total body count.
   * Call this when the loaded system, the independent-outpost list, or the body
   * tree changes — not from the template.
   */
  private recomputeDerivedSystemData(): void {
    const coords = this.data?.system?.coords;
    if (!coords) {
      this._systemDistances = [];
      this._nearestOutposts = [];
      this._totalBodyCount = 0;
      return;
    }
    const { x, y, z } = coords;
    const distanceTo = (ox: number, oy: number, oz: number) =>
      Math.sqrt((x - ox) ** 2 + (y - oy) ** 2 + (z - oz) ** 2);

    const currentName = (this.data!.system.name || '').toLowerCase();
    this._systemDistances = this.referenceSystems
      .filter(ref => ref.name.toLowerCase() !== currentName)
      .map(ref => ({ name: ref.name, distance: distanceTo(ref.coords.x, ref.coords.y, ref.coords.z) }))
      .sort((a, b) => a.distance - b.distance);

    this._nearestOutposts = (this.independentOutposts ?? [])
      .map(outpost => {
        const [ox, oy, oz] = outpost.coordinates;
        return {
          name: this.decodeHtmlEntities(outpost.name),
          systemName: outpost.galMapSearch,
          distance: distanceTo(ox, oy, oz),
        };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);

    this._totalBodyCount = this.countBodies(this.bodies);
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
    this.copyToClipboard(text);
  }

  /** Writes text to the clipboard, ignoring rejection (e.g. permissions/insecure context). */
  private copyToClipboard(text: string): void {
    navigator.clipboard?.writeText(text).catch(() => { /* clipboard unavailable */ });
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
    this.copyToClipboard(`${this.data.system.id64}`);
  }
  public encodeURIComponent(value: string): string {
    return encodeURIComponent(value);
  }
  public readonly faFileCode = faFileCode;
  private _searching = false;
  /** A system requested (e.g. via query param) while a search was already in flight. */
  private pendingSystemRequest: string | null = null;

  public get searching(): boolean {
    return this._searching;
  }

  public set searching(value: boolean) {
    const wasSearching = this._searching;
    this._searching = value;
    // When a search settles, apply any request that arrived while it was running so
    // rapid system changes (e.g. clicking map markers) are not silently dropped.
    if (wasSearching && !value && this.pendingSystemRequest) {
      const next = this.pendingSystemRequest;
      this.pendingSystemRequest = null;
      if (!this.data || this.data.system.name !== next) {
        this.loadSystem(next);
      }
    }
  }

  /**
   * Populates the search box with a system name and kicks off a search. If a search
   * is already in flight, the request is deferred and applied when that one settles
   * (see the `searching` setter) so requests from any source — query params, the
   * autocomplete, or region-map marker clicks — are never silently dropped.
   */
  private loadSystem(systemName: string): void {
    if (this.searching) {
      this.pendingSystemRequest = systemName;
      return;
    }
    this.searchInput = systemName;
    this.searchControl.setValue(systemName);
    this.search();
  }

  public searchInput: string = "";
  public searchError = false;
  public searchErrorMessage: string = "";
  public data: CanonnBiostats | null = null;
  public bodies: SystemBody[] = [];
  public anchorBodyId: number | null = null;
  public searchControl = new FormControl('');
  public filteredSystems: Observable<string[]> = of([]);
  public edastroData: EdastroData | null = null;
  private systemMapping: Map<string, { systemName?: string, id64?: number }> = new Map();
  public independentOutposts: IndependentOutpost[] = [];

  public ngOnInit(): void {
    this.loadCredits();
    this.activatedRoute.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(q => {
        const requested = q["system"];
        // Ignore when there's nothing to load or it's already the loaded system.
        if (!requested || (this.data && this.data.system.name === requested)) {
          return;
        }
        // loadSystem defers automatically if a search is already in flight.
        this.loadSystem(requested);
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
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(outposts => {
        this.independentOutposts = outposts;
        // Outposts can arrive after a system is already loaded; refresh the cached
        // nearest-outpost list so the panel reflects them.
        this.recomputeDerivedSystemData();
        this.cdr.markForCheck();
      });
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
        .subscribe({
          next: data => {
            this.processBodies(data);
            this.searchControl.enable();
            // Set last so the `searching` setter can drain a deferred request.
            this.searching = false;
          },
          error: () => this.searchFailed(),
        });
      return;
    }

    if (this.isNumeric(this.searchInput)) {
      const systemAddress = parseInt(this.searchInput);
      this.searchBySystemAddress(systemAddress);
      return;
    }

    // Check EdAstro cache first (case-insensitive)
    this.appService.edastroSystems.pipe(take(1)).subscribe(edastroSystems => {
      const edastroSystem = edastroSystems.find(s =>
        this.decodeHtmlEntities(s.name).toLowerCase() === this.searchInput.toLowerCase()
      );
      if (edastroSystem && edastroSystem.id64) {
        this.searchBySystemAddress(edastroSystem.id64);
        return;
      }

      // Try Spansh if not found in EdAstro
      this.httpClient.get<{ min_max: { name: string, id64: number }[] }>(`https://us-central1-canonn-api-236217.cloudfunctions.net/query/typeahead?q=${encodeURIComponent(this.searchInput)}`)
        .subscribe({
          next: data => {
            const systems = data.min_max || [];
            // Use case-insensitive comparison to find the system
            const system = systems.find(s => s.name.toLowerCase() === this.searchInput.toLowerCase());
            if (system && system.id64) {
              this.searchBySystemAddress(system.id64);
            } else {
              this.searchFailed('System not found in database.\nSystem data is gathered from EDDN and processed by Spansh. If this is a recently discovered system, please try again later as there may be delays in processing.');
            }
          },
          error: () => this.searchFailed('Typeahead API error: Unable to search for systems. Please try again later.'),
        });
    });
  }

  private searchFailed(message: string = 'System not found'): void {
    this.searchError = true;
    this.searchErrorMessage = message;
    this.searchControl.enable();
    this.cdr.markForCheck();
    // Set last so the `searching` setter can drain a deferred request.
    this.searching = false;
  }

  private searchBySystemAddress(systemAddress: number): void {
    this.httpClient.get<CanonnBiostats>(`https://us-central1-canonn-api-236217.cloudfunctions.net/query/codex/biostats?id=${systemAddress}&caller=Signals`)
      .subscribe({
        next: data => {
          // A missing payload or system info means Spansh has no data for it yet.
          if (!data || !data.system || !data.system.name) {
            this.searchFailed('System not found in database.\nSystem data is gathered from EDDN and processed by Spansh. If this is a recently discovered system, please try again later as there may be delays in processing.');
            return;
          }
          this.processBodies(data);
          // Ensure Simbad data is updated after setting this.data
          this.updateEdGalaxyData();
          this.searchControl.enable();
          this.cdr.markForCheck();
          // Set last so the `searching` setter can drain a deferred request.
          this.searching = false;
        },
        error: error => {
          // Check for specific error messages
          const errorMessage = error?.error?.message || error?.message || '';
          if (errorMessage.toLowerCase().includes('no spansh data')) {
            this.searchFailed('System not found in Spansh database.\nSystem data is gathered from EDDN and processed by Spansh. If this is a recently discovered system, please try again later as there may be delays in processing.');
          } else if (error.status === 404) {
            this.searchFailed('System not found.\nSystem data is gathered from EDDN and processed by Spansh. If this is a recently discovered system, please try again later as there may be delays in processing.');
          } else {
            this.searchFailed(`Biostats API error: ${errorMessage || 'Unable to load system data'}. Please try again later.`);
          }
        },
      });
  }

  private processBodies(data: CanonnBiostats): void {
    // Decode HTML entities in system name
    data.system.name = this.decodeHtmlEntities(data.system.name);

    const queryParams: Params = { system: data.system.name };

    // Only update query params if not already set
    if (!this.data || this.data.system.name !== data.system.name) {
      this.router.navigate(
        [],
        {
          relativeTo: this.activatedRoute,
          queryParams,
          queryParamsHandling: 'merge',
          preserveFragment: true,
        });
    }
    this.searchInput = data.system.name;

    // Check if we're loading a different system
    const isDifferentSystem = !this.data || this.data.system.id64 !== data.system.id64;

    this.data = data;
    this.bodies = [];
    // Ensure edGalaxyData is updated/fetched when system changes
    this.updateEdGalaxyData();

    // Only reset edastroData if loading a different system
    if (isDifferentSystem) {
      this.edastroData = null;
    }

    // Only set default background if we don't have edastro data with an image
    if (!this.edastroData?.mainImage) {
      this.appService.setBackgroundImage('assets/bg1.jpg');
    }

    // The <app-region-map> child re-renders from its [system]/[outposts] inputs.

    // Fetch edastro data only if we don't have it or it's a different system
    if (isDifferentSystem || !this.edastroData) {
      this.appService.getEdastroData(data.system.id64)
        .subscribe({
          next: edastroData => {
            if (edastroData && (edastroData.name || edastroData.summary || edastroData.mainImage)) {
              this.edastroData = edastroData;
              if (edastroData.mainImage) {
                this.appService.setBackgroundImage(edastroData.mainImage);
              }
              this.cdr.markForCheck();
            }
          },
          // edastro data is optional - silently ignore failures.
          error: error => console.error('EdAstro data error:', error),
        });
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
              type: BODY_TYPE.Belt,
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
              type: BODY_TYPE.Ring,
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
                type: BODY_TYPE.Planet,
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
                type: BODY_TYPE.Star,
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
                type: BODY_TYPE.Barycentre,
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
    this.recomputeDerivedSystemData();

    const hash = window.location.hash;
    if (hash) {
      const match = hash.match(/^#body-(\d+)$/);
      if (match) {
        this.anchorBodyId = parseInt(match[1], 10);
      }
      // Wait for Angular to render the body elements, then scroll
      setTimeout(() => {
        const el = document.querySelector(hash);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
    } else {
      this.anchorBodyId = null;
    }

    // Zoneless: this method runs inside async HTTP callbacks, so explicitly
    // notify the change-detection scheduler that bound state (data/bodies) changed.
    this.cdr.markForCheck();
  }

  private isNumeric(value: string) {
    return /^\d+$/.test(value);
  }

  private getSystemSuggestions(query: string): Observable<string[]> {
    const cacheKey = query.trim().toLowerCase();
    if (this.systemSuggestionsCache.has(cacheKey)) {
      return this.systemSuggestionsCache.get(cacheKey)!;
    }

    const spansQuery = this.httpClient.get<{ values: string[] }>(`https://us-central1-canonn-api-236217.cloudfunctions.net/query/typeahead?q=${encodeURIComponent(query)}`)
      .pipe(map(response => (response.values || []).map(name => this.decodeHtmlEntities(name))));

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
          return firstValueFrom(this.appService.galMapSearch(decodedSystemName))
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

    const result$ = combineLatest([spansQuery, edastroQuery]).pipe(
      map(([spansSuggestions, edastroSuggestions]) => {
        // Store mapping for EdAstro systems
        this.appService.edastroSystems.pipe(take(1)).subscribe(systems => {
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

        return sorted.slice(0, 20);
      }),
      takeUntilDestroyed(this.destroyRef)
    );

    this.systemSuggestionsCache.set(cacheKey, result$);
    return result$;
  }

  /** A marker on the region map was clicked; load that system. */
  public onMarkerSelected(systemName: string): void {
    this.loadSystem(systemName);
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
    // Safe: assigning to a detached <textarea>'s innerHTML decodes entities without
    // executing markup (textarea content is parsed as text, not HTML).
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  }

  public getTotalBodyCount(): number {
    return this._totalBodyCount;
  }

  private countBodies(bodies: SystemBody[]): number {
    return bodies.reduce((count, body) => count + 1 + this.countBodies(body.subBodies), 0);
  }

  public trackByBody(index: number, body: SystemBody): number {
    return body.bodyData.bodyId;
  }

  public onGecImageError(event: any): void {
    // Force reload for GIFs that might have loading issues
    const img = event.target as HTMLImageElement;
    if (img.src.toLowerCase().includes('.gif')) {
      setTimeout(() => {
        img.src = img.src + '?t=' + Date.now();
      }, 100);
    }
  }

  public getBodyDisplayName(bodyName: string): string {
    return this.appService.getBodyDisplayName(bodyName);
  }

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

export interface EdGalaxyData {
  PGName: string;
  SystemAddress: number;
  Name: string;
  Simbad?: {
    Name?: string;
    Ident?: string;
    RAJ2000?: number;
    DEJ2000?: number;
  };
}

interface SimbadApiResponse {
  name: string;
  system_address: number;
  ra_j2000?: number;
  dec_j2000?: number;
  simbad_name?: string;
  simbad_ident?: string;
}
