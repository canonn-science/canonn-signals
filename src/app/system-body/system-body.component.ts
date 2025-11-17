import { Component, Input, OnChanges, OnInit, ViewChild, ElementRef, AfterViewInit, ViewChildren, QueryList } from '@angular/core';
import { SystemBody } from '../home/home.component';
import { faCircleChevronRight, faCircleQuestion, faSquareCaretDown, faSquareCaretUp, faUpRightFromSquare, faCode, faLock } from '@fortawesome/free-solid-svg-icons';
import { AppService, CanonnCodexEntry } from '../app.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BodyImage } from '../data/body-images';
import { animate, style, transition, trigger } from '@angular/animations';
import { MatTooltip } from '@angular/material/tooltip';

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

  public constructor(private readonly appService: AppService) {
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
      this.bodyImage = `bodies/planets/terrestrial/Rings.png`;
    }
    else if (this.body.bodyData.type === "Belt") {
      this.bodyImage = `bodies/planets/terrestrial/Belts.png`;
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

  public isRingNotVisible(): boolean {
    if (this.body.bodyData.type !== 'Ring') {
      return false;
    }
    const density = this.getRingDensity();
    const width = this.getRingWidth();
    return density < 0.1 && width > 1000000;
  }

  public getSolidCompositionTooltip(): string {
    if (!this.body.bodyData.solidComposition) {
      return '';
    }
    return Object.entries(this.body.bodyData.solidComposition)
      .map(([component, percentage]) => `${component}: ${percentage.toFixed(2)}%`)
      .join('\n');
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
      return { classification: "Anomalous", tooltip: `Old neutron star (${age}My) with impossible rotation (${(period/86400).toFixed(3)}d) or temperature (${temp.toLocaleString()}K)` };
    }

    if (mass <= 3 && age >= 0.1 && age <= 10 && period >= 0.001 && period <= 0.01) {
      return { classification: "Millisecond Pulsar", tooltip: `Fast rotation (${(period*1000).toFixed(1)}ms) and moderate age (${age}My) indicate spin-up from companion` };
    }

    if (mass <= 3 && age <= 10 && period > 0.01 && period <= 5 && temp > 1e7) {
      return { classification: "Normal Pulsar (Young)", tooltip: `Young age (${age}My) with expected high rotation rate and temperature (${temp.toLocaleString()}K)` };
    }

    if (mass <= 3 && age > 10 && age <= 100 && period > 0.01 && period <= 5 && temp >= 1e6 && temp <= 1e7) {
      return { classification: "Normal Pulsar (Middle-aged)", tooltip: `Middle age (${age}My) with moderate rotation (${(period/86400).toFixed(3)}d) as pulsar spins down` };
    }

    if (mass <= 3 && age > 100 && period > 0.1 && temp <= 1e6) {
      return { classification: "Normal Pulsar (Old)", tooltip: `Old age (${age}My) with slow rotation (${(period/86400).toFixed(3)}d) as rotational energy dissipated` };
    }

    if (mass <= 3 && age < 0.1 && period >= 2 && period <= 12 && temp > 1e8) {
      return { classification: "Potential Magnetar", tooltip: `Very young (${age}My) with slow rotation (${(period/86400).toFixed(3)}d) and extreme temperature (${temp.toLocaleString()}K) suggests strong magnetic field` };
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