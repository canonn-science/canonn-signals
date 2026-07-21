/**
 * The Gnosis megaship's permanent 8-system retirement loop (issue canonn-science/canonn-signals#121).
 * Unlike the community-sighted megaship schedule in `data/megaships.ts`, this route is fixed and
 * confirmed, not derived from sightings — the ship's current position is live-tracked via
 * `AppService.getGnosis()`, the same source used to place its marker on the Galaxy Region Map
 * (see `region-map.component.ts`).
 */
export const GNOSIS_ROUTE_STOPS: readonly string[] = [
  'Varati',
  'HIP 17862',
  'Pleiades Sector PN-T b3-0',
  'Synuefe PR-L b40-1',
  'HIP 18120',
  'IC 2391 Sector CQ-Y c16',
  'Kappa-1 Volantis',
  'Epsilon Indi',
];

/** Case/whitespace-insensitive comparison key for a system name. */
export function normalizeSystemName(name: string): string {
  return name.trim().toLowerCase();
}

/** True if `systemName` is one of the Gnosis's 8 permanent stops. */
export function isGnosisRouteSystem(systemName: string): boolean {
  return gnosisRouteIndex(systemName) !== -1;
}

/** The stop's index (0-based, in visit order starting at Varati), or -1 if not a route stop. */
export function gnosisRouteIndex(systemName: string): number {
  const target = normalizeSystemName(systemName);
  return GNOSIS_ROUTE_STOPS.findIndex(stop => normalizeSystemName(stop) === target);
}

/** A route stop with its next-due date inferred from the Gnosis's current position. */
export interface GnosisRouteDueStop {
  name: string;
  /** ISO date (YYYY-MM-DD) this stop is next due, or null if the current position couldn't be
   *  placed on the route (e.g. stale/unrecognised live-tracking data). */
  dueDate: string | null;
  presentNow: boolean;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** Any Thursday 07:00 UTC works as the weekly-cadence reference point — this one matches the
 *  community megaship schedule's own anchor in `data/megaships.ts`. */
const CADENCE_ANCHOR_MS = Date.parse('2023-12-28T07:00:00+00:00');

/** The UTC instant of the most recent Thursday ~07:00 UTC at or before `now` — the start of
 *  the Gnosis's current weekly "slot". Computed from the wall clock rather than a live-fetched
 *  timestamp: the Gnosis API reports only the current system, not a jump date. */
function currentSlotStartMs(now: Date): number {
  const slot = Math.floor((now.getTime() - CADENCE_ANCHOR_MS) / WEEK_MS);
  return CADENCE_ANCHOR_MS + slot * WEEK_MS;
}

/** ISO date (YYYY-MM-DD) of the given UTC instant. */
function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Every stop's next-due date, inferred from the Gnosis's current position and the current time.
 * The Gnosis jumps to the next stop on a fixed weekly cadence (Thursdays, ~07:00 UTC — the same
 * cadence `data/megaships.ts` assumes for the community-tracked fleet), so once the current stop
 * is known, every other stop's date is just the start of the current weekly slot plus a whole
 * number of weeks around the 8-stop loop.
 */
export function gnosisRouteDueDates(currentSystemName: string, now: Date): GnosisRouteDueStop[] {
  const currentIndex = gnosisRouteIndex(currentSystemName);
  if (currentIndex === -1) {
    return GNOSIS_ROUTE_STOPS.map(name => ({ name, dueDate: null, presentNow: false }));
  }
  const slotStartMs = currentSlotStartMs(now);
  return GNOSIS_ROUTE_STOPS.map((name, index) => {
    const offset = (index - currentIndex + GNOSIS_ROUTE_STOPS.length) % GNOSIS_ROUTE_STOPS.length;
    return {
      name,
      dueDate: isoDate(slotStartMs + offset * WEEK_MS),
      presentNow: offset === 0,
    };
  });
}
