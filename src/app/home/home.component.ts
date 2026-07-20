import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, HostListener, inject, viewChild, signal, computed, effect } from '@angular/core';
import { AppService, EdastroData } from '../app.service';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { faChartColumn, faChevronDown, faDownload, faFileCode, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { MatDialog } from '@angular/material/dialog';
import { openLazyDialog } from '../dialogs/lazy-dialog';
import type { HistogramDialogData } from '../dialogs/histogram-dialog/histogram-dialog.component';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { PGSystem } from 'src/app/data/pgnames/PGSystem';
import { MatFormField, MatLabel, MatError } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatAutocompleteTrigger, MatAutocomplete, MatOption } from '@angular/material/autocomplete';
import { MatButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { SystemBodyComponent } from '../system-body/system-body.component';
import { RegionMapComponent } from '../region-map/region-map.component';
import { CanonnLogoComponent } from '../canonn-logo/canonn-logo.component';
import { DecimalPipe } from '@angular/common';
import { BODY_TYPE } from '../data/body-types';
import { logger } from '../data/logger';
import { decodeHtmlEntities } from '../data/html-entities';
import { CREDITS_HTML } from '../data/credits.generated';
import { findNearestNebulae, NearestNebula } from '../data/nebulae';
import { isPermitLockedSystem } from '../data/permit-locked-systems';
import { applySpeculativeBodies, getSpeculativeSystemCompleteness, getSpeculativeSystemInfo, getSystemMapImage, isSpeculativeBodySystem, SystemMapImage } from '../data/speculative-systems';
import { BodyEnrichmentService } from '../data/body-enrichment.service';
import { buildSystemExport, downloadJson, serializeSystemExport, systemExportFilename } from '../data/system-export';
import { buildMegashipIndex, megashipRoute, megashipsAtSystem, MegashipSystemEntry } from '../data/megaships';
import type { MegashipRouteDialogData } from '../dialogs/megaship-route-dialog/megaship-route-dialog.component';
import { BodyPhysicsService } from '../data/body-physics.service';
import { OrbitalRelationsService } from '../data/orbital-relations.service';
import { BodyInterestRegistryService } from '../data/body-interest-registry.service';
import {
  FilterCategory, FilterCommand, walkBodies, collectMatchingBodies,
  hasBiologySignals, hasGeologySignals, hasGuardianSignals, hasThargoidSignals, hasHumanSignals, isLandable,
  getBodyMaterialKeys, getBodyHotspotKeys, isTouristInteresting,
} from '../data/body-filters';
import { MINING_RESOURCES } from '../data/mining-resources';

/** A Megaships-table row: the ship plus its resolved current-location display label. */
interface MegashipRow {
  signalName: string;
  shipName: string;
  locationLabel: string;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatFormField, MatLabel, MatInput, ReactiveFormsModule, MatAutocompleteTrigger, MatAutocomplete, MatOption, MatError, MatButton, FaIconComponent, SystemBodyComponent, RegionMapComponent, CanonnLogoComponent, DecimalPipe, MatTooltip]
})
export class HomeComponent implements OnInit, OnDestroy {
  readonly appService = inject(AppService);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly enrichment = inject(BodyEnrichmentService);
  private readonly physics = inject(BodyPhysicsService);
  private readonly orbitalRelations = inject(OrbitalRelationsService);
  private readonly interestRegistry = inject(BodyInterestRegistryService);

  private lastSimbadSystemName: string | null = null;
  private lastSimbadId64: bigint | null = null;
  // Monotonic token so a slow SIMBAD response for a previously-selected system
  // can't overwrite edGalaxyData after the user has navigated to another one.
  private edGalaxyGeneration = 0;
  // Credits are extracted from readme.md at build time by scripts/generate-credits.js.
  // Bound via [innerHTML], which Angular sanitizes; the source is a trusted local file.
  public creditsHtml: string = CREDITS_HTML;
  // In-memory cache for typeahead suggestions
  private systemSuggestionsCache: Map<string, Promise<string[]>> = new Map();

  openSimbadPageRaw(ident: string) {
    if (!ident) return;
    window.open(`https://simbad.harvard.edu/simbad/sim-id?Ident=@${encodeURIComponent(ident)}`, '_blank', 'noopener,noreferrer');
  }

  // Format RAJ2000 (degrees) to '19h 21m 45.0s' (rounded to 0.1s, padded)
  formatRAJ2000(ra: number): string {
    if (typeof ra !== 'number' || isNaN(ra)) return '';
    const totalSeconds = ra * 240; // 360deg = 24h, so 1deg = 240s
    let hours = Math.floor(totalSeconds / 3600);
    let minutes = Math.floor((totalSeconds % 3600) / 60);
    // Round the seconds to the displayed precision (0.1s) first, then carry any
    // rollover into minutes/hours so we never render a "60.0s" (or "60m") field.
    let seconds = Math.round((totalSeconds % 60) * 10) / 10;
    if (seconds >= 60) { seconds -= 60; minutes += 1; }
    if (minutes >= 60) { minutes -= 60; hours += 1; }
    if (hours >= 24) { hours -= 24; } // RA wraps at 24h
    // Pad minutes and seconds to 2 digits, seconds to 1 decimal
    const pad = (n: number, d = 2) => n.toString().padStart(d, '0');
    return `${hours}h ${pad(minutes)}m ${seconds.toFixed(1).padStart(4, '0')}s`;
  }

  // Format DEJ2000 (degrees) to '+21° 53′ 02.3″' (rounded to 0.1″, padded)
  formatDEJ2000(de: number): string {
    if (typeof de !== 'number' || isNaN(de)) return '';
    const sign = de >= 0 ? '+' : '-';
    const abs = Math.abs(de);
    let degrees = Math.floor(abs);
    let arcminutes = Math.floor((abs - degrees) * 60);
    // Round to the displayed precision (0.1″) first, then carry any rollover into
    // arcminutes/degrees so we never render a "60.0″" (or "60′") field.
    let arcseconds = Math.round((abs - degrees - arcminutes / 60) * 3600 * 10) / 10;
    if (arcseconds >= 60) { arcseconds -= 60; arcminutes += 1; }
    if (arcminutes >= 60) { arcminutes -= 60; degrees += 1; }
    // Pad arcminutes and arcseconds
    const pad = (n: number, d = 2) => n.toString().padStart(d, '0');
    return `${sign}${degrees}° ${pad(arcminutes)}′ ${arcseconds.toFixed(1).padStart(4, '0')}″`;
  }

  public readonly edGalaxyData = signal<EdGalaxyData | null>(null);
  // Simbad cache and file loading logic removed (now using API)

  // Convert id64 to PGName using PGSystem, formatted for Elite Dangerous
  getPGName(id64: string | number | bigint): string {
    try {
      // Accept id64 as string, number or bigint; BigInt() handles all three. id64
      // should already be a bigint (see parseJsonWithBigIntIds) to retain precision.
      const id64BigInt = BigInt(id64);

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

      // Elite Dangerous omits the N1 field (and its hyphen) when it is zero, so
      // "Synuefe WH-F c0" (N1=0, N2=0) must not render as "Synuefe WH-F c0-0".
      const index = mid3 !== 0 ? `${mid3}-${seq}` : `${seq}`;
      const result = `${titleCasedRegion} ${mid1a}${mid1b}-${mid2} ${mcode}${index}`;
      return result;
    } catch (e) {
      logger.error('[getPGName] Error:', e);
      return '';
    }
  }

  fetchEdGalaxyData(systemName: string, id64: bigint, coords?: { x: number, y: number, z: number }) {
    const pgName = this.getPGName(id64);
    // Claim this request's slot; a later fetch bumps the token so this one's
    // async result is discarded rather than clobbering the newer system's data.
    const generation = ++this.edGalaxyGeneration;

    // The PGName is derived synchronously from the id64, so publish it immediately. Previously we
    // waited for the async Simbad lookup before setting edGalaxyData at all, which left the "PG Name"
    // row absent (edGalaxyData === null) for the whole request — so it flashed out and back in as the
    // reserved-space skeleton handed over to the real view. Simbad (when present) is merged in later,
    // and the PGName row stays put throughout.
    const pgOnly = { PGName: pgName, SystemAddress: id64, Name: systemName, Simbad: undefined };
    this.edGalaxyData.set(pgOnly);

    // Skip the Simbad lookup for procedurally-generated systems: when the
    // PGName matches the system name, the name is a valid PG name, or it
    // contains "Sector". Simbad only has hand-authored systems.
    if (pgName.toLowerCase() === systemName.toLowerCase()
      || PGSystem.isPGSystemName(systemName)
      || systemName.toLowerCase().includes('sector')) {
      return;
    }

    // Call the API for Simbad data and merge it in when it resolves.
    this.appService.getSimbad(id64, systemName, coords)
      .then(result => {
        // Drop the response if the user has since navigated to another system.
        if (generation !== this.edGalaxyGeneration) {
          return;
        }
        // Remap API response to expected structure for edGalaxyData
        const hasSimbad = result.simbad_name || result.simbad_ident
          || result.ra_j2000 !== undefined || result.dec_j2000 !== undefined;
        this.edGalaxyData.set({
          PGName: pgName,
          SystemAddress: result.system_address,
          Name: result.name,
          Simbad: hasSimbad ? {
            Name: result.simbad_name,
            Ident: result.simbad_ident,
            RAJ2000: result.ra_j2000,
            DEJ2000: result.dec_j2000
          } : undefined
        });
      })
      // On failure the synchronously-published PGName-only data already stands; reaffirm it only
      // while this request is still the current one.
      .catch(() => {
        if (generation === this.edGalaxyGeneration) {
          this.edGalaxyData.set(pgOnly);
        }
      });
  }

  updateEdGalaxyData() {
    const data = this.data();
    if (!data?.system?.name || !data?.system?.id64) {
      return;
    }
    const currentName = data.system.name;
    const currentId64 = data.system.id64;
    if (this.lastSimbadSystemName === currentName && this.lastSimbadId64 === currentId64) {
      return;
    }
    // Clear previous data immediately when switching systems
    this.edGalaxyData.set(null);
    this.lastSimbadSystemName = currentName;
    this.lastSimbadId64 = currentId64;
    this.fetchEdGalaxyData(currentName, currentId64, data.system.coords);
  }
  openSignalsPage(systemName: string) {
    const url = `?system=${encodeURIComponent(systemName)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  // --- Loading-shell placeholders (the `@else if (searching)` branch in the template) ------------
  // Reserved-space rows for the system chrome while the biostats payload is in flight. Grouped into
  // two shapes so the template drives each with one loop (no per-section copy-paste):
  //  - labelled sections (Location, Society): the static row label renders as real text — identical
  //    for every system — and only the per-system value cell shimmers, with a `value` width (px)
  //    picked so the column reads naturally.
  //  - shimmer sections (Distances, Nearest DSSA, Nearest Nebulae): the row has no static label (the
  //    system name is per-system too), so both the `name` and `value` cells shimmer.
  // Bodies are unknown until data arrives, so those rows stay fully generic.
  protected readonly loadingLabelledSections: readonly {
    header: string, rows: readonly { label: string, value: number }[],
  }[] = [
    {
      header: 'Location',
      rows: [
        { label: 'PG Name', value: 96 },
        { label: 'Region', value: 120 },
        { label: 'Id64', value: 110 },
        { label: 'Coordinates', value: 140 },
        { label: 'Permit required', value: 30 },
        { label: 'Info updated', value: 100 },
      ],
    },
    {
      header: 'Society',
      rows: [
        { label: 'Economy', value: 96 },
        { label: 'Government', value: 110 },
        { label: 'Allegiance', value: 80 },
        { label: 'Controlling faction', value: 130 },
        { label: 'Security', value: 60 },
      ],
    },
  ];
  protected readonly loadingShimmerSections: readonly {
    header: string, rows: readonly { name: number, value: number }[],
  }[] = [
    {
      header: 'Distances',
      rows: [
        { name: 132, value: 58 },
        { name: 104, value: 54 },
        { name: 150, value: 64 },
        { name: 116, value: 50 },
        { name: 128, value: 60 },
      ],
    },
    {
      header: 'Nearest DSSA',
      rows: [
        { name: 138, value: 60 },
        { name: 110, value: 54 },
        { name: 126, value: 64 },
      ],
    },
    {
      header: 'Nearest Nebulae',
      rows: [
        { name: 122, value: 58 },
        { name: 148, value: 62 },
        { name: 134, value: 56 },
      ],
    },
    {
      header: 'Megaships',
      rows: [
        { name: 140, value: 60 },
        { name: 116, value: 56 },
      ],
    },
  ];
  protected readonly loadingBodyRows: readonly number[] = [0, 1, 2, 3, 4, 5];

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
    const data = this.data();
    if (!data?.system?.name) return false;
    const systemName = data.system.name;
    return this.voyagerGoldenRecordSystems.some(name =>
      name.toLowerCase() === systemName.toLowerCase()
    );
  }

  // Derived as computed signals from the loaded system, outpost feed and body tree:
  // they recompute lazily only when those inputs change (never on an unrelated CD
  // pass) and return stable references the @for blocks track by object identity.
  readonly getSystemDistances = computed<{ name: string, distance: number }[]>(() => {
    const data = this.data();
    const coords = data?.system?.coords;
    if (!coords) {
      return [];
    }
    const currentName = (data.system.name || '').toLowerCase();
    return this.referenceSystems
      .filter(ref => ref.name.toLowerCase() !== currentName)
      .map(ref => ({ name: ref.name, distance: this.distance3d(coords, ref.coords) }))
      .sort((a, b) => a.distance - b.distance);
  });

  readonly getNearestOutposts = computed<{ name: string, systemName: string, distance: number }[]>(() => {
    const coords = this.data()?.system?.coords;
    if (!coords) {
      return [];
    }
    return (this.independentOutposts() ?? [])
      .map(outpost => {
        const [ox, oy, oz] = outpost.coordinates;
        return {
          name: this.decodeHtmlEntities(outpost.name),
          systemName: outpost.galMapSearch,
          distance: this.distance3d(coords, { x: ox, y: oy, z: oz }),
        };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);
  });

  readonly getNearestNebulae = computed<NearestNebula[]>(() => {
    const coords = this.data()?.system?.coords;
    const nebulae = this.appService.nebulae();
    if (!coords || nebulae.length === 0) {
      return [];
    }
    return findNearestNebulae(coords, nebulae, 3);
  });

  // --- Megaships (issue #114) --------------------------------------------------------------
  // Rebuilt only when the schedule itself changes (a one-shot asset load), not on every
  // system search — megashipEntries below is the one that recomputes per system.
  private readonly megashipIndex = computed(() => {
    const schedule = this.appService.megashipSchedule();
    return schedule ? buildMegashipIndex(schedule) : null;
  });

  readonly megashipEntries = computed<MegashipSystemEntry[]>(() => {
    const schedule = this.appService.megashipSchedule();
    const index = this.megashipIndex();
    const system = this.data()?.system;
    if (!schedule || !index || !system) {
      return [];
    }
    // The schedule stores system addresses as plain JSON numbers, not the bigint-upgraded
    // id64/system_address fields json-bigint.ts recognises — anything above 2^53 would
    // already have lost precision in the source file, an accepted limit of that data.
    const systemId64 = Number(system.id64);
    if (!Number.isSafeInteger(systemId64)) {
      return [];
    }
    const asOf = new Date(this.appService.nowOverride() ?? Date.now());
    return megashipsAtSystem(systemId64, asOf, schedule, index);
  });

  readonly megashipRows = computed<MegashipRow[]>(() => {
    const names = this.appService.systemNames();
    return this.megashipEntries().map(entry => ({
      signalName: entry.signalName,
      shipName: entry.shipName,
      locationLabel: this.megashipLocationLabel(entry, names),
    }));
  });

  private megashipLocationLabel(entry: MegashipSystemEntry, names: ReadonlyMap<string, string>): string {
    if (entry.presentNow) {
      return 'Present';
    }
    if (entry.currentSystemId64 === null) {
      return 'Unknown';
    }
    return names.get(String(entry.currentSystemId64)) ?? '…';
  }

  /** Best-effort name lookup for every megaship's current location not already shown as "Present". */
  private readonly requestMegashipLocationNames = effect(() => {
    for (const entry of this.megashipEntries()) {
      if (!entry.presentNow && entry.currentSystemId64 !== null) {
        this.appService.requestSystemName(entry.currentSystemId64);
      }
    }
  });

  /** Opens the route-detail dialog for a Megaships table row, showing every stop and its due date. */
  public openMegashipRouteDialog(signalName: string): void {
    const schedule = this.appService.megashipSchedule();
    const ship = schedule?.ships.find(s => s.signal_name === signalName);
    if (!schedule || !ship) {
      return;
    }
    const asOf = new Date(this.appService.nowOverride() ?? Date.now());
    const stops = megashipRoute(ship, asOf, schedule);

    openLazyDialog(this.dialog, {
      loader: () => import('../dialogs/megaship-route-dialog/megaship-route-dialog.component').then(m => m.MegashipRouteDialogComponent),
      skeleton: 'text',
      width: '700px',
      maxWidth: '95vw',
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop',
      data: {
        signalName: ship.signal_name,
        shipName: ship.ship_name,
        type: ship.type,
        confirmed: ship.type === 'cycle' ? ship.confirmed : true,
        lastSeen: ship.last_seen,
        firstSeen: ship.type === 'static' ? ship.first_seen : undefined,
        weeksConfirmed: ship.type === 'static' ? ship.weeks_confirmed : undefined,
        routeLen: ship.type === 'cycle' ? ship.route_len : undefined,
        stops,
      } satisfies MegashipRouteDialogData,
    });
  }

  readonly getTotalBodyCount = computed<number>(() => this.countBodies(this.bodies()));

  /**
   * System scan completeness: how many bodies we know about versus the system's
   * total body count from the system JSON. `known` counts the real bodies in the
   * JSON's `bodies` array — stars, planets and moons — which is what `bodyCount`
   * counts too. Belts, rings and barycentres are excluded: the game does not count
   * them as bodies, so including them would inflate the percentage (e.g. Sol's
   * `bodies` array carries a Barycentre entry on top of its 40 real bodies).
   * (Deliberately not `getTotalBodyCount()`, which counts the rendered tree including
   * those synthesized ring/belt/barycentre nodes.) If we know about more bodies than
   * the reported count (stale/under-reported `bodyCount`), the percentage is capped at
   * 100. When the system JSON has no `bodyCount`, `percent` is null (rendered as
   * "?%"/Unknown).
   */
  readonly systemCompleteness = computed<{ known: number; total: number | null; percent: number | null }>(() => {
    const system = this.data()?.system;
    const override = system ? getSpeculativeSystemCompleteness(system.id64) : null;
    if (override) {
      return override;
    }
    const known = (system?.bodies ?? []).filter(body =>
      body.type !== BODY_TYPE.Belt &&
      body.type !== BODY_TYPE.Ring &&
      body.type !== BODY_TYPE.Barycentre,
    ).length;
    const total = system?.bodyCount ?? null;
    const percent = total ? Math.min(100, Math.round((known / total) * 100)) : null;
    return { known, total, percent };
  });

  /**
   * Info-panel paragraphs for a system with a Thargoid-map tie-in (currently Col 70 Sector
   * FY-N c21-3 and Merope, see data/speculative-systems.ts), or `null` for every other
   * system. Shown between System Completeness and the quick-filter toolbar.
   */
  readonly speculativeSystemInfo = computed<readonly string[] | null>(() => {
    const id64 = this.data()?.system?.id64;
    return id64 !== undefined ? getSpeculativeSystemInfo(id64) : null;
  });

  /** The info panel's right-hand map image for the loaded system, or `null`. */
  readonly systemMapImage = computed<SystemMapImage | null>(() => {
    const id64 = this.data()?.system?.id64;
    return id64 !== undefined ? getSystemMapImage(id64) : null;
  });

  /**
   * True only for a system whose body list is itself a speculative reconstruction
   * (currently just Col 70 Sector FY-N c21-3) — unlike Merope, which also gets an info
   * panel but has real body data. Drives defaulting the root body to only its main star
   * expanded, so the page doesn't open onto a wall of speculative detail.
   */
  readonly defaultExpandStarOnly = computed<boolean>(() => {
    const id64 = this.data()?.system?.id64;
    return id64 !== undefined && isSpeculativeBodySystem(id64);
  });

  /**
   * Whether the loaded system requires a permit. The biostats API carries no
   * permit field, so this is matched against a hand-maintained static list
   * (see permit-locked-systems.ts).
   */
  readonly isPermitLocked = computed<boolean>(() => {
    const system = this.data()?.system;
    return !!system && isPermitLockedSystem(system.name);
  });

  /**
   * Combined economy label, e.g. "Refinery / Service". Drops the placeholder
   * "None" and any null/duplicate so a single-economy system shows just one name
   * and an unpopulated system shows nothing.
   */
  systemEconomyDisplay(system: CanonnBiostats['system']): string {
    const seen = new Set<string>();
    const parts: string[] = [];
    for (const economy of [system.primaryEconomy, system.secondaryEconomy]) {
      if (!economy || economy === 'None') continue;
      if (seen.has(economy)) continue;
      seen.add(economy);
      parts.push(economy);
    }
    return parts.join(' / ');
  }

  /**
   * Formats the system's update timestamp — a UTC value like "2026-06-19 16:46:17+00"
   * — as wall-clock time in the browser's local time zone (e.g. "2026-06-19 18:46" for
   * a UTC+2 viewer). The layout is fixed ("YYYY-MM-DD HH:mm") and locale-independent;
   * only the zone offset varies. Uses the timestamp's own offset, not the current
   * clock, so it stays deterministic under the e2e timezone pin. Returns '' for a
   * missing date and the raw string if it can't be parsed.
   */
  formatUpdated(date: string | null | undefined): string {
    if (!date) return '';
    // Normalise the API's "YYYY-MM-DD HH:mm:ss+00" into a parseable ISO instant
    // (space → 'T', bare "+00" hour offset → "+00:00"), then render local components.
    const iso = date.trim().replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00');
    const instant = new Date(iso);
    if (isNaN(instant.getTime())) return date;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${instant.getFullYear()}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())} `
      + `${pad(instant.getHours())}:${pad(instant.getMinutes())}`;
  }

  /**
   * Tooltip companion to {@link formatUpdated}: repeats the update timestamp on two lines,
   * first as the viewer's local time (with the zone offset that applied on that date, so
   * DST is honoured) and then as UTC. Both lines carry seconds for precision. Uses the
   * timestamp's own offset rather than the current clock, so it stays deterministic under
   * the e2e timezone pin. Returns '' for a missing date and the raw string if unparseable.
   */
  formatUpdatedTooltip(date: string | null | undefined): string {
    if (!date) return '';
    const iso = date.trim().replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00');
    const instant = new Date(iso);
    if (isNaN(instant.getTime())) return date;
    const pad = (n: number) => String(n).padStart(2, '0');
    const local = `${instant.getFullYear()}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())} `
      + `${pad(instant.getHours())}:${pad(instant.getMinutes())}:${pad(instant.getSeconds())}`;
    const utc = `${instant.getUTCFullYear()}-${pad(instant.getUTCMonth() + 1)}-${pad(instant.getUTCDate())} `
      + `${pad(instant.getUTCHours())}:${pad(instant.getUTCMinutes())}:${pad(instant.getUTCSeconds())}`;
    // getTimezoneOffset() is minutes *behind* UTC, so negate to get the conventional
    // "minutes east of UTC" used in the "UTC±HH:MM" label.
    const offsetMin = -instant.getTimezoneOffset();
    const sign = offsetMin >= 0 ? '+' : '-';
    const absMin = Math.abs(offsetMin);
    const offset = `UTC${sign}${pad(Math.floor(absMin / 60))}:${pad(absMin % 60)}`;
    return `${local} local time (${offset})\n${utc} UTC`;
  }

  private distance3d(a: { x: number, y: number, z: number }, b: { x: number, y: number, z: number }): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
  }
  copyCoordinatesToClipboard(separator?: 'comma' | 'tab' | 'pipe', event?: MouseEvent) {
    if (event) {
      event.preventDefault();
    }
    const data = this.data();
    if (!data?.system?.coords) return;
    const coords = data.system.coords;
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
    const data = this.data();
    if (!data?.system?.id64) return;
    this.copyToClipboard(`${data.system.id64}`);
  }

  /**
   * Downloads the whole system as a Spansh-shaped JSON dump with each body (and ring/belt)
   * enriched with a `calculated` block. Uses a single `now` epoch so every body's
   * time-dependent values share one reproducible instant.
   */
  public exportSystem(data: CanonnBiostats): void {
    // Honour the app clock override (used by the `?t=` param and frozen-clock e2e fixtures) so
    // the export's time-dependent values match what the UI shows.
    const now = this.appService.nowOverride() ?? Date.now();
    const exportData = buildSystemExport(data, this.bodies(), this.enrichment, now);
    downloadJson(systemExportFilename(data.system.name), serializeSystemExport(exportData));
  }
  public encodeURIComponent(value: string): string {
    return encodeURIComponent(value);
  }
  public readonly faFileCode = faFileCode;
  public readonly faDownload = faDownload;
  public readonly faMagnifyingGlass = faMagnifyingGlass;
  public readonly faChartColumn = faChartColumn;
  public readonly faChevronDown = faChevronDown;
  private readonly dialog = inject(MatDialog);

  /** Opens the body-type histogram for the current system. */
  public async showBodyHistogram(): Promise<void> {
    const data = this.data();
    if (!data) return;
    openLazyDialog(this.dialog, {
      loader: () => import('../dialogs/histogram-dialog/histogram-dialog.component').then(m => m.HistogramDialogComponent),
      skeleton: 'diagram',
      width: '640px',
      maxWidth: '95vw',
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop',
      data: {
        systemName: data.system.name,
        bodies: data.system.bodies,
        totalBodyCount: data.system.bodyCount ?? null,
      } satisfies HistogramDialogData,
    });
  }
  private readonly _searching = signal(false);
  /**
   * Fade the loading shell in only when it first appears with no system panel already on screen
   * (a fresh search from the landing page). Set in `startSearch`; a re-search over an already-visible
   * panel leaves it false so the shell swaps in place, and the shell→loaded hand-over is always an
   * instant swap — the reserved-space chrome means neither needs a fade, and fading the loaded view
   * in over the shell would flash the background through the panel.
   */
  protected readonly fadeInPanel = signal(false);
  /** A system requested (e.g. via query param) while a search was already in flight. */
  private pendingSystemRequest: string | null = null;

  public get searching(): boolean {
    return this._searching();
  }

  public set searching(value: boolean) {
    const wasSearching = this._searching();
    this._searching.set(value);
    // When a search settles, apply any request that arrived while it was running so
    // rapid system changes (e.g. clicking map markers) are not silently dropped.
    if (wasSearching && !value && this.pendingSystemRequest) {
      const next = this.pendingSystemRequest;
      this.pendingSystemRequest = null;
      const data = this.data();
      if (!data || data.system.name !== next) {
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

  /**
   * Resets result/error state and raises the in-flight guard (`searching`). Shared by
   * `search()` and the id64 fast-path (`onSystemSelected`) so both set up identical state
   * and a search can't be started while another is running.
   */
  private startSearch(): void {
    // Fade the loading shell in only when no system panel is currently on screen; a re-search over
    // an already-visible panel (loaded, or a still-running search) swaps in place without a fade.
    // Capture this before clearing the state below.
    this.fadeInPanel.set(this.data() === null && !this._searching());
    this.data.set(null);
    this.bodies.set([]);
    this.searching = true;
    this.searchError.set(false);
    this.searchErrorMessage.set('');
    // Close any open suggestion panel as the search takes over.
    this.autocompleteTrigger()?.closePanel();
    this.searchControl.disable();
  }

  public searchInput: string = "";
  public readonly searchError = signal(false);
  public readonly searchErrorMessage = signal('');
  public readonly data = signal<CanonnBiostats | null>(null);
  public readonly bodies = signal<SystemBody[]>([]);
  public readonly anchorBodyId = signal<number | null>(null);

  /** id64 of the loaded system, threaded down to every SystemBodyComponent as a key for the async collision registry. */
  public readonly systemKey = computed<bigint | null>(() => this.data()?.system?.id64 ?? null);

  // --- Quick filters (see body-filters.ts) ---
  public readonly activeFilterCategory = signal<FilterCategory | null>(null);
  public readonly filterCommand = signal<FilterCommand | null>(null);
  private filterTokenSeq = 0;
  public readonly selectedMaterials = signal<Set<string>>(new Set());
  public readonly selectedHotspots = signal<Set<string>>(new Set());
  public readonly materialsMenuOpen = signal(false);
  public readonly miningMenuOpen = signal(false);

  public readonly biologyMatches = computed(() => collectMatchingBodies(this.bodies(), hasBiologySignals));
  public readonly geologyMatches = computed(() => collectMatchingBodies(this.bodies(), hasGeologySignals));
  public readonly guardianMatches = computed(() => collectMatchingBodies(this.bodies(), hasGuardianSignals));
  public readonly thargoidMatches = computed(() => collectMatchingBodies(this.bodies(), hasThargoidSignals));
  public readonly humanMatches = computed(() => collectMatchingBodies(this.bodies(), hasHumanSignals));
  public readonly landableMatches = computed(() => collectMatchingBodies(this.bodies(), isLandable));

  /**
   * Synchronous "special badge" criteria only (see {@link isTouristInteresting}). Orbital
   * collision candidates resolve later, off the main thread, and are folded in separately by
   * {@link touristMatches} so the Tourist filter (and its visibility) can still catch up once
   * those results land.
   */
  private readonly touristSyncMatches = computed(() =>
    collectMatchingBodies(this.bodies(), body => isTouristInteresting(body, this.physics, this.orbitalRelations)));
  public readonly touristMatches = computed(() => {
    const collisionBodies = this.interestRegistry.collisionCandidateBodies();
    if (collisionBodies.size === 0) { return this.touristSyncMatches(); }
    const merged = new Set(this.touristSyncMatches());
    for (const body of collisionBodies) { merged.add(body); }
    return merged;
  });

  /** Material keys present anywhere in the system, for populating the Materials dropdown (and hiding it when empty). */
  public readonly availableMaterialKeys = computed(() => {
    const keys = new Set<string>();
    walkBodies(this.bodies(), body => { for (const key of getBodyMaterialKeys(body)) { keys.add(key); } });
    return Array.from(keys).sort((a, b) => a.localeCompare(b));
  });
  /** Mining-hotspot resource keys present anywhere in the system, for the Mining dropdown. */
  public readonly availableHotspotKeys = computed(() => {
    const keys = new Set<string>();
    walkBodies(this.bodies(), body => { for (const key of getBodyHotspotKeys(body)) { keys.add(key); } });
    return Array.from(keys).sort((a, b) => a.localeCompare(b));
  });

  /** Collapses every body except those in `bodies` (or every body, for `'all'`) and marks `category` as the active filter. */
  private applyFilter(category: FilterCategory, bodies: Set<SystemBody> | 'all'): void {
    this.activeFilterCategory.set(category);
    this.filterCommand.set({ token: ++this.filterTokenSeq, bodies });
  }

  public onBiologyFilterClick(): void { this.applyFilter('biology', this.biologyMatches()); }
  public onGeologyFilterClick(): void { this.applyFilter('geology', this.geologyMatches()); }
  public onGuardianFilterClick(): void { this.applyFilter('guardian', this.guardianMatches()); }
  public onThargoidFilterClick(): void { this.applyFilter('thargoid', this.thargoidMatches()); }
  public onHumanFilterClick(): void { this.applyFilter('human', this.humanMatches()); }
  public onLandableFilterClick(): void { this.applyFilter('landable', this.landableMatches()); }
  public onTouristFilterClick(): void { this.applyFilter('tourist', this.touristMatches()); }
  public onEverythingFilterClick(): void { this.applyFilter('everything', 'all'); }

  public toggleMaterialsMenu(): void {
    this.miningMenuOpen.set(false);
    this.materialsMenuOpen.set(!this.materialsMenuOpen());
  }

  public toggleMiningMenu(): void {
    this.materialsMenuOpen.set(false);
    this.miningMenuOpen.set(!this.miningMenuOpen());
  }

  /** Closes the Materials/Mining dropdown menus on any click outside them (the menus themselves stop propagation). */
  @HostListener('document:click')
  public closeFilterMenus(): void {
    this.materialsMenuOpen.set(false);
    this.miningMenuOpen.set(false);
  }

  /** Toggles `material` in the selection and immediately re-applies the Materials filter. */
  public toggleMaterialSelection(material: string): void {
    const next = new Set(this.selectedMaterials());
    if (next.has(material)) { next.delete(material); } else { next.add(material); }
    this.selectedMaterials.set(next);
    if (next.size === 0) {
      if (this.activeFilterCategory() === 'materials') {
        this.activeFilterCategory.set(null);
        this.filterCommand.set(null);
      }
      return;
    }
    this.applyFilter('materials', collectMatchingBodies(this.bodies(), body => getBodyMaterialKeys(body).some(key => next.has(key))));
  }

  public hotspotDisplayName(resourceKey: string): string {
    return MINING_RESOURCES[resourceKey]?.name ?? resourceKey;
  }

  /** Toggles `resource` in the selection and immediately re-applies the Mining filter. */
  public toggleHotspotSelection(resource: string): void {
    const next = new Set(this.selectedHotspots());
    if (next.has(resource)) { next.delete(resource); } else { next.add(resource); }
    this.selectedHotspots.set(next);
    if (next.size === 0) {
      if (this.activeFilterCategory() === 'mining') {
        this.activeFilterCategory.set(null);
        this.filterCommand.set(null);
      }
      return;
    }
    this.applyFilter('mining', collectMatchingBodies(this.bodies(), body => getBodyHotspotKeys(body).some(key => next.has(key))));
  }

  public searchControl = new FormControl('');
  public readonly filteredSystems = signal<string[]>([]);
  private readonly autocompleteTrigger = viewChild(MatAutocompleteTrigger);
  public readonly edastroData = signal<EdastroData | null>(null);
  // Read the outposts signal straight off the service — the getNearestOutposts
  // computed below depends on it, so the panel refreshes when the feed arrives.
  public readonly independentOutposts = this.appService.independentOutposts;

  // Display-name -> systemName/id64 lookup used by onSystemSelected, derived from
  // the EdAstro feed (recomputes when it changes; reads are synchronous).
  private readonly systemMapping = computed(() => {
    const map = new Map<string, { systemName?: string, id64?: bigint }>();
    for (const system of this.appService.edastroSystems()) {
      const displayName = this.decodeHtmlEntities(system.name);
      const systemName = system.galMapSearch ? this.decodeHtmlEntities(system.galMapSearch) : displayName;
      map.set(displayName, { systemName, id64: system.id64 });
    }
    return map;
  });

  public ngOnInit(): void {
    // Apply optional ?t= timestamp override (ISO-8601 or ms since epoch) for debugging.
    const tParam = this.activatedRoute.snapshot.queryParamMap.get('t');
    if (tParam) {
      const ms = Date.parse(tParam);
      if (Number.isFinite(ms)) { this.appService.setNowOverride(ms); }
    }
    // Handle the initial deep-link (?system=…) from the route snapshot…
    this.handleSystemParam(this.activatedRoute.snapshot.queryParamMap.get('system') ?? undefined);
    // …and browser back/forward. In-app navigations (from processBodies) are guarded by
    // the data() check below, so they don't trigger a redundant reload.
    window.addEventListener('popstate', this.onPopState);
  }

  public ngOnDestroy(): void {
    window.removeEventListener('popstate', this.onPopState);
    if (this.suggestionDebounceTimer !== null) {
      clearTimeout(this.suggestionDebounceTimer);
    }
  }

  /** Reads the `system` query param after browser back/forward navigation. */
  private readonly onPopState = (): void => {
    const requested = new URLSearchParams(window.location.search).get('system');
    this.handleSystemParam(requested ?? undefined);
  };

  /** Loads the requested system unless it's empty or already shown. */
  private handleSystemParam(requested: string | undefined): void {
    // Ignore when there's nothing to load or it's already the loaded system.
    if (!requested || (this.data()?.system.name === requested)) {
      return;
    }
    // loadSystem defers automatically if a search is already in flight.
    this.loadSystem(requested);
  }

  /** Debounce timer + generation guard replacing the former valueChanges → debounceTime →
   *  distinctUntilChanged → switchMap pipeline (see onSearchInput / runSuggestions). */
  private suggestionDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSuggestionQuery: string | null = null;
  private suggestionGeneration = 0;

  /** Bound to the search input's (input) event; debounces suggestion lookups by 300ms. */
  public onSearchInput(): void {
    const value = this.searchControl.value ?? '';
    if (this.suggestionDebounceTimer !== null) {
      clearTimeout(this.suggestionDebounceTimer);
    }
    this.suggestionDebounceTimer = setTimeout(() => {
      this.suggestionDebounceTimer = null;
      void this.runSuggestions(value);
    }, 300);
  }

  private async runSuggestions(value: string): Promise<void> {
    // distinctUntilChanged: skip if the (debounced) query is unchanged (don't cancel its
    // own in-flight lookup).
    if (value === this.lastSuggestionQuery) {
      return;
    }
    this.lastSuggestionQuery = value;

    // switchMap semantics: a new query supersedes any older in-flight lookup. Bump the
    // generation BEFORE the suppression gate too, so a suppressed/short query still
    // invalidates a slower, earlier lookup (otherwise it could resolve and reopen the
    // panel over the loading/results view).
    const generation = ++this.suggestionGeneration;

    // Suppress suggestions while a search is running, or for queries too short to be useful.
    if (this.searching || !value || value.length < 3) {
      this.filteredSystems.set([]);
      return;
    }

    try {
      const suggestions = await this.getSystemSuggestions(value);
      if (generation === this.suggestionGeneration) {
        this.filteredSystems.set(suggestions);
      }
    } catch {
      if (generation === this.suggestionGeneration) {
        this.filteredSystems.set([]);
      }
    }
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
    this.startSearch();

    // Load test system
    if (this.searchInput.toLowerCase() === 'test') {
      fetch('assets/test-system.json')
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          return response.json() as Promise<CanonnBiostats>;
        })
        .then(data => {
          this.processBodies(data);
          this.searchControl.enable();
          // Set last so the `searching` setter can drain a deferred request.
          this.searching = false;
        })
        .catch(() => this.searchFailed());
      return;
    }

    if (this.isNumeric(this.searchInput)) {
      // Pass the raw digit string (not parseInt) so 64-bit system addresses that exceed
      // Number.MAX_SAFE_INTEGER keep full precision when used in the biostats API query.
      this.searchBySystemAddress(this.searchInput);
      return;
    }

    // Check EdAstro cache first (case-insensitive) — read the current snapshot.
    const edastroSystem = this.appService.edastroSystems().find(s =>
      this.decodeHtmlEntities(s.name).toLowerCase() === this.searchInput.toLowerCase()
    );
    if (edastroSystem && edastroSystem.id64) {
      this.searchBySystemAddress(edastroSystem.id64);
      return;
    }

    // Try the Canonn typeahead API if not found in EdAstro
    this.appService.galMapSearch(this.searchInput)
      .then(data => {
        const systems = data.min_max || [];
        // Use case-insensitive comparison to find the system
        const system = systems.find(s => s.name.toLowerCase() === this.searchInput.toLowerCase());
        if (system && system.id64) {
          this.searchBySystemAddress(system.id64);
        } else {
          this.searchFailed('System not found in database.\nSystem data is gathered from EDDN and processed by Spansh. If this is a recently discovered system, please try again later as there may be delays in processing.');
        }
      })
      .catch(() => this.searchFailed('Typeahead API error: Unable to search for systems. Please try again later.'));
  }

  private searchFailed(message: string = 'System not found'): void {
    this.searchError.set(true);
    this.searchErrorMessage.set(message);
    this.searchControl.enable();
    // Set last so the `searching` setter can drain a deferred request.
    this.searching = false;
  }

  private searchBySystemAddress(systemAddress: number | string | bigint): void {
    this.appService.getBiostats(systemAddress)
      .then(data => {
        // A missing payload or system info means Spansh has no data for it yet.
        if (!data || !data.system || !data.system.name) {
          this.searchFailed('System not found in database.\nSystem data is gathered from EDDN and processed by Spansh. If this is a recently discovered system, please try again later as there may be delays in processing.');
          return;
        }
        this.processBodies(data);
        // Ensure Simbad data is updated after setting this.data
        this.updateEdGalaxyData();
        this.searchControl.enable();
        // Set last so the `searching` setter can drain a deferred request.
        this.searching = false;
      })
      .catch(error => {
        // Check for specific error messages
        const errorMessage = error?.error?.message || error?.message || '';
        if (errorMessage.toLowerCase().includes('no spansh data')) {
          this.searchFailed('System not found in Spansh database.\nSystem data is gathered from EDDN and processed by Spansh. If this is a recently discovered system, please try again later as there may be delays in processing.');
        } else if (error?.status === 404) {
          this.searchFailed('System not found.\nSystem data is gathered from EDDN and processed by Spansh. If this is a recently discovered system, please try again later as there may be delays in processing.');
        } else {
          this.searchFailed(`Biostats API error: ${errorMessage || 'Unable to load system data'}. Please try again later.`);
        }
      });
  }

  private processBodies(data: CanonnBiostats): void {
    // Decode HTML entities in system name
    data.system.name = this.decodeHtmlEntities(data.system.name);

    applySpeculativeBodies(data.system);

    const queryParams: Params = { system: data.system.name };

    // Only update query params if not already set
    const previousData = this.data();
    if (!previousData || previousData.system.name !== data.system.name) {
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
    const isDifferentSystem = !previousData || previousData.system.id64 !== data.system.id64;

    if (isDifferentSystem) {
      this.interestRegistry.resetForSystem(data.system.id64);
      this.activeFilterCategory.set(null);
      this.filterCommand.set(null);
      this.selectedMaterials.set(new Set());
      this.selectedHotspots.set(new Set());
      this.closeFilterMenus();
    }

    this.data.set(data);
    this.bodies.set([]);
    // Ensure edGalaxyData is updated/fetched when system changes
    this.updateEdGalaxyData();
    // Kick off the lazy nebula-catalogue load so the "Nearest Nebulae" panel can populate.
    this.appService.ensureNebulae();
    // Kick off the lazy megaship-schedule load so the "Megaships" panel can populate.
    this.appService.ensureMegaships();

    // Only reset edastroData if loading a different system
    if (isDifferentSystem) {
      this.edastroData.set(null);
    }

    // Only set default background if we don't have edastro data with an image
    if (!this.edastroData()?.mainImage) {
      this.appService.setBackgroundImage('assets/bg1.jpg');
    }

    // The <app-region-map> child re-renders from its [system]/[outposts] inputs.

    // Fetch edastro data only if we don't have it or it's a different system
    if (isDifferentSystem || !this.edastroData()) {
      this.appService.getEdastroData(data.system.id64)
        .then(edastroData => {
          // Ignore a late response once the user has loaded a different system,
          // or it would show this system's summary/image/background on another.
          if (this.data()?.system?.id64 !== data.system.id64) {
            return;
          }
          if (edastroData && (edastroData.name || edastroData.summary || edastroData.mainImage)) {
            // Sanitize the untrusted EDAstro URLs: the image flows into both an
            // <img src> and the page-background `url(...)` (which bypasses Angular's
            // URL sanitizer), and poiUrl into an external href. Accept http(s) only.
            const safe = {
              ...edastroData,
              mainImage: this.safeHttpUrl(edastroData.mainImage),
              poiUrl: this.safeHttpUrl(edastroData.poiUrl),
            };
            this.edastroData.set(safe);
            if (safe.mainImage) {
              this.appService.setBackgroundImage(safe.mainImage);
            }
          }
        })
        // edastro data is optional - silently ignore failures.
        .catch(error => logger.error('EdAstro data error:', error));
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
              id64: 0n,
              subType: belt.type,
              type: BODY_TYPE.Belt,
              innerRadius: belt.innerRadius / 1000, // Convert m to km
              outerRadius: belt.outerRadius / 1000, // Convert m to km
              mass: belt.mass,
              speculative: systemBody.speculative,
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
              id64: ring.id64 || 0n,
              subType: ring.type,
              type: BODY_TYPE.Ring,
              innerRadius: ring.innerRadius / 1000, // Convert m to km
              outerRadius: ring.outerRadius / 1000, // Convert m to km
              mass: ring.mass,
              signals: ring.signals ? {
                signals: ring.signals.signals,
                updateTime: ring.signals.updateTime || ''
              } : undefined,
              speculative: systemBody.speculative,
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
        if (typeof parent.Planet !== 'undefined') {
          let parentBody = bodiesFlat.find(b => b.bodyData.bodyId === parent.Planet);
          if (!parentBody) {
            parentBody = {
              bodyData: {
                bodyId: parent.Planet,
                name: `Unknown planet (${parent.Planet})`,
                id64: 0n,
                subType: "",
                type: BODY_TYPE.Planet,
              },
              subBodies: [],
              parent: null,
            };
            bodiesFlat.push(parentBody);
          }
        }
        if (typeof parent.Star !== 'undefined') {
          let parentBody = bodiesFlat.find(b => b.bodyData.bodyId === parent.Star);
          if (!parentBody) {
            parentBody = {
              bodyData: {
                bodyId: parent.Star,
                name: `Unknown star (${parent.Star})`,
                id64: 0n,
                subType: "",
                type: BODY_TYPE.Star,
              },
              subBodies: [],
              parent: null,
            };
            bodiesFlat.push(parentBody);
          }
        }
        if (typeof parent.Null !== 'undefined') {
          let parentBody = bodiesFlat.find(b => b.bodyData.bodyId === parent.Null);
          if (!parentBody) {
            parentBody = {
              bodyData: {
                bodyId: parent.Null,
                name: `Unknown barycentre (${parent.Null})`,
                id64: 0n,
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

    // Two passes are required to attach every body to its parent. `parents` is ordered
    // nearest-first, so on pass 0 we link each body to its immediate parent — but that
    // parent may itself be a barycentre/body that hasn't been linked to *its* parent yet.
    // Pass 1 walks the chain again now that those intermediate links exist, so deeper
    // grandchild → ... → root relationships resolve. (Pass 0 stops at the first parent;
    // pass 1 climbs until it reaches an already-linked ancestor.)
    for (let pass = 0; pass <= 1; pass++) {
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
              if (pass === 0 || currentBody.parent) {
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

    this.bodies.set(bodiesFlat.filter(b => b.parent === null));

    const hash = window.location.hash;
    if (hash) {
      const match = hash.match(/^#body-(\d+)$/);
      if (match) {
        this.anchorBodyId.set(parseInt(match[1], 10));
      }
      // Wait for Angular to render the body elements, then scroll
      setTimeout(() => {
        const el = document.querySelector(hash);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
    } else {
      this.anchorBodyId.set(null);
    }
    // Zoneless: the data/bodies/anchorBodyId signal writes above schedule the CD
    // pass that re-reads this method's bound state, even from async HTTP callbacks.
  }

  private isNumeric(value: string) {
    return /^\d+$/.test(value);
  }

  private getSystemSuggestions(query: string): Promise<string[]> {
    const cacheKey = query.trim().toLowerCase();
    const cached = this.systemSuggestionsCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    // Cache the in-flight promise so concurrent keystrokes share one request, but
    // evict the entry if it resolves empty (or rejects). Both suggestion sources
    // swallow API errors into an empty list, so an empty result is indistinguishable
    // from a transient failure — caching it permanently would suppress suggestions
    // for this query forever, even after the API recovers.
    const result = this.computeSystemSuggestions(query)
      .then(suggestions => {
        if (suggestions.length === 0) {
          this.systemSuggestionsCache.delete(cacheKey);
        }
        return suggestions;
      })
      .catch(error => {
        this.systemSuggestionsCache.delete(cacheKey);
        throw error;
      });
    this.systemSuggestionsCache.set(cacheKey, result);
    return result;
  }

  private async computeSystemSuggestions(query: string): Promise<string[]> {
    // Name suggestions from the Canonn typeahead. A failure here shouldn't wipe out the
    // EdAstro suggestions, so fall back to an empty list.
    const canonnSuggestions = await this.appService.typeahead(query)
      .then(response => (response.values || []).map(name => this.decodeHtmlEntities(name)))
      .catch(() => [] as string[]);

    // EdAstro name matches from the in-memory snapshot. Match on the decoded name so a
    // query typed with the decoded character (e.g. "&") matches a name stored with an HTML
    // entity ("&amp;"), consistent with how names are displayed.
    //
    // We deliberately do NOT resolve a missing id64 here. Doing so previously fired one
    // extra typeahead HTTP request *per matching system* — up to 10 additional calls for a
    // single keystroke (e.g. typing "Alph" triggered a galMapSearch for every matched
    // system name). The id64 isn't needed to display a suggestion, the resolved value was
    // thrown away (never written back into systemMapping), and onSystemSelected already
    // resolves a missing id64 on demand via search(). So this is now a single HTTP call.
    const queryLower = query.toLowerCase();
    const edastroSuggestions = this.appService.edastroSystems()
      .filter(s => this.decodeHtmlEntities(s.name).toLowerCase().includes(queryLower))
      .slice(0, 10)
      .map(s => this.decodeHtmlEntities(s.name));

    const combined = [...new Set([...canonnSuggestions, ...edastroSuggestions])];

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
  }

  /** A marker on the region map was clicked; load that system. */
  public onMarkerSelected(systemName: string): void {
    this.loadSystem(systemName);
  }

  public onSystemSelected(displayName: string): void {
    const mapping = this.systemMapping().get(displayName);
    if (mapping && mapping.id64) {
      // Fast path: we already have the id64, so skip the name→id64 lookup. Route through
      // the same in-flight guard as search()/loadSystem — a selection made while a previous
      // search is still running is deferred (by name), not started concurrently, which
      // would race two getBiostats responses and double-fire the searching cleanup.
      if (this.searching) {
        this.pendingSystemRequest = mapping.systemName ?? displayName;
        return;
      }
      this.searchInput = displayName;
      this.startSearch();
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

  /**
   * Accept only absolute http(s) URLs from the external EDAstro feed. The disallowed
   * characters (whitespace, quotes, `)`) also prevent breaking out of the CSS
   * `url(...)` the image is concatenated into for the page background.
   */
  private safeHttpUrl(url: string | undefined): string | undefined {
    return url && /^https?:\/\/[^\s)'"]+$/i.test(url) ? url : undefined;
  }

  private stripParentName(ringName: string, parentName: string): string {
    // Remove parent name from ring name, keeping only the ring identifier
    const pattern = new RegExp(`^${parentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i');
    return ringName.replace(pattern, '').trim();
  }

  private decodeHtmlEntities(text: string): string {
    return decodeHtmlEntities(text);
  }

  private countBodies(bodies: SystemBody[]): number {
    return bodies.reduce((count, body) => count + 1 + this.countBodies(body.subBodies), 0);
  }

  public trackByBody(index: number, body: SystemBody): number {
    return body.bodyData.bodyId;
  }

  public onGecImageError(event: Event): void {
    // Some GEC GIFs intermittently fail to decode on first load; force a one-shot
    // reload with a cache-busting query param so a transient failure self-heals.
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

export interface CanonnBiostats {
  system: {
    // Null on unpopulated systems (the API reports no allegiance for those).
    allegiance: string | null;
    bodies: CanonnBiostatsBody[];
    // Optional: some systems (e.g. unsurveyed ones) omit this in the API payload.
    bodyCount?: number;
    controllingFaction?: {
      name: string;
      allegiance?: string;
      government?: string;
      state?: string;
    };
    coords: {
      x: number;
      y: number;
      z: number;
    };
    date: string;
    government: string | null;
    id64: bigint;
    name: string;
    population: number;
    // powerState
    // powers
    primaryEconomy?: string | null;
    // Absent for some systems (e.g. uninhabited deep-space systems served by Spansh), so optional.
    region?: {
      name: string;
      region: number;
    };
    signals?: {
      anomaly?: string[];
      cloud?: string[];
    };
    secondaryEconomy?: string | null;
    security?: string | null;
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
    id64?: bigint;
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
  id64: bigint;
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
  // All three keys are optional: a parent chain link identifies exactly one of a
  // Null (barycentre)/Planet/Star ancestor by bodyId — e.g. real dumps report bare
  // `{ Null: 2 }` links with no `Star` key at all (see Beta Sculptoris body 3's
  // `[{ Null: 2 }, { Null: 0 }]` chain, which never mentions a Star).
  parents?: {
    Null?: number;
    Planet?: number;
    Star?: number;
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
  // True only for the synthesized bodies of a special-cased system (currently just Col 70
  // Sector FY-N c21-3, see data/speculative-systems.ts) whose classification is an inferred
  // guess rather than sourced scan data. Never set for real Spansh bodies. The renderer uses
  // it to mark the subtype/image as unconfirmed, and (like speculativeValues) to flag every
  // displayed value in the body panel with a "?".
  speculative?: boolean;
  // Like `speculative`, but for a body whose classification is real/confirmed (so its
  // subtype/image stay unmarked) while its other displayed values are still guesses — used
  // for Col 70 Sector FY-N c21-3's main star (see data/speculative-systems.ts).
  speculativeValues?: boolean;
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
  SystemAddress: bigint;
  Name: string;
  Simbad?: {
    Name?: string;
    Ident?: string;
    RAJ2000?: number;
    DEJ2000?: number;
  };
}

export interface SimbadApiResponse {
  name: string;
  system_address: bigint;
  ra_j2000?: number;
  dec_j2000?: number;
  simbad_name?: string;
  simbad_ident?: string;
}
