import { describe, expect, it } from 'vitest';
import {
  MegashipScheduleFile,
  buildMegashipIndex,
  megashipRoute,
  megashipsAtSystem,
  slotStart,
  weekSlot,
} from './megaships';

// Anchor matches the real schedule: a Thursday 07:00 UTC. week_seconds always 604800 (7 days).
const ANCHOR = '2023-12-28T07:00:00+00:00';
const WEEK_SECONDS = 604800;

const SYSTEM_A = 1000;
const SYSTEM_B = 2000;
const SYSTEM_C = 3000;
const SYSTEM_UNVISITED = 9999;

function schedule(): MegashipScheduleFile {
  return {
    anchor: ANCHOR,
    week_seconds: WEEK_SECONDS,
    generated_at: '2026-07-12T00:00:00Z',
    ships: [
      {
        signal_name: 'CYCLER I',
        ship_name: 'Test-class Cycler',
        type: 'cycle',
        route_len: 3,
        confirmed: true,
        positions: { '0': SYSTEM_A, '1': SYSTEM_B, '2': SYSTEM_C },
        last_seen: '2026-07-10',
      },
      {
        signal_name: 'GAPPY I',
        ship_name: 'Test-class Gappy',
        type: 'cycle',
        route_len: 4,
        confirmed: false,
        // Position 2 has never been observed — a gap in the route.
        positions: { '0': SYSTEM_A, '1': SYSTEM_B, '3': SYSTEM_C },
        last_seen: '2026-07-01',
      },
      {
        signal_name: 'DUPLICATE I',
        ship_name: 'Test-class Duplicate',
        type: 'cycle',
        route_len: 4,
        confirmed: false,
        // Same system at two slots — an unconfirmed route-length guess.
        positions: { '0': SYSTEM_A, '1': SYSTEM_A, '2': SYSTEM_B, '3': SYSTEM_C },
        last_seen: '2026-07-01',
      },
      {
        signal_name: 'STATIC I',
        ship_name: 'Test-class Outpost',
        type: 'static',
        system: SYSTEM_A,
        first_seen: '2023-10-01',
        last_seen: '2026-07-10',
        weeks_confirmed: 90,
      },
    ],
  };
}

describe('weekSlot / slotStart', () => {
  it('returns slot 0 exactly at the anchor', () => {
    const s = schedule();
    expect(weekSlot(new Date(ANCHOR), s)).toBe(0);
  });

  it('advances one slot per 7 days', () => {
    const s = schedule();
    const oneWeekLater = new Date(Date.parse(ANCHOR) + WEEK_SECONDS * 1000);
    expect(weekSlot(oneWeekLater, s)).toBe(1);
  });

  it('handles dates before the anchor (negative slots)', () => {
    const s = schedule();
    const oneWeekEarlier = new Date(Date.parse(ANCHOR) - WEEK_SECONDS * 1000);
    expect(weekSlot(oneWeekEarlier, s)).toBe(-1);
  });

  it('slotStart is the inverse of weekSlot at exact boundaries', () => {
    const s = schedule();
    expect(slotStart(5, s).toISOString()).toBe(new Date(Date.parse(ANCHOR) + 5 * WEEK_SECONDS * 1000).toISOString());
  });
});

describe('megashipsAtSystem', () => {
  it('reports a cycle ship present this week at its current-slot system', () => {
    const s = schedule();
    const index = buildMegashipIndex(s);
    // Slot 0 falls exactly at the anchor -> CYCLER I is at SYSTEM_A.
    const asOf = new Date(ANCHOR);
    const results = megashipsAtSystem(SYSTEM_A, asOf, s, index);
    const cycler = results.find(r => r.signalName === 'CYCLER I')!;
    expect(cycler.presentNow).toBe(true);
    expect(cycler.daysUntilDue).toBe(0);
    expect(cycler.currentSystemId64).toBe(SYSTEM_A);
  });

  it('reports days-until-due and the due date for a system not yet reached', () => {
    const s = schedule();
    const index = buildMegashipIndex(s);
    const asOf = new Date(ANCHOR); // slot 0 -> ship is at SYSTEM_A, due at SYSTEM_B in 1 week
    const results = megashipsAtSystem(SYSTEM_B, asOf, s, index);
    const cycler = results.find(r => r.signalName === 'CYCLER I')!;
    expect(cycler.presentNow).toBe(false);
    expect(cycler.daysUntilDue).toBe(7);
    expect(cycler.dueDate).toBe(slotStart(1, s).toISOString().slice(0, 10));
    // Currently at SYSTEM_A, not SYSTEM_B (the system being queried).
    expect(cycler.currentSystemId64).toBe(SYSTEM_A);
  });

  it('wraps around the route length when computing days until due', () => {
    const s = schedule();
    const index = buildMegashipIndex(s);
    // Slot 2 -> ship is at SYSTEM_C; SYSTEM_A (slot 0) is due in 1 week (wraps past route_len).
    const asOf = slotStart(2, s);
    const results = megashipsAtSystem(SYSTEM_A, asOf, s, index);
    const cycler = results.find(r => r.signalName === 'CYCLER I')!;
    expect(cycler.daysUntilDue).toBe(7);
  });

  it('reports currentSystemId64 as null for a ship whose current slot has never been observed', () => {
    const s = schedule();
    const index = buildMegashipIndex(s);
    // Slot 2 is GAPPY I's unobserved gap.
    const asOf = slotStart(2, s);
    const results = megashipsAtSystem(SYSTEM_A, asOf, s, index);
    const gappy = results.find(r => r.signalName === 'GAPPY I')!;
    expect(gappy.currentSystemId64).toBeNull();
  });

  it('always reports a static ship as present at its home system', () => {
    const s = schedule();
    const index = buildMegashipIndex(s);
    const results = megashipsAtSystem(SYSTEM_A, new Date(ANCHOR), s, index);
    const staticShip = results.find(r => r.signalName === 'STATIC I')!;
    expect(staticShip.type).toBe('static');
    expect(staticShip.presentNow).toBe(true);
    expect(staticShip.confirmed).toBe(true);
    expect(staticShip.daysUntilDue).toBe(0);
  });

  it('reports each ship once per system, keeping the soonest occurrence', () => {
    const s = schedule();
    const index = buildMegashipIndex(s);
    // DUPLICATE I visits SYSTEM_A at both slot 0 and slot 1; querying from slot 3 the
    // soonest occurrence is slot 0 next cycle (1 week away), not slot 1 (2 weeks away).
    const asOf = slotStart(3, s);
    const results = megashipsAtSystem(SYSTEM_A, asOf, s, index);
    const duplicates = results.filter(r => r.signalName === 'DUPLICATE I');
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].daysUntilDue).toBe(7);
  });

  it('returns an empty list for a system no tracked ship visits', () => {
    const s = schedule();
    const index = buildMegashipIndex(s);
    expect(megashipsAtSystem(SYSTEM_UNVISITED, new Date(ANCHOR), s, index)).toEqual([]);
  });

  it('sorts present-now ships before ships that are due later, then by soonest due', () => {
    const s = schedule();
    const index = buildMegashipIndex(s);
    // At slot 0: STATIC I present (SYSTEM_A); CYCLER I present (SYSTEM_A); GAPPY I due later.
    const asOf = new Date(ANCHOR);
    const results = megashipsAtSystem(SYSTEM_A, asOf, s, index);
    const presentCount = results.filter(r => r.presentNow).length;
    // All present-now entries sort before all not-present entries.
    expect(results.slice(0, presentCount).every(r => r.presentNow)).toBe(true);
    expect(results.slice(presentCount).every(r => !r.presentNow)).toBe(true);
    // The not-present tail is sorted ascending by daysUntilDue.
    const tail = results.slice(presentCount);
    for (let i = 1; i < tail.length; i++) {
      expect(tail[i].daysUntilDue).toBeGreaterThanOrEqual(tail[i - 1].daysUntilDue);
    }
  });
});

describe('megashipRoute', () => {
  it('lists every observed stop in position order for a cycle ship, skipping gaps', () => {
    const s = schedule();
    const cycler = s.ships.find(sh => sh.signal_name === 'CYCLER I')!;
    const stops = megashipRoute(cycler, new Date(ANCHOR), s);
    expect(stops.map(st => st.systemId64)).toEqual([SYSTEM_A, SYSTEM_B, SYSTEM_C]);
    expect(stops.map(st => st.position)).toEqual([0, 1, 2]);
  });

  it('omits a route position that has never been observed', () => {
    const s = schedule();
    const gappy = s.ships.find(sh => sh.signal_name === 'GAPPY I')!;
    const stops = megashipRoute(gappy, new Date(ANCHOR), s);
    expect(stops.map(st => st.position)).toEqual([0, 1, 3]);
  });

  it('flags exactly one stop as present-now, matching the current slot', () => {
    const s = schedule();
    const cycler = s.ships.find(sh => sh.signal_name === 'CYCLER I')!;
    const stops = megashipRoute(cycler, new Date(ANCHOR), s); // slot 0 -> SYSTEM_A
    const present = stops.filter(st => st.presentNow);
    expect(present).toHaveLength(1);
    expect(present[0].systemId64).toBe(SYSTEM_A);
  });

  it('returns a single always-present stop for a static ship', () => {
    const s = schedule();
    const staticShip = s.ships.find(sh => sh.signal_name === 'STATIC I')!;
    const stops = megashipRoute(staticShip, new Date(ANCHOR), s);
    expect(stops).toEqual([{ position: 0, systemId64: SYSTEM_A, dueDate: stops[0].dueDate, presentNow: true }]);
  });
});
