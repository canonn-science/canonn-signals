import {
  VIEW_BOX_SIZE,
  anomalyDiagram,
  arcPath,
  axialTiltDiagram,
  inclinationDiagram,
  lagrangeDiagram,
  parentDistanceDiagram,
  periapsisDiagram,
} from './orbital-diagrams';

const CENTER = VIEW_BOX_SIZE / 2;

/** Distance between two points, for asserting on derived geometry. */
function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe('orbital-diagrams', () => {
  describe('arcPath', () => {
    it('starts at a0 and ends at a1 (anticlockwise, screen space)', () => {
      const path = arcPath(0, 0, 10, 0, 90);
      // First sampled point is at 0° -> (+r, 0); last is at 90° -> (0, -r) screen.
      expect(path.startsWith('M 10 0')).toBe(true);
      expect(path.endsWith('L 0 -10')).toBe(true);
    });

    it('produces steps + 1 vertices', () => {
      const path = arcPath(0, 0, 5, 0, 45, 4);
      // 1 "M" vertex + 4 "L" vertices.
      expect((path.match(/L/g) ?? []).length).toBe(4);
    });
  });

  describe('axialTiltDiagram', () => {
    it('keeps the axis vertical at 0° tilt', () => {
      const d = axialTiltDiagram(0);
      expect(d.axis.x1).toBeCloseTo(CENTER, 6);
      expect(d.axis.x2).toBeCloseTo(CENTER, 6);
      expect(d.equator.rotation).toBe(0);
    });

    it('leans the axis toward +x and rotates the equator by the tilt', () => {
      const d = axialTiltDiagram(45);
      // Top of the axis (x2,y2 is the +dir end) moves right of centre and up.
      expect(d.axis.x2).toBeGreaterThan(CENTER);
      expect(d.axis.y2).toBeLessThan(CENTER);
      expect(d.equator.rotation).toBe(45);
    });

    it('lays the axis horizontal at 90° tilt', () => {
      const d = axialTiltDiagram(90);
      expect(d.axis.y1).toBeCloseTo(CENTER, 6);
      expect(d.axis.y2).toBeCloseTo(CENTER, 6);
    });

    it('defaults non-finite input to 0', () => {
      const d = axialTiltDiagram(NaN);
      expect(d.equator.rotation).toBe(0);
    });

    it('always renders a flattened (edge-on) equator ellipse', () => {
      const d = axialTiltDiagram(30);
      expect(d.equator.ry).toBeLessThan(d.equator.rx);
    });
  });

  describe('inclinationDiagram', () => {
    it('overlays the orbit plane on the reference plane at 0°', () => {
      const d = inclinationDiagram(0);
      expect(d.orbitPlane.rotation).toBe(0);
      expect(d.orbitLine.y1).toBeCloseTo(CENTER, 6);
      expect(d.orbitLine.y2).toBeCloseTo(CENTER, 6);
    });

    it('tilts the orbit plane anticlockwise (negative SVG rotation)', () => {
      const d = inclinationDiagram(30);
      expect(d.orbitPlane.rotation).toBe(-30);
      // +x end of the orbit line rises above centre.
      expect(d.orbitLine.y2).toBeLessThan(CENTER);
      expect(d.orbitLine.x2).toBeGreaterThan(CENTER);
    });

    it('keeps the reference plane horizontal regardless of inclination', () => {
      const d = inclinationDiagram(75);
      expect(d.referencePlane.rotation).toBe(0);
      expect(d.referenceLine.y1).toBe(CENTER);
      expect(d.referenceLine.y2).toBe(CENTER);
    });

    it('defaults the body to the major-axis end of the orbital plane', () => {
      const d = inclinationDiagram(30);
      // With no orbital angle the body sits at the +x end of the orbit line.
      expect(d.bodyPoint).toEqual({ x: d.orbitLine.x2, y: d.orbitLine.y2 });
      expect(d.bodyPoint.y).toBeLessThan(CENTER);
    });

    it('places the body on the orbit-plane rim at the given orbital angle', () => {
      // At 0° tilt the orbit plane is flat: angle 90° lands at the minor-axis tip below centre.
      const d = inclinationDiagram(0, 90);
      expect(d.bodyPoint.x).toBeCloseTo(CENTER, 3);
      expect(d.bodyPoint.y).toBeCloseTo(d.orbitPlane.cy + d.orbitPlane.ry, 3);
    });

    it('moves the body around the orbit as the orbital angle advances', () => {
      const at0 = inclinationDiagram(20, 0).bodyPoint;
      const at120 = inclinationDiagram(20, 120).bodyPoint;
      const at240 = inclinationDiagram(20, 240).bodyPoint;
      // Three distinct positions around the rim.
      expect(at0).not.toEqual(at120);
      expect(at120).not.toEqual(at240);
      expect(at0).not.toEqual(at240);
    });

    it('puts the names on opposite halves to avoid overlap', () => {
      // Body in the lower half (angle 90° at 0° tilt) -> parent name above, body name below.
      const lower = inclinationDiagram(0, 90);
      expect(lower.bodyPoint.y).toBeGreaterThan(CENTER);
      expect(lower.parentLabel.y).toBeLessThan(CENTER);
      expect(lower.bodyLabel.y).toBeGreaterThan(lower.bodyPoint.y);

      // Body in the upper half (angle 270°) -> parent name below, body name above.
      const upper = inclinationDiagram(0, 270);
      expect(upper.bodyPoint.y).toBeLessThan(CENTER);
      expect(upper.parentLabel.y).toBeGreaterThan(CENTER);
      expect(upper.bodyLabel.y).toBeLessThan(upper.bodyPoint.y);
    });
  });

  describe('periapsisDiagram', () => {
    it('draws an ellipse, never a circle', () => {
      const d = periapsisDiagram(0, 0.5);
      expect(d.ellipse.rx).not.toBeCloseTo(d.ellipse.ry, 3);
      expect(d.ellipse.ry).toBeLessThan(d.ellipse.rx);
    });

    it('places the parent at a focus, offset from the ellipse centre', () => {
      const d = periapsisDiagram(0, 0.5);
      // Focus is the diagram centre; ellipse centre is shifted away from it.
      expect(d.focus.x).toBe(CENTER);
      expect(dist(d.focus, { x: d.ellipse.cx, y: d.ellipse.cy })).toBeGreaterThan(0.5);
    });

    it('puts periapsis along +x for a 0° argument', () => {
      const d = periapsisDiagram(0, 0.5);
      expect(d.periapsisPoint.y).toBeCloseTo(CENTER, 3);
      expect(d.periapsisPoint.x).toBeGreaterThan(CENTER);
    });

    it('rotates periapsis anticlockwise for a 90° argument', () => {
      const d = periapsisDiagram(90, 0.5);
      expect(d.periapsisPoint.x).toBeCloseTo(CENTER, 3);
      expect(d.periapsisPoint.y).toBeLessThan(CENTER); // upward on screen
      expect(d.ellipse.rotation).toBe(-90);
    });

    it('places periapsis at the near vertex, within the semi-major axis of the focus', () => {
      const d = periapsisDiagram(120, 0.6);
      // Periapsis distance a·(1-e) is positive and strictly inside the semi-major axis (rx = a).
      const periapsisDist = dist(d.focus, d.periapsisPoint);
      expect(periapsisDist).toBeGreaterThan(0);
      expect(periapsisDist).toBeLessThan(d.ellipse.rx);
    });

    it('clamps eccentricity so near-circular orbits still read as ellipses', () => {
      const d = periapsisDiagram(0, 0);
      // Clamped to >= 0.2, so a visible offset between rx and ry remains.
      expect(d.ellipse.rx - d.ellipse.ry).toBeGreaterThan(0.5);
    });

    it('caps extreme eccentricity and defaults missing values', () => {
      const high = periapsisDiagram(0, 0.99);
      const def = periapsisDiagram(0, undefined);
      // High eccentricity is clamped (rx > ry, finite) and a missing value still draws an ellipse.
      expect(high.ellipse.rx).toBeGreaterThan(high.ellipse.ry);
      expect(def.ellipse.rx).toBeGreaterThan(0);
    });
  });

  describe('anomalyDiagram', () => {
    it('coincides the mean and true markers at periapsis (M = ν = 0)', () => {
      // Each point's x/y is independently rounded to 3 decimals (see `r()`), so the
      // distance between two theoretically-identical points can be a few thousandths.
      const d = anomalyDiagram(0, 0, 0.5);
      expect(dist(d.meanPoint, d.truePoint)).toBeCloseTo(0, 2);
    });

    it('coincides the mean and true markers at apoapsis (M = ν = 180)', () => {
      const d = anomalyDiagram(180, 180, 0.5);
      expect(dist(d.meanPoint, d.truePoint)).toBeCloseTo(0, 2);
    });

    it('coincides mean and true markers everywhere for a circular orbit', () => {
      const d = anomalyDiagram(90, 90, 0);
      expect(dist(d.meanPoint, d.truePoint)).toBeCloseTo(0, 2);
    });

    it('diverges mean and true markers mid-orbit for an eccentric orbit', () => {
      // At M = 90 with e = 0.5, true anomaly leads well past 90° (see meanToTrueAnomaly),
      // so the two markers land on visibly different points.
      const d = anomalyDiagram(90, 130, 0.5);
      expect(dist(d.meanPoint, d.truePoint)).toBeGreaterThan(1);
    });

    it('draws the true-anomaly point on the ellipse and the mean-anomaly point on the wider auxiliary circle', () => {
      const d = anomalyDiagram(90, 130, 0.5);
      expect(d.auxCircle.rx).toBeCloseTo(d.ellipse.rx, 6);
      expect(d.auxCircle.ry).toBeCloseTo(d.ellipse.rx, 6); // auxiliary circle is a true circle
      expect(d.ellipse.ry).toBeLessThan(d.ellipse.rx); // real orbit stays elliptical
    });

    it('orients the ellipse and markers by the body\'s own argument of periapsis, like periapsisDiagram', () => {
      // At ν = M = 0 the body sits exactly at periapsis, a fixed distance from the focus —
      // rotating argOfPeriapsis should carry that point (and the ellipse) around the focus
      // without changing its distance, the same convention periapsisDiagram uses. This is
      // what lets two colliding bodies' diagrams (different orbits, same physical position)
      // agree on where their markers land instead of always drawing periapsis along +x.
      const unrotated = anomalyDiagram(0, 0, 0.5);
      const rotated = anomalyDiagram(0, 0, 0.5, 90);

      expect(rotated.ellipse.rotation).toBe(-90);
      expect(dist(rotated.focus, rotated.truePoint)).toBeCloseTo(dist(unrotated.focus, unrotated.truePoint), 3);

      // Unrotated periapsis sits along +x from the focus (screen y unchanged).
      expect(unrotated.truePoint.y).toBeCloseTo(unrotated.focus.y, 2);
      expect(unrotated.truePoint.x).toBeGreaterThan(unrotated.focus.x);

      // A 90° argument of periapsis rotates periapsis to screen "up" (x unchanged, y decreases).
      expect(rotated.truePoint.x).toBeCloseTo(rotated.focus.x, 2);
      expect(rotated.truePoint.y).toBeLessThan(rotated.focus.y);
    });

    it('rotates the mean-anomaly marker by the same argument of periapsis', () => {
      const unrotated = anomalyDiagram(90, 90, 0.5);
      const rotated = anomalyDiagram(90, 90, 0.5, 90);
      // M = 90 sits 90° around the auxiliary circle from periapsis; adding a 90° argument of
      // periapsis carries it to 180° absolute — the far side of the circle from the unrotated case.
      expect(dist(unrotated.focus, unrotated.meanPoint)).toBeCloseTo(dist(rotated.focus, rotated.meanPoint), 3);
      expect(rotated.meanPoint.x).toBeLessThan(unrotated.meanPoint.x);
    });
  });

  describe('parentDistanceDiagram', () => {
    it('places the body at the periapsis marker when ν = 0', () => {
      const d = parentDistanceDiagram(0, 0.5);
      expect(dist(d.bodyPoint, d.periapsisPoint)).toBeCloseTo(0, 2);
    });

    it('places the body at the apoapsis marker when ν = 180', () => {
      const d = parentDistanceDiagram(180, 0.5);
      expect(dist(d.bodyPoint, d.apoapsisPoint)).toBeCloseTo(0, 2);
    });

    it('matches r = a(1 − e²) / (1 + e·cos ν) at an arbitrary true anomaly', () => {
      // maxApo = 46, e = 0.5 => a = 46 / 1.5; at ν = 90° the formula reduces to a·(1 − e²) = 23.
      const d = parentDistanceDiagram(90, 0.5);
      expect(dist(d.focus, d.bodyPoint)).toBeCloseTo(23, 1);
    });

    it('holds the body at a constant radius (= a) for a circular orbit regardless of ν', () => {
      const atZero = parentDistanceDiagram(0, 0);
      const atNinety = parentDistanceDiagram(90, 0);
      expect(dist(atZero.focus, atZero.bodyPoint)).toBeCloseTo(dist(atNinety.focus, atNinety.bodyPoint), 2);
    });

    it('orients the ellipse and markers by the body\'s own argument of periapsis, like periapsisDiagram/anomalyDiagram', () => {
      const unrotated = parentDistanceDiagram(0, 0.5);
      const rotated = parentDistanceDiagram(0, 0.5, 90);

      expect(rotated.ellipse.rotation).toBe(-90);
      expect(dist(rotated.focus, rotated.bodyPoint)).toBeCloseTo(dist(unrotated.focus, unrotated.bodyPoint), 3);

      // Unrotated periapsis sits along +x from the focus (screen y unchanged).
      expect(unrotated.bodyPoint.y).toBeCloseTo(unrotated.focus.y, 2);
      expect(unrotated.bodyPoint.x).toBeGreaterThan(unrotated.focus.x);

      // A 90° argument of periapsis rotates periapsis to screen "up" (x unchanged, y decreases).
      expect(rotated.bodyPoint.x).toBeCloseTo(rotated.focus.x, 2);
      expect(rotated.bodyPoint.y).toBeLessThan(rotated.focus.y);
    });

    it('draws the distance line from the focus to the body point', () => {
      const d = parentDistanceDiagram(90, 0.5);
      expect(d.distanceLine).toEqual({ x1: d.focus.x, y1: d.focus.y, x2: d.bodyPoint.x, y2: d.bodyPoint.y });
    });

    it('preserves high eccentricities instead of clamping them down to a different orbit', () => {
      const e = 0.95;
      const d = parentDistanceDiagram(0, e);
      const expectedPeriapsis = 46 * (1 - e) / (1 + e);
      expect(dist(d.focus, d.periapsisPoint)).toBeCloseTo(expectedPeriapsis, 2);
    });
  });

  describe('lagrangeDiagram', () => {
    const d = lagrangeDiagram();

    it('centres the primary and puts the secondary on the orbit to the right', () => {
      expect(d.center).toEqual({ x: CENTER, y: CENTER });
      // Secondary sits one orbit-radius to the right, on the axis.
      expect(d.secondary).toEqual({ x: CENTER + d.orbitRadius, y: CENTER });
      expect(dist(d.center, d.secondary)).toBeCloseTo(d.orbitRadius, 6);
    });

    it('exposes all five Lagrange points in L1…L5 order', () => {
      expect(d.markers.map(m => m.id)).toEqual(['L1', 'L2', 'L3', 'L4', 'L5']);
    });

    it('places L4 leading (above the axis) and L5 trailing (below), 60° off, on the orbit', () => {
      const l4 = d.markers.find(m => m.id === 'L4')!;
      const l5 = d.markers.find(m => m.id === 'L5')!;
      // Screen "up" is -y: the leading point sits above the axis, the trailing one below.
      expect(l4.point.y).toBeLessThan(CENTER);
      expect(l5.point.y).toBeGreaterThan(CENTER);
      // Both ride the reference orbit and mirror each other across the axis.
      expect(dist(d.center, l4.point)).toBeCloseTo(d.orbitRadius, 3);
      expect(dist(d.center, l5.point)).toBeCloseTo(d.orbitRadius, 3);
      expect(l4.point.x).toBeCloseTo(l5.point.x, 6);
      expect(l4.point.y - CENTER).toBeCloseTo(CENTER - l5.point.y, 6);
    });

    it('orders L1 inside the orbit, L3 opposite the secondary, L2 beyond it', () => {
      const x = (id: string) => d.markers.find(m => m.id === id)!.point.x;
      // L3 opposite < primary < L1 inside < secondary < L2 beyond, all on the axis (y = CENTER).
      expect(x('L3')).toBeLessThan(CENTER);
      expect(x('L1')).toBeGreaterThan(CENTER);
      expect(x('L1')).toBeLessThan(d.secondary.x);
      expect(x('L2')).toBeGreaterThan(d.secondary.x);
      for (const id of ['L1', 'L2', 'L3']) {
        expect(d.markers.find(m => m.id === id)!.point.y).toBe(CENTER);
      }
    });

    it('drops the L3 occupant name below its marker, onto the secondary name band', () => {
      const l3 = d.markers.find(m => m.id === 'L3')!;
      // The "L3" caption stays above the marker; the body name goes below it…
      expect(l3.label.y).toBeLessThan(l3.point.y);
      expect(l3.nameLabel.y).toBeGreaterThan(l3.point.y);
      // …onto the same horizontal band as the secondary's name on the opposite side.
      expect(l3.nameLabel.y).toBeCloseTo(d.secondaryLabel.y, 6);
      expect(l3.nameLabel.x).toBeCloseTo(l3.point.x, 6);
    });

    it('keeps every drawn point within the view box', () => {
      const pts = [d.center, d.secondary, ...d.markers.map(m => m.point)];
      for (const p of pts) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(VIEW_BOX_SIZE);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(VIEW_BOX_SIZE);
      }
    });
  });
});
