import { temperatureToX, magnitudeToY, hrPlot, VIEW_BOX_WIDTH, VIEW_BOX_HEIGHT } from './hr-diagram';

describe('temperatureToX', () => {
  it('places hotter stars further to the left', () => {
    expect(temperatureToX(40000)).toBeLessThan(temperatureToX(5000));
    expect(temperatureToX(5000)).toBeLessThan(temperatureToX(3000));
  });

  it('clamps temperatures outside the domain', () => {
    expect(temperatureToX(1e9)).toBe(temperatureToX(50000));
    expect(temperatureToX(10)).toBe(temperatureToX(2000));
  });
});

describe('magnitudeToY', () => {
  it('places brighter (more negative) stars higher up (smaller y)', () => {
    expect(magnitudeToY(-8)).toBeLessThan(magnitudeToY(5));
    expect(magnitudeToY(5)).toBeLessThan(magnitudeToY(12));
  });
});

describe('hrPlot', () => {
  it('returns a plottable point for a normal star', () => {
    const d = hrPlot({ surfaceTemperature: 5600, absoluteMagnitude: 4.7, spectralClass: 'G2' });
    expect(d.point).not.toBeNull();
    expect(d.inRange).toBe(true);
  });

  it('returns null point when temperature or magnitude is missing', () => {
    expect(hrPlot({ surfaceTemperature: 5600, absoluteMagnitude: null }).point).toBeNull();
    expect(hrPlot({ surfaceTemperature: null, absoluteMagnitude: 4.7 }).point).toBeNull();
  });

  it('marks a star outside the domain as out of range but still clamps it', () => {
    const d = hrPlot({ surfaceTemperature: 3.1e8, absoluteMagnitude: -16, spectralClass: null });
    expect(d.point).not.toBeNull();
    expect(d.inRange).toBe(false);
  });

  it('produces class ticks ordered hottest (left) to coolest (right)', () => {
    const d = hrPlot({});
    expect(d.classTicks.map((t) => t.label)).toEqual(['O', 'B', 'A', 'F', 'G', 'K', 'M']);
    for (let i = 1; i < d.classTicks.length; i++) {
      expect(d.classTicks[i].x).toBeGreaterThan(d.classTicks[i - 1].x);
    }
  });

  it('exposes a view box matching its constants', () => {
    expect(hrPlot({}).viewBox).toBe(`0 0 ${VIEW_BOX_WIDTH} ${VIEW_BOX_HEIGHT}`);
  });

  it('builds a non-empty main-sequence path', () => {
    expect(hrPlot({}).mainSequencePath.startsWith('M ')).toBe(true);
  });

  it('colours the star marker by spectral class (incl. subType fallback)', () => {
    expect(hrPlot({ surfaceTemperature: 5600, absoluteMagnitude: 4.7, spectralClass: 'G2' }).pointColor).toBeTruthy();
    expect(hrPlot({ surfaceTemperature: 20000, absoluteMagnitude: -1, spectralClass: null, subType: 'B (Blue-White) Star' }).pointColor).toBeTruthy();
    expect(hrPlot({ surfaceTemperature: 5600, absoluteMagnitude: 4.7, spectralClass: null }).pointColor).toBeNull();
  });

  it('produces gradient stops in ascending order across the plot width', () => {
    const stops = hrPlot({}).mainSequenceStops;
    expect(stops.length).toBe(7);
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i].offset).toBeGreaterThan(stops[i - 1].offset);
    }
  });

  it('draws the canonical luminosity regions with positive radii', () => {
    const regions = hrPlot({}).regions;
    expect(regions.map((rg) => rg.key)).toEqual(['supergiants', 'giants', 'whitedwarfs']);
    expect(regions.every((rg) => rg.rx > 0 && rg.ry > 0)).toBe(true);
  });

  it('highlights the region matching the star\'s luminosity class', () => {
    const giant = hrPlot({ surfaceTemperature: 4500, absoluteMagnitude: 0, spectralClass: 'K2', luminosity: 'III' });
    expect(giant.regions.find((rg) => rg.key === 'giants')!.current).toBe(true);
    expect(giant.mainSequenceCurrent).toBe(false);

    const dwarf = hrPlot({ surfaceTemperature: 5600, absoluteMagnitude: 4.7, spectralClass: 'G2', luminosity: 'V' });
    expect(dwarf.mainSequenceCurrent).toBe(true);
    expect(dwarf.regions.every((rg) => !rg.current)).toBe(true);

    const supergiant = hrPlot({ surfaceTemperature: 4000, absoluteMagnitude: -7, spectralClass: 'K5', luminosity: 'Iab' });
    expect(supergiant.regions.find((rg) => rg.key === 'supergiants')!.current).toBe(true);
  });

  it('highlights the white-dwarf region and derives a point from radius + temperature', () => {
    // White dwarfs report a radius and temperature but no absolute magnitude.
    const wd = hrPlot({
      surfaceTemperature: 27735, absoluteMagnitude: null, spectralClass: 'DA5',
      subType: 'White Dwarf (DA) Star', luminosity: 'VII', solarRadius: 0.0038452,
    });
    expect(wd.regions.find((rg) => rg.key === 'whitedwarfs')!.current).toBe(true);
    expect(wd.mainSequenceCurrent).toBe(false);
    expect(wd.point).not.toBeNull();
    expect(wd.inRange).toBe(true);
    // Derived magnitude (~+10) places it below the main sequence, in the white-dwarf band.
    expect(wd.point!.y).toBeGreaterThan(magnitudeToY(5));
  });

  it('flags a white dwarf as white-dwarf region even without a luminosity field', () => {
    const wd = hrPlot({ surfaceTemperature: 15000, spectralClass: 'DB', solarRadius: 0.01 });
    expect(wd.regions.find((rg) => rg.key === 'whitedwarfs')!.current).toBe(true);
  });

  it('places a vertical separator between each adjacent class', () => {
    const seps = hrPlot({}).classSeparators;
    expect(seps.length).toBe(6);
    for (let i = 1; i < seps.length; i++) {
      expect(seps[i]).toBeGreaterThan(seps[i - 1]);
    }
  });
});
