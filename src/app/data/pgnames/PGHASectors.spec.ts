import { describe, it, expect } from 'vitest';
import { PGSystem } from './PGSystem';
import { PGHASectors, HA_REGIONS } from './PGHASectors';

/** Format a decoded system the way the app displays it (see home.component getPGName). */
function pgName(sys: PGSystem): string {
    const region = sys.isHASector
        ? sys.regionName
        : sys.regionName
            .split(' ')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ');
    const l1 = String.fromCharCode(65 + sys.mid1a);
    const l2 = String.fromCharCode(65 + sys.mid1b);
    const l3 = String.fromCharCode(65 + sys.mid2);
    const mc = String.fromCharCode(97 + sys.sizeClass);
    const n1 = Math.trunc(sys.mid3);
    const n2 = Math.trunc(sys.sequence);
    const index = n1 !== 0 ? `${n1}-${n2}` : `${n2}`;
    return `${region} ${l1}${l2}-${l3} ${mc}${index}`;
}

// Real (name, id64, coords) triples pulled from Spansh. Each is a system that
// physically sits inside a hand-authored named sector, so the game renames it.
const GROUND_TRUTH: { name: string; id64: bigint; coords: { x: number; y: number; z: number } }[] = [
    { name: 'Pleiades Sector HR-W d1-79', id64: 2724879894859n, coords: { x: -80.625, y: -146.65625, z: -343.25 } },
    { name: 'Coalsack Sector IW-V b2-0', id64: 677397014017n, coords: { x: 475.375, y: 33.34375, z: 227.3125 } },
    { name: 'California Sector BA-A e6', id64: 27072119940n, coords: { x: -319.8125, y: -216.75, z: -913.46875 } },
    { name: 'Witch Head Sector FB-X c1-9', id64: 2558424486466n, coords: { x: 381.09375, y: -383.34375, z: -729.53125 } },
    // In-game (EDDN/Spansh) spelling has a lower-case "planetary"; the hand-authored
    // data preserves it and it must be rendered verbatim (not canonicalised).
    { name: 'Blue planetary Sector RO-Q b5-0', id64: 731622287601n, coords: { x: 4516.65625, y: 419.40625, z: 2099.875 } },
];

describe('PGHASectors.regionForCoords', () => {
    it('resolves the innermost hand-authored region containing a point', () => {
        expect(PGHASectors.regionForCoords(-80.625, -146.65625, -343.25)?.name).toBe('Pleiades Sector');
        expect(PGHASectors.regionForCoords(475.375, 33.34375, 227.3125)?.name).toBe('Coalsack Sector');
    });

    it('resolves an inhabited near-Sol region at the origin', () => {
        // Several equal-radius spheres blanket the bubble; the origin lands in one
        // of them (not procedural space). Exact winner is the earliest same-radius
        // region, matching ED's smallest-radius-first priority.
        expect(PGHASectors.regionForCoords(0, 0, 0)).not.toBeNull();
    });

    it('returns null for procedural (deep) space', () => {
        expect(PGHASectors.regionForCoords(2000, 2000, 40000)).toBeNull();
        expect(PGHASectors.regionForCoords(-25000, 0, 8000)).toBeNull();
    });

    it('carries the permit flag for permit-locked regions', () => {
        // Cone Sector is permit-locked and isolated enough that its centre resolves
        // back to itself, so the flag survives the containment lookup.
        const cone = HA_REGIONS.find(r => r.name === 'Cone Sector')!;
        expect(cone.needsPermit).toBe(true);
        const s = cone.spheres[0];
        const hit = PGHASectors.regionForCoords(s.cx, s.cy, s.cz);
        expect(hit?.name).toBe('Cone Sector');
        expect(hit?.needsPermit).toBe(true);
    });

    it('is sorted smallest-radius-first (ED overlap priority)', () => {
        for (let i = 1; i < HA_REGIONS.length; i++) {
            const prev = Math.min(...HA_REGIONS[i - 1].spheres.map(s => s.r));
            const cur = Math.min(...HA_REGIONS[i].spheres.map(s => s.r));
            expect(cur).toBeGreaterThanOrEqual(prev);
        }
    });
});

describe('PGSystem.fromSystemAddress hand-authored naming', () => {
    it('reproduces the hand-authored name when given coordinates', () => {
        for (const { name, id64, coords } of GROUND_TRUTH) {
            const sys = PGSystem.fromSystemAddress(id64, coords);
            expect(sys.isHASector).toBe(true);
            expect(pgName(sys)).toBe(name);
        }
    });

    it('falls back to the procedural name without coordinates', () => {
        const sys = PGSystem.fromSystemAddress(2724879894859n);
        expect(sys.isHASector).toBe(false);
        expect(sys.regionName.toLowerCase()).not.toContain('pleiades');
        // The same boxel's procedural alias (verified against the app's decoder).
        expect(pgName(sys)).toBe('Synuefai XU-M d8-79');
    });

    it('leaves procedural systems untouched even with coordinates', () => {
        // Deep procedural space: coords resolve to no hand-authored region.
        const sys = PGSystem.fromSystemAddress(2724879894859n, { x: 2000, y: 2000, z: 40000 });
        expect(sys.isHASector).toBe(false);
        expect(pgName(sys)).toBe('Synuefai XU-M d8-79');
    });
});

describe('PGSystem.fromModSystemAddress hand-authored naming', () => {
    it('applies the hand-authored name on the mod-address path', () => {
        // Round-trip a hand-authored name through the mod-address encoding, then
        // decode it back with the region's coordinates.
        const parsed = PGSystem.tryParse('Pleiades Sector HR-W d1-79');
        expect(parsed[0]).toBe(true);
        const modAddr = parsed[1].toModSystemAddress();
        const sys = PGSystem.fromModSystemAddress(modAddr, { x: -80.625, y: -146.65625, z: -343.25 });
        expect(sys.isHASector).toBe(true);
        expect(pgName(sys)).toBe('Pleiades Sector HR-W d1-79');
    });
});
