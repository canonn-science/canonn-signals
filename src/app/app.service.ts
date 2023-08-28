import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AppService {
  public codexEntries: Observable<CanonnCodex>;

  constructor(
    private readonly httpClient: HttpClient
  ) {
    this.codexEntries = this.httpClient.get<CanonnCodex>("https://us-central1-canonn-api-236217.cloudfunctions.net/query/codex/ref");
  }
}

export interface CanonnCodex {
  [key: string]: {
    category: string;
    english_name: string;
    entryid: number;
    hud_category: string;
    name: string;
    platform: 'legacy' | 'odyssey';
    reward: number | null;
    sub_category: string;
    sub_class: string;
  }
}