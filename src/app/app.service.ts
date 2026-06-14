import { Injectable, Signal, signal } from '@angular/core';
import { environment } from 'src/environments/environment';
import { parseJsonWithBigIntIds } from './data/json-bigint';
import type { CanonnBiostats, SimbadApiResponse } from './home/home.component';
import type { GnosisData } from './region-map/region-map.component';

/** Default per-request timeout for remote API calls (ms). */
const HTTP_TIMEOUT_MS = 20000;
/** Number of automatic retries for transient failures. */
const HTTP_RETRY_COUNT = 2;
/** Base URL for the Canonn cloud-function query API. */
const CANONN_QUERY_BASE = 'https://us-central1-canonn-api-236217.cloudfunctions.net/query';

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