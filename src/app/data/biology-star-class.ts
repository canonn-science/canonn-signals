import type { CanonnBiostatsBody } from '../home/home.component';
import { isWhiteDwarf, starClassLetter } from './stellar-reference';

/**
 * Filters a body's *guessed* biology signals (never confirmed ones) down to the ones whose
 * codex entry is plausible for the body's Influencing Star (see `influencing-star.ts`).
 *
 * Elite's codex internal names encode the star class a species requires as the token right
 * before the trailing `_Name;`, e.g. `$Codex_Ent_Aleoids_02_TTS_Name;` requires a T Tauri
 * Star. Not every codex name carries one (genus-level names like
 * `$Codex_Ent_Aleoids_Genus_Name;` don't) — those are left alone, since there's nothing to
 * compare against.
 */

/** Star-class tokens Elite's codex names encode ahead of the trailing `_Name;`. */
const CODEX_STAR_CLASS_TOKENS = new Set([
  'G', 'M', 'L', 'F', 'K', 'TTS', 'T', 'N', 'A', 'B', 'Y', 'D', 'O', 'W', 'Ae',
]);

/**
 * Extracts the star-class token from a codex entry's internal `name` field (e.g.
 * `$Codex_Ent_Aleoids_02_TTS_Name;` → `"TTS"`), or null when the name doesn't end in a
 * recognised token — meaning the species isn't tied to a specific star class (or the name
 * doesn't decompose that way at all), so it's not a candidate for filtering.
 */
export function codexStarClassToken(codexName: string | null | undefined): string | null {
  const m = codexName?.match(/_([A-Za-z]+)_Name;$/);
  if (!m) { return null; }
  return CODEX_STAR_CLASS_TOKENS.has(m[1]) ? m[1] : null;
}

/**
 * Maps a star's spectralClass/subType to the same star-class token vocabulary the codex
 * uses in species names, or null when the star's class has no codex token at all (e.g. a
 * Black Hole) — in which case no star-class-tagged species can match it.
 */
export function influencingStarClassToken(star: CanonnBiostatsBody): string | null {
  if (isWhiteDwarf(star.spectralClass, star.subType)) { return 'D'; }
  if (star.spectralClass?.charAt(0) === 'N' || star.subType === 'Neutron Star') { return 'N'; }
  if (star.subType?.includes('Wolf-Rayet')) { return 'W'; }
  if (star.subType === 'T Tauri Star') { return 'TTS'; }
  if (star.subType === 'Herbig Ae/Be Star') { return 'Ae'; }
  return starClassLetter(star.spectralClass, star.subType);
}

/**
 * True when a guessed biology signal should be kept given the resolved Influencing Star's
 * class token (from {@link influencingStarClassToken}). `codexName` is the guess's codex
 * entry's internal `name` field.
 */
export function isBiologyGuessAllowed(
  englishName: string, codexName: string | null | undefined, influencingStarToken: string | null,
): boolean {
  // Stratum Araneamus - Emerald can occur around any star class.
  if (englishName === 'Stratum Araneamus - Emerald') { return true; }

  const requiredToken = codexStarClassToken(codexName);
  if (requiredToken === null || requiredToken === influencingStarToken) { return true; }

  // Yellow Tussocks (codex star class F) also occur around Neutron Stars.
  if (requiredToken === 'F' && influencingStarToken === 'N'
    && englishName.startsWith('Tussock') && englishName.endsWith('Yellow 1')) {
    return true;
  }

  return false;
}
