import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AppService {
  private _codexEntries: BehaviorSubject<CanonnCodexEntry[]> = new BehaviorSubject<CanonnCodexEntry[]>([]);
  public codexEntries: Observable<CanonnCodexEntry[]> = this._codexEntries.asObservable();

  private _backgroundImage: BehaviorSubject<string> = new BehaviorSubject<string>('assets/bg1.jpg');
  public backgroundImage$: Observable<string> = this._backgroundImage.asObservable();

  private _edastroSystems: BehaviorSubject<EdastroSystem[]> = new BehaviorSubject<EdastroSystem[]>([]);
  public edastroSystems: Observable<EdastroSystem[]> = this._edastroSystems.asObservable();

  private _independentOutposts: BehaviorSubject<IndependentOutpost[]> = new BehaviorSubject<IndependentOutpost[]>([]);
  public independentOutposts: Observable<IndependentOutpost[]> = this._independentOutposts.asObservable();

  constructor(
    private readonly httpClient: HttpClient
  ) {
    this.httpClient.get<CanonnCodex>("https://us-central1-canonn-api-236217.cloudfunctions.net/query/codex/ref")
      .subscribe(c => {
        this._codexEntries.next(Object.values(c));
      });

    const edastroUrl = environment.production
      ? "https://edastro.com/gec/json/combined"
      : "/api/edastro/gec/json/combined";

    this.httpClient.get<EdastroSystem[]>(edastroUrl)
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
    return this.httpClient.get<EdastroData>(url);
  }

  public setBackgroundImage(imageUrl: string): void {
    this._backgroundImage.next(imageUrl);
  }

  public galMapSearch(systemName: string): Observable<{ min_max: { name: string, id64: number }[] }> {
    return this.httpClient.get<{ min_max: { name: string, id64: number }[] }>(`https://us-central1-canonn-api-236217.cloudfunctions.net/query/typeahead?q=${encodeURIComponent(systemName)}`);
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