import { greenGasGiantLadderDiagram, LADDER_VIEW_HEIGHT, LADDER_VIEW_WIDTH } from './green-gas-giant-ladder';
import { GreenGasGiantCandidate, predictGreenGasGiant } from './green-gas-giant-prediction';

/** M17 Sector CF-Y c1-23 2 — green on its 6th layer, exactly on the 270 K boundary. */
const M17: GreenGasGiantCandidate = {
  subType: 'Class I gas giant',
  surfaceTemperature: 133.998352,
  earthMasses: 220.366837,
  radius: 66635.716,
};

/** The same body one float32 step off: no layer on a boundary. */
const NOT_GREEN: GreenGasGiantCandidate = {
  subType: 'Gas giant with water-based life',
  surfaceTemperature: 176.666626,
  earthMasses: 408.532623,
  radius: 75062.848,
};

const diagramFor = (body: GreenGasGiantCandidate) => {
  const prediction = predictGreenGasGiant(body);
  expect(prediction).not.toBeNull();
  return greenGasGiantLadderDiagram(prediction!);
};

describe('greenGasGiantLadderDiagram', () => {
  it('emits one rung per cloud layer, in the prediction\'s order', () => {
    const prediction = predictGreenGasGiant(M17)!;
    const diagram = greenGasGiantLadderDiagram(prediction);
    expect(diagram.rungs).toHaveLength(7);
    expect(diagram.rungs.map(rung => rung.layer)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(diagram.rungs.map(rung => rung.temperature)).toEqual([...prediction.layers]);
  });

  it('maps hotter temperatures to smaller y, so the ladder climbs up the screen', () => {
    const diagram = diagramFor(M17);
    for (let i = 1; i < diagram.rungs.length; i++) {
      expect(diagram.rungs[i].y).toBeLessThan(diagram.rungs[i - 1].y);
    }
  });

  it('keeps every rung inside the viewBox', () => {
    const diagram = diagramFor(M17);
    expect(diagram.viewWidth).toBe(LADDER_VIEW_WIDTH);
    expect(diagram.viewHeight).toBe(LADDER_VIEW_HEIGHT);
    for (const rung of diagram.rungs) {
      expect(rung.y).toBeGreaterThan(0);
      expect(rung.y).toBeLessThan(LADDER_VIEW_HEIGHT);
    }
  });

  it('marks the hit rung and the boundary it lands on, and puts them at the same y', () => {
    const diagram = diagramFor(M17);
    expect(diagram.isGreen).toBe(true);
    const hitRungs = diagram.rungs.filter(rung => rung.isHit);
    expect(hitRungs).toHaveLength(1);
    expect(hitRungs[0].layer).toBe(6);
    const hitCracks = diagram.cracks.filter(crack => crack.isHit);
    expect(hitCracks).toHaveLength(1);
    expect(hitCracks[0].temperature).toBe(270);
    // The whole point of the picture: the rung visibly coincides with the boundary.
    expect(hitRungs[0].y).toBe(hitCracks[0].y);
  });

  it('marks no rung or boundary as hit when the giant is not green', () => {
    const diagram = diagramFor(NOT_GREEN);
    expect(diagram.isGreen).toBe(false);
    expect(diagram.rungs.some(rung => rung.isHit)).toBe(false);
    expect(diagram.cracks.some(crack => crack.isHit)).toBe(false);
    expect(diagram.stripes.some(stripe => stripe.band === null)).toBe(false);
  });

  it('drops band boundaries far outside the body\'s temperature range', () => {
    const diagram = diagramFor(M17);
    // M17's layers span 134-297 K, so the 700/900/1400 K boundaries have nothing to say.
    const plotted = diagram.cracks.map(crack => crack.temperature);
    expect(plotted).toContain(270);
    expect(plotted).not.toContain(700);
    expect(plotted).not.toContain(1400);
    for (const crack of plotted) {
      expect(crack).toBeGreaterThanOrEqual(diagram.minTemperature);
      expect(crack).toBeLessThanOrEqual(diagram.maxTemperature);
    }
  });

  it('plots the reach only when the reach, not the ceiling, capped the ladder', () => {
    // M17's ladder stops short of its 340 K ceiling, so the reach is what to show.
    const densityDriven = diagramFor(M17);
    expect(densityDriven.reach).not.toBeNull();

    // A water-life giant at 158 K hits the ceiling, so the reach is irrelevant.
    const capped = diagramFor({
      subType: 'Gas giant with water-based life',
      surfaceTemperature: 158, earthMasses: 389.048157, radius: 74427.544,
    });
    expect(capped.reach).toBeNull();
    expect(capped.ceiling?.temperature).toBe(340);
  });

  it('builds seven stacked, non-overlapping stripes covering the planet disc', () => {
    const diagram = diagramFor(M17);
    expect(diagram.stripes).toHaveLength(7);
    const top = diagram.planetCenterY - diagram.planetRadius;
    const bottom = diagram.planetCenterY + diagram.planetRadius;
    // Layer 1 (coldest) sits at the bottom of the disc, layer 7 at the top — the same way
    // round as the ladder beside it.
    // Tolerances are 2dp because the module rounds its output to 3dp, so adjacent edges
    // can differ by a rounding step — invisible at a 680-unit viewBox, but real.
    expect(diagram.stripes[0].y + diagram.stripes[0].height).toBeCloseTo(bottom, 2);
    expect(diagram.stripes[6].y).toBeCloseTo(top, 2);
    for (let i = 1; i < diagram.stripes.length; i++) {
      expect(diagram.stripes[i].y).toBeLessThan(diagram.stripes[i - 1].y);
      expect(diagram.stripes[i].y + diagram.stripes[i].height).toBeCloseTo(diagram.stripes[i - 1].y, 2);
    }
  });

  it('gives the layer on a boundary no band at all — that is the green stripe', () => {
    const diagram = diagramFor(M17);
    const greenStripes = diagram.stripes.filter(stripe => stripe.band === null);
    expect(greenStripes).toHaveLength(1);
    expect(greenStripes[0].layer).toBe(6);
    expect(greenStripes[0].isHit).toBe(true);
  });

  it('assigns bands that rise with temperature', () => {
    const diagram = diagramFor(NOT_GREEN);
    const bands = diagram.stripes.map(stripe => stripe.band!);
    for (let i = 1; i < bands.length; i++) {
      expect(bands[i]).toBeGreaterThanOrEqual(bands[i - 1]);
    }
    // Never negative, and never past the last band (one more than the boundary count).
    for (const band of bands) {
      expect(band).toBeGreaterThanOrEqual(0);
      expect(band).toBeLessThanOrEqual(diagram.cracks.length + diagram.stripes.length);
    }
  });

  it('survives a clamped ladder whose layers barely spread', () => {
    // A class V giant's step is clamped to at least 250 K, so its range is enormous; a
    // near-flat ladder is the opposite extreme. Neither may produce NaN geometry.
    for (const body of [
      { subType: 'Class V gas giant', surfaceTemperature: 1600, earthMasses: 3000, radius: 70000 },
      { subType: 'Class I gas giant', surfaceTemperature: 74, earthMasses: 500, radius: 70000 },
    ] satisfies GreenGasGiantCandidate[]) {
      const diagram = diagramFor(body);
      expect(diagram.maxTemperature).toBeGreaterThan(diagram.minTemperature);
      for (const rung of diagram.rungs) {
        expect(Number.isFinite(rung.y)).toBe(true);
      }
      for (const stripe of diagram.stripes) {
        expect(Number.isFinite(stripe.y)).toBe(true);
        expect(stripe.height).toBeGreaterThan(0);
      }
    }
  });
});
