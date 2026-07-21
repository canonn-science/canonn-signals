import { getGreenGasGiantImagePath, isGreenGasGiant, findGreenGasGiant } from './green-gas-giant-images';
import { GREEN_GAS_GIANTS } from './green-gas-giants.generated';

describe('getGreenGasGiantImagePath', () => {
  it('resolves the square-crop path for a catalogued body', () => {
    expect(getGreenGasGiantImagePath('Blua Hypa HT-F D12-1226 12'))
      .toBe('bodies/green-gas-giants/blua-hypa-ht-f-d12-1226-12.png');
  });

  it('matches case-insensitively', () => {
    expect(getGreenGasGiantImagePath('blua hypa ht-f d12-1226 12'))
      .toBe('bodies/green-gas-giants/blua-hypa-ht-f-d12-1226-12.png');
  });

  it('returns null for a body not in the list', () => {
    expect(getGreenGasGiantImagePath('Sol 1')).toBeNull();
  });

  it('resolves every catalogued body to a distinct path', () => {
    const paths = GREEN_GAS_GIANTS.map(g => getGreenGasGiantImagePath(findGreenGasGiant(g.body)?.body ?? g.body));
    expect(paths.every(p => p !== null)).toBe(true);
    expect(new Set(paths).size).toBe(GREEN_GAS_GIANTS.length);
  });

  describe('CSV rows recording only the system name (no body suffix)', () => {
    it('resolves to the real gas-giant body, not the star', () => {
      const result = findGreenGasGiant('Aemonz UT-R d4-36 10 a');
      expect(result).not.toBeNull();
      expect(result!.body).toBe('Aemonz UT-R d4-36 10 a');
    });

    it('does not match the system name itself (the star)', () => {
      expect(isGreenGasGiant('Aemonz UT-R d4-36')).toBe(false);
    });

    it('still resolves an image for the corrected body', () => {
      expect(getGreenGasGiantImagePath('Aemonz UT-R d4-36 10 a'))
        .toBe('bodies/green-gas-giants/aemonz-ut-r-d4-36.png');
    });
  });
});

describe('isGreenGasGiant', () => {
  it('is true for a catalogued body', () => {
    expect(isGreenGasGiant('Systimbu WJ-R e4-720 10')).toBe(true);
  });

  it('is false for an uncatalogued body', () => {
    expect(isGreenGasGiant('Sol 1')).toBe(false);
  });
});
