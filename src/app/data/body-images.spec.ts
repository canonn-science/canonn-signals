import { BodyImage } from './body-images';
import { CanonnBiostatsBody } from '../home/home.component';

/** Builds a CanonnBiostatsBody with sensible defaults for image-path resolution. */
function body(data: Partial<CanonnBiostatsBody>): CanonnBiostatsBody {
  return { bodyId: 0, id64: 0, name: 'Test', subType: '', type: 'Planet', ...data } as CanonnBiostatsBody;
}

describe('BodyImage.getBodyImagePath', () => {
  describe('stars', () => {
    it('resolves main-sequence spectral classes with a corona', () => {
      const result = BodyImage.getBodyImagePath(body({ type: 'Star', spectralClass: 'G2' }))!;
      expect(result.path).toBe('stars/G');
      expect(result.coronaPath).toBe('stars/Corona_G');
    });

    it('resolves a class without a corona (no coronaPath)', () => {
      const result = BodyImage.getBodyImagePath(body({ type: 'Star', spectralClass: 'L' }))!;
      expect(result.path).toBe('stars/L');
      expect(result.coronaPath).toBeUndefined();
    });

    it('selects white-dwarf variants by mass (covers every mass predicate)', () => {
      const wd = (solarMasses: number) =>
        BodyImage.getBodyImagePath(body({ type: 'Star', subType: 'White Dwarf (DA) Star', solarMasses }))!.path;
      expect(wd(1.5)).toBe('stars/D');
      expect(wd(0.9)).toBe('stars/D_hot');
      expect(wd(0.7)).toBe('stars/D_veryHot');
      expect(wd(0.5)).toBe('stars/D_extremelyHot');
    });

    it('selects neutron-star variants by mass', () => {
      const ns = (solarMasses: number) =>
        BodyImage.getBodyImagePath(body({ type: 'Star', subType: 'Neutron Star', solarMasses }))!.path;
      expect(ns(0.5)).toBe('stars/N');
      expect(ns(1.5)).toBe('stars/N_massive');
      expect(ns(3)).toBe('stars/N_veryMassive');
    });

    it('distinguishes black holes from supermassive black holes by subType', () => {
      expect(BodyImage.getBodyImagePath(body({ type: 'Star', subType: 'Black Hole' }))!.path).toBe('stars/H');
      expect(BodyImage.getBodyImagePath(body({ type: 'Star', subType: 'Supermassive Black Hole' }))!.path)
        .toBe('stars/SuperMassiveBlackHole');
    });

    it('returns null for an unrecognised spectral class', () => {
      expect(BodyImage.getBodyImagePath(body({ type: 'Star', spectralClass: 'ZZ' }))).toBeNull();
    });
  });

  describe('gas giants', () => {
    it('resolves Sudarsky classes I–V', () => {
      for (const [roman, _cls] of [['I', 1], ['II', 2], ['III', 3], ['IV', 4], ['V', 5]] as const) {
        const result = BodyImage.getBodyImagePath(body({ subType: `Class ${roman} gas giant`, surfaceTemperature: 5000 }));
        expect(result?.path.startsWith('planets/giant/')).toBe(true);
      }
    });

    it('resolves life-bearing, helium and water giants', () => {
      expect(BodyImage.getBodyImagePath(body({ subType: 'Gas giant with ammonia-based life', surfaceTemperature: 100 }))?.path)
        .toMatch(/^planets\/giant\//);
      expect(BodyImage.getBodyImagePath(body({ subType: 'Gas giant with water-based life', surfaceTemperature: 150 }))?.path)
        .toMatch(/^planets\/giant\//);
      expect(BodyImage.getBodyImagePath(body({ subType: 'Helium gas giant', surfaceTemperature: 50 }))?.path)
        .toMatch(/^planets\/giant\//);
      expect(BodyImage.getBodyImagePath(body({ subType: 'Water giant' }))?.path).toMatch(/^planets\/giant\//);
    });

    it('filters water-based life giants by atmosphere requirement', () => {
      // GGWv1 requires an oxygen atmosphere at <=155K; the atmosphere filter lower-cases the type.
      const withO2 = BodyImage.getBodyImagePath(body({ subType: 'Gas giant with water-based life', surfaceTemperature: 154, atmosphereType: 'Oxygen' }));
      expect(withO2?.path).toBe('planets/giant/GGWv1');
    });

    it('returns null for a "giant" subType that matches no class', () => {
      expect(BodyImage.getBodyImagePath(body({ subType: 'Some unknown giant' }))).toBeNull();
    });
  });

  describe('terrestrial bodies', () => {
    it('matches a plain subType', () => {
      expect(BodyImage.getBodyImagePath(body({ subType: 'Metal-rich body', surfaceTemperature: 900 }))?.path)
        .toMatch(/^planets\/terrestrial\/MRB/);
    });

    it('applies the maxSurfaceTemperature filter', () => {
      const cold = BodyImage.getBodyImagePath(body({ subType: 'Rocky body', surfaceTemperature: 100 }))!.path;
      const hot = BodyImage.getBodyImagePath(body({ subType: 'Rocky body', surfaceTemperature: 450 }))!.path;
      expect(cold).not.toBe(hot);
    });

    it('applies the maxEarthMasses filter for small Earth-likes', () => {
      const result = BodyImage.getBodyImagePath(body({
        subType: 'Earth-like world', earthMasses: 0.1, surfaceTemperature: 260,
      }))!;
      expect(result.path).toBe('planets/terrestrial/ELWv4');
    });

    it('honours the isApplicable predicate for an exact Earth analogue', () => {
      const result = BodyImage.getBodyImagePath(body({
        subType: 'Earth-like world', earthMasses: 1, surfaceTemperature: 288,
      }))!;
      expect(result.path).toBe('planets/terrestrial/ELWv1');
    });

    it('honours the isApplicable predicate for a 55K rocky body', () => {
      const result = BodyImage.getBodyImagePath(body({ subType: 'Rocky body', surfaceTemperature: 55 }))!;
      expect(result.path).toBe('planets/terrestrial/RBDv6');
    });

    it('honours the isApplicable predicates for rocky ice worlds', () => {
      // isApplicable matches lower-case substrings against the raw atmosphere type.
      const thickRich = BodyImage.getBodyImagePath(body({
        subType: 'Rocky Ice world', atmosphereType: 'thick ammonia-rich',
      }))!;
      expect(thickRich.path).toBe('planets/terrestrial/RIBv4');
      const hotThin = BodyImage.getBodyImagePath(body({
        subType: 'Rocky Ice world', atmosphereType: 'hot thin carbon dioxide',
      }))!;
      expect(hotThin.path).toBe('planets/terrestrial/RIBv1');
    });

    it('applies the boolean atmosphere filter (no atmosphere vs has atmosphere)', () => {
      const noAtm = BodyImage.getBodyImagePath(body({
        subType: 'High metal content world', surfaceTemperature: 250, atmosphereType: null,
      }))!;
      expect(noAtm.path).toMatch(/^planets\/terrestrial\/HMC/);
      const waterWorldNoAtm = BodyImage.getBodyImagePath(body({ subType: 'Water world', atmosphereType: null }))!;
      expect(waterWorldNoAtm.path).toBe('planets/terrestrial/WTRv10');
    });

    it('matches by atmosphere keyword', () => {
      const co2 = BodyImage.getBodyImagePath(body({
        subType: 'High metal content world', atmosphereType: 'Carbon dioxide', surfaceTemperature: 200,
      }))!;
      expect(co2.path).toMatch(/^planets\/terrestrial\/HMC/);
    });

    it('applies the landable filter', () => {
      const landable = BodyImage.getBodyImagePath(body({
        subType: 'Metal-rich body', surfaceTemperature: 800, isLandable: true,
      }))!;
      expect(landable.path).toBe('planets/terrestrial/MRBv7');
    });

    it('applies the tidallyLocked filter', () => {
      const locked = BodyImage.getBodyImagePath(body({
        subType: 'Earth-like world', surfaceTemperature: 400, rotationalPeriodTidallyLocked: true,
      }))!;
      expect(locked.path).toBe('planets/terrestrial/ELWv7');
    });

    it('matches the first entry for an ammonia world (terraformable is not used as a filter)', () => {
      const ammonia = BodyImage.getBodyImagePath(body({ subType: 'Ammonia world', surfaceTemperature: 1000 }))!;
      expect(ammonia.path).toBe('planets/terrestrial/AMWv2');
    });

    it('returns null for an unknown terrestrial subType', () => {
      expect(BodyImage.getBodyImagePath(body({ subType: 'Nonexistent body type' }))).toBeNull();
    });
  });

  it('returns null for non-star, non-planet bodies', () => {
    expect(BodyImage.getBodyImagePath(body({ type: 'Ring', subType: 'Icy' }))).toBeNull();
  });
});
