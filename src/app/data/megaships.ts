/**
 * Megaship schedule helpers — a TypeScript port of the Canonn community `lookup.py` /
 * `week_anchor.py` logic (see GitHub issue canonn-science/canonn-signals#114). The schedule
 * itself ships as a lazily-fetched JSON asset (`assets/megaship-schedule.json`), a periodic
 * snapshot of community sightings tracked since 2022 — there's no live API for it, so this
 * module does the whole "which megaships visit this system, and where are they now" lookup
 * client-side, mirroring what the Python reference script computes server-side.
 *
 * Each system address in the schedule is a plain JSON number (not the quoted `id64`/
 * `system_address` string convention `json-bigint.ts` upgrades to `bigint`), so values above
 * 2^53 would already have lost precision in the source file before this module ever sees them
 * — an accepted limitation of the upstream data, not something fixable here.
 */

/** A ship that cycles through a fixed set of systems on a weekly rotation. */
export interface MegashipCycleRecord {
  signal_name: string;
  ship_name: string;
  type: 'cycle';
  /** Number of distinct weekly slots in the ship's rotation. */
  route_len: number;
  /** Whether the full rotation has been confirmed by repeated sightings, or is a best guess. */
  confirmed: boolean;
  /** Weekly slot index (0..route_len-1, as a string key) -> system address. A slot with no
   *  recorded sighting is simply absent (a gap in the observed route). */
  positions: Record<string, number>;
  /** ISO date the ship was last sighted anywhere. */
  last_seen: string;
}

/** A ship that has only ever been sighted at one system (no rotation). */
export interface MegashipStaticRecord {
  signal_name: string;
  ship_name: string;
  type: 'static';
  system: number;
  first_seen: string;
  last_seen: string;
  weeks_confirmed: number;
}

export type MegashipRecord = MegashipCycleRecord | MegashipStaticRecord;

export interface MegashipScheduleFile {
  /** ISO timestamp of the Thursday-07:00-UTC week-zero anchor the schedule is built from. */
  anchor: string;
  /** Seconds per weekly slot (always 604800 = 7 days, but read from the file rather than assumed). */
  week_seconds: number;
  generated_at: string;
  ships: MegashipRecord[];
}

/** system address -> every (ship, position) pair whose route includes that system. */
export type MegashipIndex = Map<number, { ship: MegashipRecord; position: number | null }[]>;

/** A tracked megaship's status relative to one queried system. */
export interface MegashipSystemEntry {
  signalName: string;
  shipName: string;
  type: 'cycle' | 'static';
  confirmed: boolean;
  /** True if the ship is predicted to be at the queried system this week. */
  presentNow: boolean;
  /** ISO date (YYYY-MM-DD) the ship is next due at the queried system; null only for the
   *  (unreachable in practice) case where a cycle ship's own route length is invalid. */
  dueDate: string | null;
  daysUntilDue: number;
  routeLen?: number;
  /** This ship's slot position for the queried system (cycle ships only). */
  position?: number;
  /** Where the ship is predicted to actually be right now; null if that position in its
   *  route has never been observed (a gap). */
  currentSystemId64: number | null;
  lastSeen: string;
}

/** One stop on a ship's full route, for the route-detail dialog. */
export interface MegashipRouteStop {
  position: number;
  systemId64: number;
  /** ISO date (YYYY-MM-DD) this stop is next due. */
  dueDate: string;
  presentNow: boolean;
}

/** Floor-mod: unlike `%`, always returns a value in [0, n). */
function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/** The weekly slot index containing `date`, relative to the schedule's anchor. */
export function weekSlot(date: Date, schedule: Pick<MegashipScheduleFile, 'anchor' | 'week_seconds'>): number {
  const anchorMs = Date.parse(schedule.anchor);
  return Math.floor((date.getTime() - anchorMs) / (schedule.week_seconds * 1000));
}

/** The UTC instant a given weekly slot begins. */
export function slotStart(slot: number, schedule: Pick<MegashipScheduleFile, 'anchor' | 'week_seconds'>): Date {
  const anchorMs = Date.parse(schedule.anchor);
  return new Date(anchorMs + slot * schedule.week_seconds * 1000);
}

/** The UTC calendar date (YYYY-MM-DD) of a `Date`. */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dueInfo(
  routeLen: number, position: number, currentSlot: number, schedule: Pick<MegashipScheduleFile, 'anchor' | 'week_seconds'>,
): { dueDate: string; presentNow: boolean; daysUntilDue: number } {
  const delta = mod(position - currentSlot, routeLen);
  return {
    dueDate: isoDate(slotStart(currentSlot + delta, schedule)),
    presentNow: delta === 0,
    daysUntilDue: delta * (schedule.week_seconds / (24 * 60 * 60)),
  };
}

/** Where `ship` is predicted to be right now; null if that route position has no recorded sighting. */
function currentLocation(ship: MegashipRecord, currentSlot: number): number | null {
  if (ship.type === 'static') {
    return ship.system;
  }
  const pos = mod(currentSlot, ship.route_len);
  return ship.positions[String(pos)] ?? null;
}

/** Builds the system-address -> ships index once per schedule load; reused across lookups. */
export function buildMegashipIndex(schedule: MegashipScheduleFile): MegashipIndex {
  const index: MegashipIndex = new Map();
  const add = (systemId64: number, entry: { ship: MegashipRecord; position: number | null }): void => {
    const list = index.get(systemId64);
    if (list) {
      list.push(entry);
    } else {
      index.set(systemId64, [entry]);
    }
  };
  for (const ship of schedule.ships) {
    if (ship.type === 'cycle') {
      for (const [posStr, systemId64] of Object.entries(ship.positions)) {
        add(systemId64, { ship, position: Number(posStr) });
      }
    } else {
      add(ship.system, { ship, position: null });
    }
  }
  return index;
}

/**
 * Every tracked megaship whose route includes `systemId64`, each with its current status:
 * present this week, or the date it's next due there, plus where it's predicted to actually
 * be right now. One entry per ship (a route that maps more than one slot to the same system —
 * usually an unconfirmed route-length guess — reports only the soonest occurrence).
 */
export function megashipsAtSystem(
  systemId64: number, asOf: Date, schedule: MegashipScheduleFile, index: MegashipIndex,
): MegashipSystemEntry[] {
  const currentSlot = weekSlot(asOf, schedule);
  const entries = index.get(systemId64) ?? [];

  const results: MegashipSystemEntry[] = entries.map(({ ship, position }) => {
    const currentSystemId64 = currentLocation(ship, currentSlot);
    if (ship.type === 'cycle') {
      const { dueDate, presentNow, daysUntilDue } = dueInfo(ship.route_len, position!, currentSlot, schedule);
      return {
        signalName: ship.signal_name,
        shipName: ship.ship_name,
        type: 'cycle',
        confirmed: ship.confirmed,
        presentNow,
        dueDate,
        daysUntilDue,
        routeLen: ship.route_len,
        position: position!,
        currentSystemId64,
        lastSeen: ship.last_seen,
      };
    }
    return {
      signalName: ship.signal_name,
      shipName: ship.ship_name,
      type: 'static',
      confirmed: true,
      presentNow: true,
      dueDate: null,
      daysUntilDue: 0,
      currentSystemId64,
      lastSeen: ship.last_seen,
    };
  });

  const bestByShip = new Map<string, MegashipSystemEntry>();
  for (const r of results) {
    const existing = bestByShip.get(r.signalName);
    if (!existing || r.daysUntilDue < existing.daysUntilDue) {
      bestByShip.set(r.signalName, r);
    }
  }

  return [...bestByShip.values()].sort((a, b) => {
    if (a.presentNow !== b.presentNow) {
      return a.presentNow ? -1 : 1;
    }
    return a.daysUntilDue - b.daysUntilDue;
  });
}

/**
 * A ship's full route for the route-detail dialog: every observed stop in slot order (cycle
 * ships) or its single system (static ships), each with the date it's next due there.
 */
export function megashipRoute(ship: MegashipRecord, asOf: Date, schedule: MegashipScheduleFile): MegashipRouteStop[] {
  if (ship.type === 'static') {
    return [{ position: 0, systemId64: ship.system, dueDate: isoDate(asOf), presentNow: true }];
  }
  const currentSlot = weekSlot(asOf, schedule);
  const stops: MegashipRouteStop[] = [];
  for (let pos = 0; pos < ship.route_len; pos++) {
    const systemId64 = ship.positions[String(pos)];
    if (systemId64 === undefined) {
      continue; // Gap: this slot in the route has never been observed.
    }
    const { dueDate, presentNow } = dueInfo(ship.route_len, pos, currentSlot, schedule);
    stops.push({ position: pos, systemId64, dueDate, presentNow });
  }
  return stops;
}
