import { TestBed } from '@angular/core/testing';
import { buildSystemExport, downloadJson, serializeSystemExport, systemExportFilename } from './system-export';
import { BodyEnrichmentService } from './body-enrichment.service';
import { CanonnBiostats, CanonnBiostatsBody, SystemBody } from '../home/home.component';
import { BODY_TYPE } from './body-types';

const NOW = Date.UTC(2026, 0, 1, 0, 0, 0);

function starRaw(): CanonnBiostatsBody {
  return {
    bodyId: 0, id64: 10n, name: 'Test A', type: BODY_TYPE.Star, subType: 'K (Yellow-Orange) Star',
    solarMasses: 0.9, solarRadius: 0.8, mainStar: true,
  };
}

function planetRaw(): CanonnBiostatsBody {
  return {
    bodyId: 1, id64: 11n, name: 'Test 1', type: BODY_TYPE.Planet, subType: 'High metal content world',
    semiMajorAxis: 2, orbitalEccentricity: 0.1, earthMasses: 95, radius: 60000, surfaceTemperature: 200,
    parents: [{ Star: 0 }],
    rings: [{ name: 'Test 1 A Ring', innerRadius: 70_000_000, outerRadius: 140_000_000, mass: 1e18, type: 'Icy' }],
  };
}

/** A minimal loaded system with a star and a ringed planet, plus the matching SystemBody tree. */
function makeSystem(): { data: CanonnBiostats; roots: SystemBody[] } {
  const star = starRaw();
  const planet = planetRaw();
  const starNode: SystemBody = { bodyData: star, subBodies: [], parent: null };
  const planetNode: SystemBody = { bodyData: planet, subBodies: [], parent: starNode };
  starNode.subBodies.push(planetNode);

  const data: CanonnBiostats = {
    system: {
      allegiance: '', bodies: [star, planet], bodyCount: 2,
      coords: { x: 1, y: 2, z: 3 }, date: '2026-01-01', government: null,
      id64: 1234n, name: 'Test System', population: 0,
    },
  };
  return { data, roots: [starNode] };
}

describe('system-export', () => {
  let enrich: BodyEnrichmentService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    enrich = TestBed.inject(BodyEnrichmentService);
  });

  describe('buildSystemExport', () => {
    it('preserves the Spansh system metadata and body count', () => {
      const { data, roots } = makeSystem();
      const result = buildSystemExport(data, roots, enrich, NOW);
      expect(result.system.name).toBe('Test System');
      expect(result.system.id64).toBe(1234n);
      expect(result.system.coords).toEqual({ x: 1, y: 2, z: 3 });
      expect(result.system.bodies.length).toBe(2);
    });

    it('attaches a calculated block to every body while keeping raw fields', () => {
      const { data, roots } = makeSystem();
      const result = buildSystemExport(data, roots, enrich, NOW);
      const planet = result.system.bodies.find(b => b.bodyId === 1)!;
      expect(planet.subType).toBe('High metal content world');
      expect(planet.semiMajorAxis).toBe(2);
      expect(planet.calculated).toBeTruthy();
      expect(planet.calculated.orbit).not.toBeNull();
      expect(planet.calculated.density).not.toBeNull();
    });

    it('enriches each ring using its parent body for context', () => {
      const { data, roots } = makeSystem();
      const result = buildSystemExport(data, roots, enrich, NOW);
      const planet = result.system.bodies.find(b => b.bodyId === 1)!;
      expect(planet.rings).toBeDefined();
      const ring = planet.rings![0];
      // Raw ring fields survive (radii still in metres) and gain calculated ring dynamics.
      expect(ring.innerRadius).toBe(70_000_000);
      expect(ring.calculated.ring).not.toBeNull();
      expect(ring.calculated.ring!.dynamics).not.toBeNull();
    });

    it('still exports a body that is absent from the tree (context-free fallback)', () => {
      const { data, roots } = makeSystem();
      const orphan: CanonnBiostatsBody = { bodyId: 99, id64: 99n, name: 'Orphan', type: BODY_TYPE.Planet, subType: 'Icy body' };
      data.system.bodies.push(orphan);
      const result = buildSystemExport(data, roots, enrich, NOW);
      const exported = result.system.bodies.find(b => b.bodyId === 99);
      expect(exported).toBeDefined();
      expect(exported!.calculated).toBeTruthy();
    });

    it('records reproducible generation metadata outside the system object', () => {
      const { data, roots } = makeSystem();
      const result = buildSystemExport(data, roots, enrich, NOW);
      expect(result._generated.generatedAt).toBe(new Date(NOW).toISOString());
      expect(result._generated.generator).toBe('canonn-signals');
      expect(typeof result._generated.note).toBe('string');
    });

    it('is deterministic for the same inputs and epoch', () => {
      const a = buildSystemExport(makeSystem().data, makeSystem().roots, enrich, NOW);
      const b = buildSystemExport(makeSystem().data, makeSystem().roots, enrich, NOW);
      expect(a).toEqual(b);
    });
  });

  describe('serializeSystemExport', () => {
    it('renders BigInt ids as decimal strings', () => {
      const { data, roots } = makeSystem();
      const json = serializeSystemExport(buildSystemExport(data, roots, enrich, NOW));
      expect(json).toContain('"id64": "1234"');
      expect(json).toContain('"generator": "canonn-signals"');
      // Round-trips as valid JSON.
      expect(() => JSON.parse(json)).not.toThrow();
    });
  });

  describe('systemExportFilename', () => {
    it('slugifies a system name and appends .json', () => {
      expect(systemExportFilename('Col 285 Sector AB-1')).toBe('Col-285-Sector-AB-1.json');
      expect(systemExportFilename('  Sol  ')).toBe('Sol.json');
      expect(systemExportFilename('***')).toBe('system.json');
    });
  });

  describe('downloadJson', () => {
    it('creates an anchor, clicks it and revokes the object URL', () => {
      const anchor = document.createElement('a');
      const clickSpy = vi.spyOn(anchor, 'click').mockImplementation(() => { /* no navigation in tests */ });
      vi.spyOn(document, 'createElement').mockReturnValue(anchor);
      // jsdom does not implement the URL object-URL methods, so ensure they exist before spying.
      const urlObj = URL as unknown as { createObjectURL?: unknown; revokeObjectURL?: unknown };
      urlObj.createObjectURL ??= () => '';
      urlObj.revokeObjectURL ??= () => { /* noop */ };
      const createUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => { /* noop */ });

      downloadJson('test.json', '{"a":1}');

      expect(createUrlSpy).toHaveBeenCalled();
      expect(anchor.download).toBe('test.json');
      expect(clickSpy).toHaveBeenCalled();
      expect(revokeSpy).toHaveBeenCalledWith('blob:mock');

      vi.restoreAllMocks();
    });
  });
});
