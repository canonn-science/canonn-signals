import {
  isPermitLockedSystem,
  isPermitLockedRegion,
  PERMIT_LOCKED_SYSTEM_NAMES,
} from './permit-locked-systems';

describe('permit-locked-systems', () => {
  describe('isPermitLockedSystem — systems', () => {
    it('flags known permit-locked systems by name', () => {
      expect(isPermitLockedSystem('Sol')).toBe(true);
      expect(isPermitLockedSystem('Shinrarta Dezhra')).toBe(true);
      expect(isPermitLockedSystem('Alioth')).toBe(true);
      expect(isPermitLockedSystem('Kamba')).toBe(true); // recovered from the sheet's permit name
      expect(isPermitLockedSystem("van Maanen's Star")).toBe(true);
    });

    it('matches case- and whitespace-insensitively', () => {
      expect(isPermitLockedSystem('  sOl  ')).toBe(true);
      expect(isPermitLockedSystem('BETA HYDRI')).toBe(true);
    });

    it('rejects systems not on the list', () => {
      expect(isPermitLockedSystem('Maia')).toBe(false);
      expect(isPermitLockedSystem('Colonia')).toBe(false);
      expect(isPermitLockedSystem('')).toBe(false);
    });

    it('stores names normalized', () => {
      expect(PERMIT_LOCKED_SYSTEM_NAMES.has('sol')).toBe(true);
      expect(PERMIT_LOCKED_SYSTEM_NAMES.has('Sol')).toBe(false);
    });
  });

  describe('isPermitLockedRegion — regions (by name prefix)', () => {
    it('flags systems inside a permit-locked region', () => {
      expect(isPermitLockedRegion('Col 121 Sector AB-C d1-2')).toBe(true);
      expect(isPermitLockedRegion('Col 70 Sector AA-D b17-0')).toBe(true);
      expect(isPermitLockedRegion('NGC 1647 Sector ST-U b3-1')).toBe(true);
      expect(isPermitLockedRegion('Bleia Flyuae DH-U e3-26')).toBe(true);
      expect(isPermitLockedRegion('Cone Sector GW-W c1-5')).toBe(true);
      expect(isPermitLockedRegion('Horsehead Dark Region IR-V c2-9')).toBe(true);
    });

    it('uses the in-game "Praea" stem, not the sheet\'s "Praei" label', () => {
      expect(isPermitLockedRegion('Praea Aoscs NM-W e1-407')).toBe(true);
      expect(isPermitLockedRegion('Praei Whatever AB-C d1-2')).toBe(false);
    });

    it('requires a whole-token prefix so similar names are not caught', () => {
      // The populated bubble's "Col 285 Sector" must not match "Col 121/70/97".
      expect(isPermitLockedRegion('Col 285 Sector XY-Z a1-0')).toBe(false);
      // A longer numeric token must not be matched by a shorter one.
      expect(isPermitLockedRegion('Col 1219 Sector AB-C d1-2')).toBe(false);
    });

    it('rejects ordinary systems', () => {
      expect(isPermitLockedRegion('Sol')).toBe(false);
      expect(isPermitLockedRegion('Maia')).toBe(false);
      expect(isPermitLockedRegion('')).toBe(false);
    });
  });

  it('isPermitLockedSystem also covers region members', () => {
    expect(isPermitLockedSystem('Cone Sector GW-W c1-5')).toBe(true);
    expect(isPermitLockedSystem('Bleia Flyuae DH-U e3-26')).toBe(true);
  });
});
