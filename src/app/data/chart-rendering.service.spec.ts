import { ChartRenderingService, RocheChartData, HillChartData } from './chart-rendering.service';

/** A no-op 2D context that swallows every drawing call and property assignment. */
function mockContext(): CanvasRenderingContext2D {
  return new Proxy({}, {
    get: () => () => undefined,
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
}

/** A canvas whose getContext returns the no-op recording context. */
function mockCanvas(width = 800, height = 500): HTMLCanvasElement {
  return { width, height, getContext: () => mockContext() } as unknown as HTMLCanvasElement;
}

describe('ChartRenderingService', () => {
  let service: ChartRenderingService;

  beforeEach(() => {
    service = new ChartRenderingService();
  });

  describe('drawRocheChart', () => {
    const data: RocheChartData = {
      parentName: 'Star',
      ringName: 'Star A Ring',
      densityRange: [500, 1000, 2000, 4000, 8000],
      rigidLimits: [10000, 8000, 6000, 5000, 4000],
      fluidLimits: [20000, 16000, 12000, 10000, 8000],
      rings: [{ name: 'A Ring', innerRadius: 5000, outerRadius: 9000, type: 'Icy', density: 1500 }],
      primaryRadius: 700,
      isBody: false,
    };

    it('draws without throwing for valid data', () => {
      expect(() => service.drawRocheChart(mockCanvas(), data)).not.toThrow();
    });

    it('returns early without throwing when the context is unavailable', () => {
      const canvas = { width: 800, height: 500, getContext: () => null } as unknown as HTMLCanvasElement;
      expect(() => service.drawRocheChart(canvas, data)).not.toThrow();
    });
  });

  describe('drawShepherdingHillChart', () => {
    const data: HillChartData = {
      parentName: 'Planet',
      bodyName: 'Moon',
      parentRadius: 60000,
      outermostRingRadius: 140000,
      bodyOrbitalRadius: 200000,
      bodyPeriapsis: 190000,
      bodyApoapsis: 210000,
      hillRadius: 30000,
      withinRings: false,
      isFirstOutside: true,
      rings: [{ name: 'Ring', innerRadius: 80000, outerRadius: 140000, type: 'Rocky' }],
      bodyRadius: 1000,
      shepherdStatus: 'shepherd',
    };

    it('draws without throwing for valid data', () => {
      expect(() => service.drawShepherdingHillChart(mockCanvas(), data)).not.toThrow();
    });

    it('handles an empty ring list', () => {
      expect(() => service.drawShepherdingHillChart(mockCanvas(), { ...data, rings: [] })).not.toThrow();
    });
  });
});
