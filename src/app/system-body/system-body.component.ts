import { estimateTempRange, isTempSafe, lookupTempDelta } from '../data/temperature-estimation';
import { Component, OnChanges, ChangeDetectionStrategy, SimpleChanges, input, viewChildren, inject, afterNextRender, signal, effect, untracked, DestroyRef } from '@angular/core';
import { SystemBody, EdGalaxyData } from '../home/home.component';
import { faCircleChevronRight, faCircleQuestion, faInfo, faSquareCaretDown, faSquareCaretUp, faUpRightFromSquare, faCode, faLock, faLink } from '@fortawesome/free-solid-svg-icons';
import { AppService, CanonnCodexEntry } from '../app.service';
import { BodyImage } from '../data/body-images';
import { getGreenGasGiantImagePath, isGreenGasGiant } from '../data/green-gas-giant-images';
import { MINING_RESOURCES } from '../data/mining-resources';
import { MatTooltip } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { DecimalPipe, DatePipe } from '@angular/common';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ClickableDirective } from '../clickable.directive';
import {
  BodyPhysicsService, RingDynamics, ShepherdingHillLimit, BodyRocheLimits, PlanetaryDensity, MassStabilityAlert, SPEED_OF_LIGHT,
  NARROW_RING_SPAN_RADII, PAUPER_RING_MIN_INNER_EDGE_RADII, PAUPER_RING_MAX_SPAN_RADII, HighAngularDiameterAssessment,
} from '../data/body-physics.service';
import { StellarPhysicsService } from '../data/stellar-physics.service';
import { OrbitalRelationsService, CollisionStatus, LagrangeConfiguration, LagrangeOccupant } from '../data/orbital-relations.service';
import { OrbitalWorkerService } from '../data/orbital-worker.service';
import { logger } from '../data/logger';
import { RocheChartData, HillChartData } from '../data/chart-rendering.service';
import { BODY_TYPE } from '../data/body-types';
import { WHITE_DWARF_CLASSES, whiteDwarfSpectralCode, whiteDwarfSpectralTypeKey } from '../data/white-dwarf';
import { openLazyDialog } from '../dialogs/lazy-dialog';
import type { WhiteDwarfTypesDialogData } from '../dialogs/white-dwarf-types-dialog/white-dwarf-types-dialog.component';
import { MATERIAL_DATA } from '../data/materials';
import { GENUS_NAMES } from '../data/genus';
import type { OrbitalDiagramType, OrbitElements } from '../dialogs/orbital-diagram-dialog/orbital-diagram-dialog.component';
import type { TidalLockDialogData } from '../dialogs/tidal-lock-dialog/tidal-lock-dialog.component';
import type { InvisibleRingDialogData } from '../dialogs/invisible-ring-dialog/invisible-ring-dialog.component';
import type { RingClassificationDialogData } from '../dialogs/ring-classification-dialog/ring-classification-dialog.component';
import type { ApoPeriDialogData } from '../dialogs/apo-peri-dialog/apo-peri-dialog.component';
import type { AnomalyDialogData } from '../dialogs/anomaly-dialog/anomaly-dialog.component';
import type { ParentDistanceDialogData } from '../dialogs/parent-distance-dialog/parent-distance-dialog.component';
import type { CollisionBodyInfo, CollisionDialogData } from '../dialogs/collision-dialog/collision-dialog.component';
import type { SynodicDiagramInput } from '../data/collision-diagram';
import type { JsonDialogData } from '../dialogs/json-dialog/json-dialog.component';
import { formatBodyJson } from '../dialogs/json-dialog/format-body-json';
import { BodyEnrichmentService } from '../data/body-enrichment.service';
import type { LagrangeDialogData } from '../dialogs/lagrange-dialog/lagrange-dialog.component';
import type { OnFootSafetyDialogData } from '../dialogs/on-foot-safety-dialog/on-foot-safety-dialog.component';
import { StellarAgeAssessment, assessStellarAge, isPlottableStarClass } from '../data/stellar-reference';
import { resolveBodySignalsMap, FilterCommand } from '../data/body-filters';
import { SPECULATIVE_BODY_TOOLTIP } from '../data/speculative-systems';
import { SpeculativeValueTooltipDirective } from './speculative-value-tooltip.directive';
import { BodyInterestRegistryService } from '../data/body-interest-registry.service';
import { ConvertIconComponent } from '../dialogs/unit-conversion-dialog/convert-icon.component';
import {
  dynamicArealDensityUnitLabel,
  dynamicAreaUnitLabel,
  dynamicDistanceUnitLabel,
  dynamicLengthUnitLabel,
  dynamicMassUnitLabel,
  formatDynamicArea,
  formatDynamicArealDensity,
  formatDynamicDistanceLs,
  formatDynamicLength,
  formatDynamicMass,
  formatLengthInUnit,
  InlineLengthUnit,
  pickInlineLengthUnit,
  KM_PER_AU,
  KM_PER_LIGHT_SECOND,
  KM_PER_SOLAR_RADIUS,
  KG_PER_EARTH_MASS,
  KG_PER_MEGATONNE,
  KG_PER_SOLAR_MASS,
  RADIANS_PER_DEGREE,
} from '../data/unit-conversions';

/**
 * Delay (ms) before the collision badge shows its pending skeleton. The collision search now runs
 * off the main thread, so its result arrives asynchronously; most bodies resolve within a worker
 * round-trip, so we only reveal the skeleton once the wait crosses this threshold (matching the
 * lazy-dialog skeleton's own delay) to avoid a flash on the common fast path.
 */
const COLLISION_SKELETON_DELAY_MS = 150;

/** Horizon (days) over which simultaneous (multi-body) collisions are scanned for the dialog's section. */
const SIMULTANEOUS_COLLISION_HORIZON_DAYS = 180;
/** Width of the collision dialog's distance-over-time diagram, in synodic periods. */
const COLLISION_DIAGRAM_SYNODIC_PERIODS = 10;
/**
 * Number of separation samples drawn across the diagram window (~100 per synodic period over the
 * {@link COLLISION_DIAGRAM_SYNODIC_PERIODS}-period span). Enough to render the conjunction dips
 * smoothly; the exact contact minima are threaded into the curve separately for precise markers.
 */
const COLLISION_DIAGRAM_SAMPLES = 1000;

@Component({
  selector: 'app-system-body',
  templateUrl: './system-body.component.html',
  styleUrls: ['./system-body.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FaIconComponent, MatTooltip, DecimalPipe, DatePipe, ClickableDirective, ConvertIconComponent, SpeculativeValueTooltipDirective]
})
export class SystemBodyComponent implements OnChanges {
  private readonly appService = inject(AppService);
  private readonly dialog = inject(MatDialog);
  private readonly physics = inject(BodyPhysicsService);
  private readonly stellarPhysics = inject(StellarPhysicsService);
  private readonly orbitalRelations = inject(OrbitalRelationsService);
  private readonly orbitalWorker = inject(OrbitalWorkerService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly enrichment = inject(BodyEnrichmentService);
  private readonly interestRegistry = inject(BodyInterestRegistryService);

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
  public readonly speculativeBodyTooltip = SPECULATIVE_BODY_TOOLTIP;
  readonly body = input.required<SystemBody>();
  readonly edGalaxyData = input<EdGalaxyData | null>(null);
  readonly isRoot = input<boolean>(false);
  readonly isLast = input<boolean>(false);
  readonly forceExpanded = input<boolean>(false);
  // Unlike forceExpanded, this is deliberately NOT propagated to subBodies (see the
  // recursive @for in the template) — it only auto-expands the exact body it's bound to,
  // e.g. home.component.html sets it on the root call so a special-cased system (see
  // data/speculative-systems.ts) can default to just its main star open, children collapsed.
  readonly defaultExpanded = input<boolean>(false);
  readonly anchorBodyId = input<number | null>(null);
  readonly systemPopulation = input<number>(0);
  readonly filterCommand = input<FilterCommand | null>(null);
  readonly systemKey = input<string | number | bigint | null>(null);
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
  // Auto-expand is a function of body identity, the anchor target and forceExpanded only.
  // These record the last values it was evaluated for, so ngOnChanges re-fires from
  // unrelated inputs (the async edGalaxyData/codex updates) don't re-open a body the
  // user has since collapsed. See the auto-expand block in ngOnChanges.
  private autoExpandBody: SystemBody | null = null;
  private autoExpandAnchor: number | null = null;
  /** Last-applied quick-filter token (see {@link FilterCommand}), so a repeat ngOnChanges from an unrelated input doesn't reapply it. */
  private lastAppliedFilterToken: number | null = null;
  private autoExpandForce = false;

  public hoveredIndex: number = -1;

  // Cache for expensive computed properties
  public readonly getMaterialBadges = signal<{ name: string, class: string, tooltip: string }[]>([]);
  public readonly getHotspotsList = signal<{ displayName: string; count: number; wikiUrl: string; description: string }[]>([]);
  public readonly cachedSurfacePressureTooltip = signal('');
  public readonly getAtmosphereDisplay = signal('');
  public readonly getSolidCompositionTooltip = signal('');
  public readonly getRingResourceTypes = signal<Set<string>>(new Set());
  // Cached values for template bindings that are read multiple times per render.
  public readonly getSpinResonance = signal('none');
  public readonly getConfirmedBiologyCount = signal(0);
  // Orbit/ring geometry and physics-service results, computed once per body change
  // rather than on every change-detection pass (several are bound multiple times).
  public readonly getApoapsis = signal(0);
  public readonly getPeriapsis = signal(0);
  public readonly getSystemAnomalyEpoch = signal<Date | null>(null);
  public readonly getMeanAnomaly = signal<number | undefined>(undefined);
  public readonly getTrueAnomaly = signal<number | undefined>(undefined);
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
  public readonly isTaylorRing = signal(false);
  public readonly taylorRingTooltip = signal('');
  public readonly isPauperRing = signal(false);
  public readonly pauperRingTooltip = signal('');
  public readonly getPlanetaryDensity = signal<PlanetaryDensity | null>(null);
  public readonly calculateRigidRocheLimit = signal<number | null>(null);
  public readonly calculateFluidRocheLimit = signal<number | null>(null);
  public readonly calculateBodyRocheLimits = signal<BodyRocheLimits | null>(null);
  public readonly calculateShepherdingHillLimit = signal<ShepherdingHillLimit | null>(null);
  public readonly isActualShepherd = signal(false);
  public readonly isShepherdingCandidate = signal(false);
  public readonly highAngularDiameterAssessment = signal<HighAngularDiameterAssessment | null>(null);
  public readonly highAngularDiameterTooltip = signal('');
  public readonly isBodyWithinParentRings = signal(false);
  public readonly getSignalsCount = signal(0);
  public readonly getAtmosphereCompositionTooltip = signal('');
  public readonly getSpinResonanceTooltip = signal('');
  public readonly getTangentialVelocity = signal<number | null>(null);
  public readonly getTangentialVelocityDisplay = signal('');
  public readonly getTangentialVelocityTooltip = signal('');
  public readonly classifyNeutronStar = signal<string | null>(null);
  public readonly getSchwarzschildRadius = signal<number | null>(null);
  public readonly getMassStabilityAlert = signal<MassStabilityAlert | null>(null);
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
    // Collision detection runs a costly 3D orbital search, so only redo it when the body
    // itself changes — not on the many ngOnChanges re-fires from unrelated input flips or
    // the async codex effect, which leave the orbital geometry untouched.
    if (this.collisionBody !== body) {
      this.collisionBody = body;
      this.requestCollisionStatus(body);
    }
    this.getNextPeriapsis.set(this.calculateNextPeriapsis());
    this.getNextApoapsis.set(this.calculateNextApoapsis());
    this.getParentDistanceKm.set(this.calculateParentDistanceKm());
    this.getRocheExcess.set(this.calculateRocheExcess());
    this.getStellarAgeAssessment.set(this.computeStellarAgeAssessment());

    this.bodyCoronaImage = "";
    this.bodyImage = "";

    // A Green Gas Giant is a real, catalogued body — show its actual photo instead of
    // the generic gas-giant art the classifier below would otherwise pick.
    const greenGasGiantImage = getGreenGasGiantImagePath(body.bodyData.name);
    const bodyImageResult = BodyImage.getBodyImagePath(body.bodyData);
    if (greenGasGiantImage) {
      this.bodyImage = greenGasGiantImage;
    }
    else if (bodyImageResult) {
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
    // Auto-expansion is driven only by the body itself, the anchor target (a body-link
    // click) and forceExpanded. Track the last values each was decided for so unrelated
    // ngOnChanges re-fires (the async edGalaxyData/codex updates) never re-open a body the
    // user has collapsed. Crucially, "interesting" only auto-expands on first sight of the
    // body — an anchor/forceExpanded change expands only the body it now targets, so
    // navigating to one body never re-opens a *different* interesting body the user
    // collapsed. Manual toggle and ancestor "expand all" (setExpandedState) are untouched.
    const anchorBodyId = this.anchorBodyId();
    const forceExpanded = this.forceExpanded();
    const bodyChanged = this.autoExpandBody !== body;
    const anchorChanged = this.autoExpandAnchor !== anchorBodyId;
    const forceChanged = this.autoExpandForce !== forceExpanded;
    this.autoExpandBody = body;
    this.autoExpandAnchor = anchorBodyId;
    this.autoExpandForce = forceExpanded;
    if (this.expanded() === false && (bodyChanged || anchorChanged || forceChanged)) {
      const isInteresting = this.hasSignals ||
        body.bodyData.subType === 'Earth-like world' ||
        body.bodyData.subType === 'Water world' ||
        body.bodyData.subType === 'Ammonia world' ||
        body.bodyData.subType?.includes('Black Hole') ||
        body.bodyData.subType === 'Neutron Star' ||
        body.bodyData.subType?.includes('White Dwarf') ||
        body.bodyData.subType?.includes('Wolf-Rayet') ||
        body.bodyData.subType?.includes('Herbig') ||
        !!body.bodyData.isLandable ||
        isGreenGasGiant(body.bodyData.name);
      const shouldExpand =
        (bodyChanged && isInteresting) ||
        ((bodyChanged || forceChanged) && forceExpanded) ||
        ((bodyChanged || anchorChanged) && this.containsAnchorBody(body)) ||
        (bodyChanged && this.defaultExpanded());
      if (shouldExpand) {
        this.expanded.set(true);
      }
    }

    // Quick-filter command (see FilterCommand): applies unconditionally, overriding whatever
    // expanded() currently holds, so a click both expands matching bodies and collapses the rest.
    const filterCommand = this.filterCommand();
    if (filterCommand && filterCommand.token !== this.lastAppliedFilterToken) {
      this.lastAppliedFilterToken = filterCommand.token;
      this.expanded.set(filterCommand.bodies === 'all' || filterCommand.bodies.has(body));
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

    // Orbit extents (km) — shared with the JSON export via BodyPhysicsService.
    const extents = this.physics.orbitExtentsKm(bd);
    this.getApoapsis.set(extents?.apoapsisKm ?? 0);
    this.getPeriapsis.set(extents?.periapsisKm ?? 0);

    // Mean/true anomaly: propagated to the most recent mean-anomaly observation
    // timestamp anywhere in the system (not "now"), so every body in a system reads
    // as one consistent snapshot even when their individual recordings differ in age.
    const epoch = this.orbitalRelations.systemAnomalyEpoch(body);
    this.getSystemAnomalyEpoch.set(epoch);
    let meanAnomalyAtEpoch: number | undefined;
    if (bd.meanAnomaly != null && bd.orbitalPeriod && bd.timestamps?.meanAnomaly && epoch) {
      meanAnomalyAtEpoch = this.orbitalRelations.meanAnomalyNow(bd.meanAnomaly, bd.orbitalPeriod, bd.timestamps.meanAnomaly, epoch.getTime());
    }
    this.getMeanAnomaly.set(meanAnomalyAtEpoch);
    this.getTrueAnomaly.set(meanAnomalyAtEpoch !== undefined && bd.orbitalEccentricity != null
      ? this.orbitalRelations.meanToTrueAnomaly(meanAnomalyAtEpoch, bd.orbitalEccentricity)
      : undefined);

    // Ring geometry.
    const outer = bd.outerRadius ?? 0;
    const inner = bd.innerRadius ?? 0;
    this.getRingWidth.set(outer - inner);
    this.getRingArea.set(Math.PI * (outer * outer - inner * inner));
    this.getRingDensity.set(this.getRingArea() > 0 ? (bd.mass ?? 0) / this.getRingArea() : 0);
    this.isRingNotVisible.set(bd.type === BODY_TYPE.Ring
      && this.isLowDensityWideRing(this.getRingWidth(), this.getRingDensity()));

    // Ring dynamics: orbital period and max velocity (Kepler math lives in the service).
    this.applyRingDynamics(this.physics.ringDynamics(body));

    // Distance to the next ring/belt sibling (by innerRadius order).
    const { distance: neighbourDist, label: neighbourLabel, velocityDiff, eitherRingInvisible } = this.physics.ringNeighbourDistance(body);
    // Suppress gap/velocity display when either ring in the pair is invisible — the values
    // are physically real but the invisible ring cannot be observed in-game.
    const displayDist = eitherRingInvisible ? null : neighbourDist;
    const displayVelocityDiff = eitherRingInvisible ? null : velocityDiff;
    this.getRingNeighbourDistance.set(displayDist);
    this.getRingNeighbourDistanceLabel.set(displayDist !== null ? neighbourLabel : '');
    this.getRingVelocityDiff.set(displayVelocityDiff);
    this.getRingVelocityDiffDisplay.set(displayVelocityDiff !== null ? this.formatVelocityKms(displayVelocityDiff) : '');
    this.getRingVelocityDiffTooltip.set(displayVelocityDiff !== null ? `${displayVelocityDiff.toFixed(3)} km/s` : '');

    // Racing Rings badge: gap between adjacent rings below threshold AND speed
    // differential above threshold, and neither ring in the pair is invisible.
    const racingRings = this.physics.isRacingRings(body);
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

    // Taylor (unusually narrow) / Pauper (unusually wide and distant) ring badges.
    const ringClass = this.physics.classifyRingSystem(body);
    this.isTaylorRing.set(ringClass?.isTaylor ?? false);
    this.isPauperRing.set(ringClass?.isPauper ?? false);
    this.taylorRingTooltip.set(ringClass?.isTaylor
      ? `Taylor ring: total ring span is ${ringClass.span.toFixed(0)} km, under 25% of the body's radius `
        + `(${(NARROW_RING_SPAN_RADII * ringClass.parentRadius).toFixed(0)} km) — unusually narrow`
      : '');
    this.pauperRingTooltip.set(ringClass?.isPauper
      ? `Pauper ring: innermost edge sits ${(ringClass.innermostInner / ringClass.parentRadius).toFixed(1)}× the body's radius out, `
        + `spanning only ${ringClass.span.toFixed(0)} km — unusually wide and distant`
      : '');

    // Physics-service delegations.
    this.getPlanetaryDensity.set(this.physics.getPlanetaryDensity(bd));
    this.calculateRigidRocheLimit.set(this.physics.calculateRigidRocheLimit(body));
    this.calculateFluidRocheLimit.set(this.physics.calculateFluidRocheLimit(body));
    this.calculateBodyRocheLimits.set(this.physics.calculateBodyRocheLimits(body));
    this.calculateShepherdingHillLimit.set(this.physics.calculateShepherdingHillLimit(body));
    this.isShepherdingCandidate.set(this.physics.isShepherdingCandidate(body));
    this.isActualShepherd.set(this.physics.isActualShepherd(body));
    this.isBodyWithinParentRings.set(this.physics.isBodyWithinParentRings(body));

    // High Angular Diameter badge: parent star/planet visibly dominates this landable body's sky.
    const angularDiameter = this.physics.highAngularDiameterAssessment(body);
    this.highAngularDiameterAssessment.set(angularDiameter);
    this.highAngularDiameterTooltip.set(angularDiameter
      ? `High angular diameter parent (${angularDiameter.parentType}: ${angularDiameter.parentLabel})\n`
        + `Landable — parent spans ${angularDiameter.angularDiameterDegrees.toFixed(0)}° across the sky`
      : '');

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
    return this.physics.eccentricityClass(eccentricity);
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

  /**
   * The classification text shown in the body header. A catalogued Green Gas Giant gets
   * "glowing green" inserted ahead of "gas giant" (e.g. "Class I gas giant" -> "Class I
   * glowing green gas giant"); every other body shows its subType unchanged.
   */
  public getDisplaySubType(): string {
    const bd = this.body().bodyData;
    if (bd.subType && isGreenGasGiant(bd.name)) {
      return bd.subType.replace(/gas giant/i, 'glowing green gas giant');
    }
    return bd.subType;
  }

  /** Opens the white-dwarf spectral-type reference modal, highlighting this star's type. */
  public async showWhiteDwarfSpectralDialog(): Promise<void> {
    const code = this.getWhiteDwarfSpectralCode();
    if (!code) { return; }
    openLazyDialog(this.dialog, {
      loader: () => import('../dialogs/white-dwarf-types-dialog/white-dwarf-types-dialog.component').then(m => m.WhiteDwarfTypesDialogComponent),
      skeleton: 'text',
      width: '900px',
      maxWidth: '95vw',
      data: { typeKey: whiteDwarfSpectralTypeKey(code) } satisfies WhiteDwarfTypesDialogData,
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
  public async showOrbitalDiagram(type: OrbitalDiagramType): Promise<void> {
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

    openLazyDialog(this.dialog, {
      loader: () => import('../dialogs/orbital-diagram-dialog/orbital-diagram-dialog.component').then(m => m.OrbitalDiagramDialogComponent),
      skeleton: 'diagram',
      width: '900px',
      maxWidth: '95vw',
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop',
      data: { type, degrees, eccentricity: bodyData.orbitalEccentricity, bodyName, parentName, orbit },
    });
  }

  /**
   * Opens the Hertzsprung–Russell diagram modal for this star, plotting it by temperature
   * and absolute magnitude and comparing its age to the lifetime its class implies.
   */
  public async showHrDiagram(): Promise<void> {
    const body = this.body();
    const bodyData = body.bodyData;
    openLazyDialog(this.dialog, {
      loader: () => import('../dialogs/hr-diagram-dialog/hr-diagram-dialog.component').then(m => m.HrDiagramDialogComponent),
      skeleton: 'diagram',
      width: '900px',
      maxWidth: '95vw',
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

  // --- Inline dynamic-by-magnitude formatters (delegated to the shared pure module) ---
  public formatLength(km: number): string { return formatDynamicLength(km); }
  public formatDistanceLs(ls: number): string { return formatDynamicDistanceLs(ls); }
  public formatMass(kg: number): string { return formatDynamicMass(kg); }
  public formatArea(km2: number): string { return formatDynamicArea(km2); }
  /** Ring/belt areal density (Mt/km² base), scaled up to Gt/km² for very dense rings. */
  public formatRingDensity(mtKm2: number): string { return formatDynamicArealDensity(mtKm2); }

  // --- Conversion-dialog "shown in UI" unit labels (which dialog row to accent). ---
  public lengthUnitLabel(km: number | null | undefined): string {
    return km == null ? '' : dynamicLengthUnitLabel(km);
  }
  public distanceUnitLabel(km: number | null | undefined): string {
    return km == null ? '' : dynamicDistanceUnitLabel(km);
  }
  public massUnitLabel(kg: number | null | undefined): string {
    return kg == null ? '' : dynamicMassUnitLabel(kg);
  }
  public areaUnitLabel(km2: number | null | undefined): string {
    return km2 == null ? '' : dynamicAreaUnitLabel(km2);
  }
  public ringDensityUnitLabel(mtKm2: number | null | undefined): string {
    return mtKm2 == null ? '' : dynamicArealDensityUnitLabel(mtKm2);
  }
  /** Dialog-row label for the inline duration unit chosen by {@link formatPeriodDays}. */
  public durationUnitLabel(days: number | null | undefined): string {
    if (days == null || !Number.isFinite(days)) { return ''; }
    return this.periodParts(days).label;
  }
  /** Dialog-row label for the inline velocity unit chosen by {@link formatVelocityKms}. */
  public velocityUnitLabel(kms: number | null | undefined): string {
    if (kms == null || !Number.isFinite(kms)) { return ''; }
    return this.isRelativistic(kms) ? 'c (fraction of light)' : 'km/s';
  }
  /** Native (journal/API) mass unit for this body, by which field carries it. */
  public massSourceUnit(): string {
    const bd = this.body().bodyData;
    if (bd.solarMasses != null) { return 'Solar Masses'; }
    if (bd.earthMasses != null) { return 'Earth Masses'; }
    if (bd.mass != null) { return 'Megatonnes'; }
    return '';
  }

  // --- Shared orbit-distance unit: semi-major axis, apoapsis and periapsis (#5). ---
  /**
   * One length unit shared by the semi-major-axis/apoapsis/periapsis trio, chosen from the
   * semi-major axis (the orbit's representative scale; apoapsis ≤ 2a and periapsis ≥ 0 stay
   * the same order of magnitude). Falls back to apoapsis then periapsis when absent.
   */
  public orbitDistanceUnit(): InlineLengthUnit {
    const rep = this.getSemiMajorAxisKm() ?? (this.getApoapsis() || this.getPeriapsis() || 0);
    return pickInlineLengthUnit(rep);
  }
  public formatOrbitDistance(km: number | null | undefined): string {
    return km == null ? '' : formatLengthInUnit(km, this.orbitDistanceUnit());
  }
  public orbitDistanceUnitLabel(): string { return this.orbitDistanceUnit().label; }

  /** This body's mass in kilograms from whichever source field it carries, or null. */
  public getMassKg(): number | null {
    const bd = this.body().bodyData;
    if (bd.solarMasses != null) { return bd.solarMasses * KG_PER_SOLAR_MASS; }
    if (bd.earthMasses != null) { return bd.earthMasses * KG_PER_EARTH_MASS; }
    if (bd.mass != null) { return bd.mass * KG_PER_MEGATONNE; }
    return null;
  }

  /** Tooltip for the mass row: the value in its stored unit at full precision. */
  public getMassTooltip(): string {
    const bd = this.body().bodyData;
    if (bd.solarMasses != null) {
      return `${bd.solarMasses.toLocaleString('en-US', { maximumFractionDigits: 20 })} Solar masses`;
    }
    if (bd.earthMasses != null) { return `${bd.earthMasses} Earth masses`; }
    if (bd.mass != null) { return `${bd.mass} Mt`; }
    return '';
  }

  /** This body's semi-major axis in km (stored in AU), or null. */
  public getSemiMajorAxisKm(): number | null {
    const au = this.body().bodyData.semiMajorAxis;
    return au == null ? null : au * KM_PER_AU;
  }

  /** This body's distance-to-arrival in km (stored in light-seconds), or null. */
  public getDistanceToArrivalKm(): number | null {
    const ls = this.body().bodyData.distanceToArrival;
    return ls == null ? null : ls * KM_PER_LIGHT_SECOND;
  }

  /** An ordinary star's radius in km (stored in solar radii), for the conversion dialog; null if absent. */
  public getSolarRadiusKm(): number | null {
    const solarRadius = this.body().bodyData.solarRadius;
    return solarRadius == null ? null : solarRadius * KM_PER_SOLAR_RADIUS;
  }

  /**
   * Physical radius in km for stars shown in km rather than solar radii: neutron stars,
   * black holes (compact objects) and — per the display spec — white dwarfs. Null for
   * ordinary stars, which keep solar radii. Kept distinct from {@link isBlackHoleOrNeutronStar}
   * so the tangential-velocity gate stays compact-object-only.
   */
  public getStarRadiusKm(): number | null {
    const compact = this.getCompactObjectRadiusKm();
    if (compact !== null) { return compact; }
    const bd = this.body().bodyData;
    if (bd.subType?.startsWith('White Dwarf')) {
      return this.stellarPhysics.radiusKm(bd.radius, bd.solarRadius);
    }
    return null;
  }



  /**
   * The hotspot/signal map for this body: its own `signals.signals`, or — for a ring
   * body — the matching entry in the parent's `rings` array. Delegates to the shared
   * {@link resolveBodySignalsMap}, also used by the home page's Mining quick filter.
   */
  private resolveSignalsMap(): { [key: string]: number } | undefined {
    return resolveBodySignalsMap(this.body());
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

    // On teardown, invalidate any in-flight collision request (so a late worker response is dropped
    // by the generation guard rather than written to a destroyed component) and cancel the pending
    // skeleton timer.
    this.destroyRef.onDestroy(() => {
      this.collisionRequestId++;
      clearTimeout(this.collisionPendingTimer);
    });

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

  /** Epoch the export's time-dependent values use — the app clock override (frozen-clock tests / `?t=`) or now. */
  private exportNow(): number {
    return this.appService.nowOverride() ?? Date.now();
  }

  public async showBodyJsonDialog(): Promise<void> {
    openLazyDialog(this.dialog, {
      loader: () => import('../dialogs/json-dialog/json-dialog.component').then(m => m.JsonDialogComponent),
      skeleton: 'text',
      width: '900px',
      maxWidth: '95vw',
      restoreFocus: false,
      data: { body: this.body(), edGalaxyData: this.edGalaxyData(), now: this.exportNow() } satisfies JsonDialogData,
    });
  }

  /** Copies the body JSON — raw Spansh plus the `calculated` block — to the clipboard (right-click shortcut). */
  public copyBodyJson(): void {
    navigator.clipboard?.writeText(formatBodyJson(this.enrichment.enrichBody(this.body(), this.exportNow())))
      .catch(() => { /* clipboard unavailable */ });
  }

  public async showInvisibleRingExplanation(): Promise<void> {
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
    const isInvisible = this.isLowDensityWideRing(width, density);

    const ringName = body.bodyData.name.split(' ').slice(1).join(' ') || body.bodyData.name;

    openLazyDialog(this.dialog, {
      loader: () => import('../dialogs/invisible-ring-dialog/invisible-ring-dialog.component').then(m => m.InvisibleRingDialogComponent),
      skeleton: 'diagram',
      width: '900px',
      maxWidth: '95vw',
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

  /** Opens the explanation dialog for the Taylor (narrow) or Pauper (wide, distant) ring badge. */
  public async showRingClassificationDialog(kind: 'taylor' | 'pauper'): Promise<void> {
    const body = this.body();
    const ringClass = this.physics.classifyRingSystem(body);
    if (!ringClass) { return; }

    openLazyDialog(this.dialog, {
      loader: () => import('../dialogs/ring-classification-dialog/ring-classification-dialog.component').then(m => m.RingClassificationDialogComponent),
      skeleton: 'diagram',
      width: '900px',
      maxWidth: '95vw',
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop',
      data: {
        kind,
        bodyName: body.parent?.bodyData.name ?? '',
        // `body` is one of the visible rings classifyRingSystem requires to compute `ringClass`
        // (see its early returns above), so it is guaranteed to appear in `ringClass.rings`.
        ringName: ringClass.rings.find(r => r.innerRadius === (body.bodyData.innerRadius ?? 0))!.name,
        parentRadius: ringClass.parentRadius,
        rings: ringClass.rings,
        span: ringClass.span,
        innermostInner: ringClass.innermostInner,
        outermostOuter: ringClass.outermostOuter,
        narrowThresholdKm: NARROW_RING_SPAN_RADII * ringClass.parentRadius,
        pauperInnerEdgeThresholdKm: PAUPER_RING_MIN_INNER_EDGE_RADII * ringClass.parentRadius,
        pauperMaxSpanKm: PAUPER_RING_MAX_SPAN_RADII * ringClass.parentRadius,
        hasVisibleGap: ringClass.hasVisibleGap,
      } satisfies RingClassificationDialogData,
    });
  }

  /** Opens the Roche-limit chart dialog with the prepared chart data. */
  private async openRocheLimitDialog(data: RocheChartData): Promise<void> {
    openLazyDialog(this.dialog, {
      loader: () => import('../dialogs/roche-limit-dialog/roche-limit-dialog.component').then(m => m.RocheLimitDialogComponent),
      skeleton: 'diagram',
      width: '900px',
      maxWidth: '95vw',
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop',
      data,
    });
  }

  public async showRocheLimitChart(): Promise<void> {
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

    await this.openRocheLimitDialog({
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

  public async showBodyRocheLimitChart(): Promise<void> {
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

    await this.openRocheLimitDialog({
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

  public async showApoPeriDialog(type: 'apo' | 'peri'): Promise<void> {
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
      currentMeanAnomaly = this.orbitalRelations.meanAnomalyNow(meanAnomaly, orbitalPeriod, body.bodyData.timestamps.meanAnomaly, this.appService.nowOverride() ?? Date.now());
      degreesToEvent = this.orbitalRelations.degreesToEvent(currentMeanAnomaly, type);
    }

    openLazyDialog(this.dialog, {
      loader: () => import('../dialogs/apo-peri-dialog/apo-peri-dialog.component').then(m => m.ApoPeriDialogComponent),
      skeleton: 'diagram',
      width: '900px',
      maxWidth: '95vw',
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

  /** Opens the Mean/True Anomaly dialog with the recorded, epoch, and live values. */
  public async showAnomalyDialog(type: 'mean' | 'true'): Promise<void> {
    const bd = this.body().bodyData;
    const epoch = this.getSystemAnomalyEpoch();
    const meanAnomalyAtEpoch = this.getMeanAnomaly();
    if (bd.meanAnomaly == null || !bd.orbitalPeriod || !bd.timestamps?.meanAnomaly || !epoch || meanAnomalyAtEpoch === undefined) return;

    openLazyDialog(this.dialog, {
      loader: () => import('../dialogs/anomaly-dialog/anomaly-dialog.component').then(m => m.AnomalyDialogComponent),
      skeleton: 'diagram',
      width: '900px',
      maxWidth: '95vw',
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop',
      data: {
        type,
        bodyName: this.getBodyDisplayName(bd.name),
        recordedMeanAnomaly: bd.meanAnomaly,
        recordedTimestamp: new Date(bd.timestamps.meanAnomaly),
        systemEpoch: epoch,
        meanAnomalyAtEpoch,
        eccentricity: bd.orbitalEccentricity ?? undefined,
        orbitalPeriodDays: bd.orbitalPeriod,
        argOfPeriapsisDeg: bd.argOfPeriapsis ?? 0,
      } satisfies AnomalyDialogData,
    });
  }

  /** Opens the Parent Distance dialog with this body's live distance and its orbital elements. */
  public async showParentDistanceDialog(): Promise<void> {
    const body = this.body();
    const bd = body.bodyData;
    const aKm = this.getSemiMajorAxisKm();
    if (aKm == null || bd.orbitalEccentricity == null || bd.meanAnomaly == null || !bd.orbitalPeriod || !bd.timestamps?.meanAnomaly) return;
    const recordedTimestampMs = Date.parse(bd.timestamps.meanAnomaly);
    if (!Number.isFinite(recordedTimestampMs)) return;

    openLazyDialog(this.dialog, {
      loader: () => import('../dialogs/parent-distance-dialog/parent-distance-dialog.component').then(m => m.ParentDistanceDialogComponent),
      skeleton: 'diagram',
      width: '900px',
      maxWidth: '95vw',
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop',
      data: {
        bodyName: this.getBodyDisplayName(bd.name),
        parentName: body.parent ? this.getBodyDisplayName(body.parent.bodyData.name) : undefined,
        semiMajorAxisKm: aKm,
        eccentricity: bd.orbitalEccentricity,
        apoapsisKm: this.getApoapsis(),
        periapsisKm: this.getPeriapsis(),
        recordedMeanAnomaly: bd.meanAnomaly,
        recordedTimestamp: new Date(recordedTimestampMs),
        orbitalPeriodDays: bd.orbitalPeriod,
        argOfPeriapsisDeg: bd.argOfPeriapsis ?? 0,
        nowOverrideMs: this.appService.nowOverride() ?? undefined,
      } satisfies ParentDistanceDialogData,
    });
  }

  /** Opens the collision dialog with this body's collision-candidate details. */
  public async showCollisionDialog(): Promise<void> {
    const status = this.collisionStatus();
    if (!status?.isCandidate) { return; }
    // Snapshot the body once: the worker round-trip below is async, so re-reading this.body()
    // afterwards could pick up a different body if the row's input is re-bound mid-flight, fusing
    // two bodies into one dialog. Use `now` consistent with the badge's candidacy (honours the
    // app-level time override) so the dialog's countdowns and now-marker match the badge.
    const body = this.body();
    const siblings = body.parent?.subBodies ?? [];
    const now = this.appService.nowOverride() ?? Date.now();

    // Both of these run the heavy orbital search, so compute them off the main thread before the
    // dialog opens (one worker round-trip). The badge already knows this body is a candidate, so
    // this only gathers the detail rows and the distance-over-time curves.
    const [simultaneousCollisions, separationDiagram] = await Promise.all([
      this.orbitalWorker.simultaneousCollisionsWithin(body, SIMULTANEOUS_COLLISION_HORIZON_DAYS, now),
      this.buildCollisionDistanceDiagram(body, siblings, status, now),
    ]);

    // Descriptive info for every collision candidate: each crossing partner from the upcoming
    // windows, the primary partner, and any simultaneous-cluster member — so the dialog can
    // enumerate all involved bodies, not just the primary pair.
    const partnerNames = new Set<string>();
    for (const w of status.upcomingCollisions) { if (w.partnerName) { partnerNames.add(w.partnerName); } }
    if (status.partnerName) { partnerNames.add(status.partnerName); }
    for (const n of status.simultaneousPartners) { partnerNames.add(n); }
    const partnerInfos = [...partnerNames].map(name => ({
      name,
      info: this.buildCollisionBodyInfo(siblings.find(s => s.bodyData.name === name) ?? null),
    }));

    openLazyDialog(this.dialog, {
      loader: () => import('../dialogs/collision-dialog/collision-dialog.component').then(m => m.CollisionDialogComponent),
      skeleton: 'diagram',
      width: '900px',
      maxWidth: '95vw',
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop',
      data: {
        bodyName: body.bodyData.name,
        partnerName: status.partnerName,
        synodicPeriodDays: status.synodicPeriodDays,
        nextCollision: status.nextCollision,
        upcomingCollisions: status.upcomingCollisions,
        combinedRadiiKm: status.combinedRadiiKm,
        bodyInfo: this.buildCollisionBodyInfo(body),
        partnerInfo: this.buildCollisionBodyInfo(
          siblings.find(s => s.bodyData.name === status.partnerName) ?? null
        ),
        partnerInfos,
        systemPopulation: this.systemPopulation(),
        systemName: this.edGalaxyData()?.Name ?? '',
        simultaneousPartners: status.simultaneousPartners,
        simultaneousCollisions,
        separationDiagram,
      } satisfies CollisionDialogData,
    });
  }

  /**
   * Builds the distance-over-time samples for the collision dialog's synodic-period diagram:
   * one centre-to-centre separation curve from this body to each sibling it directly collides
   * with, over a window of ten synodic periods. Every collision falling inside that window is
   * marked (uncapped — not just the 10 table rows), so no in-view dip is left without a marker.
   * Returns null when no pair has the phase data needed to place the bodies in time.
   */
  private async buildCollisionDistanceDiagram(
    body: SystemBody,
    siblings: SystemBody[],
    status: CollisionStatus,
    now: number,
  ): Promise<SynodicDiagramInput | null> {
    const MS_PER_DAY = 1000 * 60 * 60 * 24;

    // Timeline: ten synodic periods — long enough to show the conjunction dips recurring and
    // which of them deepen into collisions. Without a synodic period there is nothing to scale to.
    const synMs = (status.synodicPeriodDays ?? 0) * MS_PER_DAY;
    if (!(synMs > 0)) { return null; }
    const spanMs = synMs * COLLISION_DIAGRAM_SYNODIC_PERIODS;
    const endMs = now + spanMs;

    // Every contact inside the window — uncapped — grouped by the partner each is with, so dips
    // beyond the table's 10-row limit are still marked. Runs off the main thread.
    const windowContacts = await this.orbitalWorker.upcomingContactsWithin(body, spanMs / MS_PER_DAY, now);

    // Distinct siblings this body collides with in-window, plus any from the (capped) status list
    // and the primary partner, so a curve is drawn even when no contact lands inside the window.
    const partnerNames = new Set<string>();
    for (const w of windowContacts) { if (w.partnerName) { partnerNames.add(w.partnerName); } }
    for (const w of status.upcomingCollisions) { if (w.partnerName) { partnerNames.add(w.partnerName); } }
    if (partnerNames.size === 0 && status.partnerName) { partnerNames.add(status.partnerName); }
    if (partnerNames.size === 0) { return null; }

    // Sample each partner's separation curve off the main thread; the calls are independent, so
    // run them concurrently and preserve partner order when assembling the series below.
    const built = await Promise.all([...partnerNames].map(async name => {
      const sibling = siblings.find(s => s.bodyData.name === name);
      if (!sibling) { return null; }
      const samplesArr = await this.orbitalWorker.separationSeries(body.bodyData, sibling.bodyData, now, endMs, COLLISION_DIAGRAM_SAMPLES);
      if (samplesArr.length === 0) { return null; }
      // Every contact window already carries this pair's contact threshold (combinedRadiiKm), so
      // prefer it; fall back to the status-level value, then the bare radius sum, only if absent.
      const partnerWindows = windowContacts.filter(w => w.partnerName === name);
      const combinedRadiiKm = partnerWindows[0]?.combinedRadiiKm
        ?? status.upcomingCollisions.find(w => w.partnerName === name)?.combinedRadiiKm
        ?? status.combinedRadiiKm
        ?? ((body.bodyData.radius ?? 0) + (sibling.bodyData.radius ?? 0));
      const contacts = partnerWindows.map(w => ({
        tMs: (w.start.getTime() + w.end.getTime()) / 2,
        sepKm: w.minSeparationKm,
      }));
      return { partnerName: name, combinedRadiiKm, samples: samplesArr, contacts };
    }));

    const series: SynodicDiagramInput['series'] = built.filter((s): s is NonNullable<typeof s> => s !== null);
    return series.length > 0 ? { startMs: now, endMs, nowMs: now, series } : null;
  }

  /**
   * Human-readable time-until for the collision badge tooltip: days, with years in parentheses
   * once the wait reaches a year. Negative means contact is already in progress.
   */
  public formatCollisionCountdown(days: number): string {
    if (days < 0) { return 'in progress now'; }
    if (days < 1) { return 'less than a day'; }
    const dayLabel = `${Math.round(days).toLocaleString()} days`;
    return days >= 365.25 ? `${dayLabel} (${(days / 365.25).toFixed(1)} years)` : dayLabel;
  }

  /** Extracts the key descriptive facts from a SystemBody for the collision dialog summary. */
  private buildCollisionBodyInfo(body: SystemBody | null): CollisionBodyInfo | null {
    if (!body) { return null; }
    const bd = body.bodyData;
    return {
      subType: bd.subType || bd.type || 'body',
      atmosphereType: bd.atmosphereType ?? null,
      orbitalPeriodDays: bd.orbitalPeriod ?? 0,
      moonCount: body.subBodies.length,
      hasRings: !!(bd.rings?.length),
    };
  }

  public async showShepherdingHillLimitChart(): Promise<void> {
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

    openLazyDialog(this.dialog, {
      loader: () => import('../dialogs/hill-limit-dialog/hill-limit-dialog.component').then(m => m.HillLimitDialogComponent),
      skeleton: 'diagram',
      width: '900px',
      maxWidth: '95vw',
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

  /** Shared invisibility heuristic used for ring stats, badges, and dialog explanations. */
  private isLowDensityWideRing(widthKm: number, densityKgPerKm2: number): boolean {
    return this.physics.isLowDensityWideRing(widthKm, densityKgPerKm2);
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

  /** True when a velocity is fast enough to read as a fraction of c rather than km/s. */
  private isRelativistic(velocityKms: number): boolean {
    return velocityKms / (SPEED_OF_LIGHT / 1000) >= 0.01;
  }

  private formatVelocityKms(velocityKms: number): string {
    if (this.isRelativistic(velocityKms)) {
      return `${(velocityKms / (SPEED_OF_LIGHT / 1000)).toFixed(3)}c`;
    }
    return `${velocityKms.toFixed(3)} km/s`;
  }

  /**
   * The unit a period reads in at this magnitude: numeric value, inline abbreviation, and
   * the matching conversion-dialog row label (every band maps to a dialog row, so the inline
   * unit is accented in the dialog — including Milliseconds for millisecond pulsars).
   * Single source for both {@link formatPeriodDays} and {@link durationUnitLabel}.
   */
  private periodParts(days: number): { value: number; unit: string; label: string } {
    const absDays = Math.abs(days);
    const seconds = absDays * 86400;
    const minutes = seconds / 60;
    const hours = minutes / 60;
    const weeks = absDays / 7;
    const years = absDays / 365.25;

    if (seconds < 1) return { value: seconds * 1000, unit: 'ms', label: 'Milliseconds' };
    if (seconds < 60) return { value: seconds, unit: 's', label: 'Seconds' };
    if (minutes < 60) return { value: minutes, unit: 'min', label: 'Minutes' };
    if (hours < 24) return { value: hours, unit: 'h', label: 'Hours' };
    if (absDays < 7) return { value: absDays, unit: 'days', label: 'Days' };
    if (weeks < 52) return { value: weeks, unit: 'weeks', label: 'Weeks' };
    if (years < 10) return { value: years, unit: 'years', label: 'Years' };
    if (years / 10 < 10) return { value: years / 10, unit: 'decades', label: 'Decades' };
    return { value: years / 100, unit: 'centuries', label: 'Centuries' };
  }

  private formatPeriodDays(days: number): string {
    const { value, unit } = this.periodParts(days);
    return `${days < 0 ? '-' : ''}${value.toFixed(2)} ${unit}`;
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
  /**
   * Result of the off-thread collision search for the current body, or null while it is still
   * running (or when the body isn't a collision candidate). A signal, not a plain field, because
   * the worker resolves asynchronously and setting it is what schedules change detection under
   * zoneless. See {@link requestCollisionStatus}.
   */
  public readonly collisionStatus = signal<CollisionStatus | null>(null);
  /** True once a collision search has been outstanding longer than {@link COLLISION_SKELETON_DELAY_MS}. */
  public readonly collisionPending = signal(false);
  /** The body `collisionStatus` was last requested for, to skip recompute on unrelated re-renders. */
  private collisionBody: SystemBody | null = null;
  /** Generation token: increments per request so a stale worker response for a superseded body is dropped. */
  private collisionRequestId = 0;
  /** Timer that reveals the pending skeleton; cleared when the result arrives or the component is destroyed. */
  private collisionPendingTimer: ReturnType<typeof setTimeout> | undefined;

  /**
   * Runs {@link OrbitalRelationsCore.detectCollisionStatus} for `body` off the main thread and
   * lands the result in {@link collisionStatus}. Since the search is now asynchronous, a per-request
   * generation token ({@link collisionRequestId}) discards a response whose body has since been
   * superseded (the row's input flipped while the worker was busy), and the pending skeleton is
   * only revealed if the worker hasn't answered within {@link COLLISION_SKELETON_DELAY_MS}.
   */
  private requestCollisionStatus(body: SystemBody): void {
    const requestId = ++this.collisionRequestId;
    this.collisionStatus.set(null);
    const now = this.appService.nowOverride() ?? Date.now();

    clearTimeout(this.collisionPendingTimer);
    this.collisionPendingTimer = setTimeout(() => {
      if (requestId === this.collisionRequestId) { this.collisionPending.set(true); }
    }, COLLISION_SKELETON_DELAY_MS);

    this.orbitalWorker.detectCollisionStatus(body, now)
      .then(status => {
        if (requestId !== this.collisionRequestId) { return; }
        clearTimeout(this.collisionPendingTimer);
        this.collisionStatus.set(status);
        this.collisionPending.set(false);
        this.reportCollisionCandidate(body, status.isCandidate);
      })
      .catch((err: unknown) => {
        // A worker/engine failure leaves the badge simply absent (collisionStatus stays null) rather
        // than crashing the row. Surface it via the logger (silent in production) so a malfunctioning
        // worker is diagnosable in development instead of being swallowed without trace.
        logger.error('Collision search failed', err);
        if (requestId !== this.collisionRequestId) { return; }
        clearTimeout(this.collisionPendingTimer);
        this.collisionPending.set(false);
        this.reportCollisionCandidate(body, false);
      });
  }

  /**
   * Surfaces this body's resolved collision-candidate status to the shared registry so the
   * "Tourist" quick filter (computed eagerly in HomeComponent from synchronous body data) can
   * pick it up once the off-thread search finishes, without re-running collision detection itself.
   */
  private reportCollisionCandidate(body: SystemBody, isCandidate: boolean): void {
    const key = this.systemKey();
    if (key === null) { return; }
    this.interestRegistry.reportCollisionCandidate(key, body, isCandidate);
  }

  /**
   * Opens the Lagrange-points diagram for this body's co-orbital family. Resolves the
   * configuration from the service, maps every body name to its display name (stripping the
   * system prefix), and hands it to the dialog. No-op when the body isn't part of a
   * detectable Trojan/Lagrange configuration.
   */
  public async showLagrangeDialog(): Promise<void> {
    const config = this.orbitalRelations.lagrangeConfiguration(this.body());
    if (!config) { return; }

    // Map raw names to full display names. The dialog drops the (repeated) system-name
    // prefix for the cramped diagram itself but keeps the full names in its description.
    const toDisplay = (occupant: LagrangeOccupant): LagrangeOccupant =>
      ({ ...occupant, name: this.getBodyDisplayName(occupant.name) });
    const points = { L1: [], L2: [], L3: [], L4: [], L5: [] } as LagrangeConfiguration['points'];
    for (const id of ['L1', 'L2', 'L3', 'L4', 'L5'] as const) {
      points[id] = config.points[id].map(toDisplay);
    }
    const displayConfig: LagrangeConfiguration = {
      primaryName: config.primaryName ? this.getBodyDisplayName(config.primaryName) : null,
      secondary: config.secondary ? toDisplay(config.secondary) : null,
      points,
    };
    const data: LagrangeDialogData = { config: displayConfig, systemName: this.edGalaxyData()?.Name ?? '' };

    openLazyDialog(this.dialog, {
      loader: () => import('../dialogs/lagrange-dialog/lagrange-dialog.component').then(m => m.LagrangeDialogComponent),
      skeleton: 'diagram',
      width: '900px',
      maxWidth: '95vw',
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop',
      data,
    });
  }
  public readonly getEstimatedTempRange = signal<{ min: number; max: number } | null>(null);
  public readonly getLandableBadgeClass = signal('badge-gray');
  public readonly getLandableTooltip = signal('');
  public readonly getNextPeriapsis = signal<{ date: Date, days: number } | null>(null);
  public readonly getNextApoapsis = signal<{ date: Date, days: number } | null>(null);
  public readonly getParentDistanceKm = signal<number | null>(null);
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

  private calculateNextPeriapsis(): { date: Date, days: number } | null {
    return this.orbitalRelations.nextOrbitalEvent(this.body().bodyData, 'peri', this.appService.nowOverride() ?? Date.now());
  }

  private calculateNextApoapsis(): { date: Date, days: number } | null {
    return this.orbitalRelations.nextOrbitalEvent(this.body().bodyData, 'apo', this.appService.nowOverride() ?? Date.now());
  }

  /**
   * Current straight-line distance (km) from the parent body — the orbital radius at the
   * body's true anomaly right now — via the polar orbit equation r = a(1 − e²) / (1 + e·cos ν).
   * Propagates the recorded mean anomaly to the same wall-clock "now" (or `?t=` override) that
   * Next Apoapsis/Periapsis use, rather than the shared system-epoch snapshot Mean/True Anomaly
   * show, so it reads as a genuinely live value. Null when the semi-major axis, eccentricity,
   * or recorded mean anomaly + timestamp needed to propagate it is unavailable. Also null for
   * an eccentricity outside [0, 1) (parabolic/hyperbolic escape trajectory, or corrupt data) —
   * there's no recurring, bound orbit to place a "current distance" on — matching the same
   * bound {@link OrbitalRelationsCore.orbitalRadialRange} enforces before computing extents.
   */
  private calculateParentDistanceKm(): number | null {
    const bd = this.body().bodyData;
    const aKm = this.getSemiMajorAxisKm();
    const e = bd.orbitalEccentricity;
    if (aKm == null || e == null || !(e >= 0) || e >= 1 || bd.meanAnomaly == null || !bd.orbitalPeriod || !bd.timestamps?.meanAnomaly) { return null; }
    const now = this.appService.nowOverride() ?? Date.now();
    const meanNow = this.orbitalRelations.meanAnomalyNow(bd.meanAnomaly, bd.orbitalPeriod, bd.timestamps.meanAnomaly, now);
    if (!Number.isFinite(meanNow)) { return null; }
    const nu = this.orbitalRelations.meanToTrueAnomaly(meanNow, e) * RADIANS_PER_DEGREE;
    return (aKm * (1 - e * e)) / (1 + e * Math.cos(nu));
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

  public async showOnFootSafetyDialog(): Promise<void> {
    const bd = this.body().bodyData;
    const surfTemp = bd.surfaceTemperature ?? null;
    const estRange = surfTemp ? estimateTempRange(surfTemp, bd.subType, bd.atmosphereType, bd.surfacePressure) : null;
    const { delta, source } = lookupTempDelta(bd.subType, bd.atmosphereType, bd.surfacePressure);
    openLazyDialog(this.dialog, {
      loader: () => import('../dialogs/on-foot-safety-dialog/on-foot-safety-dialog.component').then(m => m.OnFootSafetyDialogComponent),
      skeleton: 'text',
      width: '900px',
      maxWidth: '95vw',
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

  public async showTidalLockDialog(): Promise<void> {
    openLazyDialog(this.dialog, {
      loader: () => import('../dialogs/tidal-lock-dialog/tidal-lock-dialog.component').then(m => m.TidalLockDialogComponent),
      skeleton: 'text',
      width: '900px',
      maxWidth: '95vw',
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop',
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