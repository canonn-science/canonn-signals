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

  constructor(
    private readonly httpClient: HttpClient
  ) {
    this.httpClient.get<CanonnCodex>("https://us-central1-canonn-api-236217.cloudfunctions.net/query/codex/ref")
      .subscribe(c => {
        this._codexEntries.next(Object.values(c));
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
}