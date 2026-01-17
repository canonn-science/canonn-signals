// ...existing code...
import { Component, Input, OnChanges, OnInit, ViewChild, ElementRef, AfterViewInit, ViewChildren, QueryList, TemplateRef, ChangeDetectionStrategy, ChangeDetectorRef, SimpleChanges } from '@angular/core';
import { SystemBody } from '../home/home.component';
import { faCircleChevronRight, faCircleQuestion, faSquareCaretDown, faSquareCaretUp, faUpRightFromSquare, faCode, faLock } from '@fortawesome/free-solid-svg-icons';
import { AppService, CanonnCodexEntry } from '../app.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BodyImage } from '../data/body-images';
import { MINING_RESOURCES, MiningResource } from '../data/mining-resources';
import { animate, style, transition, trigger } from '@angular/animations';
import { MatTooltip } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';

@UntilDestroy()
@Component({
  selector: 'app-system-body',
  templateUrl: './system-body.component.html',
  styleUrls: ['./system-body.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger("grow", [ // Note the trigger name
      transition(":enter", [
        // :enter is alias to 'void => *'
        style({ height: "0", overflow: "hidden" }),
        animate(250, style({ height: "*" }))
      ]),
      transition(":leave", [
        // :leave is alias to '* => void'
        animate(250, style({ height: 0, overflow: "hidden" }))
      ])
    ])
  ]
})
export class SystemBodyComponent implements OnInit, OnChanges, AfterViewInit {
  // Expose Math.abs for template use
  abs(value: number): number {
    return Math.abs(value);
  }
  public readonly faChevronRight = faCircleChevronRight;
  public readonly faCircleQuestion = faCircleQuestion;
  public readonly faUpRightFromSquare = faUpRightFromSquare;
  public readonly faSquareCaretDown = faSquareCaretDown;
  public readonly faSquareCaretUp = faSquareCaretUp;
  public readonly faCode = faCode;
  public readonly faLock = faLock;
  @Input() body!: SystemBody;
  @Input() isRoot: boolean = false;
  @Input() isLast: boolean = false;
  @Input() forceExpanded: boolean = false;
  @ViewChildren(SystemBodyComponent) childComponents!: QueryList<SystemBodyComponent>;
  @ViewChild('hillLimitDialogTemplate') hillLimitDialogTemplate!: TemplateRef<any>;
  @ViewChild('invisibleRingDialogTemplate') invisibleRingDialogTemplate!: TemplateRef<any>;
  @ViewChild('jsonDialogTemplate') jsonDialogTemplate!: TemplateRef<any>;
  @ViewChild('jsonDialogTitle') jsonDialogTitle!: ElementRef<HTMLElement>;
  @ViewChild('rocheLimitDialogTemplate') rocheLimitDialogTemplate!: TemplateRef<any>;
  @ViewChild('tidalLockDialogTemplate') tidalLockDialogTemplate!: TemplateRef<any>;
  @ViewChild('jetAngleDialogTemplate') jetAngleDialogTemplate!: TemplateRef<any>;
  @ViewChild('apoPeriDialogTemplate') apoPeriDialogTemplate!: TemplateRef<any>;
  public styleClass = "child-container-default";
  private codex: CanonnCodexEntry[] | null = null;

  public hasSignals = false;
  public humanSignalCount: number = 0;
  public otherSignalCount: number = 0;

  public geologySignalCount: number = 0;
  public geologySignals: string[] = [];

  public biologySignalCount: number = 0;
  public biologySignals: BiologySignal[] = [];

  public thargoidSignalCount: number = 0;
  public thargoidSignals: string[] = [];

  public guardianSignalCount: number = 0;
  public guardianSignals: string[] = [];

  public bodyImage: string = "";
  public bodyCoronaImage: string = "";

  public exandable = false;
  public expanded = false;
  public isExpanded = false;

  public hoveredIndex: number = -1;

  public hillLimitDialogData: any = null;
  public invisibleRingDialogData: any = null;
  public rocheLimitDialogData: any = null;
  public isChartLoading: boolean = false;
  public jetAngleChartDataUrl: string | null = null;
  public readonly jetSampleCsv: string = `System,Body,Rotation Period [s],Radius [Ls],Angle [deg],age
Hypaa,B1,1.789518,2.01,8.759363,12830
Hypaa,B2,1.700175,2.04,11.40773,12860
Hypaa,B3,2.27105,1.62,7.6653,12982
Hypaa,B4,2.510701,1.52,6.9503,10680
Hypaa,B5,3.352849,1.18,8.0145,7416
Hypua,B6,1.026249,3.26,16.396,12296
Phrooe,B7,4.044732,1.04,7.1671,12918
Phrooe,B8,0.973363,3.3,16,6402
Phrooe,B9,1.866787,1.95,9.1197,6346
Phrooe,B10,1.117071,3.02,13.454,12938`;

  public apoPeriDialogData: {
    type: 'apo' | 'peri', date: Date, days: number, distanceKm?: number,
    meanAnomaly?: number, orbitalPeriod?: number, timestamp?: Date, currentMeanAnomaly?: number, degreesToEvent?: number
  } | null = null;

  public formattedEarthMass: { display: string; tooltip: string } | null = null;
  public formattedSolarMass: { display: string; tooltip: string } | null = null;

  // Cache for expensive computed properties
  public cachedMaterialBadges: { name: string, class: string, tooltip: string }[] = [];
  public cachedHotspotsList: { displayName: string; count: number; wikiUrl: string; description: string }[] = [];
  public cachedSurfacePressureTooltip: string = '';

  public cachedRingResourceTypes: Set<string> = new Set();

  public constructor(
    private readonly appService: AppService,
    private readonly dialog: MatDialog,
    private readonly cdr: ChangeDetectorRef
  ) {
  }

  public getBodyDisplayName(bodyName: string): string {
    return this.appService.getBodyDisplayName(bodyName);
  }

  public ngOnInit(): void {
    this.appService.codexEntries
      .pipe(untilDestroyed(this))
      .subscribe(c => {
        this.codex = c;
        this.ngOnChanges();
      });
  }

  public ngOnChanges(changes?: SimpleChanges): void {
    if (!this.body) {
      return;
    }

    this.detectTrojanStatus();
    this.detectRosetteStatus();
    this.cachedNextPeriapsis = this.calculateNextPeriapsis();
    this.cachedNextApoapsis = this.calculateNextApoapsis();
    this.cachedRocheExcess = this.calculateRocheExcess();

    // Calculate formatted mass values once when body changes
    this.formattedEarthMass = this.body.bodyData.earthMasses
      ? this.formatEarthMass(this.body.bodyData.earthMasses)
      : null;
    this.formattedSolarMass = this.body.bodyData.solarMasses
      ? this.formatSolarMass(this.body.bodyData.solarMasses)
      : null;

    this.bodyCoronaImage = "";
    this.bodyImage = "";

    const bodyImageResult = BodyImage.getBodyImagePath(this.body.bodyData);
    if (bodyImageResult) {
      this.bodyImage = `bodies/${bodyImageResult.path}.png`;
      if (bodyImageResult.coronaPath) {
        this.bodyCoronaImage = `bodies/${bodyImageResult.coronaPath}.png`;
      }
    }
    else if (this.body.bodyData.type === "Ring") {
      const asteroidIcon = this.getAsteroidIcon();
      this.bodyImage = asteroidIcon || `bodies/planets/terrestrial/Rings.png`;
    }
    else if (this.body.bodyData.type === "Belt") {
      const asteroidIcon = this.getAsteroidIcon();
      this.bodyImage = asteroidIcon || `bodies/planets/terrestrial/Belts.png`;
    }
    else if (this.body.bodyData.type === "Barycentre") {
      this.bodyImage = `Orbit2.gif`;
    }

    if (this.body.bodyData.signals) {
      this.humanSignalCount = this.body.bodyData.signals.signals ? this.body.bodyData.signals.signals['$SAA_SignalType_Human;'] : 0;
      this.otherSignalCount = this.body.bodyData.signals.signals ? this.body.bodyData.signals.signals['$SAA_SignalType_Other;'] : 0;
      this.geologySignalCount = this.body.bodyData.signals.signals ? this.body.bodyData.signals.signals['$SAA_SignalType_Geological;'] : 0;
      this.biologySignalCount = this.body.bodyData.signals.signals ? this.body.bodyData.signals.signals['$SAA_SignalType_Biological;'] : 0;
      this.thargoidSignalCount = this.body.bodyData.signals.signals ? this.body.bodyData.signals.signals['$SAA_SignalType_Thargoid;'] : 0;
      this.guardianSignalCount = this.body.bodyData.signals.signals ? this.body.bodyData.signals.signals['$SAA_SignalType_Guardian;'] : 0;
      this.geologySignals = this.body.bodyData.signals.geology ?? [];
      this.thargoidSignals = this.body.bodyData.signals.thargoid ?? [];
      this.guardianSignals = this.body.bodyData.signals.guardian ?? [];
      this.biologySignals = [];
      if (this.body.bodyData.signals.biology) {
        for (const biologySignal of this.body.bodyData.signals.biology) {
          const codexEntry = this.codex?.find(c => c.english_name == biologySignal);
          this.biologySignals.push({
            entryId: codexEntry?.entryid ?? 0,
            signal: biologySignal,
            codex: codexEntry,
            isGuess: false,
          });
        }
      }
      const addGuessesAndGenuses = this.biologySignals.length < this.biologySignalCount;
      if (this.body.bodyData.signals.guesses && addGuessesAndGenuses) {
        for (const guessedSignal of this.body.bodyData.signals.guesses) {
          if (this.biologySignals.findIndex(b => b.signal == guessedSignal) !== -1) {
            continue;
          }
          const codexEntry = this.codex?.find(c => c.english_name == guessedSignal);
          if (codexEntry && this.biologySignals.findIndex(b => b.codex?.sub_class == codexEntry.sub_class) !== -1) {
            continue;
          }
          this.biologySignals.push({
            entryId: codexEntry?.entryid ?? 0,
            signal: guessedSignal,
            codex: codexEntry,
            isGuess: true,
          });
        }
      }
      if (this.body.bodyData.signals.genuses && addGuessesAndGenuses) {
        for (const genusSiggnal of this.body.bodyData.signals.genuses) {
          const genusName = genus[genusSiggnal] ?? genusSiggnal;
          if (this.biologySignals.findIndex(b => b.signal.includes(genusName)) !== -1) {
            continue;
          }
          const codexEntry = this.codex?.find(c => c.category == genusName);
          this.biologySignals.push({
            entryId: codexEntry?.entryid ?? 0,
            signal: genusName,
            codex: codexEntry,
            isGuess: true,
          });
        }
      }
    }
    this.hasSignals = this.humanSignalCount > 0 || this.otherSignalCount > 0 || this.geologySignalCount > 0 || this.biologySignalCount > 0 || this.thargoidSignalCount > 0 || this.guardianSignalCount > 0 ||
      this.geologySignals.length > 0 || this.biologySignals.length > 0 || this.thargoidSignals.length > 0 || this.guardianSignals.length > 0;
    this.exandable = true;
    if (this.expanded === false || this.expanded === undefined) {
      const isInteresting = this.hasSignals ||
        this.body.bodyData.subType === 'Earth-like world' ||
        this.body.bodyData.subType === 'Water world' ||
        this.body.bodyData.subType === 'Ammonia world' ||
        this.body.bodyData.subType === 'Black Hole' ||
        this.body.bodyData.subType === 'Neutron Star' ||
        this.body.bodyData.subType?.includes('White Dwarf') ||
        this.body.bodyData.subType?.includes('Wolf-Rayet') ||
        this.body.bodyData.subType?.includes('Herbig') ||
        !!this.body.bodyData.isLandable;
      this.expanded = this.forceExpanded || isInteresting;
    }
    this.isExpanded = this.expanded;

    if (this.isRoot) {
      this.styleClass = "";
    }
    else if (!this.isLast) {
      if (!this.isExpanded) {
        this.styleClass = "child-container-title-only";
      }
      else {
        this.styleClass = "child-container-default";
      }
    }
    else {
      if (!this.isExpanded) {
        this.styleClass = "child-container-title-only-last";
      }
      else {
        this.styleClass = "child-container-default-last";
      }
    }

    // Compute and cache expensive properties
    this.computeMaterialBadges();
    this.computeHotspotsList();
    this.computeRingResourceTypes();
    this.computeSurfacePressureTooltip();

  }

  public toggleExpand(): void {
    this.expanded = !this.expanded;
    this.isExpanded = this.expanded;
    // Update cached state
    this.updateChildrenExpandedState();
    this.cdr.markForCheck();
  }

  public toggleChildren(): void {
    const childArray = this.childComponents.toArray();
    const anyChildExpanded = childArray.some(child => child.expanded);
    const targetState = !anyChildExpanded;

    // Collect all descendants using non-recursive approach
    const allDescendants: SystemBodyComponent[] = [];
    const queue: SystemBodyComponent[] = [...childArray];

    while (queue.length > 0) {
      const component = queue.shift()!;
      allDescendants.push(component);

      // Add grandchildren to queue
      if (component.childComponents) {
        queue.push(...component.childComponents.toArray());
      }
    }

    // Batch update all descendants
    allDescendants.forEach(component => {
      component.expanded = targetState;
      component.isExpanded = targetState;
      component.cdr.markForCheck();
    });

    // Update cached state and trigger change detection
    this.updateChildrenExpandedState();
    this.cdr.markForCheck();
  }

  public hasChildren(): boolean {
    return this.body.subBodies && this.body.subBodies.length > 0;
  }

  public getChildrenExpandedState(): boolean {
    return this.cachedChildrenExpandedState;
  }

  public getEccentricityAnalysis(eccentricity: number): string {
    if (eccentricity === 0) return 'Circular';
    if (eccentricity < 0.4) return 'Nearly Circular';
    if (eccentricity < 0.8) return 'Eccentric';
    return 'Highly Eccentric';
  }

  public getAtmosphereCompositionTooltip(): string {
    if (!this.body.bodyData.atmosphereComposition) {
      return '';
    }
    return Object.entries(this.body.bodyData.atmosphereComposition)
      .map(([gas, percentage]) => `${gas}: ${percentage.toFixed(2)}%`)
      .join('\n');
  }

  public getAtmosphereDisplay(): string {
    if (this.body.bodyData.atmosphereType) {
      return this.body.bodyData.atmosphereType;
    }
    if (this.body.bodyData.atmosphereComposition) {
      const largest = Object.entries(this.body.bodyData.atmosphereComposition)
        .reduce((max, [gas, percentage]) => percentage > max[1] ? [gas, percentage] : max);
      return `${largest[0]} ${largest[1].toFixed(2)}%`;
    }
    return '';
  }

  public getApoapsis(): number {
    const semiMajorAxisKm = (this.body.bodyData.semiMajorAxis ?? 0) * 149597870.7;
    const eccentricity = this.body.bodyData.orbitalEccentricity ?? 0;
    return semiMajorAxisKm * (1 + eccentricity);
  }

  public getPeriapsis(): number {
    const semiMajorAxisKm = (this.body.bodyData.semiMajorAxis ?? 0) * 149597870.7;
    const eccentricity = this.body.bodyData.orbitalEccentricity ?? 0;
    return semiMajorAxisKm * (1 - eccentricity);
  }

  public getRingWidth(): number {
    const outer = this.body.bodyData.outerRadius ?? 0;
    const inner = this.body.bodyData.innerRadius ?? 0;
    return outer - inner;
  }

  public getRingArea(): number {
    const outer = this.body.bodyData.outerRadius ?? 0;
    const inner = this.body.bodyData.innerRadius ?? 0;
    return Math.PI * (outer * outer - inner * inner);
  }

  public getRingDensity(): number {
    const mass = this.body.bodyData.mass ?? 0;
    const area = this.getRingArea();
    return area > 0 ? mass / area : 0;
  }

  public getPlanetaryDensity(): { value: number; unit: string; tooltip: string } | null {
    // Only calculate for planets and stars with both mass and radius
    let radiusKm: number = 0;

    // Get radius in km
    if (this.body.bodyData.radius) {
      radiusKm = this.body.bodyData.radius;
    } else if (this.body.bodyData.solarRadius) {
      // Convert solar radius to km (1 solar radius = 695,700 km)
      radiusKm = this.body.bodyData.solarRadius * 695700;
    } else {
      return null;
    }

    let massKg: number = 0;

    // Get mass in kg
    if (this.body.bodyData.earthMasses) {
      massKg = this.body.bodyData.earthMasses * 5.972e24; // Earth mass in kg
    } else if (this.body.bodyData.solarMasses) {
      massKg = this.body.bodyData.solarMasses * 1.989e30; // Solar mass in kg
    } else {
      return null;
    }

    // Calculate volume in m³ (radius is in km)
    const radiusM = radiusKm * 1000;
    const volumeM3 = (4 / 3) * Math.PI * Math.pow(radiusM, 3);

    // Calculate density in kg/m³
    const densityKgM3 = massKg / volumeM3;

    // Choose appropriate unit based on magnitude
    let value: number;
    let unit: string;

    if (densityKgM3 < 1) {
      // Use g/cm³ for very low densities (gas giants, some stars)
      value = densityKgM3 / 1000;
      unit = 'g/cm³';
    } else if (densityKgM3 < 10000) {
      // Use g/cm³ for typical planetary densities
      value = densityKgM3 / 1000;
      unit = 'g/cm³';
    } else {
      // Use kg/m³ for very high densities (neutron stars, etc.)
      value = densityKgM3;
      unit = 'kg/m³';
    }

    return {
      value: value,
      unit: unit,
      tooltip: `${densityKgM3} kg/m³`
    };
  }

  public isRingNotVisible(): boolean {
    if (this.body.bodyData.type !== 'Ring') {
      return false;
    }
    const density = this.getRingDensity();
    const width = this.getRingWidth();
    return density < 0.1 && width > 1000000;
  }

  public getHillLimitExceeded(): number | null {
    // Ring Hill-limit reporting removed. Shepherding bodies use dedicated UI.
    return null;
  }

  public formatEarthMass(earthMasses: number): { display: string; tooltip: string } {
    return {
      display: `${earthMasses.toFixed(2)} Earth masses`,
      tooltip: `${earthMasses} Earth masses`
    };
  }

  public formatSolarMass(solarMasses: number): { display: string; tooltip: string } {
    return {
      display: `${solarMasses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      tooltip: `${solarMasses.toLocaleString('en-US', { maximumFractionDigits: 20 })} Solar masses`
    };
  }

  public getSignalsCount(): number {
    // First check if the ring body itself has signals
    if (this.body.bodyData.signals?.signals) {
      return Object.keys(this.body.bodyData.signals.signals).length;
    }

    // For ring bodies, check the parent's rings array
    if (this.body.bodyData.type === 'Ring' && this.body.parent?.bodyData.rings) {
      const ringData = this.body.parent.bodyData.rings.find(r => r.name === this.body.bodyData.name);
      if (ringData?.signals?.signals) {
        return Object.keys(ringData.signals.signals).length;
      }
    }

    return 0;
  }

  private computeHotspotsList(): void {
    let signals: { [key: string]: number } | undefined;

    // First check if the ring body itself has signals
    if (this.body.bodyData.signals?.signals) {
      signals = this.body.bodyData.signals.signals;
    }
    // For ring bodies, check the parent's rings array
    else if (this.body.bodyData.type === 'Ring' && this.body.parent?.bodyData.rings) {
      const ringData = this.body.parent.bodyData.rings.find(r => r.name === this.body.bodyData.name);
      if (ringData?.signals?.signals) {
        signals = ringData.signals.signals;
      }
    }

    if (!signals) {
      this.cachedHotspotsList = [];
      return;
    }

    this.cachedHotspotsList = Object.entries(signals).map(([key, count]) => {
      const resource = MINING_RESOURCES[key];
      const displayName = resource?.name || key;
      let description = resource?.description || '';
      // Remove "— In-Game Description" suffix
      description = description.replace(/\s*—\s*In-Game Description\s*$/i, '').trim();
      return {
        displayName,
        count,
        wikiUrl: `https://elite-dangerous.fandom.com/wiki/${encodeURIComponent(displayName)}`,
        description
      };
    });
  }

  public getHotspotsList(): { displayName: string; count: number; wikiUrl: string; description: string }[] {
    return this.cachedHotspotsList;
  }

  private computeRingResourceTypes(): void {
    const hotspots = this.cachedHotspotsList;
    const types = new Set<string>();

    hotspots.forEach(hotspot => {
      const key = Object.keys(MINING_RESOURCES).find(
        k => MINING_RESOURCES[k].name === hotspot.displayName
      );
      if (key) {
        types.add(MINING_RESOURCES[key].type);
      }
    });

    this.cachedRingResourceTypes = types;
  }

  public getRingResourceTypes(): Set<string> {
    return this.cachedRingResourceTypes;
  }

  private computeSurfacePressureTooltip(): void {
    const p = this.body?.bodyData?.surfacePressure;
    if (p === null || p === undefined) {
      this.cachedSurfacePressureTooltip = '';
      return;
    }

    // Assume stored value is in atmospheres
    const atm = Number(p);
    const kPa = atm * 101.325; // 1 atm = 101.325 kPa
    const pa = atm * 101325; // 1 atm = 101325 Pa
    const psi = atm * 14.6959488; // 1 atm = 14.6959 psi

    // Format nicely (one value per line for tooltip)
    const atmStr = `${atm.toFixed(2)} atm`;
    const kPaStr = `${kPa.toFixed(2)} kPa`;
    const paStr = `${Math.round(pa).toLocaleString()} Pa`;
    const psiStr = `${psi.toFixed(2)} psi`;

    this.cachedSurfacePressureTooltip = `${atmStr}\n${kPaStr}\n${paStr}\n${psiStr}`;
  }

  public logTooltip(name: string, description: string): void {
    // Debug logging removed
  }

  public trackByHotspot(index: number, hotspot: any): string {
    return hotspot.displayName;
  }

  public getSignalsTooltip(): string {
    let signals: { [key: string]: number } | undefined;

    // First check if the ring body itself has signals
    if (this.body.bodyData.signals?.signals) {
      signals = this.body.bodyData.signals.signals;
    }
    // For ring bodies, check the parent's rings array
    else if (this.body.bodyData.type === 'Ring' && this.body.parent?.bodyData.rings) {
      const ringData = this.body.parent.bodyData.rings.find(r => r.name === this.body.bodyData.name);
      if (ringData?.signals?.signals) {
        signals = ringData.signals.signals;
      }
    }

    if (!signals) return '';

    return Object.entries(signals)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  }

  // Ring Hill-limit calculation removed. Shepherding uses calculateShepherdingHillLimit().

  public calculateShepherdingHillLimit(): {
    hillRadius: number;
    bodyOrbitalRadius: number;
    bodyPeriapsis: number;
    bodyApoapsis: number;
    parentRadius: number;
    outermostRingRadius: number;
    withinRings: boolean;
    isFirstOutside: boolean;
  } | null {
    // Simple localized Hill sphere calculation for potential shepherding bodies
    if (!this.body.parent || !this.isShepherdingCandidate()) {
      return null;
    }

    const parent = this.body.parent.bodyData;
    const bodyMass = this.body.bodyData.earthMasses;
    const semiMajorAxis = this.body.bodyData.semiMajorAxis;
    const eccentricity = this.body.bodyData.orbitalEccentricity || 0;

    if (!bodyMass || !semiMajorAxis) {
      return null;
    }

    // Get parent mass
    let parentMass = parent.earthMasses;
    if (!parentMass && parent.solarMasses) {
      parentMass = parent.solarMasses * 332950; // Convert to Earth masses
    }

    if (!parentMass) {
      return null;
    }

    // Calculate Hill radius: r_H = a * (m / 3M)^(1/3)
    // where a = semi-major axis, m = satellite mass, M = primary mass
    const semiMajorAxisKm = semiMajorAxis * 149597870.7;
    const massRatio = bodyMass / (3 * parentMass);
    const hillRadius = semiMajorAxisKm * Math.pow(massRatio, 1 / 3);

    // Calculate periapsis and apoapsis
    const bodyPeriapsis = semiMajorAxisKm * (1 - eccentricity);
    const bodyApoapsis = semiMajorAxisKm * (1 + eccentricity);

    // Get parent radius
    let parentRadius = 0;
    if (parent.radius) {
      parentRadius = parent.radius;
    } else if (parent.solarRadius) {
      parentRadius = parent.solarRadius * 695700;
    }

    // Find outermost ring (convert from meters to km)
    let outermostRingRadius = 0;
    if (parent.rings) {
      for (const ring of parent.rings) {
        const outerRadiusKm = (ring.outerRadius || 0) / 1000;
        if (outerRadiusKm > outermostRingRadius) {
          outermostRingRadius = outerRadiusKm;
        }
      }
    }

    // Determine position relative to rings
    const withinRings = semiMajorAxisKm >= parentRadius && semiMajorAxisKm <= outermostRingRadius;

    // Check if first body outside
    const siblings = this.body.parent.subBodies.filter(b =>
      b.bodyData.type !== 'Ring' &&
      b.bodyData.semiMajorAxis &&
      b.bodyData.semiMajorAxis > 0
    );
    const sortedSiblings = siblings.sort((a, b) => {
      const distA = (a.bodyData.semiMajorAxis || 0) * 149597870.7;
      const distB = (b.bodyData.semiMajorAxis || 0) * 149597870.7;
      return distA - distB;
    });
    const bodiesOutsideRings = sortedSiblings.filter(b => {
      const dist = (b.bodyData.semiMajorAxis || 0) * 149597870.7;
      return dist > outermostRingRadius;
    });
    const isFirstOutside = bodiesOutsideRings.length > 0 && bodiesOutsideRings[0] === this.body;

    return {
      hillRadius,
      bodyOrbitalRadius: semiMajorAxisKm,
      bodyPeriapsis,
      bodyApoapsis,
      parentRadius,
      outermostRingRadius,
      withinRings,
      isFirstOutside
    };
  }

  public calculateRigidRocheLimit(): number | null {
    // Rigid body Roche limit (for solid bodies)
    // d = 2.456 * R_primary * (ρ_primary / ρ_satellite)^(1/3)
    if (!this.body.parent) {
      return null;
    }

    const parent = this.body.parent.bodyData;
    let primaryRadius = 0;
    let primaryDensity = 0;

    // Get primary radius in km
    if (parent.radius) {
      primaryRadius = parent.radius;
    } else if (parent.solarRadius) {
      primaryRadius = parent.solarRadius * 695700; // Solar radius to km
    } else {
      return null;
    }

    // Calculate primary density in kg/m³
    if (parent.earthMasses && parent.radius) {
      // Planet with earthMasses
      const massKg = parent.earthMasses * 5.972e24; // Earth masses to kg
      const radiusM = parent.radius * 1000; // km to m
      const volume = (4 / 3) * Math.PI * Math.pow(radiusM, 3); // m³
      primaryDensity = massKg / volume; // kg/m³
    } else if (parent.mass && parent.radius) {
      // Body with mass in Mt
      const massKg = parent.mass * 1e12; // Mt to kg
      const radiusM = parent.radius * 1000; // km to m
      const volume = (4 / 3) * Math.PI * Math.pow(radiusM, 3); // m³
      primaryDensity = massKg / volume; // kg/m³
    } else if (parent.solarMasses && parent.solarRadius) {
      // Star with solar masses
      const radiusM = parent.solarRadius * 695700 * 1000; // solar radius to m
      const massKg = parent.solarMasses * 1.989e30; // kg
      const volume = (4 / 3) * Math.PI * Math.pow(radiusM, 3); // m³
      primaryDensity = massKg / volume; // kg/m³
    } else {
      return null;
    }

    // Determine satellite density based on ring type (kg/m³)
    let satelliteDensity = 1000; // Default: icy rings (water ice)
    const ringClass = this.body.bodyData.subType?.toLowerCase() || '';

    if (ringClass.includes('metal')) {
      satelliteDensity = 4500; // Metal-rich rings (iron/nickel)
    } else if (ringClass.includes('metallic')) {
      satelliteDensity = 4500; // Metallic rings
    } else if (ringClass.includes('rocky')) {
      satelliteDensity = 3000; // Rocky rings (silicates)
    } else if (ringClass.includes('icy')) {
      satelliteDensity = 1000; // Icy rings (water ice)
    }

    const rigidRocheLimit = 1.26 * primaryRadius * Math.pow(primaryDensity / satelliteDensity, 1 / 3);
    return rigidRocheLimit;
  }

  public calculateFluidRocheLimit(): number | null {
    // Fluid body Roche limit (for liquid bodies)
    // d = 2.456 * R_primary * (ρ_primary / ρ_satellite)^(1/3)
    if (!this.body.parent) {
      return null;
    }

    const parent = this.body.parent.bodyData;
    let primaryRadius = 0;
    let primaryDensity = 0;

    // Get primary radius in km
    if (parent.radius) {
      primaryRadius = parent.radius;
    } else if (parent.solarRadius) {
      primaryRadius = parent.solarRadius * 695700;
    } else {
      return null;
    }

    // Calculate primary density in kg/m³
    if (parent.earthMasses && parent.radius) {
      // Planet with earthMasses
      const massKg = parent.earthMasses * 5.972e24; // Earth masses to kg
      const radiusM = parent.radius * 1000; // km to m
      const volume = (4 / 3) * Math.PI * Math.pow(radiusM, 3); // m³
      primaryDensity = massKg / volume; // kg/m³
    } else if (parent.mass && parent.radius) {
      // Body with mass in Mt
      const massKg = parent.mass * 1e12; // Mt to kg
      const radiusM = parent.radius * 1000; // km to m
      const volume = (4 / 3) * Math.PI * Math.pow(radiusM, 3); // m³
      primaryDensity = massKg / volume; // kg/m³
    } else if (parent.solarMasses && parent.solarRadius) {
      // Star with solar masses
      const radiusM = parent.solarRadius * 695700 * 1000; // solar radius to m
      const massKg = parent.solarMasses * 1.989e30; // kg
      const volume = (4 / 3) * Math.PI * Math.pow(radiusM, 3); // m³
      primaryDensity = massKg / volume; // kg/m³
    } else {
      return null;
    }

    // Determine satellite density based on ring type (kg/m³)
    let satelliteDensity = 1000; // Default: icy rings (water ice)
    const ringClass = this.body.bodyData.subType?.toLowerCase() || '';

    if (ringClass.includes('metal')) {
      satelliteDensity = 4500; // Metal-rich rings (iron/nickel)
    } else if (ringClass.includes('metallic')) {
      satelliteDensity = 4500; // Metallic rings
    } else if (ringClass.includes('rocky')) {
      satelliteDensity = 3000; // Rocky rings (silicates)
    } else if (ringClass.includes('icy')) {
      satelliteDensity = 1000; // Icy rings (water ice)
    }

    const fluidRocheLimit = 2.456 * primaryRadius * Math.pow(primaryDensity / satelliteDensity, 1 / 3);
    return fluidRocheLimit;
  }

  public calculateBodyRocheLimits(): { rigid: number; fluid: number; currentDistance: number; periapsis: number; apoapsis: number } | null {
    // Calculate Roche limits for planets/moons (not rings)
    if (!this.body.parent || this.body.bodyData.type === 'Ring' || this.body.bodyData.type === 'Star') {
      return null;
    }

    if (!this.body.bodyData.semiMajorAxis || !this.body.bodyData.radius || !this.body.bodyData.earthMasses) {
      return null;
    }

    const parent = this.body.parent.bodyData;
    let primaryRadius = 0;
    let primaryDensity = 0;

    // Get primary radius in km
    if (parent.radius) {
      primaryRadius = parent.radius;
    } else if (parent.solarRadius) {
      primaryRadius = parent.solarRadius * 695700;
    } else {
      return null;
    }

    // Calculate primary density in kg/m³
    if (parent.earthMasses && parent.radius) {
      const massKg = parent.earthMasses * 5.972e24;
      const radiusM = parent.radius * 1000;
      const volume = (4 / 3) * Math.PI * Math.pow(radiusM, 3);
      primaryDensity = massKg / volume;
    } else if (parent.solarMasses && parent.solarRadius) {
      const radiusM = parent.solarRadius * 695700 * 1000;
      const massKg = parent.solarMasses * 1.989e30;
      const volume = (4 / 3) * Math.PI * Math.pow(radiusM, 3);
      primaryDensity = massKg / volume;
    } else {
      return null;
    }

    // Calculate satellite (this body's) density
    const satelliteMassKg = this.body.bodyData.earthMasses * 5.972e24;
    const satelliteRadiusM = this.body.bodyData.radius * 1000;
    const satelliteVolume = (4 / 3) * Math.PI * Math.pow(satelliteRadiusM, 3);
    const satelliteDensity = satelliteMassKg / satelliteVolume;

    const rigidLimit = 1.26 * primaryRadius * Math.pow(primaryDensity / satelliteDensity, 1 / 3);
    const fluidLimit = 2.456 * primaryRadius * Math.pow(primaryDensity / satelliteDensity, 1 / 3);
    const currentDistance = this.body.bodyData.semiMajorAxis * 149597870.7; // AU to km

    // Calculate periapsis and apoapsis
    const eccentricity = this.body.bodyData.orbitalEccentricity || 0;
    const periapsis = currentDistance * (1 - eccentricity);
    const apoapsis = currentDistance * (1 + eccentricity);

    return { rigid: rigidLimit, fluid: fluidLimit, currentDistance, periapsis, apoapsis };
  }

  public getConfirmedBiologyCount(): number {
    return this.biologySignals.filter(b => !b.isGuess).length;
  }

  public isBodyWithinParentRings(): boolean {
    // Check if this body orbits within or near the parent's ring system
    if (!this.body.parent || this.body.bodyData.type === 'Ring' || this.body.bodyData.type === 'Star') {
      return false;
    }

    if (!this.body.bodyData.semiMajorAxis) {
      return false;
    }

    const parent = this.body.parent.bodyData;
    if (!parent.rings || parent.rings.length === 0) {
      return false;
    }

    // Get body's orbital distance in km
    const bodyDistanceKm = this.body.bodyData.semiMajorAxis * 149597870.7;

    // Get parent radius in km
    let parentRadius = 0;
    if (parent.radius) {
      parentRadius = parent.radius;
    } else if (parent.solarRadius) {
      parentRadius = parent.solarRadius * 695700;
    }

    // Find the outermost ring (convert from meters to km)
    let outermostRingRadius = 0;
    for (const ring of parent.rings) {
      const outerRadiusKm = (ring.outerRadius || 0) / 1000;
      if (outerRadiusKm > outermostRingRadius) {
        outermostRingRadius = outerRadiusKm;
      }
    }

    if (outermostRingRadius === 0) {
      return false;
    }

    // Show limits if body is between parent surface and outer ring edge
    // or if body is close to the outer ring (within 20% of the ring system extent)
    const ringSystemExtent = outermostRingRadius - parentRadius;
    const proximityThreshold = outermostRingRadius + (ringSystemExtent * 0.2);

    return bodyDistanceKm >= parentRadius && bodyDistanceKm <= proximityThreshold;
  }

  public isShepherdingCandidate(): boolean {
    // Identifies bodies that could have a shepherding effect on rings
    // Returns true if body's Hill sphere overlaps or is close to rings
    if (!this.body.parent || this.body.bodyData.type === 'Ring' || this.body.bodyData.type === 'Star') {
      return false;
    }

    if (!this.body.bodyData.semiMajorAxis) {
      return false;
    }

    const parent = this.body.parent.bodyData;
    if (!parent.rings || parent.rings.length === 0) {
      return false;
    }

    // Get body's orbital distance in km
    const bodyDistanceKm = this.body.bodyData.semiMajorAxis * 149597870.7;

    // Get parent radius in km
    let parentRadius = 0;
    if (parent.radius) {
      parentRadius = parent.radius;
    } else if (parent.solarRadius) {
      parentRadius = parent.solarRadius * 695700;
    }

    // Find the outermost ring (convert from meters to km)
    let outermostRingRadius = 0;
    for (const ring of parent.rings) {
      const outerRadiusKm = (ring.outerRadius || 0) / 1000;
      if (outerRadiusKm > outermostRingRadius) {
        outermostRingRadius = outerRadiusKm;
      }
    }

    if (outermostRingRadius === 0) {
      return false;
    }

    // Body is within rings if between parent and outermost ring
    if (bodyDistanceKm >= parentRadius && bodyDistanceKm <= outermostRingRadius) {
      return true;
    }

    // For bodies outside rings, check if Hill sphere is close enough to influence
    // Calculate Hill radius
    const bodyMass = this.body.bodyData.earthMasses;
    if (!bodyMass) {
      return false;
    }

    let parentMass = parent.earthMasses;
    if (!parentMass && parent.solarMasses) {
      parentMass = parent.solarMasses * 332950;
    }

    if (!parentMass) {
      return false;
    }

    const massRatio = bodyMass / (3 * parentMass);
    const hillRadius = bodyDistanceKm * Math.pow(massRatio, 1 / 3);

    // Check if Hill sphere extends close to the rings
    // Inner edge of Hill sphere
    const hillInnerEdge = bodyDistanceKm - hillRadius;

    // Body is a shepherding candidate if its Hill sphere comes within 20% of ring system width from the outer ring
    const ringSystemWidth = outermostRingRadius - parentRadius;
    const influenceDistance = outermostRingRadius + (ringSystemWidth * 0.2);

    if (hillInnerEdge <= influenceDistance) {
      return true;
    }

    return false;
  }

  /**
   * Returns true if the body is a true shepherd moon (Hill sphere close enough to ring edge)
   */
  public isActualShepherd(): boolean {
    const hillData = this.calculateShepherdingHillLimit();
    if (!hillData) return false;
    // Only true shepherd if status is 'shepherd' (Hill sphere close to ring edge)
    // Use same logic as in showShepherdingHillLimitChart
    if (hillData.withinRings) return false;
    if (hillData.isFirstOutside) {
      const hillInnerEdge = hillData.bodyOrbitalRadius - hillData.hillRadius;
      const ringSystemWidth = hillData.outermostRingRadius - hillData.parentRadius;
      const influenceDistance = hillData.outermostRingRadius + (ringSystemWidth * 0.2);
      if (hillInnerEdge <= influenceDistance) {
        return true;
      }
    }
    return false;
  }

  // Orbital mechanics helper: Convert Keplerian elements to 3D Cartesian position
  private orbitalElementsToCartesian(
    semiMajorAxisAU: number,
    eccentricity: number,
    inclinationDeg: number,
    argPeriapsisDeg: number,
    ascendingNodeDeg: number,
    meanAnomalyDeg: number
  ): { x: number; y: number; z: number } {
    const a = semiMajorAxisAU * 149597870.7; // AU to km
    const e = eccentricity;
    const i = inclinationDeg * Math.PI / 180;
    const w = argPeriapsisDeg * Math.PI / 180;
    const omega = ascendingNodeDeg * Math.PI / 180;
    const M = meanAnomalyDeg * Math.PI / 180;

    // Solve Kepler's equation for eccentric anomaly E
    let E = M;
    for (let iter = 0; iter < 10; iter++) {
      E = M + e * Math.sin(E);
    }

    // True anomaly
    const nu = 2 * Math.atan2(
      Math.sqrt(1 + e) * Math.sin(E / 2),
      Math.sqrt(1 - e) * Math.cos(E / 2)
    );

    // Distance from focus
    const r = a * (1 - e * Math.cos(E));

    // Position in orbital plane
    const xOrb = r * Math.cos(nu);
    const yOrb = r * Math.sin(nu);

    // Rotate to reference frame
    const cosW = Math.cos(w);
    const sinW = Math.sin(w);
    const cosO = Math.cos(omega);
    const sinO = Math.sin(omega);
    const cosI = Math.cos(i);
    const sinI = Math.sin(i);

    const x = (cosO * cosW - sinO * sinW * cosI) * xOrb + (-cosO * sinW - sinO * cosW * cosI) * yOrb;
    const y = (sinO * cosW + cosO * sinW * cosI) * xOrb + (-sinO * sinW + cosO * cosW * cosI) * yOrb;
    const z = (sinW * sinI) * xOrb + (cosW * sinI) * yOrb;

    return { x, y, z };
  }

  // Get position of a body in system coordinates, accounting for hierarchical parent-child relationships
  // Each body in the chain uses its current orbital position (meanAnomalyDeg parameter)
  private getBodyPositionInSystemFrame(body: SystemBody, meanAnomalyDeg: number): { x: number; y: number; z: number } | null {
    const bodyData = body.bodyData;

    // If no parent, this is the root body (at origin)
    if (!body.parent) {
      return { x: 0, y: 0, z: 0 };
    }

    // If no orbital data for a body that has a parent
    if (!bodyData.semiMajorAxis) {
      // Special case: bodyId 0 can be at origin even with a parent (primary star/barycentre)
      if (bodyData.bodyId === 0) {
        return { x: 0, y: 0, z: 0 };
      }
      // For any other body (including unknown barycentres), missing semiMajorAxis means we can't calculate position
      return null;
    }

    // Check if all required orbital parameters are present
    if (bodyData.orbitalEccentricity === null || bodyData.orbitalEccentricity === undefined ||
      bodyData.orbitalInclination === null || bodyData.orbitalInclination === undefined ||
      bodyData.argOfPeriapsis === null || bodyData.argOfPeriapsis === undefined ||
      bodyData.ascendingNode === null || bodyData.ascendingNode === undefined) {
      // Special case: bodyId 0 can be at origin even with missing parameters
      if (bodyData.bodyId === 0) {
        return { x: 0, y: 0, z: 0 };
      }
      // Missing orbital parameters for non-primary body (like unknown barycentres)
      return null;
    }

    // Get orbital elements (convert from Elite Dangerous convention)
    const sma = bodyData.semiMajorAxis;
    const ecc = bodyData.orbitalEccentricity;
    const inc = bodyData.orbitalInclination;
    const argP = -bodyData.argOfPeriapsis;
    const node = -bodyData.ascendingNode;

    // Compute position relative to parent using this body's mean anomaly
    const localPos = this.orbitalElementsToCartesian(sma, ecc, inc, argP, node, meanAnomalyDeg);

    // Recursively get parent's position in system frame
    // Parent uses its own current mean anomaly (from its bodyData or 0 if not orbiting)
    const parentMeanAnomaly = body.parent.bodyData.meanAnomaly || 0;
    const parentPos = this.getBodyPositionInSystemFrame(body.parent, parentMeanAnomaly);

    if (!parentPos) {
      // Parent chain has missing data - cannot calculate absolute position
      return null;
    }

    // Transform to system coordinates by adding parent's position
    return {
      x: localPos.x + parentPos.x,
      y: localPos.y + parentPos.y,
      z: localPos.z + parentPos.z
    };
  }  // Calculate distance between two 3D points
  private distance3D(p1: { x: number; y: number; z: number }, p2: { x: number; y: number; z: number }): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = p1.z - p2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // Validate calculated distance against orbital mechanics constraints
  private validateDistanceCalculation(body1: SystemBody, body2: SystemBody, calculatedDistance: number): void {
    // Walk up the parent chain to find common ancestor and calculate theoretical min/max distances
    const getParentChain = (body: SystemBody): SystemBody[] => {
      const chain: SystemBody[] = [];
      let current: SystemBody | null = body;
      while (current) {
        chain.push(current);
        current = current.parent;
      }
      return chain;
    };

    const chain1 = getParentChain(body1);
    const chain2 = getParentChain(body2);

    // Find common ancestor (barycentre or star)
    let commonAncestor: SystemBody | null = null;
    for (const ancestor1 of chain1) {
      if (chain2.includes(ancestor1)) {
        commonAncestor = ancestor1;
        break;
      }
    }

    if (!commonAncestor) return; // No common ancestor found

    // Calculate theoretical minimum distance: |periapsis1 - apoapsis2|
    // For bodies orbiting a common parent, minimum distance occurs when one is at periapsis
    // facing the other at apoapsis
    const getOrbitalExtents = (body: SystemBody): { periapsis: number; apoapsis: number } | null => {
      const data = body.bodyData;
      if (!data.semiMajorAxis) return null;

      const sma = data.semiMajorAxis * 149597870.7; // Convert AU to km
      const ecc = data.orbitalEccentricity || 0;
      const periapsis = sma * (1 - ecc);
      const apoapsis = sma * (1 + ecc);

      return { periapsis, apoapsis };
    };

    // Check each body in the chains up to common ancestor
    const extents1 = getOrbitalExtents(body1);
    const extents2 = getOrbitalExtents(body2);

    if (extents1 && extents2) {
      // Theoretical absolute minimum: difference between closest approaches
      const theoreticalMin = Math.abs(extents1.periapsis - extents2.apoapsis);
      const theoreticalMax = extents1.apoapsis + extents2.apoapsis;

      // Silently validate - errors will be shown in debug info dialog if enabled
    }
  }

  // Get all bodies in the system (traverse to root and collect all)
  private getAllSystemBodies(): SystemBody[] {
    let root = this.body;
    while (root.parent) {
      root = root.parent;
    }

    const allBodies: SystemBody[] = [];
    const traverse = (body: SystemBody) => {
      allBodies.push(body);
      for (const child of body.subBodies) {
        traverse(child);
      }
    };
    traverse(root);
    return allBodies;
  }

  // Calculate Hill limit considering all potential perturbers
  // Ring Hill-limit calculation removed.

  public getSolidCompositionTooltip(): string {
    if (!this.body.bodyData.solidComposition) {
      return '';
    }
    return Object.entries(this.body.bodyData.solidComposition)
      .map(([component, percentage]) => `${component}: ${percentage.toFixed(2)}%`)
      .join('\n');
  }

  private getAsteroidIcon(): string | null {
    // Only show icon for rings and belts
    if (this.body.bodyData.type !== 'Ring' && this.body.bodyData.type !== 'Belt') {
      return null;
    }

    // Get the subType (e.g., "Icy", "Metallic", "Metal Rich", "Rocky")
    const subType = this.body.bodyData.subType;
    if (!subType) {
      return null;
    }

    // Convert subType to lowercase and replace spaces with underscores
    // "Metal Rich" -> "metal_rich"
    const iconName = subType.toLowerCase().replace(/ /g, '_');

    // Construct the filename based on type (without 'assets/' prefix as it's added in template)
    if (this.body.bodyData.type === 'Belt') {
      return `asteroids/cluster_${iconName}_01.png`;
    } else {
      // Ring
      return `asteroids/${iconName}_01.png`;
    }
  }

  public ngAfterViewInit(): void {
    setTimeout(() => this.updateChildrenExpandedState());
  }

  private updateChildrenExpandedState(): void {
    const childArray = this.childComponents?.toArray() || [];
    this.cachedChildrenExpandedState = childArray.some(child => child.expanded);
  }

  public trackByMaterial(index: number, material: { name: string, class: string, tooltip: string }): string {
    return material.name;
  }

  public trackByBody(index: number, body: SystemBody): number {
    return body.bodyData.bodyId;
  }

  public trackByBiologySignal(index: number, signal: BiologySignal): number {
    return signal.entryId;
  }

  public trackByString(index: number, item: string): string {
    return item;
  }



  public onMouseEnter(index: number): void {
    this.hoveredIndex = index;
  }

  public copyBodyJson(): void {
    const jsonText = JSON.stringify(this.body.bodyData, null, 2);
    const textArea = document.createElement('textarea');
    textArea.value = jsonText;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }

  public getFormattedBodyJson(): string {
    return JSON.stringify(this.body.bodyData, null, 2);
  }

  public showBodyJsonDialog(event: MouseEvent): void {
    this.dialog.open(this.jsonDialogTemplate, {
      width: '800px',
      autoFocus: false,
      restoreFocus: false
    });

    // Focus the title after the dialog opens
    setTimeout(() => {
      if (this.jsonDialogTitle) {
        this.jsonDialogTitle.nativeElement.focus();
      }
    }, 100);
  }

  // Ring Hill-limit dialog removed.

  public showInvisibleRingExplanation(): void {
    if (this.body.bodyData.type !== 'Ring') {
      return;
    }

    const innerRadius = this.body.bodyData.innerRadius || 0;
    const outerRadius = this.body.bodyData.outerRadius || 0;
    const mass = this.body.bodyData.mass || 0;
    const width = this.getRingWidth();
    const area = this.getRingArea();
    const density = this.getRingDensity();
    const isInvisible = density < 0.1 && width > 1000000;

    const ringName = this.body.bodyData.name.split(' ').slice(1).join(' ') || this.body.bodyData.name;

    this.invisibleRingDialogData = {
      ringName,
      innerRadius,
      outerRadius,
      width,
      area,
      mass,
      density,
      isInvisible
    };

    this.dialog.open(this.invisibleRingDialogTemplate, {
      width: '700px',
      maxWidth: '90vw',
      panelClass: 'invisible-ring-dialog'
    });
  }

  public showRocheLimitChart(): void {
    if (!this.body.parent || this.body.bodyData.type !== 'Ring') {
      return;
    }

    const parent = this.body.parent.bodyData;

    // Calculate parent density and radius
    let primaryDensity = 0;
    let primaryRadius = 0;

    if (parent.radius) {
      primaryRadius = parent.radius;
    } else if (parent.solarRadius) {
      primaryRadius = parent.solarRadius * 695700;
    } else {
      return;
    }

    if (parent.earthMasses && parent.radius) {
      const massKg = parent.earthMasses * 5.972e24;
      const radiusM = parent.radius * 1000;
      const volume = (4 / 3) * Math.PI * Math.pow(radiusM, 3);
      primaryDensity = massKg / volume;
    } else if (parent.solarMasses && parent.solarRadius) {
      const radiusM = parent.solarRadius * 695700 * 1000;
      const massKg = parent.solarMasses * 1.989e30;
      const volume = (4 / 3) * Math.PI * Math.pow(radiusM, 3);
      primaryDensity = massKg / volume;
    } else {
      return;
    }

    // Generate chart data points
    const densityRange = [];
    const rigidLimits = [];
    const fluidLimits = [];

    for (let density = 500; density <= 8000; density += 100) {
      densityRange.push(density);
      const rigidLimit = 1.26 * primaryRadius * Math.pow(primaryDensity / density, 1 / 3);
      const fluidLimit = 2.456 * primaryRadius * Math.pow(primaryDensity / density, 1 / 3);
      rigidLimits.push(rigidLimit);
      fluidLimits.push(fluidLimit);
    }

    // Get only the current ring
    const currentRing = {
      name: this.body.bodyData.name,
      innerRadius: this.body.bodyData.innerRadius || 0, // Already in km
      outerRadius: this.body.bodyData.outerRadius || 0, // Already in km
      type: this.body.bodyData.subType,
      density: this.getRingDensityFromType(this.body.bodyData.subType)
    };

    this.rocheLimitDialogData = {
      parentName: parent.name,
      ringName: this.body.bodyData.name,
      densityRange,
      rigidLimits,
      fluidLimits,
      rings: [currentRing],
      primaryRadius,
      isBody: false
    };

    this.isChartLoading = true;

    const dialogRef = this.dialog.open(this.rocheLimitDialogTemplate, {
      width: '800px',
      maxWidth: '90vw',
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop'
    });

    // Draw chart after dialog opens
    setTimeout(() => {
      this.drawRocheChart();
      this.isChartLoading = false;
    }, 100);
  }

  public showBodyRocheLimitChart(): void {
    const rocheLimits = this.calculateBodyRocheLimits();
    if (!rocheLimits || !this.body.parent) {
      return;
    }

    const parent = this.body.parent.bodyData;

    // Calculate parent density and radius
    let primaryDensity = 0;
    let primaryRadius = 0;

    if (parent.radius) {
      primaryRadius = parent.radius;
    } else if (parent.solarRadius) {
      primaryRadius = parent.solarRadius * 695700;
    } else {
      return;
    }

    if (parent.earthMasses && parent.radius) {
      const massKg = parent.earthMasses * 5.972e24;
      const radiusM = parent.radius * 1000;
      const volume = (4 / 3) * Math.PI * Math.pow(radiusM, 3);
      primaryDensity = massKg / volume;
    } else if (parent.solarMasses && parent.solarRadius) {
      const radiusM = parent.solarRadius * 695700 * 1000;
      const massKg = parent.solarMasses * 1.989e30;
      const volume = (4 / 3) * Math.PI * Math.pow(radiusM, 3);
      primaryDensity = massKg / volume;
    } else {
      return;
    }

    // Calculate body density
    const bodyMassKg = this.body.bodyData.earthMasses! * 5.972e24;
    const bodyRadiusM = this.body.bodyData.radius! * 1000;
    const bodyVolume = (4 / 3) * Math.PI * Math.pow(bodyRadiusM, 3);
    const bodyDensity = bodyMassKg / bodyVolume;

    // Generate chart data points
    const densityRange = [];
    const rigidLimits = [];
    const fluidLimits = [];

    for (let density = 500; density <= 8000; density += 100) {
      densityRange.push(density);
      const rigidLimit = 1.26 * primaryRadius * Math.pow(primaryDensity / density, 1 / 3);
      const fluidLimit = 2.456 * primaryRadius * Math.pow(primaryDensity / density, 1 / 3);
      rigidLimits.push(rigidLimit);
      fluidLimits.push(fluidLimit);
    }

    // Create a "ring" representation using periapsis/apoapsis with body radius
    const bodyRadius = this.body.bodyData.radius!; // in km
    const bodyRing = {
      name: this.body.bodyData.name,
      innerRadius: rocheLimits.periapsis - bodyRadius,
      outerRadius: rocheLimits.apoapsis + bodyRadius,
      type: 'Body Orbit',
      density: bodyDensity
    };

    this.rocheLimitDialogData = {
      parentName: parent.name,
      ringName: this.body.bodyData.name,
      densityRange,
      rigidLimits,
      fluidLimits,
      rings: [bodyRing],
      primaryRadius,
      isBody: true
    };

    this.isChartLoading = true;

    const dialogRef = this.dialog.open(this.rocheLimitDialogTemplate, {
      width: '800px',
      maxWidth: '90vw',
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop'
    });

    // Draw chart after dialog opens
    setTimeout(() => {
      this.drawRocheChart();
      this.isChartLoading = false;
    }, 100);
  }

  public showApoPeriDialog(type: 'apo' | 'peri'): void {
    let data: { date: Date, days: number } | null = null;
    let distanceKm: number | undefined = undefined;
    if (type === 'apo') {
      data = this.getNextApoapsis();
      if (this.body.bodyData.semiMajorAxis && this.body.bodyData.orbitalEccentricity !== undefined) {
        distanceKm = this.getApoapsis();
      }
    } else {
      data = this.getNextPeriapsis();
      if (this.body.bodyData.semiMajorAxis && this.body.bodyData.orbitalEccentricity !== undefined) {
        distanceKm = this.getPeriapsis();
      }
    }

    if (!data) return;

    // Prepare detailed calculation info if orbital elements exist
    let meanAnomaly: number | undefined = undefined;
    let orbitalPeriod: number | undefined = undefined;
    let timestamp: Date | undefined = undefined;
    let currentMeanAnomaly: number | undefined = undefined;
    let degreesToEvent: number | undefined = undefined;

    if (this.body.bodyData.meanAnomaly !== undefined && this.body.bodyData.orbitalPeriod && this.body.bodyData.timestamps?.meanAnomaly) {
      meanAnomaly = this.body.bodyData.meanAnomaly;
      orbitalPeriod = this.body.bodyData.orbitalPeriod;
      timestamp = new Date(this.body.bodyData.timestamps.meanAnomaly);
      const timestampMs = timestamp.getTime();
      const elapsedDays = (Date.now() - timestampMs) / (1000 * 60 * 60 * 24);
      const orbitalCycles = elapsedDays / orbitalPeriod;
      currentMeanAnomaly = (meanAnomaly + (orbitalCycles * 360)) % 360;

      if (type === 'apo') {
        degreesToEvent = (180 - currentMeanAnomaly) % 360;
        if (degreesToEvent < 0) degreesToEvent += 360;
      } else {
        degreesToEvent = (360 - currentMeanAnomaly) % 360;
      }
    }

    this.apoPeriDialogData = {
      type,
      date: data.date,
      days: data.days,
      distanceKm,
      meanAnomaly,
      orbitalPeriod,
      timestamp,
      currentMeanAnomaly,
      degreesToEvent
    };

    this.dialog.open(this.apoPeriDialogTemplate, {
      width: '600px',
      maxWidth: '90vw',
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop'
    });
  }

  public showShepherdingHillLimitChart(): void {
    const hillData = this.calculateShepherdingHillLimit();
    if (!hillData || !this.body.parent) {
      return;
    }

    const parent = this.body.parent.bodyData;

    // Get parent radius
    let parentRadius = 0;
    if (parent.radius) {
      parentRadius = parent.radius;
    } else if (parent.solarRadius) {
      parentRadius = parent.solarRadius * 695700;
    } else {
      return;
    }

    // Get all rings (convert from meters to km)
    const rings = parent.rings || [];
    const ringData = rings.map(ring => ({
      name: ring.name || 'Ring',
      innerRadius: (ring.innerRadius || 0) / 1000,
      outerRadius: (ring.outerRadius || 0) / 1000,
      type: ring.type || 'Ring'
    }));

    // Prepare dialog data
    // Shepherd status logic
    let shepherdStatus: 'shepherd' | 'inner' | 'none' = 'none';
    if (hillData.withinRings) {
      shepherdStatus = 'inner';
    } else if (hillData.isFirstOutside) {
      // Calculate Hill sphere proximity
      const hillInnerEdge = hillData.bodyOrbitalRadius - hillData.hillRadius;
      const ringSystemWidth = hillData.outermostRingRadius - hillData.parentRadius;
      const influenceDistance = hillData.outermostRingRadius + (ringSystemWidth * 0.2);
      if (hillInnerEdge <= influenceDistance) {
        shepherdStatus = 'shepherd';
      }
    }

    this.hillLimitDialogData = {
      parentName: parent.name,
      bodyName: this.body.bodyData.name,
      parentRadius,
      outermostRingRadius: hillData.outermostRingRadius,
      bodyOrbitalRadius: hillData.bodyOrbitalRadius,
      bodyPeriapsis: hillData.bodyPeriapsis,
      bodyApoapsis: hillData.bodyApoapsis,
      hillRadius: hillData.hillRadius,
      withinRings: hillData.withinRings,
      isFirstOutside: hillData.isFirstOutside,
      rings: ringData,
      bodyRadius: this.body.bodyData.radius || 0,
      shepherdStatus
    };

    this.isChartLoading = true;

    const dialogRef = this.dialog.open(this.hillLimitDialogTemplate, {
      width: '800px',
      maxWidth: '90vw',
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop'
    });

    // Draw chart after dialog opens with a longer delay
    setTimeout(() => {
      this.drawShepherdingHillChart();
      this.isChartLoading = false;
    }, 200);
  }

  private getRingDensityFromType(type: string): number {
    const ringClass = type?.toLowerCase() || '';
    if (ringClass.includes('metal')) return 4500;
    if (ringClass.includes('rocky')) return 3000;
    return 1000; // icy
  }

  private drawRocheChart(): void {
    const canvas = document.querySelector('.roche-dialog canvas') as HTMLCanvasElement;
    if (!canvas || !this.rocheLimitDialogData) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = this.rocheLimitDialogData;
    const width = canvas.width;
    const height = canvas.height;
    const padding = 60;
    const chartWidth = width - 2 * padding;
    const chartHeight = height - 2 * padding;

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Find data ranges - use log scale for Y-axis
    const minDensity = Math.min(...data.densityRange);
    const maxDensity = Math.max(...data.densityRange);

    // Get all distances including ring positions for proper scaling
    const allDistances = [...data.rigidLimits, ...data.fluidLimits];
    data.rings.forEach((ring: any) => {
      allDistances.push(ring.innerRadius);
      allDistances.push(ring.outerRadius);
    });
    const maxDistance = Math.max(...allDistances);
    const minDistance = Math.min(...allDistances) * 0.5; // Start slightly below minimum for visibility

    // Helper functions - logarithmic Y scale
    const scaleX = (density: number) => padding + ((density - minDensity) / (maxDensity - minDensity)) * chartWidth;
    const scaleY = (distance: number) => {
      if (distance <= 0) return height - padding;
      const logMin = Math.log10(minDistance);
      const logMax = Math.log10(maxDistance);
      const logDist = Math.log10(distance);
      return height - padding - ((logDist - logMin) / (logMax - logMin)) * chartHeight;
    };

    // Draw axes
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Draw logarithmic grid lines with labels
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    const logMin = Math.log10(minDistance);
    const logMax = Math.log10(maxDistance);
    const logRange = logMax - logMin;

    // Draw grid at powers of 10
    for (let logVal = Math.ceil(logMin); logVal <= Math.floor(logMax); logVal++) {
      const distance = Math.pow(10, logVal);
      const y = scaleY(distance);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // Draw rigid limit line
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < data.densityRange.length; i++) {
      const x = scaleX(data.densityRange[i]);
      const y = scaleY(data.rigidLimits[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw fluid limit line
    ctx.strokeStyle = '#4dabf7';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < data.densityRange.length; i++) {
      const x = scaleX(data.densityRange[i]);
      const y = scaleY(data.fluidLimits[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw ring positions as horizontal bands with vertical density line
    const ringColors = ['#51cf66', '#ffa94d', '#748ffc', '#ff6b6b', '#20c997'];
    data.rings.forEach((ring: any, index: number) => {
      const color = ringColors[index % ringColors.length];
      const x = scaleX(ring.density);
      const yInner = scaleY(ring.innerRadius);
      const yOuter = scaleY(ring.outerRadius);

      // Draw translucent horizontal bar for ring extent
      const rgb = color === '#51cf66' ? '81, 207, 102' :
        color === '#ffa94d' ? '255, 169, 77' :
          color === '#748ffc' ? '116, 143, 252' :
            color === '#ff6b6b' ? '255, 107, 107' : '32, 201, 151';
      ctx.fillStyle = `rgba(${rgb}, 0.2)`;
      ctx.fillRect(padding, yOuter, chartWidth, yInner - yOuter);

      // Draw horizontal lines at inner and outer radius
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(padding, yInner);
      ctx.lineTo(width - padding, yInner);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(padding, yOuter);
      ctx.lineTo(width - padding, yOuter);
      ctx.stroke();

      // Draw vertical line at the assumed density
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw density marker
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, height - padding, 6, 0, 2 * Math.PI);
      ctx.fill();

      // Label the density line
      ctx.fillStyle = color;
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.save();
      ctx.translate(x, padding + 15 + (index * 18));
      ctx.fillText(`${ring.density.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg/m³`, 0, 0);
      ctx.restore();
    });

    // Draw axis labels
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';

    // X-axis labels
    for (let i = 0; i <= 5; i++) {
      const density = minDensity + ((maxDensity - minDensity) / 5) * i;
      const x = scaleX(density);
      ctx.fillText(density.toFixed(0), x, height - padding + 20);
    }

    // Y-axis labels (logarithmic scale - powers of 10)
    ctx.textAlign = 'right';
    for (let logVal = Math.ceil(logMin); logVal <= Math.floor(logMax); logVal++) {
      const distance = Math.pow(10, logVal);
      const y = scaleY(distance);
      // Format large numbers with scientific notation or comma separation
      let label = distance >= 1000000
        ? (distance / 1000000).toFixed(1) + 'M'
        : distance >= 1000
          ? (distance / 1000).toFixed(0) + 'k'
          : distance.toFixed(0);
      ctx.fillText(label, padding - 10, y + 4);
    }

    // Draw axis titles
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Particle Density (kg/m³)', width / 2, height - 10);

    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Roche Limit Distance (km, log scale)', 0, 0);
    ctx.restore();

    // Draw legend
    const legendX = width - padding - 120;
    const legendY = padding + 20;

    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(legendX, legendY);
    ctx.lineTo(legendX + 30, legendY);
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Rigid limit', legendX + 35, legendY + 4);

    ctx.strokeStyle = '#4dabf7';
    ctx.beginPath();
    ctx.moveTo(legendX, legendY + 20);
    ctx.lineTo(legendX + 30, legendY + 20);
    ctx.stroke();
    ctx.fillText('Fluid limit', legendX + 35, legendY + 24);

    ctx.strokeStyle = '#51cf66';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(legendX, legendY + 40);
    ctx.lineTo(legendX + 30, legendY + 40);
    ctx.stroke();
    const positionLabel = this.rocheLimitDialogData.isBody ? 'Body position' : 'Ring position';
    ctx.fillText(positionLabel, legendX + 35, legendY + 44);
  }

  private drawShepherdingHillChart(): void {
    const canvas = document.querySelector('.hill-limit-dialog canvas') as HTMLCanvasElement;
    if (!canvas || !this.hillLimitDialogData) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }


    const data = this.hillLimitDialogData;
    const width = canvas.width;
    const height = canvas.height;
    const centerX = 80; // Bottom left origin
    const centerY = height - 80;

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);


    // Determine scale - find minimum and maximum radii from all features
    let minRadius = data.parentRadius;
    let maxRadius = Math.max(
      data.outermostRingRadius * 1.1,
      data.bodyApoapsis + data.hillRadius
    );

    // Find the smallest inner radius from rings for better scaling
    if (data.rings && data.rings.length > 0) {
      const smallestInner = Math.min(...data.rings.map((r: any) => r.innerRadius || minRadius));
      minRadius = Math.min(minRadius, smallestInner * 0.8); // Start slightly below smallest ring
    }


    // Use logarithmic scale for better visibility of inner rings
    const minLog = Math.log10(Math.max(minRadius, 1));
    const maxLog = Math.log10(maxRadius);
    const availableRadius = Math.min(width - centerX - 40, centerY - 40); // Quarter circle space

    // Helper to convert km to pixels using logarithmic scale
    const toPixels = (km: number) => {
      if (km <= 0) return 0;
      const logValue = Math.log10(km);
      return ((logValue - minLog) / (maxLog - minLog)) * availableRadius;
    };

    // Draw parent body at origin (bottom left)
    ctx.fillStyle = '#ff922b';
    ctx.beginPath();
    const parentRadiusPx = toPixels(data.parentRadius);
    ctx.arc(centerX, centerY, Math.max(parentRadiusPx, 8), 0, Math.PI * 2);
    ctx.fill();

    // Label parent
    ctx.fillStyle = '#333';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Parent', centerX + 10, centerY - 5);

    // Draw rings as quarter-circle arcs (top-right quadrant from bottom-left origin)
    // Use a single green colour for all rings to match the legend and improve
    // visibility when rings are very thin.
    const ringColors = ['#51cf66', '#51cf66', '#51cf66', '#51cf66', '#51cf66'];
    const startAngle = -Math.PI / 2; // Start at top (12 o'clock from origin)
    const endAngle = 0; // End at right (3 o'clock from origin)

    data.rings.forEach((ring: any, index: number) => {
      const color = ringColors[index % ringColors.length];
      const innerRadiusPx = toPixels(ring.innerRadius);
      const outerRadiusPx = toPixels(ring.outerRadius);

      // Draw ring as two arcs (inner and outer)
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      // Outer arc
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadiusPx, startAngle, endAngle);
      ctx.stroke();

      // Inner arc
      ctx.beginPath();
      ctx.arc(centerX, centerY, innerRadiusPx, startAngle, endAngle);
      ctx.stroke();

      // Fill between arcs with transparency
      const rgb = color === '#51cf66' ? '81, 207, 102' :
        color === '#ffa94d' ? '255, 169, 77' :
          color === '#748ffc' ? '116, 143, 252' :
            color === '#ff6b6b' ? '255, 107, 107' : '32, 201, 151';

      ctx.fillStyle = `rgba(${rgb}, 0.2)`;
      ctx.beginPath();
      ctx.arc(centerX, centerY, innerRadiusPx, startAngle, endAngle);
      ctx.lineTo(centerX + outerRadiusPx * Math.cos(endAngle), centerY + outerRadiusPx * Math.sin(endAngle));
      ctx.arc(centerX, centerY, outerRadiusPx, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fill();

      // Label ring at 45 degrees
      ctx.fillStyle = color;
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      const labelAngle = -Math.PI / 4; // 45 degrees
      const labelRadius = (innerRadiusPx + outerRadiusPx) / 2;
      const labelX = centerX + labelRadius * Math.cos(labelAngle);
      const labelY = centerY + labelRadius * Math.sin(labelAngle);
      ctx.fillText(`R${index + 1}`, labelX, labelY);
    });

    // Draw body orbital position as a solid quarter arc
    const bodyOrbitRadiusPx = toPixels(data.bodyOrbitalRadius);
    ctx.strokeStyle = '#4c6ef5';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(centerX, centerY, bodyOrbitRadiusPx, startAngle, endAngle);
    ctx.stroke();

    // Draw body position marker at 45 degrees
    const bodyAngle = -Math.PI / 4;
    const bodyX = centerX + bodyOrbitRadiusPx * Math.cos(bodyAngle);
    const bodyY = centerY + bodyOrbitRadiusPx * Math.sin(bodyAngle);
    ctx.fillStyle = '#4c6ef5';
    ctx.beginPath();
    ctx.arc(bodyX, bodyY, 5, 0, 2 * Math.PI);
    ctx.fill();

    // Draw Hill sphere limits as dashed quarter arcs on either side
    const hillInnerRadiusPx = toPixels(Math.max(data.bodyOrbitalRadius - data.hillRadius, data.parentRadius));
    const hillOuterRadiusPx = toPixels(data.bodyOrbitalRadius + data.hillRadius);

    ctx.strokeStyle = '#f03e3e';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);

    // Inner Hill limit
    if (data.bodyOrbitalRadius - data.hillRadius > data.parentRadius) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, hillInnerRadiusPx, startAngle, endAngle);
      ctx.stroke();
    }

    // Outer Hill limit
    ctx.beginPath();
    ctx.arc(centerX, centerY, hillOuterRadiusPx, startAngle, endAngle);
    ctx.stroke();

    ctx.setLineDash([]);

    // Add distance markers with logarithmic spacing
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.setLineDash([1, 3]);

    // Calculate nice logarithmic intervals
    const logRange = maxLog - minLog;
    const numMarkers = 6;

    for (let i = 0; i <= numMarkers; i++) {
      const logValue = minLog + (logRange / numMarkers) * i;
      const dist = Math.pow(10, logValue);
      const radiusPx = toPixels(dist);

      if (radiusPx > parentRadiusPx && radiusPx < availableRadius) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radiusPx, startAngle, endAngle);
        ctx.stroke();

        // Label at the right edge
        ctx.fillStyle = '#999';
        ctx.font = '9px Arial';
        ctx.textAlign = 'left';
        const label = dist >= 1000000
          ? (dist / 1000000).toFixed(1) + 'M km'
          : dist >= 1000
            ? (dist / 1000).toFixed(0) + 'k km'
            : dist.toFixed(0) + ' km';
        ctx.fillText(label, centerX + radiusPx + 5, centerY);
      }
    }

    ctx.setLineDash([]);

    // Draw title
    ctx.fillStyle = '#333';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Orbital View - Shepherding Analysis (Log Scale)', 20, 25);

    // Draw legend in top right
    const legendX = width - 180;
    const legendY = 50;

    ctx.fillStyle = '#333';
    ctx.font = '11px Arial';
    ctx.textAlign = 'left';

    // Ring legend
    ctx.fillStyle = 'rgba(81, 207, 102, 0.3)';
    ctx.fillRect(legendX, legendY, 15, 10);
    ctx.strokeStyle = '#51cf66';
    ctx.lineWidth = 2;
    ctx.strokeRect(legendX, legendY, 15, 10);
    ctx.fillStyle = '#333';
    ctx.fillText('Ring boundaries', legendX + 20, legendY + 9);

    // Body orbit
    ctx.strokeStyle = '#4c6ef5';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(legendX, legendY + 30);
    ctx.lineTo(legendX + 15, legendY + 30);
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.fillText('Body orbit', legendX + 20, legendY + 34);

    // Hill sphere
    ctx.strokeStyle = '#f03e3e';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(legendX, legendY + 55);
    ctx.lineTo(legendX + 15, legendY + 55);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#333';
    ctx.fillText('Hill sphere extent', legendX + 20, legendY + 59);

    // Parent body
    ctx.fillStyle = '#ff922b';
    ctx.beginPath();
    ctx.arc(legendX + 7, legendY + 80, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.fillText('Parent body', legendX + 20, legendY + 84);
  }

  public getSpinResonance(): string {
    if (!this.body.bodyData.rotationalPeriod || !this.body.bodyData.orbitalPeriod) {
      return 'none';
    }

    const rotationsPerOrbit = this.body.bodyData.orbitalPeriod / this.body.bodyData.rotationalPeriod;
    const maxDenominator = 5;
    const tolerance = 0.01;

    for (let denom = 1; denom <= maxDenominator; denom++) {
      for (let num = 1; num <= maxDenominator; num++) {
        const candidate = num / denom;
        const relError = Math.abs(candidate - rotationsPerOrbit) / candidate;
        if (relError <= tolerance) {
          return `${num}:${denom}`;
        }
      }
    }

    return 'none';
  }

  public getSpinResonanceTooltip(): string {
    const resonance = this.getSpinResonance();
    if (resonance === 'none' && this.body.bodyData.rotationalPeriodTidallyLocked) {
      return 'Rotational Period Tidally Locked';
    }
    if (resonance === '1:1' && this.body.bodyData.rotationalPeriodTidallyLocked) {
      if (this.body.parent?.bodyData.type === 'Star') {
        if (this.body.bodyData.subType === 'Earth-like world') {
          return 'Eyeball earth';
        }
        if (this.body.bodyData.subType === 'Water world') {
          return 'Eyeball water world';
        }
      }
      return 'Synchronised';
    }
    return resonance + ' spin resonance';
  }

  public getTangentialVelocity(): number | null {
    if (!this.isBlackHoleOrNeutronStar() || !this.body.bodyData.rotationalPeriod) {
      return null;
    }

    let radiusKm: number;
    if (this.body.bodyData.radius) {
      radiusKm = this.body.bodyData.radius;
    } else if (this.body.bodyData.solarRadius) {
      radiusKm = this.body.bodyData.solarRadius * 695700; // Convert solar radii to km
    } else {
      return null;
    }

    const rotationalPeriodDays = this.body.bodyData.rotationalPeriod;
    const rotationalPeriodSeconds = rotationalPeriodDays * 24 * 3600;

    const circumference = 2 * Math.PI * radiusKm * 1000; // Convert km to m
    const velocityMs = circumference / rotationalPeriodSeconds;

    return velocityMs / 1000; // Convert m/s to km/s
  }

  public getTangentialVelocityDisplay(): string {
    const velocityKms = this.getTangentialVelocity();
    if (velocityKms === null) return '';

    const speedOfLight = 299792458; // m/s
    const velocityMs = velocityKms * 1000;
    const fractionOfC = velocityMs / speedOfLight;

    if (fractionOfC >= 0.01) {
      return `${fractionOfC.toFixed(3)}c`;
    }

    return `${velocityKms.toFixed(0)} km/s`;
  }

  public getTangentialVelocityTooltip(): string {
    const velocityKms = this.getTangentialVelocity();
    if (velocityKms === null) return '';

    return `${velocityKms.toFixed(3)} km/s`;
  }

  public isBlackHoleOrNeutronStar(): boolean {
    return this.body.bodyData.type === 'Star' &&
      (this.body.bodyData.subType === 'Black Hole' ||
        this.body.bodyData.subType === 'Neutron Star');
  }

  public getRotationalPeriodDisplay(): string {
    const days = this.body.bodyData.rotationalPeriod;
    if (!days) return '';

    const seconds = days * 86400;
    const minutes = seconds / 60;
    const hours = minutes / 60;
    const weeks = days / 7;
    const years = days / 365.25;
    const decades = years / 10;
    const centuries = years / 100;

    if (seconds < 1) return `${(seconds * 1000).toFixed(2)} ms`;
    if (seconds < 60) return `${seconds.toFixed(2)} s`;
    if (minutes < 60) return `${minutes.toFixed(2)} min`;
    if (hours < 24) return `${hours.toFixed(2)} h`;
    if (days < 7) return `${days.toFixed(2)} days`;
    if (weeks < 52) return `${weeks.toFixed(2)} weeks`;
    if (years < 10) return `${years.toFixed(2)} years`;
    if (decades < 10) return `${decades.toFixed(2)} decades`;
    return `${centuries.toFixed(2)} centuries`;
  }

  public classifyNeutronStar(): string | null {
    if (this.body.bodyData.type !== 'Star' || this.body.bodyData.subType !== 'Neutron Star') {
      return null;
    }

    const mass = this.body.bodyData.solarMasses;
    const radius = this.body.bodyData.solarRadius;
    const periodDays = this.body.bodyData.rotationalPeriod;
    const absMag = this.body.bodyData.absoluteMagnitude;

    if (mass === undefined || radius === undefined || periodDays === undefined || absMag === undefined) {
      return null;
    }

    const period = periodDays * 86400; // Convert days to seconds

    const isHighMass = mass > 2.1;

    if (period < 0.01) {
      return isHighMass ? "Hyper-Massive Millisecond Pulsar" : "Millisecond Pulsar";
    }

    if (period >= 0.01 && period < 5) {
      return isHighMass ? "Anomalous Mass Pulsar" : "Standard Pulsar";
    }

    if (period >= 5 && period < 30) {
      return isHighMass ? "Anomalous Mass Slow-Period Pulsar" : "Slow-Period Pulsar";
    }

    if (period >= 30 && period < 3600) {
      return absMag < 10 ? "Ultra-Long Period Magnetar" : "Ultra-Long Period Pulsar";
    }

    if (period >= 3600) {
      return "Anomalous Slow-Rotator";
    }

    return "Unclassified Compact Object";
  }



  public getLandableBadgeClass(): string {
    if (!this.body.bodyData.isLandable) {
      return 'badge-gray';
    }

    // High gravity takes precedence
    if (this.body.bodyData.gravity && this.body.bodyData.gravity > 2.7) {
      return 'badge-red';
    }

    if (!this.body.bodyData.surfaceTemperature) {
      return 'badge-gray';
    }

    const temp = this.body.bodyData.surfaceTemperature;
    if (temp >= 182 && temp < 700) {
      return 'badge-green';
    } else if (temp < 182 || temp >= 700) {
      return 'badge-orange';
    } else {
      return 'badge-red';
    }
  }

  public getLandableTooltip(): string {
    // High gravity takes precedence
    if (this.body.bodyData.gravity && this.body.bodyData.gravity > 2.7) {
      return 'Landable: High gravity. Disembarking not possible';
    }

    if (!this.body.bodyData.surfaceTemperature) {
      return 'Landable: No temperature data available';
    }

    const temp = this.body.bodyData.surfaceTemperature;
    if (temp >= 182 && temp < 700) {
      return 'Landable: Safe to disembark';
    } else if (temp < 182) {
      return 'Landable: Battery drain risk';
    } else if (temp >= 700) {
      return 'Landable: Risk of injury or death';
    } else {
      return 'Landable: Disembarking not permitted';
    }
  }

  public trojanStatus: string | null = null;
  public rosetteStatus: string | null = null;
  private cachedNextPeriapsis: { date: Date, days: number } | null = null;
  private cachedNextApoapsis: { date: Date, days: number } | null = null;
  private cachedChildrenExpandedState: boolean = false;
  private cachedRocheExcess: number | null = null;

  private detectTrojanStatus(): void {
    this.trojanStatus = null;

    if (!this.body.parent || !this.body.bodyData.orbitalPeriod || !this.body.bodyData.semiMajorAxis ||
      this.body.bodyData.argOfPeriapsis === undefined) {
      return;
    }

    // Check L3, L4, L5 (same orbital distance)
    const sameSMABodies = this.body.parent.subBodies.filter(sibling =>
      sibling !== this.body &&
      sibling.bodyData.orbitalPeriod === this.body.bodyData.orbitalPeriod &&
      sibling.bodyData.semiMajorAxis === this.body.bodyData.semiMajorAxis &&
      sibling.bodyData.argOfPeriapsis !== undefined
    );

    for (const sibling of sameSMABodies) {
      const argDiff = Math.abs(this.body.bodyData.argOfPeriapsis! - sibling.bodyData.argOfPeriapsis!);
      const normalizedDiff = Math.min(argDiff, 360 - argDiff);

      if (Math.abs(normalizedDiff - 60) < 1) {
        this.trojanStatus = this.body.bodyData.argOfPeriapsis! > sibling.bodyData.argOfPeriapsis! ? 'L4' : 'L5';
        return;
      } else if (Math.abs(normalizedDiff - 180) < 1) {
        this.trojanStatus = 'L3';
        return;
      }
    }

    // Check L1, L2 (different orbital distances, same period)
    const samePeriodBodies = this.body.parent.subBodies.filter(sibling =>
      sibling !== this.body &&
      sibling.bodyData.orbitalPeriod === this.body.bodyData.orbitalPeriod &&
      sibling.bodyData.semiMajorAxis !== this.body.bodyData.semiMajorAxis &&
      sibling.bodyData.argOfPeriapsis !== undefined &&
      sibling.bodyData.ascendingNode !== undefined
    );

    for (const sibling of samePeriodBodies) {
      const argDiff = Math.abs(this.body.bodyData.argOfPeriapsis! - sibling.bodyData.argOfPeriapsis!);
      const nodeDiff = Math.abs((this.body.bodyData.ascendingNode || 0) - (sibling.bodyData.ascendingNode || 0));

      if (argDiff < 5 && nodeDiff < 5) {
        if (this.body.bodyData.semiMajorAxis! < sibling.bodyData.semiMajorAxis!) {
          this.trojanStatus = 'L1';
        } else {
          this.trojanStatus = 'L2';
        }
        return;
      }
    }
  }

  private detectRosetteStatus(): void {
    this.rosetteStatus = null;

    if (!this.body.parent || !this.body.bodyData.orbitalPeriod || !this.body.bodyData.semiMajorAxis ||
      this.body.bodyData.argOfPeriapsis === undefined) {
      return;
    }

    const rosetteGroup = this.body.parent.subBodies.filter(sibling =>
      sibling.bodyData.orbitalPeriod === this.body.bodyData.orbitalPeriod &&
      sibling.bodyData.semiMajorAxis === this.body.bodyData.semiMajorAxis &&
      sibling.bodyData.argOfPeriapsis !== undefined
    );

    if (rosetteGroup.length < 3) return;

    const angles = rosetteGroup.map(body => body.bodyData.argOfPeriapsis!).sort((a, b) => a - b);
    const expectedSpacing = 360 / rosetteGroup.length;

    let isRosette = true;
    for (let i = 0; i < angles.length; i++) {
      const nextIndex = (i + 1) % angles.length;
      let spacing = angles[nextIndex] - angles[i];
      if (spacing < 0) spacing += 360;

      if (Math.abs(spacing - expectedSpacing) > 5) {
        isRosette = false;
        break;
      }
    }

    if (isRosette) {
      this.rosetteStatus = `Rosette (${rosetteGroup.length})`;
    }
  }

  public getJetConeAngle(): number | null {
    // Only apply to neutron stars with required inputs
    if (this.body.bodyData.type !== 'Star' || !this.body.bodyData.subType?.includes('Neutron Star') ||
      !this.body.bodyData.rotationalPeriod || !this.body.bodyData.solarRadius || !this.body.bodyData.age) {
      return null;
    }

    const rotationalPeriod = this.body.bodyData.rotationalPeriod;
    const solarRadius = this.body.bodyData.solarRadius;
    const age = this.body.bodyData.age;

    if (rotationalPeriod <= 0 || solarRadius <= 0 || age <= 0) {
      return null;
    }

    // Fitted parameters
    const Amin = -83.8389;
    const Amax = -60.8896;
    const k = 2.2037;
    const x0 = -5.0497;
    const alpha = 0.001517;
    const gamma_sr = 0.724671;
    const gamma_rot = -0.025587;
    const gamma_age = 0.045594;

    // Step 2: combined predictor
    // Using the requested form: x = LN(solarRadius / SQRT(rotationalPeriod)) + alpha * LN(age)
    // LN(solarRadius / SQRT(rotationalPeriod)) = ln(solarRadius) - 0.5 * ln(rotationalPeriod)
    const x = Math.log(solarRadius / Math.sqrt(rotationalPeriod)) + alpha * Math.log(age);

    // Step 3: sigmoid
    const denom = 1 + Math.exp(-k * (x - x0));
    const angleSigmoid = Amin + (Amax - Amin) / denom;

    // Step 4: quadratic corrections (use natural logs)
    const ln_sr = Math.log(solarRadius);
    const ln_rot = Math.log(rotationalPeriod);
    const ln_age = Math.log(age);
    const quad = gamma_sr * (ln_sr * ln_sr) + gamma_rot * (ln_rot * ln_rot) + gamma_age * (ln_age * ln_age);

    // Step 5: combine
    const anglePred = angleSigmoid + quad;

    return anglePred;
  }

  private calculateNextPeriapsis(): { date: Date, days: number } | null {
    if (!this.body.bodyData.meanAnomaly || !this.body.bodyData.orbitalPeriod ||
      !this.body.bodyData.timestamps?.meanAnomaly ||
      !this.body.bodyData.orbitalEccentricity || this.body.bodyData.orbitalEccentricity === 0) {
      return null;
    }

    const timestampMs = new Date(this.body.bodyData.timestamps.meanAnomaly).getTime();
    const elapsedDays = (Date.now() - timestampMs) / (1000 * 60 * 60 * 24);
    const orbitalCycles = elapsedDays / this.body.bodyData.orbitalPeriod;
    const currentMeanAnomaly = (this.body.bodyData.meanAnomaly + (orbitalCycles * 360)) % 360;

    const degreesToPeriapsis = (360 - currentMeanAnomaly) % 360;
    const daysToEvent = (degreesToPeriapsis / 360) * this.body.bodyData.orbitalPeriod;
    const eventDate = new Date(Date.now() + (daysToEvent * 24 * 60 * 60 * 1000));

    return { date: eventDate, days: daysToEvent };
  }

  private calculateNextApoapsis(): { date: Date, days: number } | null {
    if (!this.body.bodyData.meanAnomaly || !this.body.bodyData.orbitalPeriod ||
      !this.body.bodyData.timestamps?.meanAnomaly ||
      !this.body.bodyData.orbitalEccentricity || this.body.bodyData.orbitalEccentricity === 0) {
      return null;
    }

    const timestampMs = new Date(this.body.bodyData.timestamps.meanAnomaly).getTime();
    const elapsedDays = (Date.now() - timestampMs) / (1000 * 60 * 60 * 24);
    const orbitalCycles = elapsedDays / this.body.bodyData.orbitalPeriod;
    const currentMeanAnomaly = (this.body.bodyData.meanAnomaly + (orbitalCycles * 360)) % 360;

    let degreesToApoapsis = (180 - currentMeanAnomaly) % 360;
    if (degreesToApoapsis < 0) degreesToApoapsis += 360;
    const daysToEvent = (degreesToApoapsis / 360) * this.body.bodyData.orbitalPeriod;
    const eventDate = new Date(Date.now() + (daysToEvent * 24 * 60 * 60 * 1000));

    return { date: eventDate, days: daysToEvent };
  }

  public getNextPeriapsis(): { date: Date, days: number } | null {
    return this.cachedNextPeriapsis;
  }

  public getNextApoapsis(): { date: Date, days: number } | null {
    return this.cachedNextApoapsis;
  }

  private computeMaterialBadges(): void {
    if (!this.body.bodyData.materials) {
      this.cachedMaterialBadges = [];
      return;
    }

    const materialData: { [key: string]: { grade: string, abbrev: string } } = {
      // Grade 1 (Very Rare)
      'Antimony': { grade: 'badge-mat1', abbrev: 'Sb' },
      'Polonium': { grade: 'badge-mat1', abbrev: 'Po' },
      'Ruthenium': { grade: 'badge-mat1', abbrev: 'Ru' },
      'Selenium': { grade: 'badge-mat1', abbrev: 'Se' },
      'Technetium': { grade: 'badge-mat1', abbrev: 'Tc' },
      'Tellurium': { grade: 'badge-mat1', abbrev: 'Te' },
      'Yttrium': { grade: 'badge-mat1', abbrev: 'Y' },
      // Grade 2 (Rare)
      'Cadmium': { grade: 'badge-mat2', abbrev: 'Cd' },
      'Mercury': { grade: 'badge-mat2', abbrev: 'Hg' },
      'Molybdenum': { grade: 'badge-mat2', abbrev: 'Mo' },
      'Niobium': { grade: 'badge-mat2', abbrev: 'Nb' },
      'Tin': { grade: 'badge-mat2', abbrev: 'Sn' },
      'Vanadium': { grade: 'badge-mat2', abbrev: 'V' },
      // Grade 3 (Uncommon)
      'Arsenic': { grade: 'badge-mat3', abbrev: 'As' },
      'Chromium': { grade: 'badge-mat3', abbrev: 'Cr' },
      'Germanium': { grade: 'badge-mat3', abbrev: 'Ge' },
      'Manganese': { grade: 'badge-mat3', abbrev: 'Mn' },
      'Phosphorus': { grade: 'badge-mat3', abbrev: 'P' },
      'Tungsten': { grade: 'badge-mat3', abbrev: 'W' },
      'Zinc': { grade: 'badge-mat3', abbrev: 'Zn' },
      'Zirconium': { grade: 'badge-mat3', abbrev: 'Zr' },
      // Grade 4 (Common)
      'Carbon': { grade: 'badge-mat4', abbrev: 'C' },
      'Iron': { grade: 'badge-mat4', abbrev: 'Fe' },
      'Nickel': { grade: 'badge-mat4', abbrev: 'Ni' },
      'Sulphur': { grade: 'badge-mat4', abbrev: 'S' }
    };

    this.cachedMaterialBadges = Object.entries(this.body.bodyData.materials)
      .filter(([material, percentage]) => percentage > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([material, percentage]) => ({
        name: materialData[material]?.abbrev || material,
        class: materialData[material]?.grade || 'badge-gray',
        tooltip: `${material}: ${percentage.toFixed(2)}%`
      }));
  }

  public getMaterialBadges(): { name: string, class: string, tooltip: string }[] {
    return this.cachedMaterialBadges;
  }

  public getRocheExcess(): number | null {
    return this.cachedRocheExcess;
  }

  private calculateRocheExcess(): number | null {
    if (!this.body.parent || !this.body.bodyData.semiMajorAxis || !this.body.bodyData.radius) {
      return null;
    }

    let parentRadius: number;
    if (this.body.parent.bodyData.radius) {
      parentRadius = this.body.parent.bodyData.radius * 1000; // Convert km to m
    } else if (this.body.parent.bodyData.solarRadius) {
      parentRadius = this.body.parent.bodyData.solarRadius * 695700000; // Convert solar radii to m
    } else {
      return null;
    }

    let parentMass: number;
    if (this.body.parent.bodyData.solarMasses) {
      parentMass = this.body.parent.bodyData.solarMasses * 1.989e30;
    } else if (this.body.parent.bodyData.earthMasses) {
      parentMass = this.body.parent.bodyData.earthMasses * 5.972e24;
    } else {
      return null;
    }

    let bodyMass: number;
    if (this.body.bodyData.solarMasses) {
      bodyMass = this.body.bodyData.solarMasses * 1.989e30;
    } else if (this.body.bodyData.earthMasses) {
      bodyMass = this.body.bodyData.earthMasses * 5.972e24;

    } else {
      return null;
    }

    const result = this.checkRigidRocheLimit(
      parentMass,
      parentRadius,
      bodyMass,
      this.body.bodyData.radius * 1000, // Convert km to m
      this.body.bodyData.semiMajorAxis * 149597870700 // Convert AU to m
    );



    return result.violates ? (result.rocheLimitM - this.body.bodyData.semiMajorAxis * 149597870700) / 1000 : null; // Convert back to km
  }

  private checkRigidRocheLimit(
    parentMassKg: number,
    parentRadiusM: number,
    satelliteMassKg: number,
    satelliteRadiusM: number,
    semiMajorAxisM: number
  ): { rocheLimitM: number, violates: boolean } {
    const rhoParent = parentMassKg / ((4 / 3) * Math.PI * Math.pow(parentRadiusM, 3));
    const rhoSatellite = satelliteMassKg / ((4 / 3) * Math.PI * Math.pow(satelliteRadiusM, 3));

    const rocheLimit = 1.26 * parentRadiusM * Math.pow(rhoParent / rhoSatellite, 1 / 3);
    const violates = semiMajorAxisM < rocheLimit;




    return { rocheLimitM: rocheLimit, violates };
  }

  public tidalLockDialogData: any = null;

  public showJetAngleDialog(): void {
    // Generate the chart image for the dialog and then open it
    try {
      this.jetAngleChartDataUrl = this.generateJetAngleChart();
    } catch (e) {
      // If chart generation fails, clear URL and still open dialog
      this.jetAngleChartDataUrl = null;
      // Debug removed
    }

    this.dialog.open(this.jetAngleDialogTemplate, {
      width: '800px',
      maxWidth: '95vw',
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop'
    });
  }



  private generateJetAngleChart(): string | null {
    // Parse CSV
    const rows = this.parseCsv(this.jetSampleCsv);
    if (!rows || rows.length === 0) return null;

    // Model parameters (used for sigmoid overlay)
    const Amin = -83.8389;
    const Amax = -60.8896;
    const k = 2.2037;
    const x0 = -5.0497;
    const alpha = 0.001517;

    // Build points with combined predictor x, actual angle y, and residual (actual - predicted_full)
    const pts: { x: number; y: number; residual: number }[] = [];
    for (const r of rows) {
      const rot = r['Rotation Period [s]'] ? Number(r['Rotation Period [s]']) : null;
      const sr = r['Radius [Ls]'] ? Number(r['Radius [Ls]']) : null;
      const age = r['age'] ? Number(r['age']) : null;
      const angle = r['Angle [deg]'] ? Number(r['Angle [deg]']) : null;
      if (rot === null || sr === null || age === null || angle === null) continue;
      const rotDays = rot / 86400;
      if (!(rotDays > 0)) continue;
      const x = Math.log(sr / Math.sqrt(rotDays)) + alpha * Math.log(age);
      const predictedFull = this.computePredictedAngleForSample(rot, sr, age);
      if (predictedFull === null) continue;
      const residual = angle - predictedFull; // positive => under-predicted (actual > predicted)
      pts.push({ x, y: angle, residual });
    }

    if (pts.length === 0) return null;

    // x-range and sampling for sigmoid overlay
    const xs = pts.map(p => p.x);
    const xmin = Math.min(...xs) - 0.2;
    const xmax = Math.max(...xs) + 0.2;
    const sampleCount = 300;
    const sigmoidCurve: { x: number; y: number }[] = [];
    for (let i = 0; i <= sampleCount; i++) {
      const x = xmin + (i / sampleCount) * (xmax - xmin);
      const denom = 1 + Math.exp(-k * (x - x0));
      const y = Amin + (Amax - Amin) / denom;
      sigmoidCurve.push({ x, y });
    }

    // Canvas setup
    const width = 780;
    const height = 360;
    const padding = 50;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // background
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);

    // For bubble plot: x = rotational period (days), y = solarRadius (Ls), color = age, size = angle (deg)
    // Build arrays
    const bubblePts: { x: number; y: number; age: number; angle: number }[] = [];
    for (const r of rows) {
      const rot = r['Rotation Period [s]'] ? Number(r['Rotation Period [s]']) : null;
      const sr = r['Radius [Ls]'] ? Number(r['Radius [Ls]']) : null;
      const age = r['age'] ? Number(r['age']) : null;
      const angle = r['Angle [deg]'] ? Number(r['Angle [deg]']) : null;
      if (rot === null || sr === null || age === null || angle === null) continue;
      const rotDays = rot / 86400;
      if (!(rotDays > 0)) continue;
      bubblePts.push({ x: rotDays, y: sr, age, angle });
    }
    if (bubblePts.length === 0) return null;

    // compute ranges
    const xvals = bubblePts.map(p => p.x);
    const yvals = bubblePts.map(p => p.y);
    const ageVals = bubblePts.map(p => p.age);
    const angleVals = bubblePts.map(p => p.angle);
    const xminB = Math.min(...xvals);
    const xmaxB = Math.max(...xvals);
    const yminB = Math.min(...yvals);
    const ymaxB = Math.max(...yvals);
    const ageMin = Math.min(...ageVals);
    const ageMax = Math.max(...ageVals);
    const angleMin = Math.min(...angleVals);
    const angleMax = Math.max(...angleVals);

    const xToPx = (x: number) => padding + ((Math.log10(x) - Math.log10(xminB)) / (Math.log10(xmaxB) - Math.log10(xminB))) * (width - padding * 2);
    const yToPx = (y: number) => (height - padding) - ((y - yminB) / (ymaxB - yminB)) * (height - padding * 2);

    // axes
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // draw bubbles
    for (const p of bubblePts) {
      const px = xToPx(p.x);
      const py = yToPx(p.y);
      // size scale (map angle to radius between 4 and 18)
      const size = 4 + 14 * ((p.angle - angleMin) / (angleMax - angleMin || 1));
      // color map age -> hue (older = more red)
      const t = (p.age - ageMin) / (ageMax - ageMin || 1);
      const hue = 240 - 240 * t; // 240 blue -> 0 red
      const color = `hsl(${hue},70%,50%)`;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // axes labels
    ctx.fillStyle = '#000';
    ctx.font = '13px Arial';
    ctx.fillText('Rotational period (days) [log scale]', width / 2 - 90, height - 12);
    ctx.save();
    ctx.translate(14, height / 2 + 30);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Solar radius (Ls)', 0, 0);
    ctx.restore();

    // color legend (age)
    const legendX = width - padding - 140;
    const legendY = padding + 10;
    ctx.fillStyle = '#000';
    ctx.fillText('Age (older → red)', legendX, legendY - 6);
    for (let i = 0; i <= 4; i++) {
      const ty = legendY + i * 12;
      const tt = i / 4;
      const hue = 240 - 240 * tt;
      ctx.fillStyle = `hsl(${hue},70%,50%)`;
      ctx.fillRect(legendX, ty, 12, 10);
      ctx.fillStyle = '#000';
      const ageLabel = Math.round(ageMin + tt * (ageMax - ageMin));
      ctx.fillText(ageLabel.toString(), legendX + 18, ty + 9);
    }

    // size legend (angle)
    ctx.fillStyle = '#000';
    ctx.fillText('Size = jet angle (deg)', legendX, legendY + 70);
    const sY = legendY + 84;
    const smallR = 6;
    const largeR = 16;
    ctx.beginPath(); ctx.arc(legendX + 12, sY, smallR, 0, Math.PI * 2); ctx.fillStyle = '#888'; ctx.fill();
    ctx.fillStyle = '#000'; ctx.fillText(Math.round(angleMin).toString(), legendX + 32, sY + 4);
    ctx.beginPath(); ctx.arc(legendX + 12, sY + 28, largeR, 0, Math.PI * 2); ctx.fillStyle = '#888'; ctx.fill();
    ctx.fillStyle = '#000'; ctx.fillText(Math.round(angleMax).toString(), legendX + 32, sY + 32 + 4);

    return canvas.toDataURL('image/png');
  }

  private parseCsv(text: string): Array<Record<string, string>> {
    if (!text) return [];
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return [];
    const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows: Array<Record<string, string>> = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      const obj: Record<string, string> = {};
      for (let j = 0; j < header.length; j++) {
        obj[header[j]] = cols[j] ?? '';
      }
      rows.push(obj);
    }
    return rows;
  }

  private computePredictedAngleForSample(rotSeconds: number | null, solarRadius: number | null, age: number | null): number | null {
    if (!rotSeconds || !solarRadius || !age) return null;
    const rotDays = Number(rotSeconds) / 86400;
    if (!(rotDays > 0) || !(solarRadius > 0) || !(age > 0)) return null;
    const Amin = -83.8389;
    const Amax = -60.8896;
    const k = 2.2037;
    const x0 = -5.0497;
    const alpha = 0.001517;
    const gamma_sr = 0.724671;
    const gamma_rot = -0.025587;
    const gamma_age = 0.045594;
    const x = Math.log(solarRadius / Math.sqrt(rotDays)) + alpha * Math.log(age);
    const denom = 1 + Math.exp(-k * (x - x0));
    const angleSigmoid = Amin + (Amax - Amin) / denom;
    const ln_sr = Math.log(solarRadius);
    const ln_rot = Math.log(rotDays);
    const ln_age = Math.log(age);
    const quad = gamma_sr * (ln_sr * ln_sr) + gamma_rot * (ln_rot * ln_rot) + gamma_age * (ln_age * ln_age);
    return angleSigmoid + quad;
  }

  public showTidalLockDialog(): void {
    const rot = this.body.bodyData.rotationalPeriod;
    const orb = this.body.bodyData.orbitalPeriod;
    let difference: number | null = null;
    let solarDay: number | null = null;
    if (rot && orb) {
      difference = Math.abs(rot - orb);
      // Solar day formula: 1 / |1/rot - 1/orb|
      const rotAbs = Math.abs(rot);
      const orbAbs = Math.abs(orb);
      if (rotAbs > 0.0001 && orbAbs > 0.0001 && Math.abs(rotAbs - orbAbs) > 0.00001) {
        solarDay = 1 / Math.abs(1 / rotAbs - 1 / orbAbs);
      } else {
        solarDay = null;
      }
    }
    const resonance = this.getSpinResonance();
    this.tidalLockDialogData = {
      rotationalPeriod: rot,
      orbitalPeriod: orb,
      difference,
      solarDay,
      resonance
    };
    this.dialog.open(this.tidalLockDialogTemplate, {
      width: '600px',
      maxWidth: '90vw',
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop'
    });
  }

}

interface BiologySignal {
  entryId: number;
  signal: string;
  codex: CanonnCodexEntry | null | undefined;
  isGuess: boolean;
}

const genus: { [key: string]: string } = {
  "$Codex_Ent_Aleoids_Genus_Name;": "Aleoida",
  "$Codex_Ent_Bacterial_Genus_Name;": "Bacterium",
  "$Codex_Ent_Brancae_Name;": "Brain Tree",
  "$Codex_Ent_Cactoid_Genus_Name;": "Cactoida",
  "$Codex_Ent_Clepeus_Genus_Name;": "Clypeus",
  "$Codex_Ent_Clypeus_Genus_Name;": "Clypeus",
  "$Codex_Ent_Conchas_Genus_Name;": "Concha",
  "$Codex_Ent_Cone_Name;": "Bark Mounds",
  "$Codex_Ent_Electricae_Genus_Name;": "Electricae",
  "$Codex_Ent_Fonticulus_Genus_Name;": "Fonticulua",
  "$Codex_Ent_Fumerolas_Genus_Name;": "Fumerola",
  "$Codex_Ent_Fungoids_Genus_Name;": "Fungoida",
  "$Codex_Ent_Ground_Struct_Ice_Name;": "Crystalline Shards",
  "$Codex_Ent_Osseus_Genus_Name;": "Osseus",
  "$Codex_Ent_Recepta_Genus_Name;": "Recepta",
  "$Codex_Ent_Seed_Name;": "Brain Trees",
  "$Codex_Ent_Shrubs_Genus_Name;": "Frutexa",
  "$Codex_Ent_Sphere_Name;": "Anemone",
  "$Codex_Ent_Stratum_Genus_Name;": "Stratum",
  "$Codex_Ent_Tube_Name;": "Sinuous Tubers",
  "$Codex_Ent_Tubus_Genus_Name;": "Tubus",
  "$Codex_Ent_Tussocks_Genus_Name;": "Tussock",
  "$Codex_Ent_Vents_Name;": "Amphora Plant",
}