import { RING_DIAGRAM_VIEW_BOX_SIZE, ringClassificationDiagram } from './ring-classification-diagram';

describe('ring-classification-diagram', () => {
  it('centres the diagram and reports the shared viewBox size', () => {
    const d = ringClassificationDiagram(50000, [{ name: 'A', innerRadius: 60000, outerRadius: 70000 }], 'A');
    expect(d.viewBoxSize).toBe(RING_DIAGRAM_VIEW_BOX_SIZE);
    expect(d.center).toBe(RING_DIAGRAM_VIEW_BOX_SIZE / 2);
  });

  it('scales the body and ring proportionally to their real radii', () => {
    // Ring inner/outer sit exactly 2x/2.5x the body radius out — the scaled diagram should
    // preserve that ratio (mid-radius relative to body radius), not just its absolute size.
    const d = ringClassificationDiagram(100000, [{ name: 'A', innerRadius: 200000, outerRadius: 250000 }], 'A');
    const ring = d.rings[0];
    const ringInnerPx = ring.radius - ring.strokeWidth / 2;
    expect(ringInnerPx / d.bodyRadius).toBeCloseTo(2, 1);
  });

  it('does not floor the body radius — a distant Pauper-style body renders genuinely tiny', () => {
    // 1 000 km body under a ring 700 000-750 000 km out: body radius should be a true, tiny
    // fraction of the drawing — not clamped up to stay "visible". Scale is derived from the
    // ring (a large, well-conditioned value) rather than back out of the tiny body radius
    // itself, so rounding in the body radius can't get amplified into a false failure.
    const d = ringClassificationDiagram(1000, [{ name: 'A', innerRadius: 700000, outerRadius: 750000 }], 'A');
    const ring = d.rings[0];
    const scale = (ring.radius + ring.strokeWidth / 2) / 750000; // outer edge of the (only, outermost) ring
    // Both sides are independently rounded to 3 decimals (see `r()`), which on a value this
    // small (~0.075) is a coarse ~0.5% relative precision — hence 2 decimal places here, not 4.
    expect(d.bodyRadius).toBeCloseTo(1000 * scale, 2);
    expect(d.bodyRadius).toBeLessThan(0.1);
  });

  it('does not floor a narrow Taylor-style ring stroke — it renders genuinely thin', () => {
    // A 100 km wide ring against a 60 000 km outer extent is a true ~0.09 SVG units wide.
    const d = ringClassificationDiagram(50000, [{ name: 'A', innerRadius: 60000, outerRadius: 60100 }], 'A');
    expect(d.rings[0].strokeWidth).toBeLessThan(0.1);
    expect(d.rings[0].strokeWidth).toBeGreaterThan(0);
  });

  it('body radius and ring geometry share exactly one linear scale factor', () => {
    const bodyRadiusKm = 40000;
    const d = ringClassificationDiagram(bodyRadiusKm, [{ name: 'A', innerRadius: 80000, outerRadius: 100000 }], 'A');
    const scale = d.bodyRadius / bodyRadiusKm;
    const ring = d.rings[0];
    expect((ring.radius - ring.strokeWidth / 2) / scale).toBeCloseTo(80000, 0);
    expect((ring.radius + ring.strokeWidth / 2) / scale).toBeCloseTo(100000, 0);
  });

  it('marks only the ring matching focusedRingName as focused', () => {
    const d = ringClassificationDiagram(50000, [
      { name: 'A', innerRadius: 60000, outerRadius: 70000 },
      { name: 'B', innerRadius: 80000, outerRadius: 90000 },
    ], 'B');
    expect(d.rings.find(r => r.name === 'A')!.isFocused).toBe(false);
    expect(d.rings.find(r => r.name === 'B')!.isFocused).toBe(true);
  });

  it('orders rings by their input order, each further out than the last for increasing radii', () => {
    const d = ringClassificationDiagram(50000, [
      { name: 'A', innerRadius: 60000, outerRadius: 70000 },
      { name: 'B', innerRadius: 80000, outerRadius: 90000 },
      { name: 'C', innerRadius: 100000, outerRadius: 110000 },
    ], 'A');
    expect(d.rings[0].radius).toBeLessThan(d.rings[1].radius);
    expect(d.rings[1].radius).toBeLessThan(d.rings[2].radius);
  });

  it('keeps every ring within the available drawing radius', () => {
    const d = ringClassificationDiagram(50000, [{ name: 'A', innerRadius: 750000, outerRadius: 800000 }], 'A');
    const outerEdgePx = d.rings[0].radius + d.rings[0].strokeWidth / 2;
    expect(outerEdgePx).toBeLessThanOrEqual(RING_DIAGRAM_VIEW_BOX_SIZE / 2);
  });
});
