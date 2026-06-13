import { parseJsonWithBigIntIds } from './json-bigint';

describe('parseJsonWithBigIntIds', () => {
  it('keeps a 64-bit id64 as an exact BigInt instead of a rounded float64', () => {
    // 1080864266413281122 is not exactly representable as a JS number; the bug
    // rendered it as 1080864266413281200.
    const parsed = parseJsonWithBigIntIds<{ id64: bigint }>('{"id64":1080864266413281122}');
    expect(typeof parsed.id64).toBe('bigint');
    expect(parsed.id64).toBe(1080864266413281122n);
    // Sanity: that value really does round when forced through a JS number.
    expect(Number(parsed.id64).toString()).toBe('1080864266413281200');
  });

  it('lifts id64 below 2^53 to BigInt too, for a uniform type', () => {
    const parsed = parseJsonWithBigIntIds<{ id64: bigint }>('{"id64":355844362082}');
    expect(typeof parsed.id64).toBe('bigint');
    expect(parsed.id64).toBe(355844362082n);
  });

  it('coerces id64 supplied as a string', () => {
    const parsed = parseJsonWithBigIntIds<{ id64: bigint }>('{"id64":"1080864266413281122"}');
    expect(parsed.id64).toBe(1080864266413281122n);
  });

  it('coerces nested id64 (ring) and system_address fields', () => {
    const text = '{"system":{"id64":9007199254740993,"system_address":9007199254740995,'
      + '"bodies":[{"id64":1080864266413281122,"rings":[{"id64":1369099587683063800}]}]}}';
    const parsed = parseJsonWithBigIntIds<any>(text);
    expect(parsed.system.id64).toBe(9007199254740993n);
    expect(parsed.system.system_address).toBe(9007199254740995n);
    expect(parsed.system.bodies[0].id64).toBe(1080864266413281122n);
    expect(parsed.system.bodies[0].rings[0].id64).toBe(1369099587683063800n);
  });

  it('leaves non-id numeric fields as plain numbers', () => {
    const parsed = parseJsonWithBigIntIds<any>('{"id64":355844362082,"bodyId":30,"gravity":0.79}');
    expect(typeof parsed.bodyId).toBe('number');
    expect(parsed.bodyId).toBe(30);
    expect(parsed.gravity).toBe(0.79);
  });

  it('parses long-decimal float fields untouched alongside a big id64', () => {
    // Regression: a >15-char float (e.g. rotationalPeriod) must not be treated as a
    // big integer. This value broke the json-bigint library and every system load.
    const text = '{"id64":1080864266413281122,"rotationalPeriod":2.58327451196759,'
      + '"semiMajorAxis":1.7033425920724}';
    const parsed = parseJsonWithBigIntIds<any>(text);
    expect(parsed.id64).toBe(1080864266413281122n);
    expect(typeof parsed.rotationalPeriod).toBe('number');
    expect(parsed.rotationalPeriod).toBe(2.58327451196759);
    expect(parsed.semiMajorAxis).toBe(1.7033425920724);
  });

  it('does not throw on a null or non-integer id64 (leaves it as-is)', () => {
    const parsed = parseJsonWithBigIntIds<any>('{"id64":null,"system_address":12.5}');
    expect(parsed.id64).toBeNull();
    expect(parsed.system_address).toBe(12.5);
  });

  it('returns null for an empty or blank body', () => {
    expect(parseJsonWithBigIntIds('')).toBeNull();
    expect(parseJsonWithBigIntIds('   ')).toBeNull();
  });

  it('does not corrupt id64/system_address text that appears inside string values', () => {
    // The quoting regex is text-based; verify it only touches real integer-valued
    // keys and leaves matching substrings inside string values intact (JSON escapes
    // inner quotes, so "id64": inside a string never matches the key pattern).
    const cases: [string, (p: any) => void][] = [
      ['{"description":"Found id64:1234567890 here","id64":5678}',
        p => { expect(p.description).toBe('Found id64:1234567890 here'); expect(p.id64).toBe(5678n); }],
      ['{"name":"system_address:999","id64":9999999999}',
        p => { expect(p.name).toBe('system_address:999'); expect(p.id64).toBe(9999999999n); }],
      ['{"note":"x=\\"id64\\":7 inside","id64":8}',
        p => { expect(p.note).toBe('x="id64":7 inside'); expect(p.id64).toBe(8n); }],
    ];
    for (const [text, check] of cases) {
      check(parseJsonWithBigIntIds<any>(text));
    }
  });

  it('handles arrays of objects at the top level', () => {
    const parsed = parseJsonWithBigIntIds<any[]>('[{"id64":1},{"id64":1080864266413281122}]');
    expect(parsed[0].id64).toBe(1n);
    expect(parsed[1].id64).toBe(1080864266413281122n);
  });
});
