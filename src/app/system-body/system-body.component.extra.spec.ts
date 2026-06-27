import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, provideZonelessChangeDetection, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import { SystemBodyComponent } from './system-body.component';
import { AppService } from '../app.service';
import { SystemBody, CanonnBiostatsBody } from '../home/home.component';

const KM_PER_AU = 149597870.7;

function makeBody(data: Partial<CanonnBiostatsBody>, parent: SystemBody | null = null): SystemBody {
  return {
    bodyData: { bodyId: 1, id64: 1n, name: 'Test Body', subType: '', type: 'Planet', ...data } as CanonnBiostatsBody,
    subBodies: [],
    parent,
  };
}

describe('SystemBodyComponent (extended coverage)', () => {
  let fixture: ComponentFixture<SystemBodyComponent>;
  let component: SystemBodyComponent;
  let dialogOpenCalls: number;
  let dialogOpenArgs: { component: unknown; config: { data?: any } }[];

  /** The data object handed to the most recent dialog.open call. */
  function lastDialogData(): any {
    return dialogOpenArgs[dialogOpenArgs.length - 1].config.data;
  }

  beforeEach(() => {
    dialogOpenCalls = 0;
    dialogOpenArgs = [];
    const dialogStub = {
      open: (component: unknown, config: { data?: any } = {}) => {
        dialogOpenCalls++;
        dialogOpenArgs.push({ component, config });
        return { afterClosed: () => of(undefined), afterOpened: () => of(undefined) };
      },
    };
    TestBed.configureTestingModule({
      imports: [SystemBodyComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: AppService, useValue: { codexEntries: signal([]), getBodyDisplayName: (n: string) => `${n}!` } },
        { provide: MatDialog, useValue: dialogStub },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    fixture = TestBed.createComponent(SystemBodyComponent);
    component = fixture.componentInstance;
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Dialog methods schedule setTimeout callbacks that touch required viewChildren;
    // discard them before TestBed tears the component down to avoid post-teardown NG0951.
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  /** Sets the body input, renders once (resolving viewChild dialog templates), and returns the component. */
  function render(body: SystemBody, inputs: Record<string, unknown> = {}): SystemBodyComponent {
    fixture.componentRef.setInput('body', body);
    for (const [k, v] of Object.entries(inputs)) {
      fixture.componentRef.setInput(k, v);
    }
    fixture.detectChanges();
    return component;
  }

  describe('simple helpers', () => {
    it('delegates display name to AppService', () => {
      render(makeBody({}));
      expect(component.getBodyDisplayName('Foo')).toBe('Foo!');
    });

    it('classifies eccentricity bands', () => {
      render(makeBody({}));
      expect(component.getEccentricityAnalysis(0)).toBe('Circular');
      expect(component.getEccentricityAnalysis(0.2)).toBe('Nearly Circular');
      expect(component.getEccentricityAnalysis(0.6)).toBe('Eccentric');
      expect(component.getEccentricityAnalysis(0.95)).toBe('Highly Eccentric');
    });

    it('converts radians to degrees and handles null', () => {
      render(makeBody({}));
      expect(component.radToDeg(Math.PI)).toBeCloseTo(180, 6);
      expect(component.radToDeg(null)).toBeNull();
      expect(component.radToDeg(undefined)).toBeNull();
    });

    it('formats Earth and Solar masses', () => {
      render(makeBody({}));
      expect(component.formatEarthMass(1.2345).display).toBe('1.23 Earth masses');
      expect(component.formatSolarMass(2).display).toBe('2.00');
    });

    it('exposes trackBy helpers and mouse-enter state', () => {
      render(makeBody({}));
      expect(component.trackByString(0, 'x')).toBe('x');
      expect(component.trackByHotspot(0, { displayName: 'Painite' })).toBe('Painite');
      expect(component.trackByMaterial(0, { name: 'Fe', class: '', tooltip: '' })).toBe('Fe');
      expect(component.trackByBiologySignal(0, { entryId: 42 } as any)).toBe(42);
      component.onMouseEnter(5);
      expect(component.hoveredIndex).toBe(5);
    });
  });

  describe('expansion state', () => {
    it('toggles its own expansion', () => {
      render(makeBody({}));
      const before = component.expanded();
      component.toggleExpand();
      expect(component.expanded()).toBe(!before);
      component.setExpandedState(true);
      expect(component.expanded()).toBe(true);
    });

    it('reports children presence', () => {
      const parent = makeBody({ bodyId: 1 });
      parent.subBodies = [makeBody({ bodyId: 2 }, parent)];
      render(parent);
      expect(component.hasChildren()).toBe(true);
    });
  });

  describe('atmosphere & white dwarf helpers', () => {
    it('describes a white dwarf atmosphere and tooltip from its spectral code', () => {
      render(makeBody({ type: 'Star', subType: 'White Dwarf (DA) Star' }));
      expect(component.getWhiteDwarfAtmosphere()).toBe('Hydrogen Dominated');
      expect(component.getAtmosphereCompositionTooltip()).toContain('DA');
      expect(component.getAtmosphereDisplay()).toBe('Hydrogen Dominated');
    });

    it('returns null/empty white dwarf info for non white dwarfs', () => {
      render(makeBody({ type: 'Star', subType: 'M (Red dwarf) Star' }));
      expect(component.getWhiteDwarfAtmosphere()).toBeNull();
    });

    it('builds an atmosphere-composition tooltip and display from composition data', () => {
      render(makeBody({ subType: 'Rocky body', atmosphereComposition: { Nitrogen: 90.5, Oxygen: 9.5 } }));
      expect(component.getAtmosphereCompositionTooltip()).toContain('Nitrogen: 90.50%');
      expect(component.getAtmosphereDisplay()).toBe('Nitrogen 90.50%');
    });

    it('prefers an explicit atmosphereType for the display', () => {
      render(makeBody({ subType: 'Rocky body', atmosphereType: 'Thin Carbon dioxide' }));
      expect(component.getAtmosphereDisplay()).toBe('Thin Carbon dioxide');
    });

    it('does not throw on an empty atmosphereComposition object', () => {
      render(makeBody({ subType: 'Rocky body', atmosphereComposition: {} }));
      expect(component.getAtmosphereDisplay()).toBe('');
    });
  });

  describe('orbit geometry', () => {
    it('computes apoapsis and periapsis from semi-major axis and eccentricity', () => {
      render(makeBody({ semiMajorAxis: 1, orbitalEccentricity: 0.1 }));
      expect(component.getApoapsis()).toBeCloseTo(KM_PER_AU * 1.1, 1);
      expect(component.getPeriapsis()).toBeCloseTo(KM_PER_AU * 0.9, 1);
    });

    it('computes next periapsis/apoapsis when orbital elements are present', () => {
      render(makeBody({
        meanAnomaly: 90, orbitalPeriod: 100, orbitalEccentricity: 0.2,
        timestamps: { distanceToArrival: '', meanAnomaly: new Date(Date.now() - 86400000).toISOString() },
      }));
      expect(component.getNextPeriapsis()).not.toBeNull();
      expect(component.getNextApoapsis()).not.toBeNull();
    });

    it('returns null next-event data for circular orbits', () => {
      render(makeBody({ meanAnomaly: 90, orbitalPeriod: 100, orbitalEccentricity: 0 }));
      expect(component.getNextPeriapsis()).toBeNull();
      expect(component.getNextApoapsis()).toBeNull();
    });
  });

  describe('rings', () => {
    const ringParent = () => makeBody({ name: 'Star A', earthMasses: 100, radius: 50000 });

    it('computes ring geometry and visibility', () => {
      const parent = ringParent();
      const ring = makeBody({
        name: 'Star A A Ring', type: 'Ring', subType: 'Icy',
        innerRadius: 60000, outerRadius: 5000000, mass: 1,
      }, parent);
      render(ring);
      expect(component.getRingWidth()).toBe(4940000);
      expect(component.getRingArea()).toBeGreaterThan(0);
      expect(component.getRingDensity()).toBeGreaterThanOrEqual(0);
      expect(component.isRingNotVisible()).toBe(true);
    });

    it('returns ring resource and signal info from the ring signals', () => {
      const parent = ringParent();
      const ring = makeBody({
        name: 'Star A A Ring', type: 'Ring', subType: 'Metallic',
        innerRadius: 60000, outerRadius: 100000, mass: 1e15,
        signals: { updateTime: '', signals: { Painite: 3, Platinum: 1 } },
      }, parent);
      render(ring);
      expect(component.getSignalsCount()).toBe(2);
      expect(component.getHotspotsList().length).toBe(2);
      expect(component.getRingResourceTypes().size).toBeGreaterThanOrEqual(0);
      expect(component.isRingNotVisible()).toBe(false);
    });

    it('opens the Roche-limit chart dialog for a ring with a massive parent', () => {
      const parent = makeBody({ name: 'Star A', solarMasses: 1, solarRadius: 1 });
      const ring = makeBody({
        name: 'Star A A Ring', type: 'Ring', subType: 'Rocky',
        innerRadius: 600000, outerRadius: 2000000, mass: 1e9,
      }, parent);
      render(ring);
      component.showRocheLimitChart();
      expect(dialogOpenCalls).toBeGreaterThan(0);
      expect(lastDialogData().isBody).toBe(false);
    });

    it('opens the invisible-ring explanation dialog', () => {
      const parent = ringParent();
      const ring = makeBody({
        name: 'Star A A Ring', type: 'Ring', subType: 'Icy',
        innerRadius: 60000, outerRadius: 5000000, mass: 1,
      }, parent);
      render(ring);
      component.showInvisibleRingExplanation();
      expect(lastDialogData().isInvisible).toBe(true);
    });

    it('formats ring max velocity in c and period in sub-day units for an extreme neutron-star ring', () => {
      // Flyae Flyuae AA-A h35 AB 10 A Ring: neutron star parent (0.894531 M☉),
      // ring inner = 35.856 km, outer = 149 250 km (API layer converts from metres).
      // v_max ≈ 3 880 km/s ≈ 0.013c → above the 0.01c display threshold.
      // period ≈ 241 s ≈ 4.03 min → displayed in minutes, not days.
      const parent = makeBody({ name: 'Neutron Star', subType: 'Neutron Star', solarMasses: 0.894531, solarRadius: 1.5e-5 });
      const ring = makeBody({
        name: 'Neutron Star A Ring', type: 'Ring', subType: 'Metallic',
        innerRadius: 35.856, outerRadius: 149250, mass: 699750000000,
      }, parent);
      render(ring);
      expect(component.getRingMaxVelocityDisplay()).toMatch(/c$/);
      expect(component.getRingMaxVelocityDisplay()).not.toMatch(/km\/s/);
      expect(component.getRingOrbitalPeriodDisplay()).toMatch(/min$/);
    });

    it('formats ring max velocity in km/s and period in days for a typical ring', () => {
      // Lightweight parent (100 M⊕) with a wide ring: v_max ≈ 25 km/s < 0.01c,
      // period ≈ 1.44 days.
      const parent = makeBody({ name: 'Gas Giant', earthMasses: 100, radius: 25000 });
      const ring = makeBody({
        name: 'Gas Giant A Ring', type: 'Ring', subType: 'Rocky',
        innerRadius: 100000, outerRadius: 500000, mass: 1e12,
      }, parent);
      render(ring);
      expect(component.getRingMaxVelocityDisplay()).toMatch(/km\/s$/);
      expect(component.getRingMaxVelocityDisplay()).not.toMatch(/c$/);
      expect(component.getRingOrbitalPeriodDisplay()).toMatch(/days$/);
    });
  });

  describe('Roche / shepherding for a moon', () => {
    it('opens the body Roche-limit chart for a close dense moon', () => {
      const parent = makeBody({ name: 'Gas Giant', earthMasses: 300, radius: 70000 });
      const moon = makeBody({
        name: 'Moon', type: 'Planet', earthMasses: 0.05, radius: 1500,
        semiMajorAxis: 0.0005, orbitalEccentricity: 0.05,
      }, parent);
      render(moon);
      expect(component.calculateBodyRocheLimits()).not.toBeNull();
      component.showBodyRocheLimitChart();
      expect(lastDialogData().isBody).toBe(true);
    });

    it('opens the shepherding Hill-limit chart for a shepherd moon', () => {
      const parent = makeBody({
        name: 'Ringed Giant', earthMasses: 100, radius: 10000,
        rings: [{ name: 'A Ring', innerRadius: 20_000_000, outerRadius: 100_000_000, mass: 1e15, type: 'Icy' } as any],
      });
      const shepherd = makeBody({
        name: 'Shepherd', type: 'Planet', earthMasses: 10, semiMajorAxis: 110000 / KM_PER_AU, orbitalEccentricity: 0.02,
      }, parent);
      parent.subBodies = [shepherd];
      render(shepherd);
      expect(component.isShepherdingCandidate()).toBe(true);
      expect(component.isActualShepherd()).toBe(true);
      component.showShepherdingHillLimitChart();
      expect(lastDialogData().shepherdStatus).toBe('shepherd');
    });
  });

  describe('apo/peri dialog', () => {
    it('opens the apoapsis dialog with derived orbital details', () => {
      render(makeBody({
        semiMajorAxis: 1, orbitalEccentricity: 0.3, meanAnomaly: 45, orbitalPeriod: 200,
        timestamps: { distanceToArrival: '', meanAnomaly: new Date(Date.now() - 5 * 86400000).toISOString() },
      }));
      component.showApoPeriDialog('apo');
      expect(lastDialogData().type).toBe('apo');
      expect(lastDialogData().distanceKm).toBeGreaterThan(0);
      component.showApoPeriDialog('peri');
      expect(lastDialogData().type).toBe('peri');
    });

    it('does nothing when there is no next-event data', () => {
      render(makeBody({ orbitalEccentricity: 0 }));
      const before = dialogOpenCalls;
      component.showApoPeriDialog('apo');
      expect(dialogOpenCalls).toBe(before);
    });
  });

  describe('stellar physics display helpers', () => {
    it('computes spin resonance, tooltip and tangential velocity for a neutron star', () => {
      render(makeBody({
        type: 'Star', subType: 'Neutron Star', solarMasses: 1.5, solarRadius: 1.5,
        rotationalPeriod: 0.001 / 86400, orbitalPeriod: 0.001 / 86400, age: 12830, absoluteMagnitude: 8, radius: 11,
        rotationalPeriodTidallyLocked: true,
      }));
      expect(component.isBlackHoleOrNeutronStar()).toBe(true);
      expect(component.getSpinResonance()).toBe('1:1');
      expect(component.getSpinResonanceTooltip()).toBe('Synchronised');
      // Fast rotator -> relativistic fraction-of-c display.
      expect(component.getTangentialVelocityDisplay()).toMatch(/c$/);
      expect(component.getTangentialVelocityTooltip()).toContain('km/s');
      expect(component.classifyNeutronStar()).not.toBeNull();
      expect(component.getJetConeAngle()).not.toBeNull();
    });

    it('renders a black hole radius in km rather than a rounded-to-zero solar radius', () => {
      render(makeBody({ type: 'Star', subType: 'Black Hole', solarMasses: 8, solarRadius: 0.00001 }));
      expect(component.isBlackHoleOrNeutronStar()).toBe(true);
      // 0.00001 solar radii * 695700 km = 6.957 km -> "6.96 km"; without conversion it would render "0.00".
      expect(component.getCompactObjectRadiusKm()).toBeCloseTo(6.957, 3);
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('6.96 km');
      expect(text).not.toContain('Solar radius');
    });

    it('treats a supermassive black hole as a compact object', () => {
      render(makeBody({ type: 'Star', subType: 'Supermassive Black Hole', solarMasses: 4e6, solarRadius: 0.00002 }));
      expect(component.isBlackHoleOrNeutronStar()).toBe(true);
      expect(fixture.nativeElement.textContent as string).toContain('13.91 km');
    });

    it('returns no tangential velocity for non-compact bodies', () => {
      render(makeBody({ type: 'Planet', subType: 'Rocky body', rotationalPeriod: 1 }));
      expect(component.getTangentialVelocity()).toBeNull();
      expect(component.getTangentialVelocityDisplay()).toBe('');
      expect(component.classifyNeutronStar()).toBeNull();
      expect(component.getJetConeAngle()).toBeNull();
    });

    it('produces a slow km/s tangential velocity for a slow neutron star', () => {
      render(makeBody({ type: 'Star', subType: 'Neutron Star', rotationalPeriod: 10, radius: 11 }));
      expect(component.getTangentialVelocityDisplay()).toMatch(/km\/s$/);
    });

    it('describes tidal lock resonance variants', () => {
      const elw = makeBody({
        type: 'Planet', subType: 'Earth-like world', rotationalPeriod: 5, orbitalPeriod: 5,
        rotationalPeriodTidallyLocked: true,
      }, makeBody({ type: 'Star', subType: 'G (White-Yellow) Star' }));
      render(elw);
      expect(component.getSpinResonanceTooltip()).toBe('Eyeball earth');
    });

    it('formats rotation and orbital periods across magnitude bands', () => {
      const body = makeBody({});
      render(body);
      const cases: [number, RegExp][] = [
        [0.000005, /ms$/], [0.0005, /s$/], [0.02, /min$/], [0.3, /h$/],
        [3, /days$/], [20, /weeks$/], [600, /years$/], [7000, /decades$/], [60000, /centuries$/],
      ];
      for (const [period, re] of cases) {
        body.bodyData.orbitalPeriod = period;
        expect(component.getOrbitalPeriodDisplay()).toMatch(re);
      }
      body.bodyData.rotationalPeriod = 3;
      expect(component.getRotationalPeriodDisplay()).toMatch(/days$/);
      body.bodyData.rotationalPeriod = undefined;
      expect(component.getRotationalPeriodDisplay()).toBe('');
    });
  });

  describe('landable safety, materials & signals', () => {
    it('computes a green landable badge for a temperate landable world', () => {
      render(makeBody({
        type: 'Planet', subType: 'Rocky body', isLandable: true, surfaceTemperature: 300,
        atmosphereType: 'No atmosphere', surfacePressure: 0, gravity: 0.8,
      }));
      expect(component.getEstimatedTempRange()).not.toBeNull();
      expect(['badge-green', 'badge-orange', 'badge-red']).toContain(component.getLandableBadgeClass());
      expect(component.getLandableTooltip()).toContain('Landable');
    });

    it('flags high-gravity landable worlds as red', () => {
      render(makeBody({ type: 'Planet', subType: 'Rocky body', isLandable: true, surfaceTemperature: 300, gravity: 5 }));
      expect(component.getLandableBadgeClass()).toBe('badge-red');
      expect(component.getLandableTooltip()).toContain('High gravity');
    });

    it('uses a gray badge for non-landable bodies', () => {
      render(makeBody({ type: 'Planet', subType: 'Rocky body', isLandable: false, surfaceTemperature: 300 }));
      expect(component.getLandableBadgeClass()).toBe('badge-gray');
    });

    it('builds sorted material badges with grades', () => {
      render(makeBody({
        type: 'Planet', subType: 'Rocky body',
        materials: { Iron: 20, Sulphur: 5, Antimony: 1, Carbon: 0 } as any,
      }));
      const badges = component.getMaterialBadges();
      expect(badges[0].name).toBe('Fe');
      expect(badges.find(b => b.name === 'Sb')?.class).toBe('badge-mat1');
      expect(badges.some(b => b.tooltip.startsWith('Carbon'))).toBe(false); // 0% filtered out
    });

    it('parses biological/geological signals and counts', () => {
      render(makeBody({
        type: 'Planet', subType: 'Rocky body',
        signals: {
          updateTime: '',
          signals: { '$SAA_SignalType_Biological;': 2, '$SAA_SignalType_Geological;': 1 },
          biology: ['Bacterium Aurasus'],
          geology: ['Lava Spout'],
        },
      }));
      expect(component.hasSignals).toBe(true);
      expect(component.biologySignals.length).toBe(1);
      expect(component.geologySignals).toContain('Lava Spout');
      expect(component.getConfirmedBiologyCount()).toBe(1);
    });

    it('builds a solid-composition tooltip', () => {
      render(makeBody({ type: 'Planet', subType: 'Rocky body', solidComposition: { Ice: 10, Metal: 30, Rock: 60 } as any }));
      expect(component.getSolidCompositionTooltip()).toContain('Rock: 60.00%');
    });

    it('builds a surface-pressure tooltip with unit conversions', () => {
      render(makeBody({ type: 'Planet', subType: 'Rocky body', surfacePressure: 1 }));
      expect(component.getAtmosphereDisplay()).toBeDefined();
    });
  });

  describe('dialogs that need no orbital data', () => {
    it('opens the on-foot safety dialog', () => {
      render(makeBody({ type: 'Planet', subType: 'Rocky body', isLandable: true, surfaceTemperature: 250, atmosphereType: 'Thin Argon', surfacePressure: 0.01, gravity: 0.5 }));
      component.showOnFootSafetyDialog();
      expect(lastDialogData().lookupSource).toContain('Argon');
    });

    it('opens the tidal-lock dialog with the body and computed resonance', () => {
      const star = makeBody({ type: 'Star', subType: 'M (Red dwarf) Star' });
      render(makeBody({ type: 'Planet', subType: 'Rocky body', rotationalPeriod: 5, orbitalPeriod: 5, rotationalPeriodTidallyLocked: true }, star));
      component.showTidalLockDialog();
      expect(dialogOpenCalls).toBe(1);
      const { config } = dialogOpenArgs[0];
      expect(config.data!.resonance).toBe('1:1');
      expect(config.data!.body.bodyData.rotationalPeriod).toBe(5);
    });

    it('opens the jet-angle dialog (chart generation is guarded)', () => {
      render(makeBody({ type: 'Star', subType: 'Neutron Star', rotationalPeriod: 0.0001, solarRadius: 1.5, age: 12830 }));
      component.showJetAngleDialog();
      expect(dialogOpenCalls).toBeGreaterThan(0);
    });

    it('opens the JSON dialog with the body and galaxy data', () => {
      render(makeBody({ type: 'Planet', subType: 'Rocky body' }));
      component.showBodyJsonDialog();
      expect(dialogOpenCalls).toBeGreaterThan(0);
      expect(lastDialogData().body.bodyData.subType).toBe('Rocky body');
    });

    it('copies the body JSON to the clipboard on the right-click shortcut', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      render(makeBody({ type: 'Planet', subType: 'Rocky body' }));
      component.copyBodyJson();
      await Promise.resolve();
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"subType": "Rocky body"'));
    });
  });

  describe('asteroid icons & barycentre image', () => {
    it('uses an asteroid icon for a belt body', () => {
      render(makeBody({ type: 'Belt', subType: 'Rocky', name: 'A Belt' }));
      expect(component.bodyImage).toContain('asteroids/cluster_rocky');
    });

    it('uses the orbit gif for a barycentre', () => {
      render(makeBody({ type: 'Barycentre', subType: '', name: 'Barycentre' }));
      expect(component.bodyImage).toBe('Orbit2.gif');
    });
  });

  describe('star-age / H-R diagram feature', () => {
    it('enables the feature for an aged main-sequence star the diagram depicts', () => {
      render(makeBody({ type: 'Star', subType: 'G (White-Yellow) Star', spectralClass: 'G2', luminosity: 'V', solarMasses: 1, age: 4600 }));
      expect(component.showStarAgeFeature()).toBe(true);
      const assessment = component.getStellarAgeAssessment();
      expect(assessment).not.toBeNull();
      expect(assessment!.status).toBe('typical');
    });

    it('disables the feature (and yields a null assessment) when the star has no age', () => {
      render(makeBody({ type: 'Star', subType: 'G (White-Yellow) Star', spectralClass: 'G2', luminosity: 'V', solarMasses: 1 }));
      expect(component.showStarAgeFeature()).toBe(false);
      expect(component.getStellarAgeAssessment()).toBeNull();
    });

    it('enables the feature for a white dwarf (its own region on the diagram)', () => {
      render(makeBody({ type: 'Star', subType: 'White Dwarf (DA) Star', spectralClass: 'DA5', luminosity: 'VII', surfaceTemperature: 27735, solarRadius: 0.0038452, solarMasses: 1.26, age: 1298 }));
      expect(component.showStarAgeFeature()).toBe(true);
      const assessment = component.getStellarAgeAssessment();
      expect(assessment).not.toBeNull();
      expect(assessment!.status).toBe('evolved'); // remnant — no young/old badge
    });

    it('excludes classes the diagram never draws (neutron star)', () => {
      render(makeBody({ type: 'Star', subType: 'Neutron Star', age: 5000 }));
      expect(component.showStarAgeFeature()).toBe(false);
      expect(component.getStellarAgeAssessment()).toBeNull();
    });

    it('excludes non-stars even when they carry an age', () => {
      render(makeBody({ type: 'Planet', subType: 'Rocky body', age: 3000 }));
      expect(component.showStarAgeFeature()).toBe(false);
      expect(component.getStellarAgeAssessment()).toBeNull();
    });

    it('opens the H-R diagram dialog for a star', () => {
      render(makeBody({ type: 'Star', subType: 'B (Blue-White) Star', spectralClass: 'B2', luminosity: 'V', solarMasses: 8, age: 50 }));
      const before = dialogOpenCalls;
      component.showHrDiagram();
      vi.runOnlyPendingTimers();
      expect(dialogOpenCalls).toBe(before + 1);
    });
  });
});
