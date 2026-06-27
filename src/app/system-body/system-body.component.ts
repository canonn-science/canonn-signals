import { estimateTempRange, isTempSafe, lookupTempDelta } from '../data/temperature-estimation';
import { Component, OnChanges, ChangeDetectionStrategy, SimpleChanges, input, viewChildren, inject, afterNextRender, signal, effect, untracked } from '@angular/core';
import { SystemBody, EdGalaxyData } from '../home/home.component';
import { faCircleChevronRight, faCircleQuestion, faInfo, faSquareCaretDown, faSquareCaretUp, faUpRightFromSquare, faCode, faLock, faLink } from '@fortawesome/free-solid-svg-icons';
import { AppService, CanonnCodexEntry } from '../app.service';
import { BodyImage } from '../data/body-images';
import { MINING_RESOURCES } from '../data/mining-resources';
import { MatTooltip } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { DecimalPipe, DatePipe } from '@angular/common';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ClickableDirective } from '../clickable.directive';
import { BodyPhysicsService, RingDynamics, ShepherdingHillLimit, BodyRocheLimits, PlanetaryDensity, SPEED_OF_LIGHT } from '../data/body-physics.service';
import { StellarPhysicsService } from '../data/stellar-physics.service';
import { OrbitalRelationsService } from '../data/orbital-relations.service';
import { RocheChartData, HillChartData } from '../data/chart-rendering.service';
import { BODY_TYPE } from '../data/body-types';
import { WHITE_DWARF_CLASSES, whiteDwarfSpectralCode, whiteDwarfSpectralTypeKey } from '../data/white-dwarf';
import { WhiteDwarfTypesDialogComponent, WhiteDwarfTypesDialogData } from '../dialogs/white-dwarf-types-dialog/white-dwarf-types-dialog.component';
import { MATERIAL_DATA } from '../data/materials';
import { GENUS_NAMES } from '../data/genus';
import { OrbitalDiagramDialogComponent, OrbitalDiagramType, OrbitElements } from '../dialogs/orbital-diagram-dialog/orbital-diagram-dialog.component';
import { TidalLockDialogComponent, TidalLockDialogData } from '../dialogs/tidal-lock-dialog/tidal-lock-dialog.component';
import { HrDiagramDialogComponent } from '../dialogs/hr-diagram-dialog/hr-diagram-dialog.component';
import { HillLimitDialogComponent } from '../dialogs/hill-limit-dialog/hill-limit-dialog.component';
import { RocheLimitDialogComponent } from '../dialogs/roche-limit-dialog/roche-limit-dialog.component';
import { InvisibleRingDialogComponent, InvisibleRingDialogData } from '../dialogs/invisible-ring-dialog/invisible-ring-dialog.component';
import { ApoPeriDialogComponent, ApoPeriDialogData } from '../dialogs/apo-peri-dialog/apo-peri-dialog.component';
import { JetAngleDialogComponent } from '../dialogs/jet-angle-dialog/jet-angle-dialog.component';
import { JsonDialogComponent, JsonDialogData, formatBodyJson } from '../dialogs/json-dialog/json-dialog.component';
import { OnFootSafetyDialogComponent, OnFootSafetyDialogData } from '../dialogs/on-foot-safety-dialog/on-foot-safety-dialog.component';
import { StellarAgeAssessment, assessStellarAge, isPlottableStarClass } from '../data/stellar-reference';

@Component({
  selector: 'app-system-body',
  templateUrl: './system-body.component.html',
  styleUrls: ['./system-body.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FaIconComponent, MatTooltip, DecimalPipe, DatePipe, ClickableDirective]
})
export class SystemBodyComponent implements OnChanges {
  private readonly appService = inject(AppService);
  private readonly dialog = inject(MatDialog);
  private readonly physics = inject(BodyPhysicsService);
  private readonly stellarPhysics = inject(StellarPhysicsService);
  private readonly orbitalRelations = inject(OrbitalRelationsService);

  // Expose Math.abs for template use
  abs(value: number): number {
    return Math.abs(value);
  }
  public readonly faChevronRight = faCircleChevronRight;
  public readonly faCircleQuestion = faCircleQuestion;
  public readonly faInfo = faInfo;
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
  public readonly expanded = signal(false);

  public hoveredIndex: number = -1;

  public formattedEarthMass: { display: string; tooltip: string } | null = null;
  public formattedSolarMass: { display: string; tooltip: string } | null = null;

  // Cache for expensive computed properties
  public readonly getMaterialBadges = signal<{ name: string, class: string, tooltip: string }[]>([]);
  public readonly getHotspotsList = signal<{ displayName: string; count: number; wikiUrl: string; description: string }[]>([]);
  public readonly cachedSurfacePressureTooltip = signal('');
  public readonly getAtmosphereDisplay = signal('');
  public readonly getSolidCompositionTooltip = signal('');
  public readonly getRingResourceTypes = signal<Set<string>>(new Set());
  // Cached values for template bindings that are read multiple times per render.
  public readonly getJetConeAngle = signal<number | null>(null);
  public readonly getSpinResonance = signal('none');
  public readonly getConfirmedBiologyCount = signal(0);
  // Orbit/ring geometry and physics-service results, computed once per body change
  // rather than on every change-detection pass (several are bound multiple times).
  public readonly getApoapsis = signal(0);
  public readonly getPeriapsis = signal(0);
  public readonly getRingWidth = signal(0);
  public readonly getRingArea = signal(0);
  public readonly getRingDensity = signal(0);
  public readonly isRingNotVisible = signal(false);
  public readonly getRingOrbitalPeriod = signal<number | null>(null);
  public readonly getRingOrbitalPeriodDisplay = signal('');
  public readonly getRingOrbitalPeriodTooltip = signal('');
  public readonly getRingMinVelocity = signal<number | null>(null);
  public readonly getRingMinVelocityDisplay = signal('');
  public readonly getRingMinVelocityTooltip = signal('');
  public readonly getRingMaxVelocity = signal<number | null>(null);
  public readonly getRingMaxVelocityDisplay = signal('');
  public readonly getRingMaxVelocityTooltip = signal('');
  public readonly getRingNeighbourDistance = signal<number | null>(null);
  public readonly getRingNeighbourDistanceLabel = signal('');
  public readonly getRingVelocityDiff = signal<number | null>(null);
  public readonly getRingVelocityDiffDisplay = signal('');
  public readonly getRingVelocityDiffTooltip = signal('');
  public readonly isRacingRings = signal(false);
  public readonly racingRingsTooltip = signal('');
  public readonly getPlanetaryDensity = signal<PlanetaryDensity | null>(null);
  public readonly calculateRigidRocheLimit = signal<number | null>(null);
  public readonly calculateFluidRocheLimit = signal<number | null>(null);
  public readonly calculateBodyRocheLimits = signal<BodyRocheLimits | null>(null);
  public readonly calculateShepherdingHillLimit = signal<ShepherdingHillLimit | null>(null);
  public readonly isActualShepherd = signal(false);
  public readonly isShepherdingCandidate = signal(false);
  public readonly isBodyWithinParentRings = signal(false);
  public readonly getSignalsCount = signal(0);
  public readonly getAtmosphereCompositionTooltip = signal('');
  public readonly getSpinResonanceTooltip = signal('');
  public readonly getTangentialVelocity = signal<number | null>(null);
  public readonly getTangentialVelocityDisplay = signal('');
  public readonly getTangentialVelocityTooltip = signal('');
  public readonly classifyNeutronStar = signal<string | null>(null);
  public readonly getSchwarzschildRadius = signal<number | null>(null);
  public readonly getMassStabilityAlert = signal<string | null>(null);
  public getBodyDisplayName(bodyName: string): string {
    return this.appService.getBodyDisplayName(bodyName);
  }

  public readonly bodyLinkCopied = signal(false);

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
    navigator.clipboard?.writeText(url)
      .then(() => {
        this.bodyLinkCopied.set(true);
        setTimeout(() => this.bodyLinkCopied.set(false), 1500);
      })
      .catch(() => { /* clipboard unavailable */ });
  }

  public ngOnChanges(changes?: SimpleChanges): void {
    const body = this.body();
    if (!body) {
      return;
    }

    const trojan = this.orbitalRelations.detectTrojanStatus(body);
    this.trojanStatus = trojan.lagrangePoint;
    this.trojanHostStatus = trojan.isHost;
    this.rosetteStatus = this.orbitalRelations.detectRosetteStatus(body);
    this.getNextPeriapsis.set(this.calculateNextPeriapsis());
    this.getNextApoapsis.set(this.calculateNextApoapsis());
    this.getRocheExcess.set(this.calculateRocheExcess());
    this.getStellarAgeAssessment.set(this.computeStellarAgeAssessment());

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
      // `?? 0`: a present `signals` map that simply lacks a given key returns `undefined`,
      // which would land in these `number`-typed fields. Coalesce so they stay numeric.
      const signalCounts = body.bodyData.signals.signals;
      this.humanSignalCount = signalCounts?.['$SAA_SignalType_Human;'] ?? 0;
      this.otherSignalCount = signalCounts?.['$SAA_SignalType_Other;'] ?? 0;
      this.geologySignalCount = signalCounts?.['$SAA_SignalType_Geological;'] ?? 0;
      this.biologySignalCount = signalCounts?.['$SAA_SignalType_Biological;'] ?? 0;
      this.thargoidSignalCount = signalCounts?.['$SAA_SignalType_Thargoid;'] ?? 0;
      this.guardianSignalCount = signalCounts?.['$SAA_SignalType_Guardian;'] ?? 0;
      this.geologySignals = body.bodyData.signals.geology ?? [];
      this.thargoidSignals = body.bodyData.signals.thargoid ?? [];
      this.guardianSignals = body.bodyData.signals.guardian ?? [];
      this.biologySignals = [];
      if (body.bodyData.signals.biology) {
        for (const biologySignal of body.bodyData.signals.biology) {
          const codexEntry = this.codex?.find(c => c.english_name === biologySignal);
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
          const codexEntry = this.codex?.find(c => c.english_name === guessedSignal);
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
          const genusName = GENUS_NAMES[genusSiggnal] ?? genusSiggnal;
          if (this.biologySignals.findIndex(b => b.signal.includes(genusName)) !== -1) {
            continue;
          }
          const codexEntry = this.codex?.find(c => c.category === genusName);
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
    if (this.expanded() === false) {
      const isInteresting = this.hasSignals ||
        body.bodyData.subType === 'Earth-like world' ||
        body.bodyData.subType === 'Water world' ||
        body.bodyData.subType === 'Ammonia world' ||
        body.bodyData.subType?.includes('Black Hole') ||
        body.bodyData.subType === 'Neutron Star' ||
        body.bodyData.subType?.includes('White Dwarf') ||
        body.bodyData.subType?.includes('Wolf-Rayet') ||
        body.bodyData.subType?.includes('Herbig') ||
        !!body.bodyData.isLandable;
      this.expanded.set(this.forceExpanded() || isInteresting || this.containsAnchorBody(body));
    }

    if (this.isRoot()) {
      this.styleClass = "";
    }
    else if (!this.isLast()) {
      if (!this.expanded()) {
        this.styleClass = "child-container-title-only";
      }
      else {
        this.styleClass = "child-container-default";
      }
    }
    else {
      if (!this.expanded()) {
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
    this.getSpinResonance.set(this.computeSpinResonance());
    this.getJetConeAngle.set(this.computeJetConeAngle());
    this.getConfirmedBiologyCount.set(this.biologySignals.filter(b => !b.isGuess).length);
    this.getAtmosphereDisplay.set(this.computeAtmosphereDisplay());
    this.getSolidCompositionTooltip.set(this.computeSolidCompositionTooltip());
    this.computeLandableAndTemp();
    this.computeDerivedPhysics();
  }

  /**
   * Computes the orbit/ring geometry and physics-service results that the template
   * reads (several of them multiple times). Runs once per body change from
   * ngOnChanges so these relatively expensive lookups don't repeat on every
   * change-detection pass.
   */
  private computeDerivedPhysics(): void {
    const body = this.body();
    const bd = body.bodyData;

    // Orbit extents (km).
    const semiMajorAxisKm = (bd.semiMajorAxis ?? 0) * 149597870.7;
    const eccentricity = bd.orbitalEccentricity ?? 0;
    this.getApoapsis.set(semiMajorAxisKm * (1 + eccentricity));
    this.getPeriapsis.set(semiMajorAxisKm * (1 - eccentricity));

    // Ring geometry.
    const outer = bd.outerRadius ?? 0;
    const inner = bd.innerRadius ?? 0;
    this.getRingWidth.set(outer - inner);
    this.getRingArea.set(Math.PI * (outer * outer - inner * inner));
    this.getRingDensity.set(this.getRingArea() > 0 ? (bd.mass ?? 0) / this.getRingArea() : 0);
    this.isRingNotVisible.set(bd.type === BODY_TYPE.Ring
      && this.getRingDensity() < 0.1 && this.getRingWidth() > 1000000);

    // Ring dynamics: orbital period and max velocity (Kepler math lives in the service).
    this.applyRingDynamics(this.physics.ringDynamics(body));

    // Distance to the next ring/belt sibling (by innerRadius order).
    const { distance: neighbourDist, label: neighbourLabel, velocityDiff, eitherRingInvisible } = this.computeRingNeighbourDistance(body);
    this.getRingNeighbourDistance.set(neighbourDist);
    this.getRingNeighbourDistanceLabel.set(neighbourLabel);
    this.getRingVelocityDiff.set(velocityDiff);
    this.getRingVelocityDiffDisplay.set(velocityDiff !== null ? this.formatVelocityKms(velocityDiff) : '');
    this.getRingVelocityDiffTooltip.set(velocityDiff !== null ? `${velocityDiff.toFixed(3)} km/s` : '');

    // Racing Rings badge: inner ring gap < 50 km AND velocity difference > 5 km/s,
    // and neither ring in the pair is invisible.
    const racingRings = neighbourDist !== null && velocityDiff !== null
      && neighbourDist < 50 && velocityDiff > 5 && !eitherRingInvisible;
    this.isRacingRings.set(racingRings);
    if (racingRings) {
      const dashIdx = neighbourLabel.indexOf('-');
      const innerLabel = dashIdx >= 0 ? neighbourLabel.slice(0, dashIdx) : neighbourLabel;
      const outerLabel = dashIdx >= 0 ? neighbourLabel.slice(dashIdx + 1) : '';
      this.racingRingsTooltip.set(
        `Ring ${innerLabel} and Ring ${outerLabel} pass within ${neighbourDist!.toFixed(0)} km with a speed differential of ${velocityDiff!.toFixed(1)} km/s`,
      );
    } else {
      this.racingRingsTooltip.set('');
    }

    // Physics-service delegations.
    this.getPlanetaryDensity.set(this.physics.getPlanetaryDensity(bd));
    this.calculateRigidRocheLimit.set(this.physics.calculateRigidRocheLimit(body));
    this.calculateFluidRocheLimit.set(this.physics.calculateFluidRocheLimit(body));
    this.calculateBodyRocheLimits.set(this.physics.calculateBodyRocheLimits(body));
    this.calculateShepherdingHillLimit.set(this.physics.calculateShepherdingHillLimit(body));
    this.isShepherdingCandidate.set(this.physics.isShepherdingCandidate(body));
    this.isActualShepherd.set(this.physics.isActualShepherd(body));
    this.isBodyWithinParentRings.set(this.physics.isBodyWithinParentRings(body));

    // Signals and tooltips.
    this.getSignalsCount.set(this.computeSignalsCount());
    this.getAtmosphereCompositionTooltip.set(this.computeAtmosphereCompositionTooltip());
    this.getSpinResonanceTooltip.set(this.computeSpinResonanceTooltip());

    // Neutron-star / black-hole derived values.
    this.classifyNeutronStar.set(this.computeClassifyNeutronStar());
    this.getSchwarzschildRadius.set(this.computeSchwarzschildRadius());
    this.getMassStabilityAlert.set(this.physics.massStabilityAlert(bd.subType, bd.solarMasses));
    this.getTangentialVelocity.set(this.computeTangentialVelocity());
    this.getTangentialVelocityDisplay.set(this.computeTangentialVelocityDisplay());
    this.getTangentialVelocityTooltip.set(this.computeTangentialVelocityTooltip());
  }

  public toggleExpand(): void {
    this.expanded.set(!this.expanded());
    // Update cached state
    this.updateChildrenExpandedState();
  }

  /**
   * Sets this body's expanded state. Exposed so an ancestor's "expand/collapse all"
   * can drive descendants; the signal write schedules each child's re-render even
   * though the change originates from the ancestor's event handler.
   */
  public setExpandedState(expanded: boolean): void {
    this.expanded.set(expanded);
  }

  public toggleChildren(): void {
    const childArray = this.childComponents();
    const anyChildExpanded = childArray.some(child => child.expanded());
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

    // Update cached state (the signal write schedules change detection).
    this.updateChildrenExpandedState();
  }

  public hasChildren(): boolean {
    const body = this.body();
    return body.subBodies && body.subBodies.length > 0;
  }


  public getEccentricityAnalysis(eccentricity: number): string {
    if (eccentricity === 0) return 'Circular';
    if (eccentricity < 0.4) return 'Nearly Circular';
    if (eccentricity < 0.8) return 'Eccentric';
    return 'Highly Eccentric';
  }


  private computeAtmosphereCompositionTooltip(): string {
    const body = this.body();
    if (body.bodyData.atmosphereComposition) {
      return Object.entries(body.bodyData.atmosphereComposition)
        .map(([gas, percentage]) => `${gas}: ${percentage.toFixed(2)}%`)
        .join('\n');
    }
    const spectralCode = whiteDwarfSpectralCode(body.bodyData.subType);
    if (spectralCode) {
      return WHITE_DWARF_CLASSES[spectralCode]?.tooltip ?? '';
    }
    return '';
  }

  public getWhiteDwarfAtmosphere(): string | null {
    const spectralCode = whiteDwarfSpectralCode(this.body().bodyData.subType);
    if (!spectralCode) { return null; }
    return WHITE_DWARF_CLASSES[spectralCode]?.atmosphere ?? null;
  }

  /** Spectral code of this body if it is a white dwarf (e.g. `DA`), otherwise null. */
  public getWhiteDwarfSpectralCode(): string | null {
    return whiteDwarfSpectralCode(this.body().bodyData.subType);
  }

  /** Opens the white-dwarf spectral-type reference modal, highlighting this star's type. */
  public showWhiteDwarfSpectralDialog(): void {
    const code = this.getWhiteDwarfSpectralCode();
    if (!code) { return; }
    this.dialog.open<WhiteDwarfTypesDialogComponent, WhiteDwarfTypesDialogData>(WhiteDwarfTypesDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      data: { typeKey: whiteDwarfSpectralTypeKey(code) },
    });
  }


  private computeAtmosphereDisplay(): string {
    const body = this.body();
    if (body.bodyData.atmosphereType) {
      return body.bodyData.atmosphereType;
    }
    if (body.bodyData.atmosphereComposition) {
      const entries = Object.entries(body.bodyData.atmosphereComposition);
      if (entries.length > 0) {
        const largest = entries
          .reduce((max, [gas, percentage]) => percentage > max[1] ? [gas, percentage] : max);
        return `${largest[0]} ${largest[1].toFixed(2)}%`;
      }
    }
    return this.getWhiteDwarfAtmosphere() ?? '';
  }







  public radToDeg(value: number | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    return value * 180 / Math.PI;
  }

  /**
   * Opens the orbital-diagram modal for one of the body's orientation angles.
   * Axial tilt is stored in radians, so it is converted to degrees here; orbital
   * inclination and argument of periapsis are already in degrees.
   */
  public showOrbitalDiagram(type: OrbitalDiagramType): void {
    const bodyData = this.body().bodyData;
    let degrees: number | null | undefined;
    switch (type) {
      case 'tilt':
        degrees = this.radToDeg(bodyData.axialTilt);
        break;
      case 'inclination':
        degrees = bodyData.orbitalInclination;
        break;
      case 'periapsis':
        degrees = bodyData.argOfPeriapsis;
        break;
    }
    if (degrees === null || degrees === undefined) return;

    const body = this.body();
    const bodyName = this.getBodyDisplayName(bodyData.name);
    const parentName = body.parent ? this.getBodyDisplayName(body.parent.bodyData.name) : undefined;

    // For the inclination diagram, hand the dialog the Keplerian elements so it can place
    // the body at its live position along the orbit (it propagates the mean anomaly to the
    // current time itself). Omitted when the telemetry needed for that is missing.
    let orbit: OrbitElements | undefined;
    if (type === 'inclination' && bodyData.meanAnomaly != null && bodyData.orbitalPeriod && bodyData.timestamps?.meanAnomaly) {
      orbit = {
        meanAnomalyDeg: bodyData.meanAnomaly,
        orbitalPeriodDays: bodyData.orbitalPeriod,
        meanAnomalyTimestamp: bodyData.timestamps.meanAnomaly,
        eccentricity: bodyData.orbitalEccentricity ?? 0,
        argOfPeriapsisDeg: bodyData.argOfPeriapsis ?? 0,
      };
    }

    this.dialog.open(OrbitalDiagramDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      autoFocus: 'first-heading',
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop',
      data: { type, degrees, eccentricity: bodyData.orbitalEccentricity, bodyName, parentName, orbit },
    });
  }

  /**
   * Opens the Hertzsprung–Russell diagram modal for this star, plotting it by temperature
   * and absolute magnitude and comparing its age to the lifetime its class implies.
   */
  public showHrDiagram(): void {
    const body = this.body();
    const bodyData = body.bodyData;
    this.dialog.open(HrDiagramDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      autoFocus: 'first-heading',
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop',
      data: {
        bodyName: this.getBodyDisplayName(bodyData.name),
        subType: bodyData.subType,
        spectralClass: bodyData.spectralClass,
        luminosity: bodyData.luminosity,
        solarMasses: bodyData.solarMasses,
        solarRadius: bodyData.solarRadius,
        surfaceTemperature: bodyData.surfaceTemperature,
        absoluteMagnitude: bodyData.absoluteMagnitude,
        ageMyr: bodyData.age,
      },
    });
  }

  /**
   * True when the star-age / H-R feature applies: a star with an age whose spectral class
   * is one the diagram actually depicts (the main sequence O–M, including their giants).
   * Excludes brown dwarfs, white dwarfs, Wolf-Rayet/carbon stars, neutron stars and black
   * holes, none of which appear on the diagram.
   */
  public showStarAgeFeature(): boolean {
    const bodyData = this.body().bodyData;
    return bodyData.type === BODY_TYPE.Star
      && bodyData.age != null
      && isPlottableStarClass(bodyData.spectralClass, bodyData.subType);
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


  /**
   * The hotspot/signal map for this body: its own `signals.signals`, or — for a ring
   * body — the matching entry in the parent's `rings` array. Single source of truth for
   * the signal-count, hotspot-list and signal-tooltip lookups, which previously each
   * reimplemented this resolution.
   */
  private resolveSignalsMap(): { [key: string]: number } | undefined {
    const body = this.body();
    if (body.bodyData.signals?.signals) {
      return body.bodyData.signals.signals;
    }
    if (body.bodyData.type === BODY_TYPE.Ring && body.parent?.bodyData.rings) {
      const ringData = body.parent.bodyData.rings.find(r => r.name === body.bodyData.name);
      return ringData?.signals?.signals;
    }
    return undefined;
  }

  private computeSignalsCount(): number {
    const signals = this.resolveSignalsMap();
    return signals ? Object.keys(signals).length : 0;
  }

  private computeHotspotsList(): void {
    const signals = this.resolveSignalsMap();

    if (!signals) {
      this.getHotspotsList.set([]);
      return;
    }

    this.getHotspotsList.set(Object.entries(signals).map(([key, count]) => {
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
    }));
  }


  private computeRingResourceTypes(): void {
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

    this.getRingResourceTypes.set(types);
  }


  private computeSurfacePressureTooltip(): void {
    const p = this.body()?.bodyData?.surfacePressure;
    if (p === null || p === undefined) {
      this.cachedSurfacePressureTooltip.set('');
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

    this.cachedSurfacePressureTooltip.set(`${atmStr}\n${kPaStr}\n${paStr}\n${psiStr}`);
  }

  public trackByHotspot(index: number, hotspot: { displayName: string }): string {
    return hotspot.displayName;
  }










  private computeSolidCompositionTooltip(): string {
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

    // Codex reference data loads asynchronously. When it changes, refresh the
    // codex-dependent biology signals (recomputed in ngOnChanges). untracked()
    // stops the effect from also re-running on body() input changes — Angular's
    // own ngOnChanges already covers those.
    effect(() => {
      this.codex = this.appService.codexEntries();
      untracked(() => this.ngOnChanges());
    });
  }

  private updateChildrenExpandedState(): void {
    const childArray = this.childComponents();
    // The signal write schedules CD, so the collapse/expand-all toggle reflects the
    // new state under zoneless even when called from an after-render hook.
    this.getChildrenExpandedState.set(childArray.some(child => child.expanded()));
  }

  public trackByMaterial(index: number, material: { name: string, class: string, tooltip: string }): string {
    return material.name;
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

  public showBodyJsonDialog(): void {
    this.dialog.open(JsonDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      autoFocus: 'first-heading',
      restoreFocus: false,
      data: { body: this.body(), edGalaxyData: this.edGalaxyData() } satisfies JsonDialogData,
    });
  }

  /** Copies the body JSON to the clipboard (right-click shortcut on the JSON button). */
  public copyBodyJson(): void {
    navigator.clipboard?.writeText(formatBodyJson(this.body().bodyData))
      .catch(() => { /* clipboard unavailable */ });
  }

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

    this.dialog.open(InvisibleRingDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      autoFocus: 'first-heading',
      data: {
        ringName,
        innerRadius,
        outerRadius,
        width,
        area,
        mass,
        density,
        isInvisible,
      } satisfies InvisibleRingDialogData,
    });
  }

  /** Opens the Roche-limit chart dialog with the prepared chart data. */
  private openRocheLimitDialog(data: RocheChartData): void {
    this.dialog.open(RocheLimitDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      autoFocus: 'first-heading',
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop',
      data,
    });
  }

  public showRocheLimitChart(): void {
    const body = this.body();
    if (!body.parent || body.bodyData.type !== BODY_TYPE.Ring) {
      return;
    }

    const parent = body.parent.bodyData;

    const primary = this.physics.getParentRadiusAndDensity(body);
    if (!primary) {
      return;
    }
    const { primaryRadius } = primary;
    const { densityRange, rigidLimits, fluidLimits } =
      this.physics.rocheLimitCurves(primary.primaryRadius, primary.primaryDensity);

    // Get only the current ring
    const currentRing = {
      name: body.bodyData.name,
      innerRadius: body.bodyData.innerRadius || 0, // Already in km
      outerRadius: body.bodyData.outerRadius || 0, // Already in km
      type: body.bodyData.subType,
      density: this.physics.ringSatelliteDensityKgM3(body.bodyData.subType)
    };

    this.openRocheLimitDialog({
      parentName: parent.name,
      ringName: body.bodyData.name,
      densityRange,
      rigidLimits,
      fluidLimits,
      rings: [currentRing],
      primaryRadius,
      isBody: false
    });
  }

  public showBodyRocheLimitChart(): void {
    const rocheLimits = this.calculateBodyRocheLimits();
    const body = this.body();
    if (!rocheLimits || !body.parent) {
      return;
    }

    const parent = body.parent.bodyData;

    const primary = this.physics.getParentRadiusAndDensity(body);
    if (!primary) {
      return;
    }
    const { primaryRadius } = primary;

    // Calculate body density
    const bodyMassKg = body.bodyData.earthMasses! * 5.972e24;
    const bodyRadiusM = body.bodyData.radius! * 1000;
    const bodyVolume = (4 / 3) * Math.PI * Math.pow(bodyRadiusM, 3);
    const bodyDensity = bodyMassKg / bodyVolume;

    const { densityRange, rigidLimits, fluidLimits } =
      this.physics.rocheLimitCurves(primary.primaryRadius, primary.primaryDensity);

    // Create a "ring" representation using periapsis/apoapsis with body radius
    const bodyRadius = body.bodyData.radius!; // in km
    const bodyRing = {
      name: body.bodyData.name,
      innerRadius: rocheLimits.periapsis - bodyRadius,
      outerRadius: rocheLimits.apoapsis + bodyRadius,
      type: 'Body Orbit',
      density: bodyDensity
    };

    this.openRocheLimitDialog({
      parentName: parent.name,
      ringName: body.bodyData.name,
      densityRange,
      rigidLimits,
      fluidLimits,
      rings: [bodyRing],
      primaryRadius,
      isBody: true
    });
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
      currentMeanAnomaly = this.orbitalRelations.meanAnomalyNow(meanAnomaly, orbitalPeriod, body.bodyData.timestamps.meanAnomaly);
      degreesToEvent = this.orbitalRelations.degreesToEvent(currentMeanAnomaly, type);
    }

    this.dialog.open(ApoPeriDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      autoFocus: 'first-heading',
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop',
      data: {
        type,
        date: data.date,
        days: data.days,
        distanceKm,
        meanAnomaly,
        orbitalPeriod,
        timestamp,
        currentMeanAnomaly,
        degreesToEvent
      } satisfies ApoPeriDialogData,
    });
  }

  public showShepherdingHillLimitChart(): void {
    const hillData = this.calculateShepherdingHillLimit();
    const body = this.body();
    if (!hillData || !body.parent) {
      return;
    }

    const parent = body.parent.bodyData;

    // Get parent radius (km), preferring an explicit radius over a solar-radius conversion.
    const parentRadius = this.stellarPhysics.radiusKm(parent.radius, parent.solarRadius);
    if (parentRadius === null) {
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

    // Prepare dialog data — tri-state shepherd status from the single source of
    // truth in BodyPhysicsService (shared with the isActualShepherd badge).
    const shepherdStatus = this.physics.shepherdStatus(hillData);

    this.dialog.open(HillLimitDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      autoFocus: 'first-heading',
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop',
      data: {
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
      } satisfies HillChartData,
    });
  }

  private computeSpinResonance(): string {
    const bodyData = this.body().bodyData;
    return this.stellarPhysics.spinResonance(bodyData.rotationalPeriod, bodyData.orbitalPeriod);
  }

  private computeSpinResonanceTooltip(): string {
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

  private computeTangentialVelocity(): number | null {
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

  private computeTangentialVelocityDisplay(): string {
    const velocityKms = this.getTangentialVelocity();
    if (velocityKms === null) return '';

    const velocityMs = velocityKms * 1000;
    const fractionOfC = velocityMs / SPEED_OF_LIGHT;

    if (fractionOfC >= 0.01) {
      return `${fractionOfC.toFixed(3)}c`;
    }

    return `${velocityKms.toFixed(0)} km/s`;
  }

  private computeTangentialVelocityTooltip(): string {
    const velocityKms = this.getTangentialVelocity();
    if (velocityKms === null) return '';

    return `${velocityKms.toFixed(3)} km/s`;
  }

  public isBlackHoleOrNeutronStar(): boolean {
    const body = this.body();
    return body.bodyData.type === BODY_TYPE.Star &&
      (body.bodyData.subType?.includes('Black Hole') ||
        body.bodyData.subType === 'Neutron Star') === true;
  }

  /** Physical radius in km for compact objects (neutron stars, black holes), whose solar-radius is too small to read; null otherwise. */
  public getCompactObjectRadiusKm(): number | null {
    if (!this.isBlackHoleOrNeutronStar()) { return null; }
    const bd = this.body().bodyData;
    return this.stellarPhysics.radiusKm(bd.radius, bd.solarRadius);
  }

  private isInvisibleRing(bd: CanonnBiostatsBody): boolean {
    if (bd.type !== BODY_TYPE.Ring) { return false; }
    const outer = bd.outerRadius ?? 0;
    const inner = bd.innerRadius ?? 0;
    const width = outer - inner;
    const area = Math.PI * (outer * outer - inner * inner);
    const density = area > 0 ? (bd.mass ?? 0) / area : 0;
    return density < 0.1 && width > 1000000;
  }

  private computeRingNeighbourDistance(body: SystemBody): { distance: number | null; label: string; velocityDiff: number | null; eitherRingInvisible: boolean } {
    const bd = body.bodyData;
    if ((bd.type !== BODY_TYPE.Ring && bd.type !== BODY_TYPE.Belt) || !body.parent) {
      return { distance: null, label: '', velocityDiff: null, eitherRingInvisible: false };
    }
    const siblings = body.parent.subBodies
      .filter(s => s.bodyData.name.includes('Ring'))
      .sort((a, b) => (a.bodyData.innerRadius ?? 0) - (b.bodyData.innerRadius ?? 0));
    const idx = siblings.indexOf(body);
    if (idx < 0 || idx === siblings.length - 1) {
      return { distance: null, label: '', velocityDiff: null, eitherRingInvisible: false };
    }
    const next = siblings[idx + 1];
    const distance = (next.bodyData.innerRadius ?? 0) - (bd.outerRadius ?? 0);
    const thisLabel = bd.name.replace('Ring', '').trim();
    const nextLabel = next.bodyData.name.replace('Ring', '').trim();
    const currentDynamics = this.physics.ringDynamics(body);
    const nextDynamics = this.physics.ringDynamics(next);
    const velocityDiff = (currentDynamics !== null && nextDynamics !== null)
      ? currentDynamics.maxVelocityKms - nextDynamics.minVelocityKms
      : null;
    const eitherRingInvisible = this.isInvisibleRing(bd) || this.isInvisibleRing(next.bodyData);
    return { distance, label: `${thisLabel}-${nextLabel}`, velocityDiff, eitherRingInvisible };
  }

  private applyRingDynamics(dynamics: RingDynamics | null): void {
    if (dynamics) {
      this.getRingOrbitalPeriod.set(dynamics.orbitalPeriodDays);
      this.getRingOrbitalPeriodDisplay.set(this.formatPeriodDays(dynamics.orbitalPeriodDays));
      this.getRingOrbitalPeriodTooltip.set(`${dynamics.orbitalPeriodDays.toFixed(6)} days`);
      this.getRingMinVelocity.set(dynamics.minVelocityKms);
      this.getRingMinVelocityDisplay.set(this.formatVelocityKms(dynamics.minVelocityKms));
      this.getRingMinVelocityTooltip.set(`${dynamics.minVelocityKms.toFixed(3)} km/s`);
      this.getRingMaxVelocity.set(dynamics.maxVelocityKms);
      this.getRingMaxVelocityDisplay.set(this.formatVelocityKms(dynamics.maxVelocityKms));
      this.getRingMaxVelocityTooltip.set(`${dynamics.maxVelocityKms.toFixed(3)} km/s`);
    } else {
      this.getRingOrbitalPeriod.set(null);
      this.getRingOrbitalPeriodDisplay.set('');
      this.getRingOrbitalPeriodTooltip.set('');
      this.getRingMinVelocity.set(null);
      this.getRingMinVelocityDisplay.set('');
      this.getRingMinVelocityTooltip.set('');
      this.getRingMaxVelocity.set(null);
      this.getRingMaxVelocityDisplay.set('');
      this.getRingMaxVelocityTooltip.set('');
    }
  }

  private formatVelocityKms(velocityKms: number): string {
    const fractionOfC = velocityKms / (SPEED_OF_LIGHT / 1000);
    if (fractionOfC >= 0.01) {
      return `${fractionOfC.toFixed(3)}c`;
    }
    return `${velocityKms.toFixed(3)} km/s`;
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

  private computeClassifyNeutronStar(): string | null {
    const bd = this.body().bodyData;
    if (bd.type !== BODY_TYPE.Star || bd.subType !== 'Neutron Star') {
      return null;
    }
    return this.stellarPhysics.classifyNeutronStar(
      bd.solarMasses, bd.rotationalPeriod, bd.absoluteMagnitude,
    );
  }

  /** Schwarzschild radius (km) for black holes and neutron stars, or null for other bodies. */
  private computeSchwarzschildRadius(): number | null {
    const bd = this.body().bodyData;
    const isBlackHole = bd.subType?.includes('Black Hole');
    const isNeutronStar = bd.subType === 'Neutron Star';
    if (!isBlackHole && !isNeutronStar) { return null; }
    return this.physics.schwarzschildRadiusKm(bd.solarMasses);
  }

  /**
   * Estimates the on-foot temperature range once and derives the landable badge colour
   * and tooltip from it, so the three template bindings share a single lookup instead
   * of each recomputing estimateTempRange on every change-detection pass.
   */
  private computeLandableAndTemp(): void {
    const bd = this.body().bodyData;
    const surfTemp = bd.surfaceTemperature;
    const range = surfTemp
      ? estimateTempRange(surfTemp, bd.subType, bd.atmosphereType, bd.surfacePressure)
      : null;
    this.getEstimatedTempRange.set(range);

    // Badge colour
    if (!bd.isLandable) {
      this.getLandableBadgeClass.set('badge-gray');
    } else if (bd.gravity && bd.gravity > 2.7) {
      this.getLandableBadgeClass.set('badge-red');
    } else if (!surfTemp || !range) {
      this.getLandableBadgeClass.set('badge-gray');
    } else {
      const safeMin = isTempSafe(range.min);
      const safeMax = isTempSafe(range.max);
      const safeSurf = isTempSafe(surfTemp);
      this.getLandableBadgeClass.set((safeMin && safeMax) ? 'badge-green'
        : (safeMin || safeMax || safeSurf) ? 'badge-orange'
          : 'badge-red');
    }

    // Tooltip (high gravity takes precedence)
    if (bd.gravity && bd.gravity > 2.7) {
      this.getLandableTooltip.set('Landable: High gravity. Disembarking not possible');
    } else if (!surfTemp || !range) {
      this.getLandableTooltip.set('Landable: No temperature data available');
    } else {
      const tooCold = range.min < 182;
      const tooHot = range.max >= 700;
      this.getLandableTooltip.set((tooCold && tooHot) ? 'Landable: Battery drain risk and risk of injury or death'
        : tooHot ? 'Landable: Risk of injury or death'
          : tooCold ? 'Landable: Battery drain risk'
            : 'Landable: Safe to disembark');
    }
  }

  public trojanStatus: string | null = null;
  public trojanHostStatus: boolean = false;
  public rosetteStatus: string | null = null;
  public readonly getEstimatedTempRange = signal<{ min: number; max: number } | null>(null);
  public readonly getLandableBadgeClass = signal('badge-gray');
  public readonly getLandableTooltip = signal('');
  public readonly getNextPeriapsis = signal<{ date: Date, days: number } | null>(null);
  public readonly getNextApoapsis = signal<{ date: Date, days: number } | null>(null);
  public readonly getChildrenExpandedState = signal<boolean>(false);
  public readonly getRocheExcess = signal<number | null>(null);
  public readonly getStellarAgeAssessment = signal<StellarAgeAssessment | null>(null);

  /** Assesses the star's age against its spectral / luminosity class, or null for non-stars. */
  private computeStellarAgeAssessment(): StellarAgeAssessment | null {
    const bodyData = this.body().bodyData;
    if (!this.showStarAgeFeature()) {
      return null;
    }
    return assessStellarAge({
      spectralClass: bodyData.spectralClass,
      subType: bodyData.subType,
      luminosity: bodyData.luminosity,
      solarMasses: bodyData.solarMasses,
      ageMyr: bodyData.age,
    });
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
    return this.orbitalRelations.nextOrbitalEvent(this.body().bodyData, 'peri');
  }

  private calculateNextApoapsis(): { date: Date, days: number } | null {
    return this.orbitalRelations.nextOrbitalEvent(this.body().bodyData, 'apo');
  }

  private computeMaterialBadges(): void {
    const body = this.body();
    if (!body.bodyData.materials) {
      this.getMaterialBadges.set([]);
      return;
    }

    this.getMaterialBadges.set(Object.entries(body.bodyData.materials)
      .filter(([, percentage]) => percentage > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([material, percentage]) => ({
        name: MATERIAL_DATA[material]?.abbrev || material,
        class: MATERIAL_DATA[material]?.grade || 'badge-gray',
        tooltip: `${material}: ${percentage.toFixed(2)}%`
      })));
  }

  private calculateRocheExcess(): number | null {
    return this.physics.rocheExcess(this.body());
  }

  public showOnFootSafetyDialog(): void {
    const bd = this.body().bodyData;
    const surfTemp = bd.surfaceTemperature ?? null;
    const estRange = surfTemp ? estimateTempRange(surfTemp, bd.subType, bd.atmosphereType, bd.surfacePressure) : null;
    const { delta, source } = lookupTempDelta(bd.subType, bd.atmosphereType, bd.surfacePressure);
    this.dialog.open(OnFootSafetyDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      autoFocus: 'first-heading',
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop',
      data: {
        bodyName: bd.name,
        subType: bd.subType,
        atmosphereType: bd.atmosphereType || null,
        surfacePressure: bd.surfacePressure ?? null,
        surfaceTemperature: surfTemp,
        gravity: bd.gravity ?? null,
        estimatedMin: estRange?.min ?? null,
        estimatedMax: estRange?.max ?? null,
        badgeClass: this.getLandableBadgeClass(),
        lookupSource: source,
        p5Delta: delta.p5,
        p95Delta: delta.p95,
      } satisfies OnFootSafetyDialogData,
    });
  }

  public showJetAngleDialog(): void {
    this.dialog.open(JetAngleDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      autoFocus: 'first-heading',
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop'
    });
  }


  public showTidalLockDialog(): void {
    this.dialog.open(TidalLockDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop',
      // Focus the dialog heading rather than the default first tabbable element
      // (a "Further reading" link near the bottom), which would scroll the long
      // content to the end on open.
      autoFocus: 'first-heading',
      data: {
        body: this.body(),
        resonance: this.getSpinResonance()
      } satisfies TidalLockDialogData
    });
  }

}

interface BiologySignal {
  entryId: number;
  signal: string;
  codex: CanonnCodexEntry | null | undefined;
  isGuess: boolean;
}