import {
  buildConversions,
  buildMassComparisons,
  dynamicAreaUnitLabel,
  dynamicDistanceUnitLabel,
  dynamicLengthUnitLabel,
  dynamicMassUnitLabel,
  formatDynamicArea,
  formatDynamicDistanceLs,
  formatDynamicLength,
  formatDynamicMass,
  formatLengthInUnit,
  pickInlineLengthUnit,
  KM_PER_AU,
  KM_PER_LIGHT_SECOND,
  KM_PER_LIGHT_YEAR,
  KG_PER_EARTH_MASS,
  KG_PER_SOLAR_MASS,
  KG_PER_MEGATONNE,
  SPEED_OF_LIGHT_KM_S,
} from './unit-conversions';

/** The display value for a unit label within a conversion row set. */
function display(rows: { unit: string; display: string }[], unit: string): string {
  return rows.find(r => r.unit === unit)!.display;
}
/** The numeric copy value for a unit label, parsed back to a number. */
function copyNum(rows: { unit: string; copyText: string }[], unit: string): number {
  return Number(rows.find(r => r.unit === unit)!.copyText);
}

describe('buildConversions', () => {
  it('lists length units largest-first and converts correctly from km', () => {
    const rows = buildConversions('length', KM_PER_AU);
    expect(rows.map(r => r.unit)).toEqual(['Light Years', 'AU', 'Solar Radii', 'Light seconds', 'km', 'm']);
    expect(copyNum(rows, 'AU')).toBeCloseTo(1, 9);
    expect(copyNum(rows, 'Light seconds')).toBeCloseTo(KM_PER_AU / KM_PER_LIGHT_SECOND, 3);
    expect(copyNum(rows, 'km')).toBeCloseTo(KM_PER_AU, 1);
    expect(copyNum(rows, 'm')).toBeCloseTo(KM_PER_AU * 1000, 0);
  });

  it('converts duration from days', () => {
    const rows = buildConversions('duration', 1);
    expect(copyNum(rows, 'Seconds')).toBeCloseTo(86400, 6);
    expect(copyNum(rows, 'Minutes')).toBeCloseTo(1440, 6);
    expect(copyNum(rows, 'Hours')).toBeCloseTo(24, 6);
    expect(copyNum(rows, 'Days')).toBeCloseTo(1, 6);
    expect(copyNum(rows, 'Years')).toBeCloseTo(1 / 365.25, 9);
  });

  it('converts mass from kilograms', () => {
    const rows = buildConversions('mass', KG_PER_SOLAR_MASS);
    expect(copyNum(rows, 'Solar Masses')).toBeCloseTo(1, 9);
    expect(copyNum(rows, 'Earth Masses')).toBeCloseTo(KG_PER_SOLAR_MASS / KG_PER_EARTH_MASS, 0);
    expect(copyNum(rows, 'Megatonnes')).toBeCloseTo(KG_PER_SOLAR_MASS / KG_PER_MEGATONNE, -5);
  });

  it('expresses velocity as a fraction of light speed', () => {
    const rows = buildConversions('velocity', SPEED_OF_LIGHT_KM_S);
    expect(copyNum(rows, 'km/s')).toBeCloseTo(SPEED_OF_LIGHT_KM_S, 0);
    expect(copyNum(rows, 'c (fraction of light)')).toBeCloseTo(1, 9);
  });

  it('converts density between kg/m³, g/cm³ and Mt/cm³', () => {
    const rows = buildConversions('density', 1000);
    expect(copyNum(rows, 'g/cm³')).toBeCloseTo(1, 9);
    // 1e18 kg/m³ == 1 Mt/cm³.
    expect(copyNum(buildConversions('density', 1e18), 'Mt/cm³')).toBeCloseTo(1, 6);
  });

  it('converts area between km² and Ls²', () => {
    const rows = buildConversions('area', KM_PER_LIGHT_SECOND * KM_PER_LIGHT_SECOND);
    expect(copyNum(rows, 'km²')).toBeCloseTo(KM_PER_LIGHT_SECOND * KM_PER_LIGHT_SECOND, -3);
    expect(copyNum(rows, 'Ls²')).toBeCloseTo(1, 6);
  });

  it('converts pressure from atmospheres', () => {
    const rows = buildConversions('pressure', 1);
    expect(copyNum(rows, 'kPa')).toBeCloseTo(101.325, 3);
    expect(copyNum(rows, 'Pa')).toBeCloseTo(101325, 0);
    expect(copyNum(rows, 'psi')).toBeCloseTo(14.6959488, 5);
  });

  it('renders zero across every unit and keeps non-finite values safe', () => {
    const zero = buildConversions('length', 0);
    expect(zero.every(r => copyNum(zero, r.unit) === 0)).toBe(true);
    const bad = buildConversions('mass', NaN);
    expect(bad.every(r => r.display === '—' && r.copyText === '')).toBe(true);
  });

  it('uses exponential notation for extreme magnitudes but grouped digits otherwise', () => {
    expect(display(buildConversions('length', KM_PER_AU), 'km')).toBe('149,597,870.7');
    expect(display(buildConversions('density', 4e17), 'kg/m³')).toBe('4.0000e+17');
  });

  it('preserves copy precision beyond the rounded display', () => {
    const rows = buildConversions('length', 12345.6789);
    expect(copyNum(rows, 'km')).toBeCloseTo(12345.6789, 4);
  });
});

describe('buildMassComparisons', () => {
  it('produces an elephant-scale comparison for a small mass', () => {
    const comparisons = buildMassComparisons(6.0e3);
    const elephants = comparisons.find(c => c.label === 'African bush elephants')!;
    expect(elephants.display).toBe('≈ 1');
    expect(comparisons.map(c => c.label)).toContain('Great Pyramids of Giza');
  });

  it('returns nothing for zero or non-finite mass', () => {
    expect(buildMassComparisons(0)).toEqual([]);
    expect(buildMassComparisons(NaN)).toEqual([]);
  });
});

describe('dynamic inline formatters', () => {
  it('formats length across the m / km / ls / ly ladder', () => {
    expect(formatDynamicLength(0)).toBe('0.00 km');
    expect(formatDynamicLength(0.5)).toBe('500.00 m');
    expect(formatDynamicLength(4314.73)).toBe('4,314.73 km');
    expect(formatDynamicLength(2e6)).toBe(`${(2e6 / KM_PER_LIGHT_SECOND).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ls`);
    expect(formatDynamicLength(2 * KM_PER_LIGHT_YEAR)).toBe('2.00 ly');
    expect(formatDynamicLength(NaN)).toBe('—');
  });

  it('keeps distance in light-seconds until Hutton-scale spans', () => {
    expect(formatDynamicDistanceLs(0)).toBe('0.00 ls');
    expect(formatDynamicDistanceLs(2108.23)).toBe('2,108.23 ls');
    expect(formatDynamicDistanceLs(6395278.54)).toBe('0.20 ly');
  });

  it('formats mass across the Mt / Earth / Solar ladder', () => {
    expect(formatDynamicMass(1e-5 * KG_PER_EARTH_MASS)).toMatch(/Mt$/);
    expect(formatDynamicMass(0.67 * KG_PER_EARTH_MASS)).toBe('0.67 Earth masses');
    expect(formatDynamicMass(5.25 * KG_PER_SOLAR_MASS)).toBe('5.25 Solar masses');
    expect(formatDynamicMass(NaN)).toBe('—');
  });

  it('formats area across the km² / ls² ladder', () => {
    expect(formatDynamicArea(1000)).toBe('1,000.00 km²');
    expect(formatDynamicArea(2 * KM_PER_LIGHT_SECOND * KM_PER_LIGHT_SECOND)).toBe('2.00 ls²');
  });
});

describe('inline unit dialog-row labels', () => {
  it('labels length by magnitude, matching the conversion-row names', () => {
    expect(dynamicLengthUnitLabel(0)).toBe('km');
    expect(dynamicLengthUnitLabel(0.5)).toBe('m');
    expect(dynamicLengthUnitLabel(5000)).toBe('km');
    expect(dynamicLengthUnitLabel(2e6)).toBe('Light seconds');
    expect(dynamicLengthUnitLabel(2 * KM_PER_LIGHT_YEAR)).toBe('Light Years');
    expect(dynamicLengthUnitLabel(NaN)).toBe('');
  });

  it('labels distance-to-arrival in light seconds until Hutton-scale spans', () => {
    expect(dynamicDistanceUnitLabel(2e6)).toBe('Light seconds');
    expect(dynamicDistanceUnitLabel(2 * KM_PER_LIGHT_YEAR)).toBe('Light Years');
    expect(dynamicDistanceUnitLabel(NaN)).toBe('');
  });

  it('labels mass across the Mt / Earth / Solar ladder', () => {
    expect(dynamicMassUnitLabel(1e-5 * KG_PER_EARTH_MASS)).toBe('Megatonnes');
    expect(dynamicMassUnitLabel(0.67 * KG_PER_EARTH_MASS)).toBe('Earth Masses');
    expect(dynamicMassUnitLabel(5.25 * KG_PER_SOLAR_MASS)).toBe('Solar Masses');
    expect(dynamicMassUnitLabel(NaN)).toBe('');
  });

  it('labels area across the km² / ls² ladder', () => {
    expect(dynamicAreaUnitLabel(1000)).toBe('km²');
    expect(dynamicAreaUnitLabel(2 * KM_PER_LIGHT_SECOND * KM_PER_LIGHT_SECOND)).toBe('Ls²');
    expect(dynamicAreaUnitLabel(NaN)).toBe('');
  });
});

describe('shared length unit (semi-major / apoapsis / periapsis group)', () => {
  it('picks one unit from a representative value and formats every member in it', () => {
    // Semi-major axis ~2e6 km lands in light-seconds; apoapsis and periapsis follow suit.
    const choice = pickInlineLengthUnit(2e6);
    expect(choice.unit).toBe('ls');
    expect(choice.label).toBe('Light seconds');
    expect(formatLengthInUnit(2e6, choice)).toBe(formatDynamicLength(2e6));
    // A smaller member of the same group still renders in the shared (ls) unit, not km.
    expect(formatLengthInUnit(1.5e6, choice)).toMatch(/ ls$/);
    expect(formatLengthInUnit(NaN, choice)).toBe('—');
  });

  it('matches formatDynamicLength when each value picks its own unit', () => {
    for (const km of [0.5, 5000, 2e6, 2 * KM_PER_LIGHT_YEAR]) {
      expect(formatLengthInUnit(km, pickInlineLengthUnit(km))).toBe(formatDynamicLength(km));
    }
  });
});
