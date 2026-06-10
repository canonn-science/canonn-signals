import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of, timer } from 'rxjs';
import { catchError, retry, timeout } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

/** Default per-request timeout for remote API calls (ms). */
const HTTP_TIMEOUT_MS = 20000;
/** Number of automatic retries for transient failures. */
const HTTP_RETRY_COUNT = 2;

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
    return this.httpClient.get<T>(url).pipe(
      timeout(timeoutMs),
      retry({
        count: HTTP_RETRY_COUNT,
        delay: (_error, retryIndex) => timer(Math.min(1000 * 2 ** (retryIndex - 1), 8000)),
      }),
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
    this.resilientGet<CanonnCodex>("https://us-central1-canonn-api-236217.cloudfunctions.net/query/codex/ref")
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

  public getEdastroData(id64: number): Observable<EdastroData> {
    const url = environment.production
      ? `https://edastro.com/gec/json/id64/${id64}`
      : `/api/edastro/gec/json/id64/${id64}`;
    return this.resilientGet<EdastroData>(url);
  }

  public setBackgroundImage(imageUrl: string): void {
    this._backgroundImage.next(imageUrl);
  }

  public galMapSearch(systemName: string): Observable<{ min_max: { name: string, id64: number }[] }> {
    return this.resilientGet<{ min_max: { name: string, id64: number }[] }>(`https://us-central1-canonn-api-236217.cloudfunctions.net/query/typeahead?q=${encodeURIComponent(systemName)}`);
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
  id64: number;
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