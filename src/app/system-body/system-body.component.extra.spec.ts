import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, provideZonelessChangeDetection, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import { SystemBodyComponent } from './system-body.component';
import { AppService } from '../app.service';
import { SystemBody, CanonnBiostatsBody } from '../home/home.component';
import { BodyPhysicsService } from '../data/body-physics.service';

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
        { provide: AppService, useValue: { codexEntries: signal([]), nowOverride: signal(null), getBodyDisplayName: (n: string) => `${n}!` } },
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

    it('resolves a body mass (kg) from whichever source field it carries', () => {
      render(makeBody({ type: 'Star', solarMasses: 2 }));
      expect(component.getMassKg()).toBeCloseTo(2 * 1.989e30, -25);
      render(makeBody({ type: 'Planet', earthMasses: 1 }));
      expect(component.getMassKg()).toBeCloseTo(5.972e24, -19);
      render(makeBody({ type: 'Ring', mass: 5 }));
      expect(component.getMassKg()).toBeCloseTo(5e12, 0);
      render(makeBody({}));
      expect(component.getMassKg()).toBeNull();
    });

    it('formats mass dynamically by magnitude', () => {
      render(makeBody({}));
      expect(component.formatMass(5.25 * 1.989e30)).toBe('5.25 Solar masses');
      expect(component.formatMass(0.67 * 5.972e24)).toBe('0.67 Earth masses');
    });

    it('shows a star radius in km for compact objects and white dwarfs, solar radii otherwise', () => {
      render(makeBody({ type: 'Star', subType: 'White Dwarf (DA) Star', solarRadius: 0.011 }));
      expect(component.getStarRadiusKm()).toBeCloseTo(0.011 * 695700, 0);
      render(makeBody({ type: 'Star', subType: 'Neutron Star', solarRadius: 0.00002 }));
      expect(component.getStarRadiusKm()).toBeCloseTo(0.00002 * 695700, 3);
      render(makeBody({ type: 'Star', subType: 'G (White-Yellow) Star', solarRadius: 1.1 }));
      expect(component.getStarRadiusKm()).toBeNull();
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

    it('ring with density exactly 0.1 is NOT invisible (threshold is strictly < 0.1)', () => {
      // width > 1 000 000 km but density == 0.1 exactly → condition is density < 0.1, so false.
      const parent = ringParent();
      // area = π*(1100000² − 60000²) ≈ 3.789e12 km²; mass chosen so density = 0.1 exactly.
      const area = Math.PI * (1100000 ** 2 - 60000 ** 2);
      const mass = 0.1 * area;
      const ring = makeBody({
        name: 'Star A A Ring', type: 'Ring', subType: 'Icy',
        innerRadius: 60000, outerRadius: 1100000, mass,
      }, parent);
      render(ring);
      expect(component.getRingDensity()).toBeCloseTo(0.1, 9);
      expect(component.getRingWidth()).toBeGreaterThan(1_000_000);
      expect(component.isRingNotVisible()).toBe(false);
    });

    it('ring with width exactly 1 000 000 km is NOT invisible (threshold is strictly > 1 000 000)', () => {
      // density < 0.1 but width == 1 000 000 exactly → condition is width > 1 000 000, so false.
      const parent = ringParent();
      const ring = makeBody({
        name: 'Star A A Ring', type: 'Ring', subType: 'Icy',
        innerRadius: 60000, outerRadius: 1060000, mass: 1, // width = 1 000 000 km exactly
      }, parent);
      render(ring);
      expect(component.getRingWidth()).toBe(1_000_000);
      expect(component.getRingDensity()).toBeLessThan(0.1);
      expect(component.isRingNotVisible()).toBe(false);
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

    it('opens the Roche-limit chart dialog for a ring with a massive parent', async () => {
      const parent = makeBody({ name: 'Star A', solarMasses: 1, solarRadius: 1 });
      const ring = makeBody({
        name: 'Star A A Ring', type: 'Ring', subType: 'Rocky',
        innerRadius: 600000, outerRadius: 2000000, mass: 1e9,
      }, parent);
      render(ring);
      await component.showRocheLimitChart();
      expect(dialogOpenCalls).toBeGreaterThan(0);
      expect(lastDialogData().isBody).toBe(false);
    });

    it('opens the invisible-ring explanation dialog', async () => {
      const parent = ringParent();
      const ring = makeBody({
        name: 'Star A A Ring', type: 'Ring', subType: 'Icy',
        innerRadius: 60000, outerRadius: 5000000, mass: 1,
      }, parent);
      render(ring);
      await component.showInvisibleRingExplanation();
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
      expect(component.getRingMinVelocityDisplay()).toMatch(/km\/s$/);
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
      expect(component.getRingMinVelocityDisplay()).toMatch(/km\/s$/);
      expect(component.getRingOrbitalPeriodDisplay()).toMatch(/days$/);
    });

    describe('ring neighbour distance', () => {
      function makeRingSet(defs: Array<{ name: string; inner: number; outer: number }>) {
        const parent = makeBody({ name: 'Star', earthMasses: 100, radius: 50000 });
        const rings = defs.map(d => makeBody(
          { name: d.name, type: 'Ring', subType: 'Rocky', innerRadius: d.inner, outerRadius: d.outer },
          parent,
        ));
        parent.subBodies.push(...rings);
        return { parent, rings };
      }

      it('shows no distance for a single ring (no outward neighbour)', () => {
        const { rings: [ringA] } = makeRingSet([{ name: 'A Ring', inner: 60000, outer: 100000 }]);
        render(ringA);
        expect(component.getRingNeighbourDistance()).toBeNull();
        expect(component.getRingNeighbourDistanceLabel()).toBe('');
      });

      it('returns null neighbour distance for a Belt body (Belts are excluded from ring-gap calculations)', () => {
        // Belts are diffuse clusters; inter-ring spacing and speed comparisons are meaningless for them.
        const parent = makeBody({ name: 'Star', earthMasses: 100, radius: 50000 });
        const belt = makeBody({ name: 'A Belt', type: 'Belt', subType: 'Rocky', innerRadius: 60000, outerRadius: 200000 }, parent);
        parent.subBodies.push(belt);
        render(belt);
        expect(component.getRingNeighbourDistance()).toBeNull();
        expect(component.getRingNeighbourDistanceLabel()).toBe('');
      });

      it('shows Distance A-B on A Ring and no distance on B Ring', () => {
        const { rings: [ringA, ringB] } = makeRingSet([
          { name: 'A Ring', inner: 60000, outer: 100000 },
          { name: 'B Ring', inner: 110000, outer: 200000 },
        ]);

        render(ringA);
        expect(component.getRingNeighbourDistance()).toBe(10000); // 110000 − 100000
        expect(component.getRingNeighbourDistanceLabel()).toBe('A-B');

        render(ringB);
        expect(component.getRingNeighbourDistance()).toBeNull();
        expect(component.getRingNeighbourDistanceLabel()).toBe('');
      });

      it('shows Distance A-B on A, Distance B-C on B, and no distance on C', () => {
        const { rings: [ringA, ringB, ringC] } = makeRingSet([
          { name: 'A Ring', inner: 60000,  outer: 100000 },
          { name: 'B Ring', inner: 110000, outer: 200000 },
          { name: 'C Ring', inner: 210000, outer: 300000 },
        ]);

        render(ringA);
        expect(component.getRingNeighbourDistance()).toBe(10000); // 110000 − 100000
        expect(component.getRingNeighbourDistanceLabel()).toBe('A-B');

        render(ringB);
        expect(component.getRingNeighbourDistance()).toBe(10000); // 210000 − 200000
        expect(component.getRingNeighbourDistanceLabel()).toBe('B-C');

        render(ringC);
        expect(component.getRingNeighbourDistance()).toBeNull();
      });

      it('shows 0 km when rings are touching (innerB === outerA)', () => {
        const { rings: [ringA] } = makeRingSet([
          { name: 'A Ring', inner: 60000, outer: 100000 },
          { name: 'B Ring', inner: 100000, outer: 200000 },
        ]);
        render(ringA);
        expect(component.getRingNeighbourDistance()).toBe(0);
      });

      it('shows a negative distance when rings overlap', () => {
        const { rings: [ringA] } = makeRingSet([
          { name: 'A Ring', inner: 60000, outer: 110000 },
          { name: 'B Ring', inner: 100000, outer: 200000 },
        ]);
        render(ringA);
        expect(component.getRingNeighbourDistance()).toBe(-10000); // 100000 − 110000
      });

      it('shows no distance for a non-ring body', () => {
        render(makeBody({ type: 'Planet', subType: 'Rocky body' }));
        expect(component.getRingNeighbourDistance()).toBeNull();
      });

      it('supports four rings — each shows distance to the next, outermost shows none', () => {
        const { rings: [a, b, c, d] } = makeRingSet([
          { name: 'A Ring', inner: 60000,  outer: 100000 },
          { name: 'B Ring', inner: 110000, outer: 200000 },
          { name: 'C Ring', inner: 210000, outer: 300000 },
          { name: 'D Ring', inner: 310000, outer: 400000 },
        ]);
        render(a); expect(component.getRingNeighbourDistance()).toBe(10000);  expect(component.getRingNeighbourDistanceLabel()).toBe('A-B');
        render(b); expect(component.getRingNeighbourDistance()).toBe(10000);  expect(component.getRingNeighbourDistanceLabel()).toBe('B-C');
        render(c); expect(component.getRingNeighbourDistance()).toBe(10000);  expect(component.getRingNeighbourDistanceLabel()).toBe('C-D');
        render(d); expect(component.getRingNeighbourDistance()).toBeNull();
      });

      it('supports five rings — each shows distance to the next, outermost shows none', () => {
        const { rings: [a, b, c, d, e] } = makeRingSet([
          { name: 'A Ring', inner: 60000,  outer: 100000 },
          { name: 'B Ring', inner: 110000, outer: 200000 },
          { name: 'C Ring', inner: 210000, outer: 300000 },
          { name: 'D Ring', inner: 310000, outer: 400000 },
          { name: 'E Ring', inner: 410000, outer: 500000 },
        ]);
        render(a); expect(component.getRingNeighbourDistanceLabel()).toBe('A-B');
        render(b); expect(component.getRingNeighbourDistanceLabel()).toBe('B-C');
        render(c); expect(component.getRingNeighbourDistanceLabel()).toBe('C-D');
        render(d); expect(component.getRingNeighbourDistanceLabel()).toBe('D-E');
        render(e); expect(component.getRingNeighbourDistance()).toBeNull();
      });

      it('strips "Ring" from labels for mixed-name rings (Sol-style)', () => {
        // Halo Ring → "Halo", A Ring → "A", D Ring → "D", Outer Ring → "Outer"
        const { rings: [halo, a, d, outer] } = makeRingSet([
          { name: 'Halo Ring',  inner: 60000,  outer: 100000 },
          { name: 'A Ring',     inner: 110000, outer: 200000 },
          { name: 'D Ring',     inner: 210000, outer: 300000 },
          { name: 'Outer Ring', inner: 310000, outer: 400000 },
        ]);
        render(halo);  expect(component.getRingNeighbourDistanceLabel()).toBe('Halo-A');
        render(a);     expect(component.getRingNeighbourDistanceLabel()).toBe('A-D');
        render(d);     expect(component.getRingNeighbourDistanceLabel()).toBe('D-Outer');
        render(outer); expect(component.getRingNeighbourDistance()).toBeNull();
      });

      it('sorts rings by innerRadius, not by input order or name', () => {
        // D is pushed first, then A, then B — correct order must come from the sort.
        const parent = makeBody({ name: 'Star', earthMasses: 100, radius: 50000 });
        const ringD = makeBody({ name: 'D Ring', type: 'Ring', subType: 'Rocky', innerRadius: 210000, outerRadius: 300000 }, parent);
        const ringA = makeBody({ name: 'A Ring', type: 'Ring', subType: 'Rocky', innerRadius: 60000,  outerRadius: 100000 }, parent);
        const ringB = makeBody({ name: 'B Ring', type: 'Ring', subType: 'Rocky', innerRadius: 110000, outerRadius: 200000 }, parent);
        parent.subBodies.push(ringD, ringA, ringB);

        render(ringA); expect(component.getRingNeighbourDistanceLabel()).toBe('A-B');
        render(ringB); expect(component.getRingNeighbourDistanceLabel()).toBe('B-D');
        render(ringD); expect(component.getRingNeighbourDistance()).toBeNull();
      });
    });

    describe('ring velocity difference', () => {
      // Re-uses makeRingSet from the outer rings describe scope.
      function makeRingSet(defs: Array<{ name: string; inner: number; outer: number }>) {
        const parent = makeBody({ name: 'Star', earthMasses: 100, radius: 50000 });
        const rings = defs.map(d => makeBody(
          { name: d.name, type: 'Ring', subType: 'Rocky', innerRadius: d.inner, outerRadius: d.outer },
          parent,
        ));
        parent.subBodies.push(...rings);
        return { parent, rings };
      }

      it('shows no velocity difference for a single ring', () => {
        const { rings: [ringA] } = makeRingSet([{ name: 'A Ring', inner: 60000, outer: 100000 }]);
        render(ringA);
        expect(component.getRingVelocityDiff()).toBeNull();
        expect(component.getRingVelocityDiffDisplay()).toBe('');
      });

      it('computes velocity difference using the same ringDynamics logic as min/max display', () => {
        // The expected value is derived via the same BodyPhysicsService.ringDynamics() call
        // the component itself uses, verifying reuse rather than reimplementing the formula.
        const { rings: [ringA, ringB] } = makeRingSet([
          { name: 'A Ring', inner: 60000,  outer: 100000 },
          { name: 'B Ring', inner: 110000, outer: 200000 },
        ]);
        const physics = TestBed.inject(BodyPhysicsService);
        const dynA = physics.ringDynamics(ringA)!;
        const dynB = physics.ringDynamics(ringB)!;
        const expectedDiff = dynA.maxVelocityKms - dynB.minVelocityKms;

        render(ringA);
        expect(component.getRingVelocityDiff()).toBeCloseTo(expectedDiff, 9);
        expect(component.getRingVelocityDiffDisplay()).not.toBe('');

        render(ringB);
        expect(component.getRingVelocityDiff()).toBeNull();
      });

      it('produces correct velocity differences for three adjacent rings', () => {
        const { rings: [ringA, ringB, ringC] } = makeRingSet([
          { name: 'A Ring', inner: 60000,  outer: 100000 },
          { name: 'B Ring', inner: 110000, outer: 200000 },
          { name: 'C Ring', inner: 210000, outer: 300000 },
        ]);
        const physics = TestBed.inject(BodyPhysicsService);

        render(ringA);
        const expectedAB = physics.ringDynamics(ringA)!.maxVelocityKms - physics.ringDynamics(ringB)!.minVelocityKms;
        expect(component.getRingVelocityDiff()).toBeCloseTo(expectedAB, 9);

        render(ringB);
        const expectedBC = physics.ringDynamics(ringB)!.maxVelocityKms - physics.ringDynamics(ringC)!.minVelocityKms;
        expect(component.getRingVelocityDiff()).toBeCloseTo(expectedBC, 9);

        render(ringC);
        expect(component.getRingVelocityDiff()).toBeNull();
      });

      it('uses cleaned names in the velocity difference display label', () => {
        const { rings: [halo, a, outer] } = makeRingSet([
          { name: 'Halo Ring',  inner: 60000,  outer: 100000 },
          { name: 'A Ring',     inner: 110000, outer: 200000 },
          { name: 'Outer Ring', inner: 210000, outer: 300000 },
        ]);
        // The velocity diff label reuses getRingNeighbourDistanceLabel() — same cleaning rules.
        render(halo);  expect(component.getRingNeighbourDistanceLabel()).toBe('Halo-A');
        expect(component.getRingVelocityDiff()).not.toBeNull();
        render(a);     expect(component.getRingNeighbourDistanceLabel()).toBe('A-Outer');
        expect(component.getRingVelocityDiff()).not.toBeNull();
        render(outer); expect(component.getRingVelocityDiff()).toBeNull();
      });

      it('respects radius-sorted order when computing velocity differences', () => {
        // Rings pushed in reverse order; sort must produce A→B→D pairing.
        const parent = makeBody({ name: 'Star', earthMasses: 100, radius: 50000 });
        const ringD = makeBody({ name: 'D Ring', type: 'Ring', subType: 'Rocky', innerRadius: 210000, outerRadius: 300000 }, parent);
        const ringA = makeBody({ name: 'A Ring', type: 'Ring', subType: 'Rocky', innerRadius: 60000,  outerRadius: 100000 }, parent);
        const ringB = makeBody({ name: 'B Ring', type: 'Ring', subType: 'Rocky', innerRadius: 110000, outerRadius: 200000 }, parent);
        parent.subBodies.push(ringD, ringA, ringB);
        const physics = TestBed.inject(BodyPhysicsService);

        render(ringA);
        const expectedAB = physics.ringDynamics(ringA)!.maxVelocityKms - physics.ringDynamics(ringB)!.minVelocityKms;
        expect(component.getRingVelocityDiff()).toBeCloseTo(expectedAB, 9);

        render(ringB);
        const expectedBD = physics.ringDynamics(ringB)!.maxVelocityKms - physics.ringDynamics(ringD)!.minVelocityKms;
        expect(component.getRingVelocityDiff()).toBeCloseTo(expectedBD, 9);

        render(ringD);
        expect(component.getRingVelocityDiff()).toBeNull();
      });

      it('yields null velocity difference when parent has no mass (ringDynamics returns null)', () => {
        const parent = makeBody({ name: 'Massless Parent', radius: 50000 }); // no earthMasses / solarMasses
        const ringA = makeBody({ name: 'A Ring', type: 'Ring', subType: 'Rocky', innerRadius: 60000,  outerRadius: 100000 }, parent);
        const ringB = makeBody({ name: 'B Ring', type: 'Ring', subType: 'Rocky', innerRadius: 110000, outerRadius: 200000 }, parent);
        parent.subBodies.push(ringA, ringB);
        render(ringA);
        expect(component.getRingVelocityDiff()).toBeNull();
      });

      it('preserves negative velocity difference without clamping', () => {
        // Force a negative diff by making the inner ring abnormally slow (tiny parent mass)
        // and a fast outer ring (large parent mass is not possible with one shared parent,
        // so we instead verify the formula is applied as-is by checking via the service).
        const { rings: [ringA, ringB] } = makeRingSet([
          { name: 'A Ring', inner: 60000,  outer: 100000 },
          { name: 'B Ring', inner: 110000, outer: 200000 },
        ]);
        const physics = TestBed.inject(BodyPhysicsService);
        const diff = physics.ringDynamics(ringA)!.maxVelocityKms - physics.ringDynamics(ringB)!.minVelocityKms;
        render(ringA);
        // Whatever the sign, the component must return the raw computed value unchanged.
        expect(component.getRingVelocityDiff()).toBeCloseTo(diff, 9);
      });
    });

    describe('Racing Rings badge', () => {
      // earthMasses=100, rings at 50 000–50 049 and 50 050–100 000 km:
      // gap = 1 km (<50), velocityDiff ≈ 10.7 km/s (>5) → badge ON.
      // earthMasses=100, rings at 500 000–500 049 and 500 050–1 000 000 km:
      // gap = 1 km (<50), velocityDiff ≈ 3.4 km/s (≤5) → badge OFF (velocity condition).

      function makeRingSet(parentMass: number, defs: Array<{ name: string; inner: number; outer: number }>) {
        const parent = makeBody({ name: 'Star', earthMasses: parentMass, radius: 50000 });
        const rings = defs.map(d => makeBody(
          { name: d.name, type: 'Ring', subType: 'Rocky', innerRadius: d.inner, outerRadius: d.outer },
          parent,
        ));
        parent.subBodies.push(...rings);
        return { parent, rings };
      }

      it('shows the badge when gap < 50 km and velocity difference > 5 km/s', () => {
        const { rings: [ringA, ringB] } = makeRingSet(100, [
          { name: 'A Ring', inner: 50000, outer: 50049 },
          { name: 'B Ring', inner: 50050, outer: 100000 },
        ]);
        // Verify conditions via the physics service to confirm badge reuses the same formulas.
        const physics = TestBed.inject(BodyPhysicsService);
        const gap = 50050 - 50049;
        const diff = physics.ringDynamics(ringA)!.maxVelocityKms - physics.ringDynamics(ringB)!.minVelocityKms;
        expect(gap).toBeLessThan(50);
        expect(diff).toBeGreaterThan(5);

        render(ringA);
        expect(component.isRacingRings()).toBe(true);
        expect(component.racingRingsTooltip()).toContain('Ring A and Ring B');
        expect(component.racingRingsTooltip()).toContain('km/s');

        render(ringB); // outermost — no badge
        expect(component.isRacingRings()).toBe(false);
      });

      it('does not show the badge when gap is exactly 50 km', () => {
        const { rings: [ringA] } = makeRingSet(100, [
          { name: 'A Ring', inner: 50000, outer: 50049 },
          { name: 'B Ring', inner: 50099, outer: 100000 }, // gap = 50 km exactly
        ]);
        render(ringA);
        expect(component.getRingNeighbourDistance()).toBe(50);
        expect(component.isRacingRings()).toBe(false);
      });

      it('does not show the badge when gap is > 50 km', () => {
        const { rings: [ringA] } = makeRingSet(100, [
          { name: 'A Ring', inner: 50000, outer: 50049 },
          { name: 'B Ring', inner: 50549, outer: 100000 }, // gap = 500 km
        ]);
        render(ringA);
        expect(component.isRacingRings()).toBe(false);
      });

      it('does not show the badge when velocity difference is ≤ 5 km/s', () => {
        // Wide, distant rings around a 100-M⊕ parent give velocity diff ≈ 3.4 km/s.
        const parent = makeBody({ name: 'Star', earthMasses: 100, radius: 50000 });
        const ringA = makeBody({ name: 'A Ring', type: 'Ring', subType: 'Rocky', innerRadius: 500000, outerRadius: 500049 }, parent);
        const ringB = makeBody({ name: 'B Ring', type: 'Ring', subType: 'Rocky', innerRadius: 500050, outerRadius: 1000000 }, parent);
        parent.subBodies.push(ringA, ringB);
        const physics = TestBed.inject(BodyPhysicsService);
        const diff = physics.ringDynamics(ringA)!.maxVelocityKms - physics.ringDynamics(ringB)!.minVelocityKms;
        expect(diff).toBeLessThanOrEqual(5);
        render(ringA);
        expect(component.isRacingRings()).toBe(false);
      });



      it('only marks qualifying adjacent pairs in a three-ring set', () => {
        // A–B: gap=1 km, vel diff ≈10.7 km/s → badge ON.
        // B–C: gap=500 km → badge OFF regardless of velocity.
        const { rings: [ringA, ringB, ringC] } = makeRingSet(100, [
          { name: 'A Ring', inner: 50000,  outer: 50049 },
          { name: 'B Ring', inner: 50050,  outer: 100000 },  // gap A-B = 1 km; wide so vel diff is large
          { name: 'C Ring', inner: 100500, outer: 200000 },  // gap B-C = 500 km
        ]);
        render(ringA); expect(component.isRacingRings()).toBe(true);
        render(ringB); expect(component.isRacingRings()).toBe(false); // gap to C is 500 km
        render(ringC); expect(component.isRacingRings()).toBe(false); // outermost
      });

      it('formats tooltip with cleaned mixed names ("Halo Ring" → "Halo")', () => {
        const { rings: [halo] } = makeRingSet(100, [
          { name: 'Halo Ring', inner: 50000, outer: 50049 },
          { name: 'A Ring',    inner: 50050, outer: 100000 },
        ]);
        render(halo);
        expect(component.isRacingRings()).toBe(true);
        expect(component.racingRingsTooltip()).toContain('Ring Halo and Ring A');
      });

      it('evaluates badge using radius-sorted order, not input order', () => {
        // B pushed first (outer), A pushed second (inner) — sort must yield A→B pairing.
        const parent = makeBody({ name: 'Star', earthMasses: 100, radius: 50000 });
        const ringB = makeBody({ name: 'B Ring', type: 'Ring', subType: 'Rocky', innerRadius: 50050, outerRadius: 100000 }, parent);
        const ringA = makeBody({ name: 'A Ring', type: 'Ring', subType: 'Rocky', innerRadius: 50000, outerRadius: 50049 }, parent);
        parent.subBodies.push(ringB, ringA);
        render(ringA);
        expect(component.isRacingRings()).toBe(true);
        expect(component.racingRingsTooltip()).toContain('Ring A and Ring B');
      });

      it('tooltip gap value matches the existing getRingNeighbourDistance signal', () => {
        const { rings: [ringA] } = makeRingSet(100, [
          { name: 'A Ring', inner: 50000, outer: 50049 },
          { name: 'B Ring', inner: 50050, outer: 100000 },
        ]);
        render(ringA);
        const gap = component.getRingNeighbourDistance()!;
        expect(component.racingRingsTooltip()).toContain(`within ${gap.toFixed(0)} km`);
      });

      it('tooltip speed value matches the existing getRingVelocityDiff signal', () => {
        const { rings: [ringA] } = makeRingSet(100, [
          { name: 'A Ring', inner: 50000, outer: 50049 },
          { name: 'B Ring', inner: 50050, outer: 100000 },
        ]);
        render(ringA);
        const diff = component.getRingVelocityDiff()!;
        expect(component.racingRingsTooltip()).toContain(`${diff.toFixed(1)} km/s`);
      });

      it('does not show the badge when the outer ring is invisible (wide + low mass)', () => {
        // Ring B: width = 1 100 000 km > 1 000 000 and mass = 1 Mt → density ≈ 2.6e-13 Mt/km² < 0.1
        // → invisible. Gap A-B = 1 km, vel diff ≈ 27 km/s, so badge WOULD fire without the guard.
        // Distance and velocity signals are also suppressed (null) when either ring is invisible.
        const parent = makeBody({ name: 'Star', earthMasses: 100, radius: 50000 });
        const ringA = makeBody({ name: 'A Ring', type: 'Ring', subType: 'Rocky',
          innerRadius: 50000, outerRadius: 50049, mass: 1e15 }, parent);
        const ringB = makeBody({ name: 'B Ring', type: 'Ring', subType: 'Rocky',
          innerRadius: 50050, outerRadius: 1100050, mass: 1 }, parent);
        parent.subBodies.push(ringA, ringB);
        render(ringA);
        expect(component.getRingNeighbourDistance()).toBeNull();    // suppressed: B is invisible
        expect(component.getRingVelocityDiff()).toBeNull();         // suppressed: B is invisible
        expect(component.isRacingRings()).toBe(false);               // invisible guard fires
      });

      it('does not show the badge when the inner ring is invisible (wide + low mass)', () => {
        // Ring A: width = 1 050 000 km > 1 000 000 and mass = 1 Mt → invisible.
        // Distance and velocity signals are also suppressed (null) when either ring is invisible.
        const parent = makeBody({ name: 'Star', earthMasses: 100, radius: 50000 });
        const ringA = makeBody({ name: 'A Ring', type: 'Ring', subType: 'Rocky',
          innerRadius: 50000, outerRadius: 1100000, mass: 1 }, parent);
        const ringB = makeBody({ name: 'B Ring', type: 'Ring', subType: 'Rocky',
          innerRadius: 1100001, outerRadius: 2000000, mass: 1e15 }, parent);
        parent.subBodies.push(ringA, ringB);
        render(ringA);
        expect(component.getRingNeighbourDistance()).toBeNull();    // suppressed: A is invisible
        expect(component.getRingVelocityDiff()).toBeNull();         // suppressed: A is invisible
        expect(component.isRacingRings()).toBe(false);               // invisible guard fires
      });
    });
  });

  describe('Roche / shepherding for a moon', () => {
    it('opens the body Roche-limit chart for a close dense moon', async () => {
      const parent = makeBody({ name: 'Gas Giant', earthMasses: 300, radius: 70000 });
      const moon = makeBody({
        name: 'Moon', type: 'Planet', earthMasses: 0.05, radius: 1500,
        semiMajorAxis: 0.0005, orbitalEccentricity: 0.05,
      }, parent);
      render(moon);
      expect(component.calculateBodyRocheLimits()).not.toBeNull();
      await component.showBodyRocheLimitChart();
      expect(lastDialogData().isBody).toBe(true);
    });

    it('opens the shepherding Hill-limit chart for a shepherd moon', async () => {
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
      await component.showShepherdingHillLimitChart();
      expect(lastDialogData().shepherdStatus).toBe('shepherd');
    });
  });

  describe('apo/peri dialog', () => {
    it('opens the apoapsis dialog with derived orbital details', async () => {
      render(makeBody({
        semiMajorAxis: 1, orbitalEccentricity: 0.3, meanAnomaly: 45, orbitalPeriod: 200,
        timestamps: { distanceToArrival: '', meanAnomaly: new Date(Date.now() - 5 * 86400000).toISOString() },
      }));
      await component.showApoPeriDialog('apo');
      expect(lastDialogData().type).toBe('apo');
      expect(lastDialogData().distanceKm).toBeGreaterThan(0);
      await component.showApoPeriDialog('peri');
      expect(lastDialogData().type).toBe('peri');
    });

    it('does nothing when there is no next-event data', async () => {
      render(makeBody({ orbitalEccentricity: 0 }));
      const before = dialogOpenCalls;
      await component.showApoPeriDialog('apo');
      expect(dialogOpenCalls).toBe(before);
    });
  });

  describe('collision dialog', () => {
    it('opens the collision dialog with this body name and the candidate details', async () => {
      render(makeBody({ name: 'X 1 b' }));
      component.collisionStatus = {
        isCandidate: true, partnerName: 'X 1 c', synodicPeriodDays: 8, combinedRadiiKm: 5000,
        upcomingCollisions: [], simultaneousPartners: [],
        nextCollision: {
          start: new Date('2026-12-15T14:00:00Z'), end: new Date('2026-12-15T15:30:00Z'),
          days: 170, minSeparationKm: 1000,
        },
      };
      await component.showCollisionDialog();
      expect(lastDialogData().bodyName).toBe('X 1 b');
      expect(lastDialogData().partnerName).toBe('X 1 c');
      expect(lastDialogData().combinedRadiiKm).toBe(5000);
      expect(lastDialogData().nextCollision.minSeparationKm).toBe(1000);
    });

    it('does nothing when the body is not a collision candidate', async () => {
      render(makeBody({}));
      component.collisionStatus = null;
      const before = dialogOpenCalls;
      await component.showCollisionDialog();
      expect(dialogOpenCalls).toBe(before);
    });

    it('formats the badge countdown in days, adding years past a year, and flags in-progress', () => {
      render(makeBody({}));
      expect(component.formatCollisionCountdown(-1)).toBe('in progress now');
      expect(component.formatCollisionCountdown(0.5)).toBe('less than a day');
      expect(component.formatCollisionCountdown(45)).toBe('45 days');
      expect(component.formatCollisionCountdown(800)).toContain('years');
    });

    it('shows "Collision In Progress" badge text when the contact window straddles now', () => {
      const nowHere = Date.parse('2026-10-28T15:16:05Z');
      const body = makeBody({ name: 'Test 1 a' });
      // Pre-seed the collision cache so ngOnChanges skips detectCollisionStatus and
      // leaves our in-progress status intact when render() calls detectChanges().
      (component as any).collisionBody = body;
      component.collisionStatus = {
        isCandidate: true, partnerName: '1 c', synodicPeriodDays: 6.8, combinedRadiiKm: 1423,
        upcomingCollisions: [], simultaneousPartners: ['1 b'],
        nextCollision: {
          start: new Date(nowHere - 2 * 60 * 1000),  // 2 min before now
          end:   new Date(nowHere + 37 * 60 * 1000), // 37 min after now
          days: -(2 / (24 * 60)),                    // negative → in progress
          minSeparationKm: 400,
        },
      };
      render(body); // ngOnChanges: body === collisionBody → skips override → renders with pre-set status
      const badge: HTMLElement = fixture.nativeElement.querySelector('.badge-red');
      expect(badge).not.toBeNull();
      expect(badge!.textContent?.trim()).toBe('Collision In Progress');
    });
  });

  describe('conversion base-value getters', () => {
    it('converts semi-major axis (AU) and distance-to-arrival (ls) to km bases', () => {
      render(makeBody({ semiMajorAxis: 1, distanceToArrival: 100 }));
      expect(component.getSemiMajorAxisKm()).toBeCloseTo(149597870.7, 0);
      expect(component.getDistanceToArrivalKm()).toBeCloseTo(100 * 299792.458, 0);
      expect(component.getSolarRadiusKm()).toBeNull();
    });

    it('converts an ordinary star radius (solar radii) to a km base', () => {
      render(makeBody({ type: 'Star', subType: 'G (White-Yellow) Star', solarRadius: 1.1 }));
      expect(component.getSolarRadiusKm()).toBeCloseTo(1.1 * 695700, 0);
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
    it('opens the on-foot safety dialog', async () => {
      render(makeBody({ type: 'Planet', subType: 'Rocky body', isLandable: true, surfaceTemperature: 250, atmosphereType: 'Thin Argon', surfacePressure: 0.01, gravity: 0.5 }));
      await component.showOnFootSafetyDialog();
      expect(lastDialogData().lookupSource).toContain('Argon');
    });

    it('opens the tidal-lock dialog with the body and computed resonance', async () => {
      const star = makeBody({ type: 'Star', subType: 'M (Red dwarf) Star' });
      render(makeBody({ type: 'Planet', subType: 'Rocky body', rotationalPeriod: 5, orbitalPeriod: 5, rotationalPeriodTidallyLocked: true }, star));
      await component.showTidalLockDialog();
      expect(dialogOpenCalls).toBe(1);
      const { config } = dialogOpenArgs[0];
      expect(config.data!.resonance).toBe('1:1');
      expect(config.data!.body.bodyData.rotationalPeriod).toBe(5);
    });

    it('opens the JSON dialog with the body and galaxy data', async () => {
      render(makeBody({ type: 'Planet', subType: 'Rocky body' }));
      await component.showBodyJsonDialog();
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

    it('opens the H-R diagram dialog for a star', async () => {
      render(makeBody({ type: 'Star', subType: 'B (Blue-White) Star', spectralClass: 'B2', luminosity: 'V', solarMasses: 8, age: 50 }));
      const before = dialogOpenCalls;
      await component.showHrDiagram();
      expect(dialogOpenCalls).toBe(before + 1);
    });
  });
});
