import { CanonnBiostatsBody } from '../home/home.component';
import { BODY_TYPE } from './body-types';
import { codexStarClassToken, influencingStarClassToken, isBiologyGuessAllowed } from './biology-star-class';

function makeStar(overrides: Partial<CanonnBiostatsBody>): CanonnBiostatsBody {
  return { id64: 0n, name: 'Star', bodyId: 0, type: BODY_TYPE.Star, subType: '', ...overrides };
}

describe('codexStarClassToken', () => {
  it('extracts the trailing star-class token from a species codex name', () => {
    expect(codexStarClassToken('$Codex_Ent_Aleoids_02_TTS_Name;')).toBe('TTS');
    expect(codexStarClassToken('$Codex_Ent_Osseus_04_G_Name;')).toBe('G');
  });

  it('returns null for a genus-level name (no star-class token)', () => {
    expect(codexStarClassToken('$Codex_Ent_Aleoids_Genus_Name;')).toBeNull();
  });

  it('returns null for a trailing segment outside the known vocabulary', () => {
    expect(codexStarClassToken('$Codex_Ent_Something_02_Name;')).toBeNull();
  });

  it('returns null for a missing name', () => {
    expect(codexStarClassToken(null)).toBeNull();
    expect(codexStarClassToken(undefined)).toBeNull();
  });
});

describe('influencingStarClassToken', () => {
  it('maps ordinary main-sequence and brown-dwarf stars by spectral class letter', () => {
    expect(influencingStarClassToken(makeStar({ spectralClass: 'G2', subType: 'G (White-Yellow) Star' }))).toBe('G');
    expect(influencingStarClassToken(makeStar({ subType: 'M (Red dwarf) Star' }))).toBe('M');
    expect(influencingStarClassToken(makeStar({ subType: 'Y (Brown dwarf) Star' }))).toBe('Y');
  });

  it('maps white dwarfs to D regardless of the specific spectral subtype', () => {
    expect(influencingStarClassToken(makeStar({ subType: 'White Dwarf (DA) Star' }))).toBe('D');
  });

  it('maps neutron stars to N', () => {
    expect(influencingStarClassToken(makeStar({ subType: 'Neutron Star' }))).toBe('N');
  });

  it('maps Wolf-Rayet variants to W', () => {
    expect(influencingStarClassToken(makeStar({ subType: 'Wolf-Rayet N Star' }))).toBe('W');
  });

  it('maps T Tauri and Herbig Ae/Be stars', () => {
    expect(influencingStarClassToken(makeStar({ subType: 'T Tauri Star' }))).toBe('TTS');
    expect(influencingStarClassToken(makeStar({ subType: 'Herbig Ae/Be Star' }))).toBe('Ae');
  });

  it('returns null for a class with no codex token (e.g. Black Hole)', () => {
    expect(influencingStarClassToken(makeStar({ subType: 'Black Hole' }))).toBeNull();
  });
});

describe('isBiologyGuessAllowed', () => {
  it('keeps a guess whose codex name has no star-class token', () => {
    expect(isBiologyGuessAllowed('Aleoida', '$Codex_Ent_Aleoids_Genus_Name;', 'M')).toBe(true);
  });

  it('keeps a guess whose star-class token matches the influencing star', () => {
    expect(isBiologyGuessAllowed('Something', '$Codex_Ent_Aleoids_02_TTS_Name;', 'TTS')).toBe(true);
  });

  it('filters out a guess whose star-class token does not match', () => {
    expect(isBiologyGuessAllowed('Something', '$Codex_Ent_Aleoids_02_TTS_Name;', 'G')).toBe(false);
  });

  it('always keeps Stratum Araneamus - Emerald regardless of star class', () => {
    expect(isBiologyGuessAllowed('Stratum Araneamus - Emerald', '$Codex_Ent_Stratum_09_G_Name;', 'N')).toBe(true);
  });

  it('keeps a Tussock ending in "Yellow 1" around a Neutron Star despite its codex class being F', () => {
    expect(isBiologyGuessAllowed('Tussock Serrati - Yellow 1', '$Codex_Ent_Tussocks_05_F_Name;', 'N')).toBe(true);
  });

  it('still filters a Tussock ending in "Yellow 1" against an unrelated mismatched star (not F vs N)', () => {
    expect(isBiologyGuessAllowed('Tussock Serrati - Yellow 1', '$Codex_Ent_Tussocks_05_F_Name;', 'M')).toBe(false);
  });

  it('does not extend the Tussock/Neutron exception to a name that merely contains "Tussock"', () => {
    expect(isBiologyGuessAllowed('Tussock Serrati - Yellow 2', '$Codex_Ent_Tussocks_05_F_Name;', 'N')).toBe(false);
  });
});
