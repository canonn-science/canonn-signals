import { buildBodyHistogram } from './body-histogram';

describe('buildBodyHistogram', () => {
  it('counts bodies by sub-type and reports totals', () => {
    const result = buildBodyHistogram([
      { type: 'Planet', subType: 'Icy body' },
      { type: 'Planet', subType: 'Icy body' },
      { type: 'Planet', subType: 'High metal content world' },
      { type: 'Star', subType: 'M (Red dwarf) Star' },
    ]);

    expect(result.total).toBe(4);
    expect(result.maxCount).toBe(2);
    expect(result.bars).toEqual([
      { label: 'M (Red dwarf) Star', count: 1, kind: 'Star' },
      { label: 'Icy body', count: 2, kind: 'Planet' },
      { label: 'High metal content world', count: 1, kind: 'Planet' },
    ]);
  });

  it('orders stars before planets before other, then by count desc, then label asc', () => {
    const result = buildBodyHistogram([
      { type: 'Planet', subType: 'Water world' },
      { type: 'Planet', subType: 'Ammonia world' },
      { type: 'Planet', subType: 'Icy body' },
      { type: 'Planet', subType: 'Icy body' },
      { type: 'Star', subType: 'A Star' },
      { type: 'Unknown', subType: 'Mystery' },
    ]);

    expect(result.bars.map(b => b.label)).toEqual([
      'A Star', // star first
      'Icy body', // planets by count desc
      'Ammonia world', // count tie -> alphabetical
      'Water world',
      'Mystery', // other last
    ]);
    expect(result.bars[result.bars.length - 1].kind).toBe('Other');
  });

  it('excludes synthetic barycentres', () => {
    const result = buildBodyHistogram([
      { type: 'Barycentre', subType: '' },
      { type: 'Star', subType: 'G Star' },
    ]);

    expect(result.total).toBe(1);
    expect(result.bars).toHaveLength(1);
    expect(result.bars[0].label).toBe('G Star');
  });

  it('falls back to type, then "Unknown", when sub-type is missing or blank', () => {
    const result = buildBodyHistogram([
      { type: 'Planet', subType: '   ' },
      { type: 'Planet' },
      {},
    ]);

    const labels = result.bars.map(b => b.label);
    expect(labels).toContain('Planet');
    expect(labels).toContain('Unknown');
  });

  it('returns an empty histogram for no bodies', () => {
    const result = buildBodyHistogram([]);
    expect(result).toEqual({ bars: [], total: 0, maxCount: 0 });
  });
});
