import { Injectable, Signal, signal } from '@angular/core';
import { environment } from 'src/environments/environment';
import { parseJsonWithBigIntIds } from './data/json-bigint';
import type { CanonnBiostats, SimbadApiResponse } from './home/home.component';
import type { GnosisData } from './region-map/region-map.component';
import type { Nebula } from './data/nebulae';
import type { MegashipScheduleFile } from './data/megaships';

/** Default per-request timeout for remote API calls (ms). */
const HTTP_TIMEOUT_MS = 20000;
/** Number of automatic retries for transient failures. */
const HTTP_RETRY_COUNT = 2;
/** Base URL for the Canonn cloud-function query API. */
const CANONN_QUERY_BASE = 'https://us-central1-canonn-api-236217.cloudfunctions.net/query';
/** How long a fetched Gnosis position is considered fresh before {@link AppService.ensureGnosis}
 *  refetches it. Matches the cache window the region map previously kept locally for the same data. */
const GNOSIS_CACHE_DURATION_MS = 3600000; // 1 hour

/**
 * Error thrown by {@link AppService} HTTP helpers for non-2xx responses. Mirrors the
 * shape callers previously relied on from Angular's `HttpErrorResponse`: `status` for
 * the code and `error` for the (best-effort parsed) response body.
 */
export class HttpError extends Error {
  constructor(public readonly status: number, message: string, public readonly error?: unknown) {
    super(message);
    this.name = 'HttpError';
  }
}

/** Resolves after `ms` milliseconds. Used for retry backoff. */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

@Injectable({
  providedIn: 'root'
})
export class AppService {
  /**
   * Performs an HTTP GET with a timeout and exponential-backoff retry so that
   * transient network errors and slow/hung requests don't permanently break
   * the feature. Callers still receive the error if all retries fail.
   */
  private async resilientGet<T>(url: string, timeoutMs: number = HTTP_TIMEOUT_MS): Promise<T> {
    let lastError: unknown;
    // One initial attempt plus HTTP_RETRY_COUNT retries.
    for (let attempt = 0; attempt <= HTTP_RETRY_COUNT; attempt++) {
      try {
        const text = await this.fetchText(url, timeoutMs);
        // Parse with a BigInt-aware parser so 64-bit id64 / system address fields keep
        // full precision (the browser's JSON.parse would round them to float64).
        return parseJsonWithBigIntIds<T>(text);
      } catch (error) {
        lastError = error;
        // Don't retry client errors (e.g. 404 "system not found") — they won't
        // succeed on a retry and would only delay surfacing the result. Timeouts
        // (aborts) and network/5xx errors (no status) are still retried with backoff.
        const status = error instanceof HttpError ? error.status : undefined;
        if (status !== undefined && status >= 400 && status < 500) {
          throw error;
        }
        if (attempt === HTTP_RETRY_COUNT) {
          break;
        }
        // retryIndex is 1-based for the first retry, matching the previous backoff curve.
        const retryIndex = attempt + 1;
        await delay(Math.min(1000 * 2 ** (retryIndex - 1), 8000));
      }
    }
    throw lastError;
  }

  /**
   * Fetches a URL as text, aborting (and thus failing) after `timeoutMs`. Non-2xx
   * responses are surfaced as an {@link HttpError} carrying the status and a best-effort
   * parsed body so callers can branch on `status` / `error.message` as before.
   */
  private async fetchText(url: string, timeoutMs: number): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        let parsed: unknown = body;
        try {
          parsed = JSON.parse(body);
        } catch {
          // Body wasn't JSON; keep the raw text.
        }
        throw new HttpError(response.status, response.statusText || `HTTP ${response.status}`, parsed);
      }
      return await response.text();
    } finally {
      clearTimeout(timer);
    }
  }

  private readonly _codexEntries = signal<CanonnCodexEntry[]>([]);
  public readonly codexEntries: Signal<CanonnCodexEntry[]> = this._codexEntries.asReadonly();

  private readonly _backgroundImage = signal('assets/bg1.jpg');
  public readonly backgroundImage: Signal<string> = this._backgroundImage.asReadonly();

  private readonly _edastroSystems = signal<EdastroSystem[]>([]);
  public readonly edastroSystems: Signal<EdastroSystem[]> = this._edastroSystems.asReadonly();

  private readonly _independentOutposts = signal<IndependentOutpost[]>([]);
  public readonly independentOutposts: Signal<IndependentOutpost[]> = this._independentOutposts.asReadonly();

  private readonly _nebulae = signal<Nebula[]>([]);
  /** The nebula catalogue; empty until {@link ensureNebulae} has loaded the asset. */
  public readonly nebulae: Signal<Nebula[]> = this._nebulae.asReadonly();
  /** Memoises the one-shot nebula asset load so concurrent callers share a single fetch. */
  private nebulaeLoad?: Promise<void>;

  /** Optional timestamp override (ms since epoch) set via the `?t=` URL param for debugging. */
  private readonly _nowOverride = signal<number | null>(null);
  public readonly nowOverride: Signal<number | null> = this._nowOverride.asReadonly();
  public setNowOverride(ms: number | null): void { this._nowOverride.set(ms); }

  private readonly _megashipSchedule = signal<MegashipScheduleFile | null>(null);
  /** The megaship route schedule; null until {@link ensureMegaships} has loaded the asset. */
  public readonly megashipSchedule: Signal<MegashipScheduleFile | null> = this._megashipSchedule.asReadonly();
  /** Memoises the one-shot schedule asset load so concurrent callers share a single fetch. */
  private megashipScheduleLoad?: Promise<void>;

  /** system address (as a string key) -> resolved system name, for megaship route display. */
  private readonly _systemNames = signal<ReadonlyMap<string, string>>(new Map());
  public readonly systemNames: Signal<ReadonlyMap<string, string>> = this._systemNames.asReadonly();
  /** In-flight name lookups, keyed by id64 string, so concurrent callers share one fetch. */
  private readonly systemNameLookups = new Map<string, Promise<string>>();

  private readonly _gnosisData = signal<GnosisData | null>(null);
  /** The Gnosis megaship's live-tracked current stop; null until {@link ensureGnosis} resolves
   *  (or on failure). Shared by the Galaxy Region Map marker and the Gnosis route card. */
  public readonly gnosisData: Signal<GnosisData | null> = this._gnosisData.asReadonly();
  private gnosisLoad?: Promise<void>;
  private gnosisFetchedAt = 0;

  constructor() {
    void this.loadCodexEntries();
    void this.loadEdastroSystems();
  }

  /** Loads the codex reference once at startup; failures leave the list empty. */
  private async loadCodexEntries(): Promise<void> {
    try {
      const codex = await this.resilientGet<CanonnCodex>(`${CANONN_QUERY_BASE}/codex/ref`);
      this._codexEntries.set(Object.values(codex));
    } catch {
      this._codexEntries.set([]);
    }
  }

  /** Loads the EdAstro combined feed once at startup; failures leave both lists empty. */
  private async loadEdastroSystems(): Promise<void> {
    const edastroUrl = environment.production
      ? "https://edastro.com/gec/json/combined"
      : "/api/edastro/gec/json/combined";

    // The combined GEC dataset can be several MB; give it a more generous timeout.
    let systems: EdastroSystem[];
    try {
      systems = await this.resilientGet<EdastroSystem[]>(edastroUrl, 60000);
    } catch {
      systems = [];
    }
    this._edastroSystems.set(systems);

    // Filter and extract independentOutpost data
    const outposts = systems
      .filter(system => system.type === 'independentOutpost' &&
        !system.name.toLowerCase().includes('retired'))
      .map(system => ({
        name: system.name,
        galMapSearch: system.galMapSearch || system.name,
        coordinates: system.coordinates || [],
        type: system.type
      } as IndependentOutpost));

    this._independentOutposts.set(outposts);
  }

  /**
   * Lazily loads the nebula catalogue asset the first time it's needed (it's ~600KB, so
   * it's kept out of the initial bundle and off the startup critical path). The fetch runs
   * at most once; failures leave the catalogue empty and are retried on the next call.
   */
  public ensureNebulae(): void {
    if (this.nebulaeLoad) {
      return;
    }
    this.nebulaeLoad = this.resilientGet<Nebula[]>('assets/nebulae.json', 60000)
      .then(nebulae => { this._nebulae.set(nebulae); })
      .catch(() => {
        this._nebulae.set([]);
        // Clear the memo so a later call can retry the load.
        this.nebulaeLoad = undefined;
      });
  }

  /**
   * Lazily loads the megaship route schedule asset the first time it's needed (it's ~2.2MB, so
   * it's kept off the startup critical path). The fetch runs at most once; failures leave the
   * schedule null and are retried on the next call. See `src/app/data/megaships.ts` for the
   * lookup logic that consumes it.
   */
  public ensureMegaships(): void {
    if (this.megashipScheduleLoad) {
      return;
    }
    this.megashipScheduleLoad = this.resilientGet<MegashipScheduleFile>('assets/megaship-schedule.json', 60000)
      .then(schedule => { this._megashipSchedule.set(schedule); })
      .catch(() => {
        this._megashipSchedule.set(null);
        // Clear the memo so a later call can retry the load.
        this.megashipScheduleLoad = undefined;
      });
  }

  /**
   * Lazily (re)loads the Gnosis's current position, at most once per {@link GNOSIS_CACHE_DURATION_MS}.
   * A failed fetch leaves the previous value in place (stale data beats none) and is retried on the
   * next call rather than waiting out the cache window.
   */
  public ensureGnosis(): void {
    const now = Date.now();
    if (this.gnosisLoad && now - this.gnosisFetchedAt < GNOSIS_CACHE_DURATION_MS) {
      return;
    }
    this.gnosisFetchedAt = now;
    this.gnosisLoad = this.getGnosis()
      .then(data => { this._gnosisData.set(data); })
      .catch(() => {
        // Clear the memo so the next call retries immediately instead of waiting out the cache window.
        this.gnosisLoad = undefined;
      });
  }

  /**
   * Resolves a system's display name from its address, for megaship route display (there's no
   * reverse id64->name endpoint, so this piggybacks on the biostats API). Every id64 is resolved
   * at most once per session — success *or* failure both cache permanently (a failed lookup
   * caches the id64 itself, stringified, as the display fallback) — so a reactive caller that
   * re-reads an unresolved entry every change-detection pass can't retry it in a loop.
   */
  public resolveSystemName(id64: number): Promise<string> {
    const key = String(id64);
    const cached = this._systemNames().get(key);
    if (cached) {
      return Promise.resolve(cached);
    }
    const inFlight = this.systemNameLookups.get(key);
    if (inFlight) {
      return inFlight;
    }
    const promise = this.getBiostats(id64)
      .then(biostats => biostats?.system?.name || key)
      .catch(() => key)
      .then(name => {
        const next = new Map(this._systemNames());
        next.set(key, name);
        this._systemNames.set(next);
        this.systemNameLookups.delete(key);
        return name;
      });
    this.systemNameLookups.set(key, promise);
    return promise;
  }

  /** Fire-and-forget {@link resolveSystemName}, for reactive callers that just need the signal to update. */
  public requestSystemName(id64: number): void {
    void this.resolveSystemName(id64);
  }

  public getEdastroData(id64: number | bigint): Promise<EdastroData> {
    const url = environment.production
      ? `https://edastro.com/gec/json/id64/${id64}`
      : `/api/edastro/gec/json/id64/${id64}`;
    return this.resilientGet<EdastroData>(url);
  }

  public setBackgroundImage(imageUrl: string): void {
    this._backgroundImage.set(imageUrl);
  }

  public galMapSearch(systemName: string): Promise<TypeaheadResponse> {
    return this.typeahead(systemName);
  }

  /** Typeahead lookup. Returns `min_max` (name + id64 matches) and/or `values` (name suggestions). */
  public typeahead(query: string): Promise<TypeaheadResponse> {
    return this.resilientGet<TypeaheadResponse>(`${CANONN_QUERY_BASE}/typeahead?q=${encodeURIComponent(query)}`);
  }

  /** Loads the per-system biostats payload (bodies, signals, coordinates). Accepts the
   *  address as a string to preserve 64-bit precision for very large system addresses. */
  public getBiostats(systemAddress: number | string | bigint): Promise<CanonnBiostats> {
    return this.resilientGet<CanonnBiostats>(`${CANONN_QUERY_BASE}/codex/biostats?id=${systemAddress}&caller=Signals`);
  }

  /** Looks up Simbad cross-identification / coordinates for a hand-authored system. */
  public getSimbad(systemAddress: number | bigint, name: string, coords?: { x: number, y: number, z: number }): Promise<SimbadApiResponse> {
    let url = `${CANONN_QUERY_BASE}/simbad?system_address=${systemAddress}&name=${encodeURIComponent(name)}`;
    if (coords) {
      url += `&x=${coords.x}&y=${coords.y}&z=${coords.z}`;
    }
    return this.resilientGet<SimbadApiResponse>(url);
  }

  /** Fetches the current location of The Gnosis mobile starport. */
  public getGnosis(): Promise<GnosisData> {
    return this.resilientGet<GnosisData>(`${CANONN_QUERY_BASE}/gnosis`);
  }

  private bodyNameOverrides: BodyNameOverride[] = [
    { bodyName: 'KOI 413 1', suffix: 'Rhubarb' },
    { bodyName: 'KOI 413 2', suffix: 'Custard' },
    { bodyName: 'KOI 232 2', suffix: 'Prunes' },
    { bodyName: 'KOI 232 3', suffix: 'Magnesia' }
  ];

  public getBodyDisplayName(bodyName: string): string {
    const override = this.bodyNameOverrides.find(o => o.bodyName === bodyName);
    return override ? `${bodyName} (${override.suffix})` : bodyName;
  }
}

export interface TypeaheadResponse {
  min_max?: { name: string, id64: bigint }[];
  values?: string[];
}

export interface CanonnCodex {
  [key: string]: CanonnCodexEntry;
}

export interface CanonnCodexEntry {
  category: string;
  english_name: string;
  entryid: number;
  hud_category: string;
  name: string;
  platform: 'legacy' | 'odyssey';
  reward?: number | null;
  sub_category: string;
  sub_class: string;
}

export interface EdastroData {
  name?: string;
  summary?: string;
  poiUrl?: string;
  mainImage?: string;
  description?: string;
}

export interface EdastroSystem {
  name: string;
  id64: bigint;
  galMapSearch?: string;
  type?: string;
  coordinates?: number[];
}

export interface BodyNameOverride {
  bodyName: string;
  suffix: string;
}

export interface IndependentOutpost {
  name: string;
  galMapSearch: string;
  coordinates: number[];
  type: string;
}