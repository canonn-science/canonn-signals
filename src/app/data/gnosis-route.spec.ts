import { GNOSIS_ROUTE_STOPS, gnosisRouteDueDates, gnosisRouteIndex, isGnosisRouteSystem, normalizeSystemName } from './gnosis-route';

describe('gnosis-route', () => {
  it('lists all 8 stops in visit order, starting and ending as specified by the issue', () => {
    expect(GNOSIS_ROUTE_STOPS.length).toBe(8);
    expect(GNOSIS_ROUTE_STOPS[0]).toBe('Varati');
    expect(GNOSIS_ROUTE_STOPS[GNOSIS_ROUTE_STOPS.length - 1]).toBe('Epsilon Indi');
    expect(GNOSIS_ROUTE_STOPS).toEqual([
      'Varati',
      'HIP 17862',
      'Pleiades Sector PN-T b3-0',
      'Synuefe PR-L b40-1',
      'HIP 18120',
      'IC 2391 Sector CQ-Y c16',
      'Kappa-1 Volantis',
      'Epsilon Indi',
    ]);
  });

  describe('normalizeSystemName', () => {
    it('trims whitespace and lowercases', () => {
      expect(normalizeSystemName('  Varati  ')).toBe('varati');
      expect(normalizeSystemName('EPSILON INDI')).toBe('epsilon indi');
    });
  });

  describe('isGnosisRouteSystem', () => {
    it('matches a route stop regardless of case or surrounding whitespace', () => {
      expect(isGnosisRouteSystem('Varati')).toBe(true);
      expect(isGnosisRouteSystem('varati')).toBe(true);
      expect(isGnosisRouteSystem('  Epsilon Indi  ')).toBe(true);
      expect(isGnosisRouteSystem('KAPPA-1 VOLANTIS')).toBe(true);
    });

    it('returns false for a system not on the route', () => {
      expect(isGnosisRouteSystem('Sol')).toBe(false);
      expect(isGnosisRouteSystem('')).toBe(false);
    });
  });

  describe('gnosisRouteIndex', () => {
    it('returns the 0-based visit-order index for each stop', () => {
      expect(gnosisRouteIndex('Varati')).toBe(0);
      expect(gnosisRouteIndex('hip 17862')).toBe(1);
      expect(gnosisRouteIndex('Epsilon Indi')).toBe(7);
    });

    it('returns -1 for a system not on the route', () => {
      expect(gnosisRouteIndex('Sol')).toBe(-1);
    });
  });

  describe('gnosisRouteDueDates', () => {
    it('infers every stop\'s date as a whole number of weeks from the current slot start', () => {
      // "Now" is exactly a Thursday-07:00-UTC jump instant, so it IS the current slot's start.
      // Currently at HIP 17862 (index 1).
      const dates = gnosisRouteDueDates('HIP 17862', new Date('2026-07-09T07:00:00Z'));
      expect(dates.map(d => d.name)).toEqual([...GNOSIS_ROUTE_STOPS]);

      // The current stop keeps its own slot-start date; every other stop is a multiple of 7
      // days later, wrapping around the 8-stop loop.
      expect(dates).toEqual([
        { name: 'Varati', dueDate: '2026-08-27', presentNow: false }, // 7 weeks ahead — wraps around the loop
        { name: 'HIP 17862', dueDate: '2026-07-09', presentNow: true }, // index 1: itself
        { name: 'Pleiades Sector PN-T b3-0', dueDate: '2026-07-16', presentNow: false },
        { name: 'Synuefe PR-L b40-1', dueDate: '2026-07-23', presentNow: false },
        { name: 'HIP 18120', dueDate: '2026-07-30', presentNow: false },
        { name: 'IC 2391 Sector CQ-Y c16', dueDate: '2026-08-06', presentNow: false },
        { name: 'Kappa-1 Volantis', dueDate: '2026-08-13', presentNow: false },
        { name: 'Epsilon Indi', dueDate: '2026-08-20', presentNow: false },
      ]);
    });

    it('marks exactly one stop present, at the current position', () => {
      const dates = gnosisRouteDueDates('Epsilon Indi', new Date('2026-07-09T07:00:00Z'));
      expect(dates.filter(d => d.presentNow)).toEqual([{ name: 'Epsilon Indi', dueDate: '2026-07-09', presentNow: true }]);
    });

    it('treats any instant within the week as the same slot (not just the exact jump moment)', () => {
      // A few days after the Thursday jump — still the same weekly slot.
      const dates = gnosisRouteDueDates('HIP 17862', new Date('2026-07-12T18:30:00Z'));
      expect(dates.find(d => d.presentNow)).toEqual({ name: 'HIP 17862', dueDate: '2026-07-09', presentNow: true });
    });

    it('returns null dates when the live position is not a recognised route stop', () => {
      const dates = gnosisRouteDueDates('Some Unrelated System', new Date('2026-07-09T07:00:00Z'));
      expect(dates.every(d => d.dueDate === null && !d.presentNow)).toBe(true);
    });
  });
});
