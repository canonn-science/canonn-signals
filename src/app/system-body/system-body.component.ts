import {
  estimateTempRange, isTempSafe, TempDelta,
  DELTA_BY_SUBTYPE_ATMOSPHERE, DELTA_BY_SUBTYPE_NO_ATM, DELTA_BY_SUBTYPE,
  DELTA_BY_ATMOSPHERE, DELTA_BY_PRESSURE, DELTA_GLOBAL,
} from '../data/temperature-estimation';
import { Component, OnChanges, OnInit, ElementRef, TemplateRef, ChangeDetectionStrategy, ChangeDetectorRef, SimpleChanges, input, DestroyRef, viewChildren, viewChild, inject, afterNextRender } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SystemBody, EdGalaxyData } from '../home/home.component';
import { faCircleChevronRight, faCircleQuestion, faSquareCaretDown, faSquareCaretUp, faUpRightFromSquare, faCode, faLock, faLink } from '@fortawesome/free-solid-svg-icons';
import { AppService, CanonnCodexEntry } from '../app.service';
import { BodyImage } from '../data/body-images';
import { MINING_RESOURCES } from '../data/mining-resources';
import { animate, style, transition, trigger } from '@angular/animations';
import { MatTooltip } from '@angular/material/tooltip';
import { MatDialog, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose } from '@angular/material/dialog';
import { DecimalPipe, DatePipe } from '@angular/common';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { MatButton } from '@angular/material/button';
import { ClickableDirective } from '../clickable.directive';
import { BodyPhysicsService, ShepherdingHillLimit, BodyRocheLimits, PlanetaryDensity } from '../data/body-physics.service';
import { StellarPhysicsService } from '../data/stellar-physics.service';
import { BODY_TYPE } from '../data/body-types';

@Component({
    selector: 'app-system-body',
    templateUrl: './system-body.component.html',
    styleUrls: ['./system-body.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: [
        trigger("grow", [
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
    ],
    imports: [FaIconComponent, MatTooltip, MatDialogTitle, CdkScrollable, MatDialogContent, MatDialogActions, MatButton, MatDialogClose, DecimalPipe, DatePipe, ClickableDirective]
})
export class SystemBodyComponent implements OnInit, OnChanges {
  private readonly appService = inject(AppService);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly physics = inject(BodyPhysicsService);
  private readonly stellarPhysics = inject(StellarPhysicsService);

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
  public readonly faLink = faLink;
  readonly body = input.required<SystemBody>();
  readonly edGalaxyData = input<EdGalaxyData | null>(null);
  readonly isRoot = input<boolean>(false);
  readonly isLast = input<boolean>(false);
  readonly forceExpanded = input<boolean>(false);
  readonly anchorBodyId = input<number | null>(null);
  readonly childComponents = viewChildren(SystemBodyComponent);
  readonly hillLimitDialogTemplate = viewChild.required<TemplateRef<any>>('hillLimitDialogTemplate');
  readonly invisibleRingDialogTemplate = viewChild.required<TemplateRef<any>>('invisibleRingDialogTemplate');
  readonly jsonDialogTemplate = viewChild.required<TemplateRef<any>>('jsonDialogTemplate');
  readonly jsonDialogTitle = viewChild.required<ElementRef<HTMLElement>>('jsonDialogTitle');
  readonly rocheLimitDialogTemplate = viewChild.required<TemplateRef<any>>('rocheLimitDialogTemplate');
  readonly tidalLockDialogTemplate = viewChild.required<TemplateRef<any>>('tidalLockDialogTemplate');
  readonly onFootSafetyDialogTemplate = viewChild.required<TemplateRef<any>>('onFootSafetyDialogTemplate');
  readonly jetAngleDialogTemplate = viewChild.required<TemplateRef<any>>('jetAngleDialogTemplate');
  readonly apoPeriDialogTemplate = viewChild.required<TemplateRef<any>>('apoPeriDialogTemplate');
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

  public expandable = false;
  public expanded = false;

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

  // Cached values for template bindings that are read multiple times per render.
  private cachedJetConeAngle: number | null = null;
  private cachedSpinResonance = 'none';
  private cachedConfirmedBiologyCount = 0;

  public getBodyDisplayName(bodyName: string): string {
    return this.appService.getBodyDisplayName(bodyName);
  }

  public encodeURIComponent(value: string | number | null | undefined): string {
    try {
      return encodeURIComponent(value ?? '');
    } catch {
      return '';
    }
  }

  public bodyLinkCopied = false;

  private containsAnchorBody(body: SystemBody): boolean {
    const anchorBodyId = this.anchorBodyId();
    if (anchorBodyId === null) { return false; }
    if (body.bodyData.bodyId === anchorBodyId) { return true; }
    return body.subBodies.some(child => this.containsAnchorBody(child));
  }

  public get isAnchorBody(): boolean {
    const anchorBodyId = this.anchorBodyId();
    return anchorBodyId !== null && this.body().bodyData.bodyId === anchorBodyId;
  }

  public copyBodyLink(): void {
    const bodyId = this.body()?.bodyData?.bodyId;
    if (bodyId === undefined || bodyId === null) { return; }
    const url = `${window.location.href.split('#')[0]}#body-${bodyId}`;
    navigator.clipboard.writeText(url).then(() => {
      this.setBodyLinkCopied();
    });
  }

  /** Flash the "Copied!" state, notifying the scheduler since this runs in async (promise/timeout) callbacks under zoneless. */
  private setBodyLinkCopied(): void {
    this.bodyLinkCopied = true;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.bodyLinkCopied = false;
      this.cdr.markForCheck();
    }, 1500);
  }

  public getEdGalaxyBodyId(b: SystemBody): number {
    if (!b || !b.bodyData) { return -1; }
    const bid = typeof b.bodyData.bodyId === 'number' ? b.bodyData.bodyId : -1;
    if (bid && bid > -1) {
      return bid;
    }
    // Fallback to parent's bodyId if available (useful for rings/belts)
    if (b.parent && b.parent.bodyData && typeof b.parent.bodyData.bodyId === 'number' && b.parent.bodyData.bodyId > -1) {
      return b.parent.bodyData.bodyId;
    }
    return bid;
  }

  public ngOnInit(): void {
    this.appService.codexEntries
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(c => {
        this.codex = c;
        this.ngOnChanges();
        // OnPush + zoneless: codex arrives asynchronously, so notify the
        // scheduler that the recomputed biology signals changed.
        this.cdr.markForCheck();
      });
  }

  public ngOnChanges(changes?: SimpleChanges): void {
    const body = this.body();
    if (!body) {
      return;
    }

    this.detectTrojanStatus();
    this.detectRosetteStatus();
    this.cachedNextPeriapsis = this.calculateNextPeriapsis();
    this.cachedNextApoapsis = this.calculateNextApoapsis();
    this.cachedRocheExcess = this.calculateRocheExcess();

    // Calculate formatted mass values once when body changes
    this.formattedEarthMass = body.bodyData.earthMasses
      ? this.formatEarthMass(body.bodyData.earthMasses)
      : null;
    this.formattedSolarMass = body.bodyData.solarMasses
      ? this.formatSolarMass(body.bodyData.solarMasses)
      : null;

    this.bodyCoronaImage = "";
    this.bodyImage = "";

    const bodyImageResult = BodyImage.getBodyImagePath(body.bodyData);
    if (bodyImageResult) {
      this.bodyImage = `bodies/${bodyImageResult.path}.png`;
      if (bodyImageResult.coronaPath) {
        this.bodyCoronaImage = `bodies/${bodyImageResult.coronaPath}.png`;
      }
    }
    else if (body.bodyData.type === "Ring") {
      const asteroidIcon = this.getAsteroidIcon();
      this.bodyImage = asteroidIcon || `bodies/planets/terrestrial/Rings.png`;
    }
    else if (body.bodyData.type === "Belt") {
      const asteroidIcon = this.getAsteroidIcon();
      this.bodyImage = asteroidIcon || `bodies/planets/terrestrial/Belts.png`;
    }
    else if (body.bodyData.type === "Barycentre") {
      this.bodyImage = `Orbit2.gif`;
    }

    if (body.bodyData.signals) {
      this.humanSignalCount = body.bodyData.signals.signals ? body.bodyData.signals.signals['$SAA_SignalType_Human;'] : 0;
      this.otherSignalCount = body.bodyData.signals.signals ? body.bodyData.signals.signals['$SAA_SignalType_Other;'] : 0;
      this.geologySignalCount = body.bodyData.signals.signals ? body.bodyData.signals.signals['$SAA_SignalType_Geological;'] : 0;
      this.biologySignalCount = body.bodyData.signals.signals ? body.bodyData.signals.signals['$SAA_SignalType_Biological;'] : 0;
      this.thargoidSignalCount = body.bodyData.signals.signals ? body.bodyData.signals.signals['$SAA_SignalType_Thargoid;'] : 0;
      this.guardianSignalCount = body.bodyData.signals.signals ? body.bodyData.signals.signals['$SAA_SignalType_Guardian;'] : 0;
      this.geologySignals = body.bodyData.signals.geology ?? [];
      this.thargoidSignals = body.bodyData.signals.thargoid ?? [];
      this.guardianSignals = body.bodyData.signals.guardian ?? [];
      this.biologySignals = [];
      if (body.bodyData.signals.biology) {
        for (const biologySignal of body.bodyData.signals.biology) {
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
      if (body.bodyData.signals.guesses && addGuessesAndGenuses) {
        for (const guessedSignal of body.bodyData.signals.guesses) {
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
      if (body.bodyData.signals.genuses && addGuessesAndGenuses) {
        for (const genusSiggnal of body.bodyData.signals.genuses) {
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
    this.expandable = true;
    if (this.expanded === false || this.expanded === undefined) {
      const isInteresting = this.hasSignals ||
        body.bodyData.subType === 'Earth-like world' ||
        body.bodyData.subType === 'Water world' ||
        body.bodyData.subType === 'Ammonia world' ||
        body.bodyData.subType === 'Black Hole' ||
        body.bodyData.subType === 'Neutron Star' ||
        body.bodyData.subType?.includes('White Dwarf') ||
        body.bodyData.subType?.includes('Wolf-Rayet') ||
        body.bodyData.subType?.includes('Herbig') ||
        !!body.bodyData.isLandable;
      this.expanded = this.forceExpanded() || isInteresting || this.containsAnchorBody(body);
    }

    if (this.isRoot()) {
      this.styleClass = "";
    }
    else if (!this.isLast()) {
      if (!this.expanded) {
        this.styleClass = "child-container-title-only";
      }
      else {
        this.styleClass = "child-container-default";
      }
    }
    else {
      if (!this.expanded) {
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

    // Cache values read several times per render from the template.
    this.cachedSpinResonance = this.computeSpinResonance();
    this.cachedJetConeAngle = this.computeJetConeAngle();
    this.cachedConfirmedBiologyCount = this.biologySignals.filter(b => !b.isGuess).length;
  }

  public toggleExpand(): void {
    this.expanded = !this.expanded;
    // Update cached state
    this.updateChildrenExpandedState();
    this.cdr.markForCheck();
  }

  /**
   * Sets this body's expanded state and schedules its own re-render. Exposed so an
   * ancestor's "expand/collapse all" can drive descendants without reaching into
   * their private change-detector.
   */
  public setExpandedState(expanded: boolean): void {
    this.expanded = expanded;
    this.cdr.markForCheck();
  }

  public toggleChildren(): void {
    const childArray = this.childComponents();
    const anyChildExpanded = childArray.some(child => child.expanded);
    const targetState = !anyChildExpanded;

    // Collect all descendants using non-recursive approach
    const allDescendants: SystemBodyComponent[] = [];
    const queue: SystemBodyComponent[] = [...childArray];

    while (queue.length > 0) {
      const component = queue.shift()!;
      allDescendants.push(component);

      // Add grandchildren to queue
      const childComponents = component.childComponents();
      if (childComponents) {
        queue.push(...childComponents);
      }
    }

    // Batch update all descendants via their own public API.
    allDescendants.forEach(component => component.setExpandedState(targetState));

    // Update cached state and trigger change detection
    this.updateChildrenExpandedState();
    this.cdr.markForCheck();
  }

  public hasChildren(): boolean {
    const body = this.body();
    return body.subBodies && body.subBodies.length > 0;
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
    const body = this.body();
    if (body.bodyData.atmosphereComposition) {
      return Object.entries(body.bodyData.atmosphereComposition)
        .map(([gas, percentage]) => `${gas}: ${percentage.toFixed(2)}%`)
        .join('\n');
    }
    const subType = body.bodyData.subType;
    if (subType?.startsWith('White Dwarf')) {
      const match = subType.match(/White Dwarf \(([^)]+)\)/);
      if (match) {
        const tooltipMap: { [key: string]: string } = {
          'DA':  'DA — Only hydrogen Balmer lines visible.\n~28.9% of white dwarfs in the galaxy.',
          'DAB': 'DAB — Hydrogen dominant with detectable helium lines.\nIntermediate between DA and DB types. ~12.9% of white dwarfs.',
          'DAO': 'DAO — Hydrogen dominant with ionized helium (He II) lines also visible.\nTransitional type between the hydrogen-rich DA and ionized-helium DO sequences.',
          'DAV': 'DAV — Pulsating hydrogen-atmosphere white dwarf.\nShows brightness variations due to non-radial oscillations. ~3.3% of white dwarfs.',
          'DAZ': 'DAZ — Hydrogen atmosphere with metal absorption lines.\nMetals likely accreted from disrupted planetesimals. ~0.5% of white dwarfs.',
          'DAP': 'DAP — Magnetic hydrogen-atmosphere white dwarf.\nMagnetic field detected via polarimetry or Zeeman splitting of hydrogen lines.',
          'DB':  'DB — Only helium I lines visible, no hydrogen.\nForms when a DA loses its hydrogen layer. ~5.2% of white dwarfs.',
          'DBV': 'DBV — Pulsating helium-atmosphere white dwarf.\nShows brightness variations due to non-radial oscillations. ~1.0% of white dwarfs.',
          'DBZ': 'DBZ — Helium atmosphere with metal absorption lines.\nMetals likely accreted from disrupted planetesimals. ~0.1% of white dwarfs.',
          'DBP': 'DBP — Magnetic helium-atmosphere white dwarf.\nMagnetic field detected via polarimetry or Zeeman splitting of helium lines.',
          'DC':  'DC — No detectable spectral lines.\nFeatureless continuum; temperature too low for spectral features. ~44.3% of white dwarfs.',
          'DCV': 'DCV — Pulsating white dwarf with no detectable spectral lines.\nVariable featureless spectrum. ~3.8% of white dwarfs.',
          'DO':  'DO — Ionized helium (He II) dominant, very hot (>45,000 K).\nTransitional type between post-AGB stars and the cooler DB sequence.',
          'DOV': 'DOV (GW Vir) — Pulsating ionized-helium white dwarf.\nAmong the hottest known pulsating stars; driven by carbon/oxygen ionization.',
          'DOP': 'DOP — Magnetic ionized-helium white dwarf.\nVery hot DO type with a detectable magnetic field.',
          'DQ':  'DQ — Carbon Swan bands or atomic carbon lines visible.\nCarbon dredged up from the core into the helium envelope. <0.1% of white dwarfs.',
          'DZ':  'DZ — Metal absorption lines only; no hydrogen or helium lines.\nMetals accreted from disrupted planetesimals; hydrogen/helium layers too thin to detect.',
          'DZA': 'DZA — Metal lines dominant with trace hydrogen also visible.\nAccreted metals with a thin residual hydrogen layer.',
          'DZB': 'DZB — Metal lines dominant with trace helium also visible.\nAccreted metals in a helium-envelope white dwarf.',
          'DZQ': 'DZQ — Metal lines with carbon features also present.\nRare combination of accreted metals and carbon dredge-up.',
          'DX':  'DX — Spectral lines present but unidentifiable.\nUsed when the spectrum cannot be classified into any standard type.',
        };
        return tooltipMap[match[1]] ?? '';
      }
    }
    return '';
  }

  public getWhiteDwarfAtmosphere(): string | null {
    const subType = this.body().bodyData.subType;
    if (!subType?.startsWith('White Dwarf')) {
      return null;
    }
    const match = subType.match(/White Dwarf \(([^)]+)\)/);
    if (!match) return null;
    const spectralCode = match[1];
    const atmosphereMap: { [key: string]: string } = {
      'DA':  'Hydrogen Dominated',
      'DAB': 'Hydrogen and Helium',
      'DAO': 'Hydrogen and Ionized Helium',
      'DAV': 'Hydrogen Dominated (Variable)',
      'DAZ': 'Hydrogen with Metals',
      'DAP': 'Hydrogen Dominated (Magnetic)',
      'DB':  'Helium Dominated',
      'DBV': 'Helium Dominated (Variable)',
      'DBZ': 'Helium with Metals',
      'DBP': 'Helium Dominated (Magnetic)',
      'DC':  'Featureless Spectrum',
      'DCV': 'Featureless Spectrum (Variable)',
      'DO':  'Ionized Helium',
      'DOV': 'Ionized Helium (Variable)',
      'DOP': 'Ionized Helium (Magnetic)',
      'DQ':  'Carbon Features',
      'DZ':  'Metal Dominated',
      'DZA': 'Metal Dominated (Hydrogen)',
      'DZB': 'Metal Dominated (Helium)',
      'DZQ': 'Metal and Carbon Features',
      'DX':  'Unclassified Spectrum',
    };
    return atmosphereMap[spectralCode] ?? null;
  }

  public getAtmosphereDisplay(): string {
    const body = this.body();
    if (body.bodyData.atmosphereType) {
      return body.bodyData.atmosphereType;
    }
    if (body.bodyData.atmosphereComposition) {
      const largest = Object.entries(body.bodyData.atmosphereComposition)
        .reduce((max, [gas, percentage]) => percentage > max[1] ? [gas, percentage] : max);
      return `${largest[0]} ${largest[1].toFixed(2)}%`;
    }
    return this.getWhiteDwarfAtmosphere() ?? '';
  }

  public getApoapsis(): number {
    const semiMajorAxisKm = (this.body().bodyData.semiMajorAxis ?? 0) * 149597870.7;
    const eccentricity = this.body().bodyData.orbitalEccentricity ?? 0;
    return semiMajorAxisKm * (1 + eccentricity);
  }

  public getPeriapsis(): number {
    const semiMajorAxisKm = (this.body().bodyData.semiMajorAxis ?? 0) * 149597870.7;
    const eccentricity = this.body().bodyData.orbitalEccentricity ?? 0;
    return semiMajorAxisKm * (1 - eccentricity);
  }

  public getRingWidth(): number {
    const outer = this.body().bodyData.outerRadius ?? 0;
    const inner = this.body().bodyData.innerRadius ?? 0;
    return outer - inner;
  }

  public getRingArea(): number {
    const outer = this.body().bodyData.outerRadius ?? 0;
    const inner = this.body().bodyData.innerRadius ?? 0;
    return Math.PI * (outer * outer - inner * inner);
  }

  public getRingDensity(): number {
    const mass = this.body().bodyData.mass ?? 0;
    const area = this.getRingArea();
    return area > 0 ? mass / area : 0;
  }

  public getPlanetaryDensity(): PlanetaryDensity | null {
    return this.physics.getPlanetaryDensity(this.body().bodyData);
  }

  public radToDeg(value: number | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    return value * 180 / Math.PI;
  }

  public isRingNotVisible(): boolean {
    if (this.body().bodyData.type !== BODY_TYPE.Ring) {
      return false;
    }
    const density = this.getRingDensity();
    const width = this.getRingWidth();
    return density < 0.1 && width > 1000000;
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
    const body = this.body();
    if (body.bodyData.signals?.signals) {
      return Object.keys(body.bodyData.signals.signals).length;
    }

    // For ring bodies, check the parent's rings array
    if (body.bodyData.type === BODY_TYPE.Ring && body.parent?.bodyData.rings) {
      const ringData = body.parent.bodyData.rings.find(r => r.name === this.body().bodyData.name);
      if (ringData?.signals?.signals) {
        return Object.keys(ringData.signals.signals).length;
      }
    }

    return 0;
  }

  private computeHotspotsList(): void {
    let signals: { [key: string]: number } | undefined;

    // First check if the ring body itself has signals
    const body = this.body();
    if (body.bodyData.signals?.signals) {
      signals = body.bodyData.signals.signals;
    }
    // For ring bodies, check the parent's rings array
    else if (body.bodyData.type === BODY_TYPE.Ring && body.parent?.bodyData.rings) {
      const ringData = body.parent.bodyData.rings.find(r => r.name === this.body().bodyData.name);
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
    const p = this.body()?.bodyData?.surfacePressure;
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

  public trackByHotspot(index: number, hotspot: { displayName: string }): string {
    return hotspot.displayName;
  }

  public getSignalsTooltip(): string {
    let signals: { [key: string]: number } | undefined;

    // First check if the ring body itself has signals
    const body = this.body();
    if (body.bodyData.signals?.signals) {
      signals = body.bodyData.signals.signals;
    }
    // For ring bodies, check the parent's rings array
    else if (body.bodyData.type === BODY_TYPE.Ring && body.parent?.bodyData.rings) {
      const ringData = body.parent.bodyData.rings.find(r => r.name === this.body().bodyData.name);
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

  public calculateShepherdingHillLimit(): ShepherdingHillLimit | null {
    return this.physics.calculateShepherdingHillLimit(this.body());
  }

  public calculateRigidRocheLimit(): number | null {
    return this.physics.calculateRigidRocheLimit(this.body());
  }

  public calculateFluidRocheLimit(): number | null {
    return this.physics.calculateFluidRocheLimit(this.body());
  }

  public calculateBodyRocheLimits(): BodyRocheLimits | null {
    return this.physics.calculateBodyRocheLimits(this.body());
  }

  public getConfirmedBiologyCount(): number {
    return this.cachedConfirmedBiologyCount;
  }

  public isBodyWithinParentRings(): boolean {
    return this.physics.isBodyWithinParentRings(this.body());
  }

  public isShepherdingCandidate(): boolean {
    return this.physics.isShepherdingCandidate(this.body());
  }

  public isActualShepherd(): boolean {
    return this.physics.isActualShepherd(this.body());
  }


  // Orbital-position math (Kepler solver + hierarchical system-frame positioning)
  // lives in OrbitalMechanicsService so it can be unit-tested without the component.

  public getSolidCompositionTooltip(): string {
    const body = this.body();
    if (!body.bodyData.solidComposition) {
      return '';
    }
    return Object.entries(body.bodyData.solidComposition)
      .map(([component, percentage]) => `${component}: ${percentage.toFixed(2)}%`)
      .join('\n');
  }

  private getAsteroidIcon(): string | null {
    // Only show icon for rings and belts
    const body = this.body();
    if (body.bodyData.type !== BODY_TYPE.Ring && body.bodyData.type !== BODY_TYPE.Belt) {
      return null;
    }

    // Get the subType (e.g., "Icy", "Metallic", "Metal Rich", "Rocky")
    const subType = body.bodyData.subType;
    if (!subType) {
      return null;
    }

    // Convert subType to lowercase and replace spaces with underscores
    // "Metal Rich" -> "metal_rich"
    const iconName = subType.toLowerCase().replace(/ /g, '_');

    // Construct the filename based on type (without 'assets/' prefix as it's added in template)
    if (body.bodyData.type === BODY_TYPE.Belt) {
      return `asteroids/cluster_${iconName}_01.png`;
    } else {
      // Ring
      return `asteroids/${iconName}_01.png`;
    }
  }

  constructor() {
    // Sync the cached collapse/expand-all state once the child components first render.
    afterNextRender(() => this.updateChildrenExpandedState());
  }

  private updateChildrenExpandedState(): void {
    const childArray = this.childComponents();
    this.cachedChildrenExpandedState = childArray.some(child => child.expanded);
    // Runs from an after-render hook as well as event handlers; notify the scheduler
    // so the collapse/expand-all toggle reflects the new state under zoneless.
    this.cdr.markForCheck();
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
    const jsonText = JSON.stringify(this.body().bodyData, null, 2);
    navigator.clipboard.writeText(jsonText);
  }

  public getFormattedBodyJson(): string {
    return JSON.stringify(this.body().bodyData, null, 2);
  }

  public showBodyJsonDialog(event: MouseEvent): void {
    this.dialog.open(this.jsonDialogTemplate(), {
      width: '800px',
      autoFocus: false,
      restoreFocus: false
    });

    // Focus the title after the dialog opens
    setTimeout(() => {
      const jsonDialogTitle = this.jsonDialogTitle();
      if (jsonDialogTitle) {
        jsonDialogTitle.nativeElement.focus();
      }
    }, 100);
  }

  // Ring Hill-limit dialog removed.

  public showInvisibleRingExplanation(): void {
    const body = this.body();
    if (body.bodyData.type !== BODY_TYPE.Ring) {
      return;
    }

    const innerRadius = body.bodyData.innerRadius || 0;
    const outerRadius = body.bodyData.outerRadius || 0;
    const mass = body.bodyData.mass || 0;
    const width = this.getRingWidth();
    const area = this.getRingArea();
    const density = this.getRingDensity();
    const isInvisible = density < 0.1 && width > 1000000;

    const ringName = body.bodyData.name.split(' ').slice(1).join(' ') || body.bodyData.name;

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

    this.dialog.open(this.invisibleRingDialogTemplate(), {
      width: '700px',
      maxWidth: '90vw',
      panelClass: 'invisible-ring-dialog'
    });
  }

  public showRocheLimitChart(): void {
    const body = this.body();
    if (!body.parent || body.bodyData.type !== BODY_TYPE.Ring) {
      return;
    }

    const parent = body.parent.bodyData;

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
      name: body.bodyData.name,
      innerRadius: body.bodyData.innerRadius || 0, // Already in km
      outerRadius: body.bodyData.outerRadius || 0, // Already in km
      type: body.bodyData.subType,
      density: this.physics.ringSatelliteDensityKgM3(body.bodyData.subType)
    };

    this.rocheLimitDialogData = {
      parentName: parent.name,
      ringName: body.bodyData.name,
      densityRange,
      rigidLimits,
      fluidLimits,
      rings: [currentRing],
      primaryRadius,
      isBody: false
    };

    this.isChartLoading = true;

    const dialogRef = this.dialog.open(this.rocheLimitDialogTemplate(), {
      width: '800px',
      maxWidth: '90vw',
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop'
    });

    // Draw chart after dialog opens
    setTimeout(() => {
      this.drawRocheChart();
      this.isChartLoading = false;
      this.cdr.markForCheck();
    }, 100);
  }

  public showBodyRocheLimitChart(): void {
    const rocheLimits = this.calculateBodyRocheLimits();
    const body = this.body();
    if (!rocheLimits || !body.parent) {
      return;
    }

    const parent = body.parent.bodyData;

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
    const bodyMassKg = body.bodyData.earthMasses! * 5.972e24;
    const bodyRadiusM = body.bodyData.radius! * 1000;
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
    const bodyRadius = body.bodyData.radius!; // in km
    const bodyRing = {
      name: body.bodyData.name,
      innerRadius: rocheLimits.periapsis - bodyRadius,
      outerRadius: rocheLimits.apoapsis + bodyRadius,
      type: 'Body Orbit',
      density: bodyDensity
    };

    this.rocheLimitDialogData = {
      parentName: parent.name,
      ringName: body.bodyData.name,
      densityRange,
      rigidLimits,
      fluidLimits,
      rings: [bodyRing],
      primaryRadius,
      isBody: true
    };

    this.isChartLoading = true;

    const dialogRef = this.dialog.open(this.rocheLimitDialogTemplate(), {
      width: '800px',
      maxWidth: '90vw',
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop'
    });

    // Draw chart after dialog opens
    setTimeout(() => {
      this.drawRocheChart();
      this.isChartLoading = false;
      this.cdr.markForCheck();
    }, 100);
  }

  public showApoPeriDialog(type: 'apo' | 'peri'): void {
    let data: { date: Date, days: number } | null = null;
    let distanceKm: number | undefined = undefined;
    const body = this.body();
    if (type === 'apo') {
      data = this.getNextApoapsis();
      if (body.bodyData.semiMajorAxis && body.bodyData.orbitalEccentricity !== undefined) {
        distanceKm = this.getApoapsis();
      }
    } else {
      data = this.getNextPeriapsis();
      if (body.bodyData.semiMajorAxis && body.bodyData.orbitalEccentricity !== undefined) {
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

    if (body.bodyData.meanAnomaly !== undefined && body.bodyData.orbitalPeriod && body.bodyData.timestamps?.meanAnomaly) {
      meanAnomaly = body.bodyData.meanAnomaly;
      orbitalPeriod = body.bodyData.orbitalPeriod;
      timestamp = new Date(body.bodyData.timestamps.meanAnomaly);
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

    this.dialog.open(this.apoPeriDialogTemplate(), {
      width: '600px',
      maxWidth: '90vw',
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop'
    });
  }

  public showShepherdingHillLimitChart(): void {
    const hillData = this.calculateShepherdingHillLimit();
    const body = this.body();
    if (!hillData || !body.parent) {
      return;
    }

    const parent = body.parent.bodyData;

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

      // Require the Hill sphere to actually reach (or slightly overlap) the outermost ring edge.
      // Use the same tolerance as `isActualShepherd()` (5% of ring width or minimum 1 km).
      const ringWidth = Math.max(0, hillData.outermostRingRadius - hillData.parentRadius);
      const tolerance = Math.max(1, ringWidth * 0.05);

      if (hillInnerEdge <= (hillData.outermostRingRadius + tolerance)) {
        shepherdStatus = 'shepherd';
      }
    }

    this.hillLimitDialogData = {
      parentName: parent.name,
      bodyName: body.bodyData.name,
      parentRadius,
      outermostRingRadius: hillData.outermostRingRadius,
      bodyOrbitalRadius: hillData.bodyOrbitalRadius,
      bodyPeriapsis: hillData.bodyPeriapsis,
      bodyApoapsis: hillData.bodyApoapsis,
      hillRadius: hillData.hillRadius,
      withinRings: hillData.withinRings,
      isFirstOutside: hillData.isFirstOutside,
      rings: ringData,
      bodyRadius: body.bodyData.radius || 0,
      shepherdStatus
    };

    this.isChartLoading = true;

    const dialogRef = this.dialog.open(this.hillLimitDialogTemplate(), {
      width: '800px',
      maxWidth: '90vw',
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop'
    });

    // Draw chart after dialog opens with a longer delay
    setTimeout(() => {
      this.drawShepherdingHillChart();
      this.isChartLoading = false;
      this.cdr.markForCheck();
    }, 200);
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
    return this.cachedSpinResonance;
  }

  private computeSpinResonance(): string {
    const bodyData = this.body().bodyData;
    return this.stellarPhysics.spinResonance(bodyData.rotationalPeriod, bodyData.orbitalPeriod);
  }

  public getSpinResonanceTooltip(): string {
    const resonance = this.getSpinResonance();
    const body = this.body();
    if (resonance === 'none' && body.bodyData.rotationalPeriodTidallyLocked) {
      return 'Tidally Locked not in a simple resonance';
    }
    if (resonance === '1:1' && body.bodyData.rotationalPeriodTidallyLocked) {
      if (body.parent?.bodyData.type === BODY_TYPE.Star) {
        if (body.bodyData.subType === 'Earth-like world') {
          return 'Eyeball earth';
        }
        if (body.bodyData.subType === 'Water world') {
          return 'Eyeball water world';
        }
      }
      return 'Synchronised';
    }
    return resonance + ' spin resonance';
  }

  public getTangentialVelocity(): number | null {
    const bodyData = this.body().bodyData;
    if (!this.isBlackHoleOrNeutronStar() || !bodyData.rotationalPeriod) {
      return null;
    }
    const radiusKm = this.stellarPhysics.radiusKm(bodyData.radius, bodyData.solarRadius);
    if (radiusKm === null) {
      return null;
    }
    return this.stellarPhysics.tangentialVelocityKms(bodyData.rotationalPeriod, radiusKm);
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
    const body = this.body();
    return body.bodyData.type === BODY_TYPE.Star &&
      (body.bodyData.subType === 'Black Hole' ||
        body.bodyData.subType === 'Neutron Star');
  }

  private formatPeriodDays(days: number): string {
    const absDays = Math.abs(days);
    const seconds = absDays * 86400;
    const minutes = seconds / 60;
    const hours = minutes / 60;
    const weeks = absDays / 7;
    const years = absDays / 365.25;
    const decades = years / 10;
    const centuries = years / 100;
    const sign = days < 0 ? '-' : '';

    if (seconds < 1) return `${sign}${(seconds * 1000).toFixed(2)} ms`;
    if (seconds < 60) return `${sign}${seconds.toFixed(2)} s`;
    if (minutes < 60) return `${sign}${minutes.toFixed(2)} min`;
    if (hours < 24) return `${sign}${hours.toFixed(2)} h`;
    if (absDays < 7) return `${sign}${absDays.toFixed(2)} days`;
    if (weeks < 52) return `${sign}${weeks.toFixed(2)} weeks`;
    if (years < 10) return `${sign}${years.toFixed(2)} years`;
    if (decades < 10) return `${sign}${decades.toFixed(2)} decades`;
    return `${sign}${centuries.toFixed(2)} centuries`;
  }

  public getRotationalPeriodDisplay(): string {
    const days = this.body().bodyData.rotationalPeriod;
    if (!days) return '';
    return this.formatPeriodDays(days);
  }

  public getOrbitalPeriodDisplay(): string {
    const days = this.body().bodyData.orbitalPeriod;
    if (!days) return '';
    return this.formatPeriodDays(days);
  }

  public classifyNeutronStar(): string | null {
    const body = this.body();
    if (body.bodyData.type !== BODY_TYPE.Star || body.bodyData.subType !== 'Neutron Star') {
      return null;
    }

    const mass = body.bodyData.solarMasses;
    const radius = body.bodyData.solarRadius;
    const periodDays = body.bodyData.rotationalPeriod;
    const absMag = body.bodyData.absoluteMagnitude;

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
    const body = this.body();
    if (!body.bodyData.isLandable) {
      return 'badge-gray';
    }

    // High gravity — disembarking not possible
    if (body.bodyData.gravity && body.bodyData.gravity > 2.7) {
      return 'badge-red';
    }

    const surfTemp = body.bodyData.surfaceTemperature;
    if (!surfTemp) {
      return 'badge-gray';
    }

    const { min, max } = estimateTempRange(
      surfTemp,
      body.bodyData.subType,
      body.bodyData.atmosphereType,
      body.bodyData.surfacePressure,
    );

    const safeMin = isTempSafe(min);
    const safeMax = isTempSafe(max);
    const safeSurf = isTempSafe(surfTemp);

    if (safeMin && safeMax) {
      return 'badge-green';
    } else if (safeMin || safeMax || safeSurf) {
      return 'badge-orange';
    } else {
      return 'badge-red';
    }
  }

  public getLandableTooltip(): string {
    // High gravity takes precedence
    const body = this.body();
    if (body.bodyData.gravity && body.bodyData.gravity > 2.7) {
      return 'Landable: High gravity. Disembarking not possible';
    }

    const surfTemp = body.bodyData.surfaceTemperature;
    if (!surfTemp) {
      return 'Landable: No temperature data available';
    }

    const { min, max } = estimateTempRange(
      surfTemp,
      body.bodyData.subType,
      body.bodyData.atmosphereType,
      body.bodyData.surfacePressure,
    );

    const rangeInfo = `Est. range ${Math.round(min)}–${Math.round(max)} K`;
    const tooCold = min < 182;
    const tooHot = max >= 700;

    if (tooCold && tooHot) {
      return `Landable: Battery drain risk and risk of injury or death`;
    } else if (tooHot) {
      return `Landable: Risk of injury or death`;
    } else if (tooCold) {
      return `Landable: Battery drain risk`;
    } else {
      return `Landable: Safe to disembark`;
    }
  }

  public getEstimatedTempRange(): { min: number; max: number } | null {
    const surfTemp = this.body().bodyData.surfaceTemperature;
    if (!surfTemp) return null;
    return estimateTempRange(
      surfTemp,
      this.body().bodyData.subType,
      this.body().bodyData.atmosphereType,
      this.body().bodyData.surfacePressure,
    );
  }

  public trojanStatus: string | null = null;
  public trojanHostStatus: boolean = false;
  public rosetteStatus: string | null = null;
  private cachedNextPeriapsis: { date: Date, days: number } | null = null;
  private cachedNextApoapsis: { date: Date, days: number } | null = null;
  private cachedChildrenExpandedState: boolean = false;
  private cachedRocheExcess: number | null = null;

  private detectTrojanStatus(): void {
    this.trojanStatus = null;
    this.trojanHostStatus = false;

    const body = this.body();
    if (!body.parent || !body.bodyData.orbitalPeriod || !body.bodyData.semiMajorAxis ||
      body.bodyData.argOfPeriapsis === undefined) {
      return;
    }

    // Check L3, L4, L5 (same orbital distance)
    const sameSMABodies = body.parent.subBodies.filter(sibling => {
      const bodyValue = this.body();
      return sibling !== bodyValue &&
      sibling.bodyData.orbitalPeriod === bodyValue.bodyData.orbitalPeriod &&
      sibling.bodyData.semiMajorAxis === bodyValue.bodyData.semiMajorAxis &&
      sibling.bodyData.argOfPeriapsis !== undefined;
    }
    );

    // If this body has co-orbital neighbours at both +60° and −60°, it is the host planet
    // of the Trojan pair (the "massive" reference body). It should not itself be labelled
    // as a Trojan, so bail out early.
    let hasLeadingTrojan = false;
    let hasTrailingTrojan = false;
    for (const sibling of sameSMABodies) {
      const diff = ((sibling.bodyData.argOfPeriapsis! - body.bodyData.argOfPeriapsis! + 540) % 360) - 180;
      if (Math.abs(diff - 60) < 1) hasLeadingTrojan = true;
      if (Math.abs(diff + 60) < 1) hasTrailingTrojan = true;
    }
    if (hasLeadingTrojan && hasTrailingTrojan) {
      this.trojanHostStatus = true; // This body has Trojans at both L4 and L5 — it is the host, not a Trojan itself.
      return;
    }

    for (const sibling of sameSMABodies) {
      const argDiff = Math.abs(body.bodyData.argOfPeriapsis! - sibling.bodyData.argOfPeriapsis!);
      const normalizedDiff = Math.min(argDiff, 360 - argDiff);

      if (Math.abs(normalizedDiff - 60) < 1) {
        // Use a signed angular difference (normalised to [−180, 180]) so that wrap-around
        // values such as 300° vs 0° are handled correctly.
        const relativePos = ((body.bodyData.argOfPeriapsis! - sibling.bodyData.argOfPeriapsis! + 540) % 360) - 180;
        this.trojanStatus = relativePos > 0 ? 'L4' : 'L5';
        return;
      } else if (Math.abs(normalizedDiff - 180) < 1) {
        this.trojanStatus = 'L3';
        return;
      }
    }

    // Check L1, L2 (different orbital distances, same period)
    const samePeriodBodies = body.parent.subBodies.filter(sibling => {
      const bodyValue = this.body();
      return sibling !== bodyValue &&
      sibling.bodyData.orbitalPeriod === bodyValue.bodyData.orbitalPeriod &&
      sibling.bodyData.semiMajorAxis !== bodyValue.bodyData.semiMajorAxis &&
      sibling.bodyData.argOfPeriapsis !== undefined &&
      sibling.bodyData.ascendingNode !== undefined;
    }
    );

    for (const sibling of samePeriodBodies) {
      const argDiff = Math.abs(body.bodyData.argOfPeriapsis! - sibling.bodyData.argOfPeriapsis!);
      const nodeDiff = Math.abs((body.bodyData.ascendingNode || 0) - (sibling.bodyData.ascendingNode || 0));

      if (argDiff < 5 && nodeDiff < 5) {
        if (body.bodyData.semiMajorAxis! < sibling.bodyData.semiMajorAxis!) {
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

    const bodyValue = this.body();
    if (!bodyValue.parent || !bodyValue.bodyData.orbitalPeriod || !bodyValue.bodyData.semiMajorAxis ||
      bodyValue.bodyData.argOfPeriapsis === undefined) {
      return;
    }

    const rosetteGroup = bodyValue.parent.subBodies.filter(sibling => {
      const body = this.body();
      return sibling.bodyData.orbitalPeriod === body.bodyData.orbitalPeriod &&
      sibling.bodyData.semiMajorAxis === body.bodyData.semiMajorAxis &&
      sibling.bodyData.argOfPeriapsis !== undefined;
    }
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
    return this.cachedJetConeAngle;
  }

  private computeJetConeAngle(): number | null {
    // Only apply to neutron stars with the required inputs.
    const bodyData = this.body().bodyData;
    if (bodyData.type !== BODY_TYPE.Star || !bodyData.subType?.includes('Neutron Star')) {
      return null;
    }
    return this.stellarPhysics.jetConeAngle(bodyData.rotationalPeriod, bodyData.solarRadius, bodyData.age);
  }

  private calculateNextPeriapsis(): { date: Date, days: number } | null {
    const body = this.body();
    if (!body.bodyData.meanAnomaly || !body.bodyData.orbitalPeriod ||
      !body.bodyData.timestamps?.meanAnomaly ||
      !body.bodyData.orbitalEccentricity || body.bodyData.orbitalEccentricity === 0) {
      return null;
    }

    const timestampMs = new Date(body.bodyData.timestamps.meanAnomaly).getTime();
    const elapsedDays = (Date.now() - timestampMs) / (1000 * 60 * 60 * 24);
    const orbitalCycles = elapsedDays / body.bodyData.orbitalPeriod;
    const currentMeanAnomaly = (body.bodyData.meanAnomaly + (orbitalCycles * 360)) % 360;

    const degreesToPeriapsis = (360 - currentMeanAnomaly) % 360;
    const daysToEvent = (degreesToPeriapsis / 360) * body.bodyData.orbitalPeriod;
    const eventDate = new Date(Date.now() + (daysToEvent * 24 * 60 * 60 * 1000));

    return { date: eventDate, days: daysToEvent };
  }

  private calculateNextApoapsis(): { date: Date, days: number } | null {
    const body = this.body();
    if (!body.bodyData.meanAnomaly || !body.bodyData.orbitalPeriod ||
      !body.bodyData.timestamps?.meanAnomaly ||
      !body.bodyData.orbitalEccentricity || body.bodyData.orbitalEccentricity === 0) {
      return null;
    }

    const timestampMs = new Date(body.bodyData.timestamps.meanAnomaly).getTime();
    const elapsedDays = (Date.now() - timestampMs) / (1000 * 60 * 60 * 24);
    const orbitalCycles = elapsedDays / body.bodyData.orbitalPeriod;
    const currentMeanAnomaly = (body.bodyData.meanAnomaly + (orbitalCycles * 360)) % 360;

    let degreesToApoapsis = (180 - currentMeanAnomaly) % 360;
    if (degreesToApoapsis < 0) degreesToApoapsis += 360;
    const daysToEvent = (degreesToApoapsis / 360) * body.bodyData.orbitalPeriod;
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
    const body = this.body();
    if (!body.bodyData.materials) {
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

    this.cachedMaterialBadges = Object.entries(body.bodyData.materials)
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
    return this.physics.rocheExcess(this.body());
  }

  public tidalLockDialogData: any = null;
  public onFootSafetyDialogData: any = null;

  private getLookupSource(
    subType: string | null | undefined,
    atmosphereType: string | null | undefined,
    surfacePressure: number | null | undefined,
  ): string {
    const st = subType?.trim() || null;
    const at = atmosphereType?.trim() || null;
    if (st && at && DELTA_BY_SUBTYPE_ATMOSPHERE[`${st}|${at}`]) {
      return `SubType + Atmosphere (${st} / ${at})`;
    }
    const noAtm = (surfacePressure != null && surfacePressure === 0) || at === 'nan';
    if (noAtm && st && DELTA_BY_SUBTYPE_NO_ATM[st]) return `SubType + No Atmosphere (${st})`;
    if (st && DELTA_BY_SUBTYPE[st]) return `SubType (${st})`;
    if (at && DELTA_BY_ATMOSPHERE[at]) return `Atmosphere type (${at})`;
    if (surfacePressure != null) {
      let pc = '';
      if (surfacePressure === 0) pc = 'None';
      else if (surfacePressure < 0.01) pc = 'Trace';
      else if (surfacePressure < 0.1) pc = 'Thin';
      if (pc && DELTA_BY_PRESSURE[pc]) return `Pressure class (${pc})`;
    }
    return 'Global fallback';
  }

  private getLookupDelta(
    subType: string | null | undefined,
    atmosphereType: string | null | undefined,
    surfacePressure: number | null | undefined,
  ): TempDelta {
    const st = subType?.trim() || null;
    const at = atmosphereType?.trim() || null;
    if (st && at) {
      const row = DELTA_BY_SUBTYPE_ATMOSPHERE[`${st}|${at}`];
      if (row) return row;
    }
    const noAtm = (surfacePressure != null && surfacePressure === 0) || at === 'nan';
    if (noAtm && st) {
      const row = DELTA_BY_SUBTYPE_NO_ATM[st];
      if (row) return row;
    }
    if (st) {
      const row = DELTA_BY_SUBTYPE[st];
      if (row) return row;
    }
    if (at) {
      const row = DELTA_BY_ATMOSPHERE[at];
      if (row) return row;
    }
    if (surfacePressure != null) {
      let pc = '';
      if (surfacePressure === 0) pc = 'None';
      else if (surfacePressure < 0.01) pc = 'Trace';
      else if (surfacePressure < 0.1) pc = 'Thin';
      if (pc && DELTA_BY_PRESSURE[pc]) return DELTA_BY_PRESSURE[pc];
    }
    return DELTA_GLOBAL;
  }

  public showOnFootSafetyDialog(): void {
    const bd = this.body().bodyData;
    const surfTemp = bd.surfaceTemperature ?? null;
    const estRange = surfTemp ? estimateTempRange(surfTemp, bd.subType, bd.atmosphereType, bd.surfacePressure) : null;
    const delta = this.getLookupDelta(bd.subType, bd.atmosphereType, bd.surfacePressure);
    this.onFootSafetyDialogData = {
      bodyName: bd.name,
      subType: bd.subType,
      atmosphereType: bd.atmosphereType || null,
      surfacePressure: bd.surfacePressure ?? null,
      surfaceTemperature: surfTemp,
      gravity: bd.gravity ?? null,
      estimatedMin: estRange?.min ?? null,
      estimatedMax: estRange?.max ?? null,
      badgeClass: this.getLandableBadgeClass(),
      lookupSource: this.getLookupSource(bd.subType, bd.atmosphereType, bd.surfacePressure),
      p5Delta: delta.p5,
      p95Delta: delta.p95,
    };
    const dialogRef = this.dialog.open(this.onFootSafetyDialogTemplate(), {
      width: '650px',
      maxWidth: '90vw',
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop'
    });
    dialogRef.afterOpened().subscribe(() => {
      setTimeout(() => {
        const container = document.querySelector('.on-foot-safety-dialog .mat-mdc-dialog-content, .on-foot-safety-dialog mat-dialog-content');
        if (container) container.scrollTop = 0;
      });
    });
  }

  public downloadOnFootReferenceData(): void {
    const rows: string[] = ['Source,SubType,AtmosphereType,p5_delta_K,p95_delta_K'];
    for (const key of Object.keys(DELTA_BY_SUBTYPE_ATMOSPHERE)) {
      const [st, at] = key.split('|');
      const d = DELTA_BY_SUBTYPE_ATMOSPHERE[key];
      rows.push(`subtype+atmosphere,"${st}","${at}",${d.p5},${d.p95}`);
    }
    for (const st of Object.keys(DELTA_BY_SUBTYPE_NO_ATM)) {
      const d = DELTA_BY_SUBTYPE_NO_ATM[st];
      rows.push(`subtype+no-atmosphere,"${st}","No atmosphere",${d.p5},${d.p95}`);
    }
    for (const st of Object.keys(DELTA_BY_SUBTYPE)) {
      const d = DELTA_BY_SUBTYPE[st];
      rows.push(`subtype,"${st}",,${d.p5},${d.p95}`);
    }
    for (const at of Object.keys(DELTA_BY_ATMOSPHERE)) {
      const d = DELTA_BY_ATMOSPHERE[at];
      rows.push(`atmosphere,,"${at}",${d.p5},${d.p95}`);
    }
    for (const pc of Object.keys(DELTA_BY_PRESSURE)) {
      const d = DELTA_BY_PRESSURE[pc];
      rows.push(`pressure_class,,"${pc} pressure",${d.p5},${d.p95}`);
    }
    rows.push(`global,,,${DELTA_GLOBAL.p5},${DELTA_GLOBAL.p95}`);
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'on-foot-temperature-reference.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  public showJetAngleDialog(): void {
    // Generate the chart image for the dialog and then open it
    try {
      this.jetAngleChartDataUrl = this.generateJetAngleChart();
    } catch {
      // If chart generation fails, clear URL and still open dialog
      this.jetAngleChartDataUrl = null;
    }

    this.dialog.open(this.jetAngleDialogTemplate(), {
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
    return this.stellarPhysics.jetConeAngleFromSeconds(rotSeconds, solarRadius, age);
  }

  public showTidalLockDialog(): void {
    const rot = this.body().bodyData.rotationalPeriod;
    const orb = this.body().bodyData.orbitalPeriod;
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
      resonance,
      tidallyLocked: !!this.body().bodyData.rotationalPeriodTidallyLocked
    };
    const dialogRef = this.dialog.open(this.tidalLockDialogTemplate(), {
      width: '600px',
      maxWidth: '90vw',
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop'
    });
    dialogRef.afterOpened().subscribe(() => {
      setTimeout(() => {
        const container = document.querySelector('.tidal-lock-dialog .mat-mdc-dialog-content, .tidal-lock-dialog mat-dialog-content');
        if (container) container.scrollTop = 0;
      });
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