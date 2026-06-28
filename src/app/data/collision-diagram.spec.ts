import {
  COLLISION_DIAGRAM_HEIGHT,
  COLLISION_DIAGRAM_WIDTH,
  SynodicDiagramInput,
  synodicDistanceDiagram,
} from './collision-diagram';

/** A window with one partner whose separation dips from ~1e6 km to a 500 km contact. */
function input(over: Partial<SynodicDiagramInput> = {}): SynodicDiagramInput {
  const start = 1_000_000;
  const end = start + 1000;
  const samples = Array.from({ length: 11 }, (_, i) => ({
    tMs: start + (end - start) * (i / 10),
    // V-shaped dip whose sampled floor (5000 km) sits ABOVE the true contact, so the test can
    // confirm the curve is threaded down to the deeper collision minimum.
    sepKm: 5000 + Math.abs(i - 5) * 200_000,
  }));
  return {
    startMs: start,
    endMs: end,
    nowMs: start,
    // The true contact (500 km) is deeper than any uniform sample.
    series: [{ partnerName: 'Test 1 c', combinedRadiiKm: 1000, samples, contacts: [{ tMs: start + 500, sepKm: 500 }] }],
    ...over,
  };
}

describe('synodicDistanceDiagram', () => {
  it('lays out a plot within the view box and a polyline for the series', () => {
    const dg = synodicDistanceDiagram(input())!;
    expect(dg).not.toBeNull();
    expect(dg.width).toBe(COLLISION_DIAGRAM_WIDTH);
    expect(dg.height).toBe(COLLISION_DIAGRAM_HEIGHT);
    // Plot rectangle sits inside the view box (margins leave room for axes).
    expect(dg.plot.x).toBeGreaterThan(0);
    expect(dg.plot.x + dg.plot.w).toBeLessThan(dg.width);
    expect(dg.plot.y + dg.plot.h).toBeLessThan(dg.height);
    // One curve whose polyline threads the contact minimum in among the 11 samples.
    expect(dg.series.length).toBe(1);
    expect(dg.series[0].points.split(' ').length).toBe(12);
  });

  it('threads the curve down to the collision marker (deeper than any uniform sample)', () => {
    const dg = synodicDistanceDiagram(input())!;
    const ys = dg.series[0].points.split(' ').map(p => Number(p.split(',')[1]));
    // SVG y grows downward, so the deepest point is the largest y — and it must be the contact
    // minimum, i.e. the curve reaches the marker rather than bottoming out above it.
    const maxY = Math.max(...ys);
    expect(dg.series[0].markers.length).toBe(1);
    expect(dg.series[0].markers[0].cy).toBeCloseTo(maxY, 6);
    // The contact threshold (1000 km) sits above the 500 km dip → smaller y than the marker,
    // and within the plot bounds.
    const tY = dg.series[0].thresholdY;
    expect(tY).toBeLessThan(maxY);
    expect(tY).toBeGreaterThanOrEqual(dg.plot.y);
    expect(tY).toBeLessThanOrEqual(dg.plot.y + dg.plot.h);
  });

  it('places the now marker only when now falls within the window', () => {
    expect(synodicDistanceDiagram(input())!.nowX).not.toBeNull();
    const outside = synodicDistanceDiagram(input({ nowMs: 0 }))!;
    expect(outside.nowX).toBeNull();
  });

  it('emits decade y-ticks across the distance range and four x-ticks across time', () => {
    const dg = synodicDistanceDiagram(input())!;
    expect(dg.xTicks.length).toBe(4);
    expect(dg.xTicks[0].tMs).toBe(1_000_000);
    expect(dg.xTicks[3].tMs).toBe(1_001_000);
    // End ticks anchor inward so the dated labels don't clip at the plot edges.
    expect(dg.xTicks[0].anchor).toBe('start');
    expect(dg.xTicks[3].anchor).toBe('end');
    expect(dg.xTicks[1].anchor).toBe('middle');
    // Range ~500 km … ~1e6 km spans several decades; labels are compact.
    expect(dg.yTicks.length).toBeGreaterThan(1);
    expect(dg.yTicks.some(t => /km$/.test(t.label))).toBe(true);
  });

  it('assigns distinct palette colours to multiple partners', () => {
    const base = input();
    const two = input({
      series: [base.series[0], { ...base.series[0], partnerName: 'Test 1 d' }],
    });
    const dg = synodicDistanceDiagram(two)!;
    expect(dg.series.length).toBe(2);
    expect(dg.series[0].color).not.toBe(dg.series[1].color);
  });

  it('returns null when there is no plottable data', () => {
    expect(synodicDistanceDiagram(input({ endMs: 1_000_000 }))).toBeNull(); // zero-width window
    expect(synodicDistanceDiagram(input({ series: [] }))).toBeNull();        // no series
    // A series whose samples are all non-finite is not plottable.
    const nan = input();
    nan.series[0].samples = nan.series[0].samples.map(s => ({ ...s, sepKm: NaN }));
    expect(synodicDistanceDiagram(nan)).toBeNull();
  });
});
