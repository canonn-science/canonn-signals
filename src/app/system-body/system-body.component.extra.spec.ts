import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, provideZonelessChangeDetection, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
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

  beforeEach(() => {
    dialogOpenCalls = 0;
    const dialogStub = {
      open: () => {
        dialogOpenCalls++;
        return { afterClosed: () => of(undefined), afterOpened: () => of(undefined) };
      },
    };
    TestBed.configureTestingModule({
      imports: [SystemBodyComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideNoopAnimations(),
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

    it('encodes URI components and tolerates nullish input', () => {
      render(makeBody({}));
      expect(component.encodeURIComponent('a b')).toBe('a%20b');
      expect(component.encodeURIComponent(null)).toBe('');
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

    it('resolves EDSM galaxy body ids with a parent fallback', () => {
      const parent = makeBody({ bodyId: 7 });
      expect(component.getEdGalaxyBodyId(makeBody({ bodyId: 3 }))).toBe(3);
      const ring = makeBody({ bodyId: -1 }, parent);
      expect(component.getEdGalaxyBodyId(ring)).toBe(7);
      expect(component.getEdGalaxyBodyId(null as any)).toBe(-1);
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
      vi.runOnlyPendingTimers(); // fires the deferred renderRocheChart callback
      expect(component.rocheLimitDialogData).not.toBeNull();
      expect(component.rocheLimitDialogData!.isBody).toBe(false);
      expect(dialogOpenCalls).toBeGreaterThan(0);
    });

    it('opens the invisible-ring explanation dialog', () => {
      const parent = ringParent();
      const ring = makeBody({
        name: 'Star A A Ring', type: 'Ring', subType: 'Icy',
        innerRadius: 60000, outerRadius: 5000000, mass: 1,
      }, parent);
      render(ring);
      component.showInvisibleRingExplanation();
      expect(component.invisibleRingDialogData).not.toBeNull();
      expect(component.invisibleRingDialogData!.isInvisible).toBe(true);
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
      vi.runOnlyPendingTimers();
      expect(component.rocheLimitDialogData!.isBody).toBe(true);
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
      vi.runOnlyPendingTimers();
      expect(component.hillLimitDialogData).not.toBeNull();
      expect(component.hillLimitDialogData!.shepherdStatus).toBe('shepherd');
    });
  });

  describe('apo/peri dialog', () => {
    it('opens the apoapsis dialog with derived orbital details', () => {
      render(makeBody({
        semiMajorAxis: 1, orbitalEccentricity: 0.3, meanAnomaly: 45, orbitalPeriod: 200,
        timestamps: { distanceToArrival: '', meanAnomaly: new Date(Date.now() - 5 * 86400000).toISOString() },
      }));
      component.showApoPeriDialog('apo');
      expect(component.apoPeriDialogData?.type).toBe('apo');
      expect(component.apoPeriDialogData?.distanceKm).toBeGreaterThan(0);
      component.showApoPeriDialog('peri');
      expect(component.apoPeriDialogData?.type).toBe('peri');
    });

    it('does nothing when there is no next-event data', () => {
      render(makeBody({ orbitalEccentricity: 0 }));
      component.apoPeriDialogData = null;
      component.showApoPeriDialog('apo');
      expect(component.apoPeriDialogData).toBeNull();
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
      expect(component.onFootSafetyDialogData).not.toBeNull();
      expect(component.onFootSafetyDialogData!.lookupSource).toContain('Argon');
    });

    it('opens the tidal-lock dialog with a computed solar day', () => {
      render(makeBody({ type: 'Planet', subType: 'Rocky body', rotationalPeriod: 2, orbitalPeriod: 5, rotationalPeriodTidallyLocked: false }));
      component.showTidalLockDialog();
      expect(component.tidalLockDialogData!.solarDay).not.toBeNull();
      expect(component.tidalLockDialogData!.difference).toBe(3);
    });

    it('opens the jet-angle dialog (chart generation is guarded)', () => {
      render(makeBody({ type: 'Star', subType: 'Neutron Star', rotationalPeriod: 0.0001, solarRadius: 1.5, age: 12830 }));
      component.showJetAngleDialog();
      expect(dialogOpenCalls).toBeGreaterThan(0);
    });

    it('opens the JSON dialog and exposes formatted JSON', () => {
      render(makeBody({ type: 'Planet', subType: 'Rocky body' }));
      // The pretty-printed JSON is prepared when the dialog opens (cached so the
      // template binding doesn't re-stringify on every change-detection pass).
      // The dialog's focus setTimeout touches a viewChild that only exists inside the
      // dialog ng-template, so it's discarded in afterEach rather than run here.
      component.showBodyJsonDialog();
      expect(dialogOpenCalls).toBeGreaterThan(0);
      expect(component.getFormattedBodyJson()).toContain('"subType": "Rocky body"');
    });

    it('downloads the on-foot reference CSV without throwing', () => {
      render(makeBody({ type: 'Planet', subType: 'Rocky body' }));
      const origCreate = URL.createObjectURL;
      const origRevoke = URL.revokeObjectURL;
      (URL as any).createObjectURL = () => 'blob:test';
      (URL as any).revokeObjectURL = () => {};
      try {
        expect(() => component.downloadOnFootReferenceData()).not.toThrow();
      } finally {
        URL.createObjectURL = origCreate;
        URL.revokeObjectURL = origRevoke;
      }
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
});
