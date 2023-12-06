import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { AppService } from '../app.service';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { animate, style, transition, trigger } from '@angular/animations';
import { faUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';
import { environment } from 'src/environments/environment';

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
export class HomeComponent implements OnInit {
  public readonly faUpRightFromSquare = faUpRightFromSquare;
  public searching = false;
  public searchInput: string = "";
  public searchError = false;
  public data: CanonnBiostats | null = null;
  public bodies: SystemBody[] = [];

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
          this.search();
        }
      });
  }

  public search(): void {
    if (this.searching || !this.searchInput) {
      return;
    }
    this.searchInput = this.searchInput.trim();
    if (this.searchInput.length <= 1) {
      return;
    }
    this.data = null;
    this.bodies = [];
    this.searching = true;
    this.searchError = false;
    if (this.isNumeric(this.searchInput)) {
      const systemAddress = parseInt(this.searchInput);
      this.searchBySystemAddress(systemAddress);
      return;
    }

    this.httpClient.get<EDSMSystemV1>(`https://www.edsm.net/api-v1/system?showId=1&systemName=${encodeURIComponent(this.searchInput)}`)
      .subscribe(
        data => {
          if (!data || !data.id64) {
            this.searchFailed();
            return;
          }
          this.searchBySystemAddress(data.id64);
        },
        error => {
          this.searchFailed();
        }
      );
  }

  private searchFailed(): void {
    this.searching = false;
    this.searchError = true;
  }

  private searchBySystemAddress(systemAddress: number): void {
    this.httpClient.get<CanonnBiostats>(`https://us-central1-canonn-api-236217.cloudfunctions.net/query/codex/biostats?id=${systemAddress}`)
      .subscribe(
        data => {
          if (!data) {
            this.searchFailed();
            return;
          }
          this.processBodies(data);
          this.searching = false;
        },
        error => {
          this.searchFailed();
        }
      );
  }

  private processBodies(data: CanonnBiostats): void {
    const queryParams: Params = { system: data.system.name };

    this.router.navigate(
      [],
      {
        relativeTo: this.activatedRoute,
        queryParams,
        queryParamsHandling: 'merge', // remove to replace all query params by provided
      });
    this.searchInput = data.system.name;

    this.data = data;
    this.bodies = [];

    const bodiesFlat: SystemBody[] = [];

    for (const systemBody of data.system.bodies) {
      const body: SystemBody = {
        bodyData: systemBody,
        subBodies: [],
        parent: null,
      };
      bodiesFlat.push(body);
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
                if (!environment.production) {
                  console.log(`${currentBody.bodyData.name} -> ${parentBody.bodyData.name}`, currentBody, parentBody, body);
                }
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
      body.subBodies.sort((a, b) => (a.bodyData.bodyId > b.bodyData.bodyId) ? 1 : -1);
    }
    bodiesFlat.sort((a, b) => (a.bodyData.bodyId > b.bodyData.bodyId) ? 1 : -1);

    this.bodies = bodiesFlat.filter(b => b.parent === null);
    if (!environment.production) {
      console.log(this.bodies, bodiesFlat);
    }
  }

  private isNumeric(value: string) {
    return /^\d+$/.test(value);
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
  axialTilt?: number;
  belts?: {
    innerRadius: number;
    mass: number;
    name: string;
    outerRadius: number;
    type: string;
  }[];
  bodyId: number;
  distanceToArrival?: number;
  earthMasses?: number;
  gravity?: number;
  id64: number;
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
  meanAnomaly?: number;
  name: string;
  orbitalEccentricity?: number;
  orbitalInclination?: number;
  orbitalPeriod?: number;
  parents?: {
    Null?: number;
    Planet?: number;
    Star: number;
  }[];
  radius?: number;
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
