import type { CanonnBiostatsBody } from '../home/home.component';
import { applySpeculativeBodies } from './speculative-systems';

describe('applySpeculativeBodies', () => {
  const COL_70_ID64 = 909626806858n;
  const REAL_BODY: CanonnBiostatsBody = {
    bodyId: 0, id64: 1n, name: 'Some Star', type: 'Star', subType: 'B (Blue-White) Star',
  };

  function systemWith(id64: bigint, bodies: CanonnBiostatsBody[], region?: { name: string; region: number }) {
    return { id64, name: 'Col 70 Sector FY-N c21-3', bodies, region };
  }

  it('does nothing for a system that is not Col 70 Sector FY-N c21-3', () => {
    const system = systemWith(123n, []);
    applySpeculativeBodies(system);
    expect(system.bodies).toEqual([]);
    expect(system.region).toBeUndefined();
  });

  it('does nothing when the system already has real body data, even for Col 70 Sector FY-N c21-3', () => {
    const system = systemWith(COL_70_ID64, [REAL_BODY]);
    applySpeculativeBodies(system);
    // Real data is never clobbered by the speculative reconstruction.
    expect(system.bodies).toEqual([REAL_BODY]);
    // The early return also skips the region fill-in in this branch.
    expect(system.region).toBeUndefined();
  });

  it("fills in the system's region when missing", () => {
    const system = systemWith(COL_70_ID64, []);
    applySpeculativeBodies(system);
    expect(system.region).toEqual({ name: 'Inner Orion Spur', region: 18 });
  });

  it("leaves an existing region untouched", () => {
    const system = systemWith(COL_70_ID64, [], { name: 'Somewhere Else', region: 99 });
    applySpeculativeBodies(system);
    expect(system.region).toEqual({ name: 'Somewhere Else', region: 99 });
  });

  describe('the synthesized body layout', () => {
    let bodies: CanonnBiostatsBody[];

    beforeEach(() => {
      const system = systemWith(COL_70_ID64, []);
      applySpeculativeBodies(system);
      bodies = system.bodies;
    });

    it('generates one body per bodyId 0-10, named off the real system name', () => {
      expect(bodies.map(b => b.bodyId)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(bodies.every(b => b.name.startsWith('Col 70 Sector FY-N c21-3'))).toBe(true);
      // bodyId 8 is the barycentre shared by the binary pair (bodyIds 9/10).
      expect(bodies[8].name).toBe('Col 70 Sector FY-N c21-3 5-6 Barycentre');
      expect(bodies[9].name).toBe('Col 70 Sector FY-N c21-3 5');
      expect(bodies[10].name).toBe('Col 70 Sector FY-N c21-3 6');
    });

    it('flags every body except the main star as speculative', () => {
      const [star, ...rest] = bodies;
      expect(star.speculative).toBeFalsy();
      expect(star.speculativeValues).toBe(true);
      expect(rest.every(b => b.speculative === true)).toBe(true);
    });

    it("keeps the main star's classification known (no speculative subtype/image marker)", () => {
      const star = bodies[0];
      expect(star.type).toBe('Star');
      expect(star.subType).toBe('T Tauri Star');
      expect(star.spectralClass).toBe('TTS3');
      expect(star.luminosity).toBe('Va');
      expect(star.mainStar).toBe(true);
    });

    it('parents bodies 1-7 directly to the star, and leaves the star itself parentless', () => {
      expect(bodies[0].parents).toBeUndefined();
      for (const bodyId of [1, 2, 3, 4, 5, 6, 7]) {
        expect(bodies[bodyId].parents).toEqual([{ Star: 0 }]);
      }
    });

    it('gives the barycentre (bodyId 8) no parents field, matching real Spansh barycentres', () => {
      expect(bodies[8].type).toBe('Barycentre');
      expect(bodies[8].parents).toBeUndefined();
    });

    it('chains the binary pair (bodyIds 9/10) through the barycentre up to the star', () => {
      expect(bodies[9].parents).toEqual([{ Null: 8 }, { Star: 0 }]);
      expect(bodies[10].parents).toEqual([{ Null: 8 }, { Star: 0 }]);
    });

    it('converts the ring on bodyId 2 from the km figures into the metres the tree-builder expects', () => {
      const ring = bodies[2].rings?.[0];
      expect(ring).toBeTruthy();
      expect(ring!.name).toBe('Col 70 Sector FY-N c21-3 2 A Ring');
      // home.component.ts's tree-builder divides these by 1000 for display, so the
      // stored values here are ×1000 the intended 5,100 / 9,600 km.
      expect(ring!.innerRadius).toBe(5100 * 1000);
      expect(ring!.outerRadius).toBe(9600 * 1000);
    });
  });
});
