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

  describe('generateJetAngleChart', () => {
    it('returns null for empty CSV input', () => {
      expect(service.generateJetAngleChart('')).toBeNull();
    });

    it('returns null when the CSV has only a header row', () => {
      expect(service.generateJetAngleChart('Rotation Period [s],Radius [Ls],Angle [deg],age')).toBeNull();
    });

    it('does not throw on well-formed sample rows', () => {
      const csv = [
        'System,Body,Rotation Period [s],Radius [Ls],Angle [deg],age',
        'Hypaa,B1,1.789518,2.01,8.759363,12830',
        'Hypaa,B2,1.700175,2.04,11.40773,12860',
      ].join('\n');
      // In jsdom getContext('2d') is unavailable, so this returns null rather than a
      // data URL — the point is that parsing/scaling runs without throwing.
      expect(() => service.generateJetAngleChart(csv)).not.toThrow();
    });

    it('renders the full bubble plot to a data URL when a 2D context is available', () => {
      const csv = [
        'System,Body,Rotation Period [s],Radius [Ls],Angle [deg],age',
        'Hypaa,B1,1.789518,2.01,8.759363,12830',
        'Hypaa,B2,1.700175,2.04,11.40773,12860',
        'Phrooe,B8,0.973363,3.3,16,6402',
      ].join('\n');
      // Stub canvas creation so getContext('2d') returns the no-op recorder and the
      // pixel-mapping helpers (xToPx/yToPx) and full drawing path execute.
      const fakeCanvas = {
        width: 0, height: 0,
        getContext: () => mockContext(),
        toDataURL: () => 'data:image/png;base64,TEST',
      } as unknown as HTMLCanvasElement;
      const createSpy = vi.spyOn(document, 'createElement').mockReturnValue(fakeCanvas as any);
      try {
        expect(service.generateJetAngleChart(csv)).toBe('data:image/png;base64,TEST');
      } finally {
        createSpy.mockRestore();
      }
    });
  });
});
