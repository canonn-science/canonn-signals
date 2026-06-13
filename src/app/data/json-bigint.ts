/**
 * BigInt-aware JSON parsing for Elite Dangerous 64-bit identifiers.
 *
 * A JavaScript `number` (IEEE-754 float64) only represents integers exactly up to
 * 2^53-1, so a ~60-bit body `id64` such as `1080864266413281122` silently rounds
 * to `1080864266413281200` when parsed by the browser's `JSON.parse`.
 *
 * The dedicated `json-bigint` library is unusable here: it treats *any* numeric
 * token longer than 15 characters as a big integer, so a long-decimal float like
 * `2.58327451196759` (rotational period, etc.) makes it call `BigInt("2.58…")`
 * and throw. Astronomical payloads are full of such floats.
 *
 * Instead we quote only the `id64` / `system_address` integer values in the raw
 * text, then run the native `JSON.parse` (which handles floats correctly), then
 * coerce those quoted strings to `bigint`.
 */

/** Keys whose values are 64-bit identifiers that must keep full precision. */
const BIGINT_KEYS = new Set(['id64', 'system_address']);

/**
 * Quote integer-valued `id64` / `system_address` fields so native JSON.parse keeps
 * them as strings instead of rounding to float64. Matches only an unquoted integer
 * literal after the key, so already-quoted strings, `null`, and floats are left
 * untouched.
 */
function quoteBigIntFields(text: string): string {
  return text.replace(/"(id64|system_address)"(\s*:\s*)(-?\d+)(?=\s*[,}\]])/g, '"$1"$2"$3"');
}

/** A plain integer string (the only thing we convert to bigint). */
const INTEGER_RE = /^-?\d+$/;

/** Recursively coerce the known 64-bit id fields to `bigint`. */
function coerceIds(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      coerceIds(item);
    }
  } else if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      const v = obj[key];
      if (BIGINT_KEYS.has(key)) {
        // Only convert clean integers; leave null / float / junk as-is so a single
        // malformed value can never throw and break the whole response.
        if (typeof v === 'string' && INTEGER_RE.test(v)) {
          obj[key] = BigInt(v);
        } else if (typeof v === 'number' && Number.isInteger(v)) {
          obj[key] = BigInt(v);
        }
      } else if (v !== null && typeof v === 'object') {
        coerceIds(v);
      }
    }
  }
}

/**
 * Parse a JSON response, preserving `id64` / `system_address` fields as exact
 * `bigint` values regardless of magnitude, while every other field (including
 * long-decimal floats) is parsed normally by the native parser.
 *
 * Returns `null` for an empty/blank body (matching `HttpClient`'s behaviour for
 * an empty JSON response).
 */
export function parseJsonWithBigIntIds<T = unknown>(text: string): T {
  if (!text || !text.trim()) {
    return null as unknown as T;
  }
  const parsed = JSON.parse(quoteBigIntFields(text));
  coerceIds(parsed);
  return parsed as T;
}
