import { describe, it, expect } from 'vitest';
import { findNearestNebulae, Nebula } from './nebulae';

const NEBULAE: Nebula[] = [
  { name: 'Origin Nebula', system: 'Sys A', x: 0, y: 0, z: 0, type: 'real' },
  { name: 'Near Nebula', system: 'Sys B', x: 3, y: 4, z: 0, type: 'planetary' }, // 5 ly from origin
  { name: 'Mid Nebula', system: 'Sys C', x: 0, y: 0, z: 10, type: 'planetary' }, // 10 ly
  { name: 'Far Nebula', system: 'Sys D', x: 100, y: 0, z: 0, type: 'procgen' },   // 100 ly
];

describe('findNearestNebulae', () => {
  it('returns nebulae ordered nearest-first with computed distances', () => {
    const result = findNearestNebulae({ x: 0, y: 0, z: 0 }, NEBULAE, 3);
    expect(result.map(n => n.name)).toEqual(['Origin Nebula', 'Near Nebula', 'Mid Nebula']);
    expect(result[0].distance).toBe(0);
    expect(result[1].distance).toBeCloseTo(5, 10);
    expect(result[2].distance).toBeCloseTo(10, 10);
  });

  it('limits the result to the requested count', () => {
    expect(findNearestNebulae({ x: 0, y: 0, z: 0 }, NEBULAE, 1)).toHaveLength(1);
    expect(findNearestNebulae({ x: 0, y: 0, z: 0 }, NEBULAE, 2)).toHaveLength(2);
  });

  it('defaults to the three nearest when no count is given', () => {
    expect(findNearestNebulae({ x: 0, y: 0, z: 0 }, NEBULAE)).toHaveLength(3);
  });

  it('computes a true 3-D distance from arbitrary coordinates', () => {
    // From (10,0,0): Far Nebula at (100,0,0) is 90 ly, the closest.
    const [nearest] = findNearestNebulae({ x: 10, y: 0, z: 0 }, [NEBULAE[3]], 1);
    expect(nearest.distance).toBeCloseTo(90, 10);
  });

  it('returns an empty array for an empty catalogue', () => {
    expect(findNearestNebulae({ x: 0, y: 0, z: 0 }, [], 3)).toEqual([]);
  });

  it('returns an empty array for a non-positive count', () => {
    expect(findNearestNebulae({ x: 0, y: 0, z: 0 }, NEBULAE, 0)).toEqual([]);
    expect(findNearestNebulae({ x: 0, y: 0, z: 0 }, NEBULAE, -1)).toEqual([]);
  });

  it('preserves the original nebula fields on each result', () => {
    const [nearest] = findNearestNebulae({ x: 0, y: 0, z: 0 }, NEBULAE, 1);
    expect(nearest).toMatchObject({ name: 'Origin Nebula', system: 'Sys A', type: 'real' });
  });
});
