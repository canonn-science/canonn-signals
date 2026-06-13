import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of, timer } from 'rxjs';
import { catchError, map, retry, timeout } from 'rxjs/operators';
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

@Injectable({
  providedIn: 'root'
})
export class AppService {
  private readonly httpClient = inject(HttpClient);

  /**
   * Wraps an HTTP GET with a timeout and exponential-backoff retry so that
   * transient network errors and slow/hung requests don't permanently break
   * the feature. Callers still receive the error if all retries fail.
   */
  private resilientGet<T>(url: string, timeoutMs: number = HTTP_TIMEOUT_MS): Observable<T> {
    // Fetch as text and parse with a BigInt-aware parser so 64-bit id64 / system
    // address fields keep full precision (the browser's JSON.parse would round
    // them to float64). See parseJsonWithBigIntIds.
    return this.httpClient.get(url, { responseType: 'text' }).pipe(
      timeout(timeoutMs),
      retry({
        count: HTTP_RETRY_COUNT,
        delay: (error, retryIndex) => {
          // Don't retry client errors (e.g. 404 "system not found") — they won't
          // succeed on a retry and would only delay surfacing the result. Timeouts
          // and network/5xx errors (no status) are still retried with backoff.
          const status = (error as HttpErrorResponse)?.status;
          if (status >= 400 && status < 500) {
            throw error;
          }
          return timer(Math.min(1000 * 2 ** (retryIndex - 1), 8000));
        },
      }),
      map(text => parseJsonWithBigIntIds<T>(text)),
    );
  }

  private _codexEntries: BehaviorSubject<CanonnCodexEntry[]> = new BehaviorSubject<CanonnCodexEntry[]>([]);
  public codexEntries: Observable<CanonnCodexEntry[]> = this._codexEntries.asObservable();

  private _backgroundImage: BehaviorSubject<string> = new BehaviorSubject<string>('assets/bg1.jpg');
  public backgroundImage$: Observable<string> = this._backgroundImage.asObservable();

  private _edastroSystems: BehaviorSubject<EdastroSystem[]> = new BehaviorSubject<EdastroSystem[]>([]);
  public edastroSystems: Observable<EdastroSystem[]> = this._edastroSystems.asObservable();

  private _independentOutposts: BehaviorSubject<IndependentOutpost[]> = new BehaviorSubject<IndependentOutpost[]>([]);
  public independentOutposts: Observable<IndependentOutpost[]> = this._independentOutposts.asObservable();

  constructor() {
    this.resilientGet<CanonnCodex>(`${CANONN_QUERY_BASE}/codex/ref`)
      .pipe(catchError(() => of({} as CanonnCodex)))
      .subscribe(c => {
        this._codexEntries.next(Object.values(c));
      });

    const edastroUrl = environment.production
      ? "https://edastro.com/gec/json/combined"
      : "/api/edastro/gec/json/combined";

    // The combined GEC dataset can be several MB; give it a more generous timeout.
    this.resilientGet<EdastroSystem[]>(edastroUrl, 60000)
      .pipe(catchError(() => of([] as EdastroSystem[])))
      .subscribe(systems => {
        this._edastroSystems.next(systems);

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

        this._independentOutposts.next(outposts);
      });
  }

  public getEdastroData(id64: number | bigint): Observable<EdastroData> {
    const url = environment.production
      ? `https://edastro.com/gec/json/id64/${id64}`
      : `/api/edastro/gec/json/id64/${id64}`;
    return this.resilientGet<EdastroData>(url);
  }

  public setBackgroundImage(imageUrl: string): void {
    this._backgroundImage.next(imageUrl);
  }

  public galMapSearch(systemName: string): Observable<TypeaheadResponse> {
    return this.typeahead(systemName);
  }

  /** Typeahead lookup. Returns `min_max` (name + id64 matches) and/or `values` (name suggestions). */
  public typeahead(query: string): Observable<TypeaheadResponse> {
    return this.resilientGet<TypeaheadResponse>(`${CANONN_QUERY_BASE}/typeahead?q=${encodeURIComponent(query)}`);
  }

  /** Loads the per-system biostats payload (bodies, signals, coordinates). Accepts the
   *  address as a string to preserve 64-bit precision for very large system addresses. */
  public getBiostats(systemAddress: number | string | bigint): Observable<CanonnBiostats> {
    return this.resilientGet<CanonnBiostats>(`${CANONN_QUERY_BASE}/codex/biostats?id=${systemAddress}&caller=Signals`);
  }

  /** Looks up Simbad cross-identification / coordinates for a hand-authored system. */
  public getSimbad(systemAddress: number | bigint, name: string, coords?: { x: number, y: number, z: number }): Observable<SimbadApiResponse> {
    let url = `${CANONN_QUERY_BASE}/simbad?system_address=${systemAddress}&name=${encodeURIComponent(name)}`;
    if (coords) {
      url += `&x=${coords.x}&y=${coords.y}&z=${coords.z}`;
    }
    return this.resilientGet<SimbadApiResponse>(url);
  }

  /** Fetches the current location of The Gnosis mobile starport. */
  public getGnosis(): Observable<GnosisData> {
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