import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { TidalLockDialogComponent, TidalLockDialogData } from './tidal-lock-dialog.component';
import { SystemBody, CanonnBiostatsBody } from '../home/home.component';

function makeBody(data: Partial<CanonnBiostatsBody>, parent: SystemBody | null = null): SystemBody {
  return {
    bodyData: { bodyId: 1, id64: 1n, name: 'Test Body', subType: '', type: 'Planet', ...data } as CanonnBiostatsBody,
    subBodies: [],
    parent,
  };
}

/** Builds the dialog with the given MAT_DIALOG_DATA and returns the component instance. */
function build(data: TidalLockDialogData): TidalLockDialogComponent {
  TestBed.configureTestingModule({
    imports: [TidalLockDialogComponent],
    providers: [
      provideZonelessChangeDetection(),
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
    schemas: [NO_ERRORS_SCHEMA],
  });
  return TestBed.createComponent(TidalLockDialogComponent).componentInstance;
}

const DEG = 180 / Math.PI;

describe('TidalLockDialogComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('exposes the rotational/orbital period difference', () => {
    const c = build({ body: makeBody({ rotationalPeriod: 2, orbitalPeriod: 5 }), resonance: 'none' });
    expect(c.difference).toBe(3);
  });

  describe('tidalCycling (fixed-face star-lock only)', () => {
    it('is null when rotation or orbit is missing', () => {
      const c = build({ body: makeBody({ rotationalPeriodTidallyLocked: true }), resonance: 'none' });
      expect(c.tidalCycling).toBeNull();
      expect(c.cyclingDiagram).toBeNull();
    });

    it('is null for a star-orbiting body that is not 1:1 (the Eden case)', () => {
      // Eden orbits a star but rotates ~1.05 d while orbiting ~31 d — not synchronous,
      // so it does not keep a fixed face and gets no cycling geometry.
      const star = makeBody({ type: 'Star', subType: 'M (Red dwarf) Star' });
      const c = build({
        body: makeBody({
          subType: 'Earth-like world', radius: 1000,
          rotationalPeriod: 1.05, orbitalPeriod: 31, rotationalPeriodTidallyLocked: true,
          orbitalEccentricity: 0.05, axialTilt: 0.1,
        }, star),
        resonance: 'none',
      });
      expect(c.tidalCycling).toBeNull();
      expect(c.cyclingDiagram).toBeNull();
    });

    it('is null for a moon locked to a planet (faces the planet, not the star)', () => {
      const gasGiant = makeBody({ type: 'Planet', subType: 'Class I gas giant' });
      const c = build({
        body: makeBody({
          subType: 'Rocky body', rotationalPeriod: 4, orbitalPeriod: 4,
          rotationalPeriodTidallyLocked: true, axialTilt: 0.05,
        }, gasGiant),
        resonance: '1:1',
      });
      expect(c.tidalCycling).toBeNull();
    });

    it('is null for a body locked to a purely planetary barycentre (no star below it)', () => {
      const barycentre = makeBody({ type: 'Barycentre' });
      barycentre.subBodies = [
        makeBody({ type: 'Planet', subType: 'Class I gas giant' }, barycentre),
        makeBody({ type: 'Planet', subType: 'Rocky body' }, barycentre),
      ];
      const c = build({
        body: makeBody({ subType: 'Rocky body', rotationalPeriod: 8, orbitalPeriod: 8, axialTilt: 0.1 }, barycentre),
        resonance: '1:1',
      });
      expect(c.tidalCycling).toBeNull();
    });

    it('computes the cycling band for a body locked directly to the star', () => {
      const star = makeBody({ type: 'Star', subType: 'M (Red dwarf) Star' });
      const c = build({
        body: makeBody({
          subType: 'Earth-like world', radius: 1000,
          rotationalPeriod: 10, orbitalPeriod: 10, rotationalPeriodTidallyLocked: true,
          orbitalEccentricity: 0.05, axialTilt: 0.1, orbitalInclination: 3,
        }, star),
        resonance: '1:1',
      });
      const cyc = c.tidalCycling!;
      const tiltDeg = 0.1 * DEG;
      expect(cyc).not.toBeNull();
      expect(cyc.indirect).toBe(false);
      expect(cyc.hasCycling).toBe(true);
      expect(cyc.axialTiltDeg).toBeCloseTo(tiltDeg, 6);
      // Swing amplitude limits combine tilt and inclination.
      expect(cyc.swingMinDeg).toBeCloseTo(Math.abs(tiltDeg - 3), 6);
      expect(cyc.swingMaxDeg).toBeCloseTo(tiltDeg + 3, 6);
      expect(cyc.hasRange).toBe(true);
      // Cycling fraction is the terminator-swept band: swing / 90 of the whole surface.
      expect(cyc.cyclingFractionMin).toBeCloseTo((tiltDeg - 3 > 0 ? tiltDeg - 3 : 3 - tiltDeg) / 90, 8);
      expect(cyc.cyclingFractionMax).toBeCloseTo((tiltDeg + 3) / 90, 8);
      // Area = 4πr²·fraction.
      expect(cyc.cyclingAreaMaxKm2!).toBeCloseTo(4 * Math.PI * 1000 * 1000 * cyc.cyclingFractionMax, 3);
    });

    it('qualifies a body locked indirectly to a star-barycentre (circumbinary)', () => {
      const barycentre = makeBody({ type: 'Barycentre' });
      barycentre.subBodies = [
        makeBody({ type: 'Star', subType: 'M (Red dwarf) Star' }, barycentre),
        makeBody({ type: 'Star', subType: 'K (Yellow-Orange) Star' }, barycentre),
      ];
      const c = build({
        body: makeBody({
          subType: 'Rocky body', radius: 2000,
          rotationalPeriod: 8, orbitalPeriod: 8, rotationalPeriodTidallyLocked: true,
          orbitalEccentricity: 0.05, axialTilt: 0.2,
        }, barycentre),
        resonance: '1:1',
      });
      const cyc = c.tidalCycling!;
      expect(cyc).not.toBeNull();
      expect(cyc.indirect).toBe(true);
      expect(cyc.hasCycling).toBe(true);
    });

    it('qualifies a body locked to a star nested under a sub-barycentre', () => {
      // root barycentre → sub-barycentre → [Star, Star]; the body orbits the root.
      const root = makeBody({ type: 'Barycentre' });
      const sub = makeBody({ type: 'Barycentre' }, root);
      sub.subBodies = [
        makeBody({ type: 'Star', subType: 'M (Red dwarf) Star' }, sub),
        makeBody({ type: 'Star', subType: 'K (Yellow-Orange) Star' }, sub),
      ];
      root.subBodies = [sub];
      const c = build({
        body: makeBody({ subType: 'Rocky body', rotationalPeriod: 8, orbitalPeriod: 8, axialTilt: 0.1 }, root),
        resonance: '1:1',
      });
      expect(c.tidalCycling).not.toBeNull();
      expect(c.tidalCycling!.indirect).toBe(true);
    });

    it('reports no range when there is no orbital inclination', () => {
      const star = makeBody({ type: 'Star', subType: 'M (Red dwarf) Star' });
      const c = build({
        body: makeBody({
          subType: 'Rocky body', radius: 1000,
          rotationalPeriod: 10, orbitalPeriod: 10, axialTilt: 0.1,
        }, star),
        resonance: '1:1',
      });
      const cyc = c.tidalCycling!;
      expect(cyc.hasRange).toBe(false);
      expect(cyc.swingMinDeg).toBeCloseTo(cyc.swingMaxDeg, 6);
      expect(cyc.swingMaxDeg).toBeCloseTo(0.1 * DEG, 6);
    });

    it('caps the swing at 90° (whole surface cycles) when the obliquity range straddles 90°', () => {
      const star = makeBody({ type: 'Star', subType: 'G (White-Yellow) Star' });
      const c = build({
        body: makeBody({
          subType: 'Rocky body', radius: 1000,
          rotationalPeriod: 9, orbitalPeriod: 9,
          axialTilt: 80 / DEG, orbitalInclination: 20, // obliquity range 60°–100° straddles 90°
        }, star),
        resonance: '1:1',
      });
      const cyc = c.tidalCycling!;
      expect(cyc.swingMaxDeg).toBe(90);
      expect(cyc.cyclingFractionMax).toBe(1);
    });

    it('reports no cycling for a tilt-free, inclination-free synchronous body', () => {
      const star = makeBody({ type: 'Star', subType: 'M (Red dwarf) Star' });
      const c = build({
        body: makeBody({
          subType: 'Rocky body', radius: 1000,
          rotationalPeriod: 10, orbitalPeriod: 10, axialTilt: 0, orbitalInclination: 0,
        }, star),
        resonance: '1:1',
      });
      const cyc = c.tidalCycling!;
      expect(cyc).not.toBeNull();
      expect(cyc.hasCycling).toBe(false);
      expect(cyc.swingMaxDeg).toBe(0);
      expect(c.cyclingDiagram!.hasCycling).toBe(false);
    });

    it('leaves the cycling area null when the radius is unknown', () => {
      const star = makeBody({ type: 'Star', subType: 'M (Red dwarf) Star' });
      const c = build({
        body: makeBody({
          subType: 'Rocky body', rotationalPeriod: 10, orbitalPeriod: 10, axialTilt: 0.1,
        }, star),
        resonance: '1:1',
      });
      const cyc = c.tidalCycling!;
      expect(cyc.hasCycling).toBe(true);
      expect(cyc.cyclingAreaMinKm2).toBeNull();
      expect(cyc.cyclingAreaMaxKm2).toBeNull();
    });

    it('derives the swing from inclination alone when axial tilt is absent', () => {
      const star = makeBody({ type: 'Star', subType: 'M (Red dwarf) Star' });
      const c = build({
        body: makeBody({
          subType: 'Rocky body', radius: 1000,
          rotationalPeriod: 10, orbitalPeriod: 10, orbitalInclination: 5, // no axialTilt
        }, star),
        resonance: '1:1',
      });
      const cyc = c.tidalCycling!;
      expect(cyc.axialTiltDeg).toBe(0);
      expect(cyc.swingMaxDeg).toBeCloseTo(5, 6);
      expect(cyc.hasCycling).toBe(true);
    });

    it('folds an obliquity sum above 180° back into range', () => {
      // tilt 170° + inclination 30° = 200° → folds to 160° (max), |170−30| = 140° (min).
      const star = makeBody({ type: 'Star', subType: 'G (White-Yellow) Star' });
      const c = build({
        body: makeBody({
          subType: 'Rocky body', radius: 1000,
          rotationalPeriod: 9, orbitalPeriod: 9, axialTilt: 170 / DEG, orbitalInclination: 30,
        }, star),
        resonance: '1:1',
      });
      const cyc = c.tidalCycling!;
      // amplitude(160°) = 20°, amplitude(140°) = 40°.
      expect(cyc.swingMinDeg).toBeCloseTo(20, 4);
      expect(cyc.swingMaxDeg).toBeCloseTo(40, 4);
    });

    it('folds a retrograde axial tilt back toward a small swing', () => {
      // Tilt ≈ 177° (3.09 rad) is nearly anti-aligned with the orbital normal — a
      // retrograde spin with a small effective swing, not a 177° swing.
      const star = makeBody({ type: 'Star', subType: 'G (White-Yellow) Star' });
      const c = build({
        body: makeBody({
          subType: 'Rocky body', radius: 1000,
          rotationalPeriod: 12, orbitalPeriod: 12, axialTilt: 3.094469,
        }, star),
        resonance: '1:1',
      });
      const cyc = c.tidalCycling!;
      expect(cyc.swingMaxDeg).toBeCloseTo(180 - 3.094469 * DEG, 5);
      expect(cyc.swingMaxDeg).toBeLessThan(5);
    });
  });

  describe('cyclingDiagram', () => {
    it('is null when there is no cycling model', () => {
      const c = build({ body: makeBody({ rotationalPeriod: 1.05, orbitalPeriod: 31 }), resonance: 'none' });
      expect(c.cyclingDiagram).toBeNull();
    });

    it('builds a tilted globe with leaf paths and graticule when the surface cycles', () => {
      const star = makeBody({ type: 'Star', subType: 'M (Red dwarf) Star' });
      const c = build({
        body: makeBody({
          subType: 'Earth-like world', radius: 1000,
          rotationalPeriod: 10, orbitalPeriod: 10, axialTilt: 0.1, orbitalInclination: 3,
        }, star),
        resonance: '1:1',
      });
      const d = c.cyclingDiagram!;
      expect(d.hasCycling).toBe(true);
      expect(d.hasRange).toBe(true);
      // The nod matches the real obliquity swing (only a high safety cap applies).
      expect(d.tiltDeg).toBeCloseTo(c.tidalCycling!.swingMaxDeg, 6);
      expect(d.tiltDeg).toBeLessThanOrEqual(45);
      // Leaf paths are real closed SVG paths.
      expect(d.leafMaxPath).toContain('M');
      expect(d.leafMaxPath).toContain('Z');
      expect(d.leafMinPath).toContain('Z');
      // Graticule: 5 latitude chords and at least one meridian.
      expect(d.latitudes.length).toBe(5);
      expect(d.meridianRx.length).toBeGreaterThan(0);
    });

    it('does not floor a small tilt — the nod matches the real swing', () => {
      // A ~1.3° obliquity must nod ~1.3°, not an exaggerated minimum.
      const star = makeBody({ type: 'Star', subType: 'M (Red dwarf) Star' });
      const c = build({
        body: makeBody({
          subType: 'Rocky body', radius: 1000,
          rotationalPeriod: 10, orbitalPeriod: 10, axialTilt: 1.3 / DEG,
        }, star),
        resonance: '1:1',
      });
      expect(c.cyclingDiagram!.tiltDeg).toBeCloseTo(1.3, 4);
    });

    it('uses no tilt and no leaves when nothing cycles', () => {
      const star = makeBody({ type: 'Star', subType: 'M (Red dwarf) Star' });
      const c = build({
        body: makeBody({
          subType: 'Rocky body', radius: 1000,
          rotationalPeriod: 10, orbitalPeriod: 10, axialTilt: 0, orbitalInclination: 0,
        }, star),
        resonance: '1:1',
      });
      const d = c.cyclingDiagram!;
      expect(d.hasCycling).toBe(false);
      expect(d.tiltDeg).toBe(0);
      expect(d.leafMaxPath).toBe('');
    });
  });

  describe('fmtRange', () => {
    const make = () => build({ body: makeBody({ rotationalPeriod: 5, orbitalPeriod: 5 }), resonance: '1:1' });

    it('collapses exactly-equal values to a single value with no marker', () => {
      expect(make().fmtRange(4.1, 4.1, 1)).toBe('4.1');
    });

    it('marks a rounding-collapsed range with ~', () => {
      expect(make().fmtRange(4.1, 4.14, 1)).toBe('~4.1');
    });

    it('shows a range when the values differ at the shown precision', () => {
      expect(make().fmtRange(4.1, 4.3, 1)).toBe('4.1–4.3');
    });

    it('groups thousands at zero decimals', () => {
      expect(make().fmtRange(1234567, 1234567, 0)).toBe('1,234,567');
    });
  });

  describe('scenarioDiagram', () => {
    /** Euclidean distance between two points. */
    const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

    it('parks each moon on its orbit with the marker on the parent-facing edge', () => {
      const c = build({ body: makeBody({ rotationalPeriod: 5, orbitalPeriod: 5 }), resonance: '1:1' });
      for (const panel of [c.scenarioDiagram.synchronous, c.scenarioDiagram.resonance]) {
        // Moon sits one orbit radius from the parent.
        expect(dist(panel.moonX, panel.moonY, panel.parentX, panel.parentY)).toBeCloseTo(panel.orbitR, 6);
        // Marker sits on the moon's edge (one body radius from its centre)...
        expect(dist(panel.markerX, panel.markerY, panel.moonX, panel.moonY)).toBeCloseTo(c.scenarioDiagram.bodyR, 6);
        // ...and nearer the parent than the moon centre (the parent-facing side).
        expect(dist(panel.markerX, panel.markerY, panel.parentX, panel.parentY))
          .toBeLessThan(dist(panel.moonX, panel.moonY, panel.parentX, panel.parentY));
      }
    });

    it('exposes shared body and parent radii used by both panels', () => {
      const c = build({ body: makeBody({ rotationalPeriod: 5, orbitalPeriod: 5 }), resonance: '1:1' });
      expect(c.scenarioDiagram.bodyR).toBeGreaterThan(0);
      expect(c.scenarioDiagram.parentR).toBeGreaterThan(0);
    });
  });

  describe('bodyDiagram', () => {
    it('marks a synchronous body (rotation = orbit) as locked with no inner spin', () => {
      const c = build({ body: makeBody({ rotationalPeriod: 5, orbitalPeriod: 5 }), resonance: '1:1' });
      const d = c.bodyDiagram!;
      expect(d.locked).toBe(true);
      expect(d.spinsPerOrbit).toBeCloseTo(1, 6);
      expect(d.spinSec).toBe(0);
    });

    it('computes spins-per-orbit and an inner-spin duration for a non-synchronous body', () => {
      // Rotates twice as fast as it orbits → 2 spins/orbit → 1 extra spin → 9s/1 = 9s.
      const c = build({ body: makeBody({ rotationalPeriod: 5, orbitalPeriod: 10 }), resonance: 'none' });
      const d = c.bodyDiagram!;
      expect(d.locked).toBe(false);
      expect(d.spinsPerOrbit).toBeCloseTo(2, 6);
      expect(d.spinSec).toBeCloseTo(9, 6);
      expect(d.spinReverse).toBe(false);
    });

    it('runs the inner spin in reverse when the body rotates slower than it orbits', () => {
      // Rotates half as fast as it orbits → 0.5 spins/orbit → −0.5 extra → reverse.
      const c = build({ body: makeBody({ rotationalPeriod: 10, orbitalPeriod: 5 }), resonance: 'none' });
      const d = c.bodyDiagram!;
      expect(d.spinsPerOrbit).toBeCloseTo(0.5, 6);
      expect(d.spinReverse).toBe(true);
    });

    it('clamps the spin speed for a very fast rotator', () => {
      const c = build({ body: makeBody({ rotationalPeriod: 0.1, orbitalPeriod: 50 }), resonance: 'none' });
      const d = c.bodyDiagram!;
      expect(d.clamped).toBe(true);
      expect(d.spinSec).toBeGreaterThanOrEqual(1.4);
    });

    it('is null when periods are missing', () => {
      const c = build({ body: makeBody({ rotationalPeriodTidallyLocked: true }), resonance: 'none' });
      expect(c.bodyDiagram).toBeNull();
    });
  });
});
