import { Component, Input, OnChanges, OnInit, ViewChild, ElementRef, AfterViewInit, ViewChildren, QueryList, TemplateRef } from '@angular/core';
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
  @ViewChild('rocheLimitDialogTemplate') rocheLimitDialogTemplate!: TemplateRef<any>;
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

  public formattedEarthMass: { display: string; tooltip: string } | null = null;
  public formattedSolarMass: { display: string; tooltip: string } | null = null;

  public constructor(private readonly appService: AppService, private readonly dialog: MatDialog) {
  }

  public ngOnInit(): void {
    this.appService.codexEntries
      .pipe(untilDestroyed(this))
      .subscribe(c => {
        this.codex = c;
        this.ngOnChanges();
      });
  }

  public ngOnChanges(): void {
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

    // Update cached children state after expansion logic
    setTimeout(() => this.updateChildrenExpandedState());

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
  }

  public toggleExpand(): void {
    this.expanded = !this.expanded;
    this.isExpanded = this.expanded;
    // Update parent's cached state if it exists
    if (this.body.parent) {
      setTimeout(() => this.updateParentChildrenState());
    }
  }

  private updateParentChildrenState(): void {
    // Find parent component and update its cached state
    const parentElement = document.querySelector(`[data-body-id="${this.body.parent?.bodyData.bodyId}"]`);
    if (parentElement) {
      // This will be handled by the parent component's change detection
    }
  }

  public toggleChildren(): void {
    const childArray = this.childComponents.toArray();
    const anyChildExpanded = childArray.some(child => child.expanded);
    childArray.forEach(child => {
      this.toggleChildRecursively(child, !anyChildExpanded);
    });
    setTimeout(() => this.updateChildrenExpandedState());
  }

  private toggleChildRecursively(component: SystemBodyComponent, expand: boolean): void {
    component.expanded = expand;
    component.isExpanded = expand;

    const grandChildren = component.childComponents?.toArray() || [];
    grandChildren.forEach(grandChild => {
      this.toggleChildRecursively(grandChild, expand);
    });
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
    if (this.body.bodyData.type !== 'Ring') {
      return null;
    }

    const outerRadius = this.body.bodyData.outerRadius;
    if (!outerRadius || !this.body.parent) {
      return null;
    }

    const hillLimit = this.calculateHillLimit();
    if (hillLimit === null) {
      return null;
    }

    const exceeded = outerRadius - hillLimit;
    return exceeded > 0 ? exceeded : null;
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

  public getHotspotsList(): { displayName: string; count: number; wikiUrl: string; description: string }[] {
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

    if (!signals) return [];

    return Object.entries(signals).map(([key, count]) => {
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

  public getRingResourceTypes(): Set<string> {
    const hotspots = this.getHotspotsList();
    const types = new Set<string>();

    hotspots.forEach(hotspot => {
      const key = Object.keys(MINING_RESOURCES).find(
        k => MINING_RESOURCES[k].name === hotspot.displayName
      );
      if (key) {
        types.add(MINING_RESOURCES[key].type);
      }
    });

    return types;
  }

  public logTooltip(name: string, description: string): void {
    console.log('Tooltip hover detected:', name);
    console.log('Description:', description);
    console.log('Description length:', description?.length);
    console.log('Description value:', JSON.stringify(description));
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

  public calculateHillLimit(): number | null {
    if (!this.body.parent) {
      return null;
    }

    const result = this.calculateHillLimitWithPerturbers();
    return result ? result.minHillRadius : null;
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

    // Find the outermost ring
    let outermostRingRadius = 0;
    for (const ring of parent.rings) {
      if (ring.outerRadius && ring.outerRadius > outermostRingRadius) {
        outermostRingRadius = ring.outerRadius;
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
  public calculateHillLimitWithPerturbers(): {
    minHillRadius: number;
    limitingPerturber: string | null;
    perturberDistance: number | null;
    baselineHillRadius: number;
    perturbers: Array<{ name: string; minDistance: number; hillRadius: number }>;
    debugInfo?: {
      parentBodyName: string;
      parentChain: string[];
      primaryBodyName: string;
      primaryChain: string[];
      distanceToPrimary: number;
      parentSMA: number;
      primarySMA: number | null;
      parentPeriapsis: number;
      parentApoapsis: number;
      primaryPeriapsis: number | null;
      primaryApoapsis: number | null;
      theoreticalMinDist: number | null;
      theoreticalMaxDist: number | null;
    };
  } | null {
    if (!this.body.parent) {
      return null;
    }

    const parentBody = this.body.parent.bodyData;
    const ringOuterRadius = this.body.bodyData.outerRadius || 0;
    const parentMass = parentBody.earthMasses || (parentBody.solarMasses ? parentBody.solarMasses * 332950 : null);
    const semiMajorAxis = parentBody.semiMajorAxis;
    const parentEcc = parentBody.orbitalEccentricity;
    const parentInc = parentBody.orbitalInclination;
    const parentArgP = parentBody.argOfPeriapsis;
    const parentNode = parentBody.ascendingNode;

    // Check if all required orbital parameters are present
    if (!semiMajorAxis || !parentMass || !ringOuterRadius ||
      parentEcc === null || parentEcc === undefined ||
      parentInc === null || parentInc === undefined ||
      parentArgP === null || parentArgP === undefined ||
      parentNode === null || parentNode === undefined) {
      const missing: string[] = [];
      if (!semiMajorAxis) missing.push('semiMajorAxis');
      if (!parentMass) missing.push('parentMass');
      if (!ringOuterRadius) missing.push('ringOuterRadius');
      if (parentEcc === null || parentEcc === undefined) missing.push('orbitalEccentricity');
      if (parentInc === null || parentInc === undefined) missing.push('orbitalInclination');
      if (parentArgP === null || parentArgP === undefined) missing.push('argOfPeriapsis');
      if (parentNode === null || parentNode === undefined) missing.push('ascendingNode');
      return null;
    }

    // Find the primary body (star or parent planet)
    // First try walking up the parent chain
    let primaryMass: number | null = null;
    let primaryBody: SystemBody | null = null;
    let currentParent = this.body.parent.parent;

    while (currentParent) {
      if (currentParent.bodyData.solarMasses) {
        primaryMass = currentParent.bodyData.solarMasses * 332950; // Convert to Earth masses
        primaryBody = currentParent;
        break;
      }
      if (currentParent.bodyData.earthMasses) {
        primaryMass = currentParent.bodyData.earthMasses;
        primaryBody = currentParent;
        break;
      }
      currentParent = currentParent.parent;
    }

    // If no primary found in parent chain (e.g., parent orbits barycentre),
    // search all system bodies for a star or the main body
    if (!primaryMass) {
      const allBodies = this.getAllSystemBodies();
      for (const body of allBodies) {
        // Look for a star (has solarMasses)
        if (body.bodyData.solarMasses) {
          primaryMass = body.bodyData.solarMasses * 332950;
          primaryBody = body;
          break;
        }
      }
    }

    if (!primaryMass || !primaryBody) {
      return null;
    }

    // Calculate the actual distance from parent's orbit to the primary body
    // If the primary is at the origin (Body 0), calculate distance to origin
    // Otherwise, calculate minimum distance between the two orbits
    let distanceToPrimary: number;
    const semiMajorAxisKm = semiMajorAxis * 149597870.7;

    if (!primaryBody.bodyData.semiMajorAxis) {
      // Primary is at origin (Body 0)
      // Need to calculate parent's position in system coordinates, accounting for intermediate barycentres
      let totalDist = 0;
      let sampleCount = 24;
      let validSamples = 0;

      for (let i = 0; i < sampleCount; i++) {
        const meanAnomaly = (360 * i) / sampleCount;
        // Get parent's position in system frame (handles hierarchical orbits)
        const parentPos = this.getBodyPositionInSystemFrame(this.body.parent, meanAnomaly);

        if (!parentPos) {
          // Missing orbital parameters in parent chain - cannot calculate Hill limit
          return null;
        }

        const distToOrigin = Math.sqrt(parentPos.x * parentPos.x + parentPos.y * parentPos.y + parentPos.z * parentPos.z);
        totalDist += distToOrigin;
        validSamples++;
      }
      distanceToPrimary = validSamples > 0 ? totalDist / validSamples : semiMajorAxisKm;
    } else {
      // Primary has an orbit (could be in a binary system or orbit a barycentre)
      // Calculate average distance using hierarchical positions
      let totalDist = 0;
      let validSamples = 0;
      const sampleCount = 24;

      // Sample both orbits using system frame positions (handles barycentres)
      for (let i = 0; i < sampleCount; i++) {
        const meanAnomaly1 = (360 * i) / sampleCount;
        const pos1 = this.getBodyPositionInSystemFrame(this.body.parent, meanAnomaly1);

        if (!pos1) {
          // Missing orbital parameters in parent chain - cannot calculate Hill limit
          return null;
        }

        for (let j = 0; j < sampleCount; j++) {
          const meanAnomaly2 = (360 * j) / sampleCount;
          const pos2 = this.getBodyPositionInSystemFrame(primaryBody, meanAnomaly2);

          if (!pos2) {
            // Missing orbital parameters in primary chain - cannot calculate Hill limit
            return null;
          }

          const dist = this.distance3D(pos1, pos2);
          totalDist += dist;
          validSamples++;
        }
      }
      distanceToPrimary = validSamples > 0 ? totalDist / validSamples : semiMajorAxisKm;
    }

    // Calculate baseline Hill radius using the actual distance to primary
    const baselineMassRatio = parentMass / (3 * primaryMass);
    const baselineHillRadius = distanceToPrimary * Math.pow(baselineMassRatio, 1 / 3);

    // Build debug info for dialog
    const getParentChain = (body: SystemBody): string[] => {
      const chain: string[] = [];
      let current: SystemBody | null = body;
      while (current) {
        chain.push(`${current.bodyData.name} (${current.bodyData.type})`);
        current = current.parent;
      }
      return chain;
    };

    const parentEccValue = parentEcc || 0;
    const parentPeriapsis = semiMajorAxisKm * (1 - parentEccValue);
    const parentApoapsis = semiMajorAxisKm * (1 + parentEccValue);

    let primaryPeriapsis: number | null = null;
    let primaryApoapsis: number | null = null;
    let theoreticalMinDist: number | null = null;
    let theoreticalMaxDist: number | null = null;

    if (primaryBody.bodyData.semiMajorAxis) {
      const primarySMAKm = primaryBody.bodyData.semiMajorAxis * 149597870.7;
      const primaryEccValue = primaryBody.bodyData.orbitalEccentricity || 0;
      primaryPeriapsis = primarySMAKm * (1 - primaryEccValue);
      primaryApoapsis = primarySMAKm * (1 + primaryEccValue);
      theoreticalMinDist = Math.abs(parentPeriapsis - primaryApoapsis);
      theoreticalMaxDist = parentApoapsis + primaryApoapsis;
    }

    const debugInfo = {
      parentBodyName: parentBody.name,
      parentChain: getParentChain(this.body.parent),
      primaryBodyName: primaryBody.bodyData.name,
      primaryChain: getParentChain(primaryBody),
      distanceToPrimary,
      parentSMA: semiMajorAxisKm,
      primarySMA: primaryBody.bodyData.semiMajorAxis ? primaryBody.bodyData.semiMajorAxis * 149597870.7 : null,
      parentPeriapsis,
      parentApoapsis,
      primaryPeriapsis,
      primaryApoapsis,
      theoreticalMinDist,
      theoreticalMaxDist
    };

    // Convert orbital elements (already validated as non-null above)
    const convertedParentEcc = parentEcc;
    const convertedParentInc = parentInc;
    const convertedParentArgP = -parentArgP;
    const convertedParentNode = -parentNode;

    // Screening distance: consider bodies within 3× ring outer radius
    const screeningDistance = ringOuterRadius * 3;

    // Get all bodies in system
    const allBodies = this.getAllSystemBodies();

    // Find potential perturbers
    const perturbers: Array<{ name: string; minDistance: number; hillRadius: number }> = [];
    let minHillRadius = baselineHillRadius;
    let limitingPerturber: string | null = null;
    let perturberDistance: number | null = null;

    // Sample count for orbit positions (balance performance vs accuracy)
    const sampleCount = 24; // 15-degree intervals

    for (const otherBody of allBodies) {
      // Skip self and parent
      if (otherBody === this.body || otherBody === this.body.parent) {
        continue;
      }

      // Skip rings and belts
      if (otherBody.bodyData.type === 'Ring' || otherBody.bodyData.type === 'Belt') {
        continue;
      }

      const otherData = otherBody.bodyData;
      const otherSMA = otherData.semiMajorAxis;
      const otherMass = otherData.earthMasses || (otherData.solarMasses ? otherData.solarMasses * 332950 : null);

      // Skip if no mass data
      if (!otherMass) {
        continue;
      }

      // Check if this body is a sibling (shares same parent as the ring's parent)
      const isSibling = otherBody.parent === this.body.parent.parent;

      // For siblings orbiting the same body as the ring's parent, they're in the same reference frame
      if (isSibling && otherSMA) {
        // Calculate average distance directly since both orbit the same central body
        const otherSMAKm = otherSMA * 149597870.7;

        // Ring is essentially at the parent's location (very small orbit around parent)
        // So distance to sibling is approximately the sibling's orbital radius
        // For siblings, use a more generous screening: consider them if they're within 100x ring radius
        // (gravitational effects extend much further than physical proximity)
        const siblingScreeningDistance = ringOuterRadius * 100;

        if (otherSMAKm <= siblingScreeningDistance) {
          const massRatio = parentMass / (3 * otherMass);
          const hillRadius = otherSMAKm * Math.pow(massRatio, 1 / 3);

          perturbers.push({
            name: otherData.name,
            minDistance: otherSMAKm,
            hillRadius: hillRadius
          });

          if (hillRadius < minHillRadius) {
            minHillRadius = hillRadius;
            limitingPerturber = otherData.name;
            perturberDistance = otherSMAKm;
          }
        }
        continue;
      }

      // Body 0 (origin) won't have orbital parameters but is at position (0,0,0)
      if (!otherSMA) {
        // This is likely Body 0 at the origin - handle it separately
        // Calculate average distance from parent's orbit to origin using system frame positions
        let totalDist = 0;
        let validSamples = 0;

        for (let i = 0; i < sampleCount; i++) {
          const meanAnomaly = (360 * i) / sampleCount;
          const parentPos = this.getBodyPositionInSystemFrame(this.body.parent, meanAnomaly);

          if (parentPos) {
            const distToOrigin = Math.sqrt(parentPos.x * parentPos.x + parentPos.y * parentPos.y + parentPos.z * parentPos.z);
            totalDist += distToOrigin;
            validSamples++;
          }
        }
        const avgDistToOrigin = validSamples > 0 ? totalDist / validSamples : semiMajorAxisKm;

        // If within screening range, calculate Hill radius at that distance
        if (avgDistToOrigin <= screeningDistance) {
          const massRatio = parentMass / (3 * otherMass);
          const hillRadius = avgDistToOrigin * Math.pow(massRatio, 1 / 3);

          perturbers.push({
            name: otherData.name,
            minDistance: avgDistToOrigin,
            hillRadius: hillRadius
          });

          if (hillRadius < minHillRadius) {
            minHillRadius = hillRadius;
            limitingPerturber = otherData.name;
            perturberDistance = avgDistToOrigin;
          }
        }

        continue;
      }

      // Quick screening: check if orbits could possibly come close
      const otherEcc = otherData.orbitalEccentricity || 0;
      const otherSMAKm = otherSMA * 149597870.7;
      const parentPeriapsis = semiMajorAxisKm * (1 - convertedParentEcc);
      const parentApoapsis = semiMajorAxisKm * (1 + convertedParentEcc);
      const otherPeriapsis = otherSMAKm * (1 - otherEcc);
      const otherApoapsis = otherSMAKm * (1 + otherEcc);

      // Skip if orbits can't possibly come within screening distance
      const maxPossibleApproach = Math.max(
        Math.abs(parentPeriapsis - otherApoapsis),
        Math.abs(parentApoapsis - otherPeriapsis)
      );

      if (Math.min(otherPeriapsis, otherApoapsis) > parentApoapsis + screeningDistance ||
        Math.max(otherPeriapsis, otherApoapsis) < parentPeriapsis - screeningDistance) {
        continue;
      }

      // Get orbital elements for other body
      const otherInc = otherData.orbitalInclination || 0;
      const otherArgP = otherData.argOfPeriapsis !== undefined ? -otherData.argOfPeriapsis : 0;
      const otherNode = otherData.ascendingNode !== undefined ? -otherData.ascendingNode : 0;

      // Sample positions along both orbits to calculate average distance using system frame
      let totalDist = 0;
      let validSamples = 0;

      for (let i = 0; i < sampleCount; i++) {
        const meanAnomaly1 = (360 * i) / sampleCount;
        const pos1 = this.getBodyPositionInSystemFrame(this.body.parent, meanAnomaly1);

        if (!pos1) continue;

        for (let j = 0; j < sampleCount; j++) {
          const meanAnomaly2 = (360 * j) / sampleCount;
          const pos2 = this.getBodyPositionInSystemFrame(otherBody, meanAnomaly2);

          if (!pos2) continue;

          const dist = this.distance3D(pos1, pos2);
          totalDist += dist;
          validSamples++;
        }
      }
      const avgDist = validSamples > 0 ? totalDist / validSamples : Math.abs(semiMajorAxisKm - otherSMAKm);

      // If average distance is within screening range, calculate Hill radius at that distance
      if (avgDist <= screeningDistance) {
        // Hill radius formula: r_H = d * (m / (3 * M))^(1/3)
        // where d = distance to perturber, m = parent mass, M = perturber mass
        const massRatio = parentMass / (3 * otherMass);
        const hillRadius = avgDist * Math.pow(massRatio, 1 / 3);

        perturbers.push({
          name: otherData.name,
          minDistance: avgDist,
          hillRadius: hillRadius
        });

        if (hillRadius < minHillRadius) {
          minHillRadius = hillRadius;
          limitingPerturber = otherData.name;
          perturberDistance = avgDist;
        }
      }
    }

    return {
      minHillRadius,
      limitingPerturber,
      perturberDistance,
      baselineHillRadius,
      perturbers,
      debugInfo
    };
  }

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
      maxHeight: '80vh'
    });
  }

  public showHillLimitExplanation(): void {
    if (!this.body.parent) {
      return;
    }

    const result = this.calculateHillLimitWithPerturbers();
    if (!result) {
      return;
    }

    const parentBody = this.body.parent.bodyData;
    const semiMajorAxis = parentBody.semiMajorAxis!;
    const parentMass = parentBody.earthMasses || (parentBody.solarMasses ? parentBody.solarMasses * 332950 : null);

    // Get primary body name from debugInfo and find it to get its mass
    const primaryName = result.debugInfo?.primaryBodyName || '';
    if (!primaryName) {
      return;
    }

    // Find the primary body to get its mass
    const allBodies = this.getAllSystemBodies();
    const primaryBodyObj = allBodies.find(b => b.bodyData.name === primaryName);
    if (!primaryBodyObj) {
      return;
    }

    const primaryMass = primaryBodyObj.bodyData.solarMasses
      ? primaryBodyObj.bodyData.solarMasses * 332950
      : primaryBodyObj.bodyData.earthMasses || null;

    if (!primaryMass) {
      return;
    }

    const semiMajorAxisKm = semiMajorAxis * 149597870.7;
    const outerRadius = this.body.bodyData.outerRadius || 0;
    const difference = outerRadius - result.minHillRadius;
    const isExceeded = difference > 0;

    const parentBodyName = parentBody.name.split(' ').slice(1).join(' ') || parentBody.name;
    const primaryStarName = primaryName.split(' ').slice(1).join(' ') || primaryName;
    const ringName = this.body.bodyData.name.split(' ').slice(1).join(' ') || this.body.bodyData.name;

    this.hillLimitDialogData = {
      parentBodyName,
      semiMajorAxis,
      semiMajorAxisKm,
      parentMass: parentMass!,
      isEarthMasses: !!parentBody.earthMasses,
      primaryStarName,
      primaryMass: primaryMass!,
      baselineHillRadius: result.baselineHillRadius,
      minHillRadius: result.minHillRadius,
      limitingPerturber: result.limitingPerturber,
      perturberDistance: result.perturberDistance,
      perturbers: result.perturbers,
      outerRadius,
      difference: Math.abs(difference),
      isExceeded,
      ringName,
      debugInfo: result.debugInfo
    };

    const dialogRef = this.dialog.open(this.hillLimitDialogTemplate, {
      width: '700px',
      maxWidth: '90vw',
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop',
      panelClass: 'hill-limit-dialog-panel'
    });
  }

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

  public classifyNeutronStar(): { classification: string; tooltip: string } | null {
    if (this.body.bodyData.type !== 'Star' || this.body.bodyData.subType !== 'Neutron Star') {
      return null;
    }

    const mass = this.body.bodyData.solarMasses;
    const age = this.body.bodyData.age;
    const temp = this.body.bodyData.surfaceTemperature;
    const periodDays = this.body.bodyData.rotationalPeriod;

    if (mass === undefined || age === undefined || periodDays === undefined || temp === undefined) {
      return null;
    }

    const period = periodDays * 86400;

    if (mass > 3) {
      return { classification: "Anomalous", tooltip: `Mass of ${mass.toFixed(2)} solar masses exceeds theoretical limit of ~3 solar masses` };
    }

    if (age > 100 && (period < 0.1 || temp > 1e7)) {
      return { classification: "Anomalous", tooltip: `Old neutron star (${age}My) with impossible rotation (${(period / 86400).toFixed(3)}d) or temperature (${temp.toLocaleString()}K)` };
    }

    if (mass <= 3 && age >= 0.1 && age <= 10 && period >= 0.001 && period <= 0.01) {
      return { classification: "Millisecond Pulsar", tooltip: `Fast rotation (${(period * 1000).toFixed(1)}ms) and moderate age (${age}My) indicate spin-up from companion` };
    }

    if (mass <= 3 && age <= 10 && period > 0.01 && period <= 5 && temp > 1e7) {
      return { classification: "Normal Pulsar (Young)", tooltip: `Young age (${age}My) with expected high rotation rate and temperature (${temp.toLocaleString()}K)` };
    }

    if (mass <= 3 && age > 10 && age <= 100 && period > 0.01 && period <= 5 && temp >= 1e6 && temp <= 1e7) {
      return { classification: "Normal Pulsar (Middle-aged)", tooltip: `Middle age (${age}My) with moderate rotation (${(period / 86400).toFixed(3)}d) as pulsar spins down` };
    }

    if (mass <= 3 && age > 100 && period > 0.1 && temp <= 1e6) {
      return { classification: "Normal Pulsar (Old)", tooltip: `Old age (${age}My) with slow rotation (${(period / 86400).toFixed(3)}d) as rotational energy dissipated` };
    }

    if (mass <= 3 && age < 0.1 && period >= 2 && period <= 12 && temp > 1e8) {
      return { classification: "Potential Magnetar", tooltip: `Very young (${age}My) with slow rotation (${(period / 86400).toFixed(3)}d) and extreme temperature (${temp.toLocaleString()}K) suggests strong magnetic field` };
    }

    return null;
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
    if (this.body.bodyData.type !== 'Star' || !this.body.bodyData.subType?.includes('Neutron Star') ||
      !this.body.bodyData.rotationalPeriod || !this.body.bodyData.solarMasses ||
      !this.body.bodyData.solarRadius || !this.body.bodyData.surfaceTemperature || !this.body.bodyData.age) {
      return null;
    }

    const mass = this.body.bodyData.solarMasses;
    const radius = this.body.bodyData.solarRadius;
    const rotPeriod = this.body.bodyData.rotationalPeriod;
    const surfaceTemp = this.body.bodyData.surfaceTemperature;
    const age = this.body.bodyData.age;

    if (mass <= 0 || radius <= 0 || rotPeriod <= 0 || surfaceTemp <= 0 || age <= 0) {
      return null;
    }

    const rotEnergy = (mass * radius * radius) / (rotPeriod * rotPeriod);
    const tempPerMass = surfaceTemp / mass;

    const logPred = 0.8785 +
      0.1185 * Math.log(rotEnergy) +
      0.1362 * Math.log(tempPerMass) +
      -0.0787 * Math.log(age);

    return Math.exp(logPred);
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

  public getMaterialBadges(): { name: string, class: string, tooltip: string }[] {
    if (!this.body.bodyData.materials) {
      return [];
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

    return Object.entries(this.body.bodyData.materials)
      .filter(([material, percentage]) => percentage > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([material, percentage]) => ({
        name: materialData[material]?.abbrev || material,
        class: materialData[material]?.grade || 'badge-gray',
        tooltip: `${material}: ${percentage.toFixed(2)}%`
      }));
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