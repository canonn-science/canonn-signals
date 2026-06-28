/**
 * Pretty-prints body data as JSON. id64 is a bigint to preserve 64-bit precision;
 * JSON.stringify can't serialize BigInt natively, so it is rendered as its exact decimal
 * string. Shared between the JSON dialog and the host's "right-click to copy" shortcut so
 * the two agree. Kept in its own module (separate from the dialog component) so the host can
 * import it without dragging the lazily-loaded JsonDialogComponent into the initial bundle.
 */
export function formatBodyJson(bodyData: unknown): string {
  return JSON.stringify(bodyData, (_key, value) => (typeof value === 'bigint' ? value.toString() : value), 2);
}
