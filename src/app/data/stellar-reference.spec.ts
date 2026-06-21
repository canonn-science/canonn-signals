import {
  SPECTRAL_CLASS_REFERENCE,
  MAIN_SEQUENCE_ORDER,
  spectralLetter,
  luminosityClass,
  mainSequenceLifetimeMyr,
  formatMillionYears,
  assessStellarAge,
  starClassLetter,
  isPlottableStarClass,
  isWhiteDwarf,
  absoluteMagnitudeFromRadiusTemp,
  spectralColor,
  SPECTRAL_COLORS,
} from './stellar-reference';

describe('spectralLetter', () => {
  it('extracts the leading letter', () => {
    expect(spectralLetter('K5')).toBe('K');
    expect(spectralLetter('M0')).toBe('M');
    expect(spectralLetter('f7')).toBe('F');
  });

  it('is null-safe', () => {
    expect(spectralLetter(null)).toBeNull();
    expect(spectralLetter(undefined)).toBeNull();
    expect(spectralLetter('')).toBeNull();
    expect(spectralLetter('Neutron')).toBeNull();
  });
});

describe('starClassLetter', () => {
  it('prefers the spectral class', () => {
    expect(starClassLetter('K5', 'K (Yellow-Orange) Star')).toBe('K');
  });

  it('falls back to the subType label when spectralClass is null', () => {
    expect(starClassLetter(null, 'B (Blue-White) Star')).toBe('B');
    expect(starClassLetter(null, 'M (Red giant) Star')).toBe('M');
    expect(starClassLetter(undefined, 'L (Brown dwarf) Star')).toBe('L');
  });

  it('returns null for classless bodies', () => {
    expect(starClassLetter(null, 'Neutron Star')).toBeNull();
    expect(starClassLetter(null, 'Black Hole')).toBeNull();
    expect(starClassLetter('DA', 'White Dwarf (DA)')).toBeNull();
    expect(starClassLetter(null, 'Wolf-Rayet O Star')).toBeNull();
  });
});

describe('isWhiteDwarf', () => {
  it('detects white dwarfs by subType or D-prefixed spectral class', () => {
    expect(isWhiteDwarf('DA5', 'White Dwarf (DA) Star')).toBe(true);
    expect(isWhiteDwarf('DQ6', null)).toBe(true);
    expect(isWhiteDwarf(null, 'White Dwarf (DB) Star')).toBe(true);
  });

  it('is false for ordinary stars and remnants', () => {
    expect(isWhiteDwarf('G2', 'G (White-Yellow) Star')).toBe(false);
    expect(isWhiteDwarf(null, 'Neutron Star')).toBe(false);
    expect(isWhiteDwarf(null, null)).toBe(false);
  });
});

describe('isPlottableStarClass', () => {
  it('is true for main-sequence classes O–M (via class or subType)', () => {
    expect(isPlottableStarClass('B2', null)).toBe(true);
    expect(isPlottableStarClass(null, 'G (White-Yellow) Star')).toBe(true);
  });

  it('is true for white dwarfs (the diagram draws their region)', () => {
    expect(isPlottableStarClass('DA5', 'White Dwarf (DA) Star')).toBe(true);
    expect(isPlottableStarClass('DQ6', null)).toBe(true);
  });

  it('is false for classes the diagram does not draw', () => {
    expect(isPlottableStarClass(null, 'L (Brown dwarf) Star')).toBe(false);
    expect(isPlottableStarClass(null, 'T (Brown dwarf) Star')).toBe(false);
    expect(isPlottableStarClass(null, 'Neutron Star')).toBe(false);
    expect(isPlottableStarClass(null, 'Black Hole')).toBe(false);
  });
});

describe('spectralColor', () => {
  it('returns a colour by class, using the subType fallback', () => {
    expect(spectralColor('O5')).toBe(SPECTRAL_COLORS['O']);
    expect(spectralColor(null, 'M (Red dwarf) Star')).toBe(SPECTRAL_COLORS['M']);
    expect(spectralColor(null, 'Neutron Star')).toBeNull();
  });
});

describe('luminosityClass', () => {
  it('parses Roman-numeral classes greedily', () => {
    expect(luminosityClass('Va')).toBe('V');
    expect(luminosityClass('Vb')).toBe('V');
    expect(luminosityClass('VII')).toBe('VII');
    expect(luminosityClass('VI')).toBe('VI');
    expect(luminosityClass('III')).toBe('III');
    expect(luminosityClass('IV')).toBe('IV');
    expect(luminosityClass('Iab')).toBe('I');
  });

  it('is null-safe', () => {
    expect(luminosityClass(null)).toBeNull();
    expect(luminosityClass('')).toBeNull();
  });
});

describe('mainSequenceLifetimeMyr', () => {
  it('gives ~10 Gyr for a solar-mass star', () => {
    expect(mainSequenceLifetimeMyr(1)).toBeCloseTo(10000, 5);
  });

  it('is monotonically decreasing with mass (heavier burns faster)', () => {
    const masses = [0.2, 0.5, 1, 2, 5, 10];
    const lifetimes = masses.map((m) => mainSequenceLifetimeMyr(m)!);
    for (let i = 1; i < lifetimes.length; i++) {
      expect(lifetimes[i]).toBeLessThan(lifetimes[i - 1]);
    }
  });

  it('returns null for invalid mass', () => {
    expect(mainSequenceLifetimeMyr(0)).toBeNull();
    expect(mainSequenceLifetimeMyr(-1)).toBeNull();
    expect(mainSequenceLifetimeMyr(null)).toBeNull();
    expect(mainSequenceLifetimeMyr(undefined)).toBeNull();
  });
});

describe('absoluteMagnitudeFromRadiusTemp', () => {
  it('returns ~4.74 for the Sun (R=1, T=5772)', () => {
    expect(absoluteMagnitudeFromRadiusTemp(1, 5772)).toBeCloseTo(4.74, 2);
  });

  it('places a hot white dwarf faint and within its region (~+10)', () => {
    // LAWD 96 (DA): R≈0.00385 R☉, T≈27735 K.
    expect(absoluteMagnitudeFromRadiusTemp(0.0038452, 27735)).toBeCloseTo(10, 0);
  });

  it('returns null for non-positive / non-finite inputs', () => {
    expect(absoluteMagnitudeFromRadiusTemp(0, 5772)).toBeNull();
    expect(absoluteMagnitudeFromRadiusTemp(1, 0)).toBeNull();
    expect(absoluteMagnitudeFromRadiusTemp(null, 5772)).toBeNull();
    expect(absoluteMagnitudeFromRadiusTemp(1, null)).toBeNull();
  });
});

describe('formatMillionYears', () => {
  it('renders whole million-year values with grouped thousands', () => {
    expect(formatMillionYears(450)).toBe('450 million years');
    expect(formatMillionYears(1200)).toBe('1,200 million years');
    expect(formatMillionYears(2920)).toBe('2,920 million years');
    expect(formatMillionYears(150000)).toBe('150,000 million years');
  });

  it('rounds to a whole million years', () => {
    expect(formatMillionYears(6671.4)).toBe('6,671 million years');
  });

  it('renders an em dash for non-finite input', () => {
    expect(formatMillionYears(Infinity)).toBe('—');
  });
});

describe('SPECTRAL_CLASS_REFERENCE table', () => {
  it('defines every field for each main-sequence class', () => {
    for (const letter of MAIN_SEQUENCE_ORDER) {
      const ref = SPECTRAL_CLASS_REFERENCE[letter];
      expect(ref).toBeDefined();
      expect(ref.tempRange[0]).toBeLessThan(ref.tempRange[1]);
      expect(ref.massRange[0]).toBeLessThan(ref.massRange[1]);
      expect(Number.isFinite(ref.bandTemp)).toBe(true);
      expect(Number.isFinite(ref.absMagApprox)).toBe(true);
      expect(ref.msLifetimeRange[0]).toBeLessThanOrEqual(ref.msLifetimeRange[1]);
    }
  });

  it('orders main-sequence classes hottest to coolest', () => {
    const temps = MAIN_SEQUENCE_ORDER.map((l) => SPECTRAL_CLASS_REFERENCE[l].bandTemp);
    for (let i = 1; i < temps.length; i++) {
      expect(temps[i]).toBeLessThan(temps[i - 1]);
    }
  });
});

describe('assessStellarAge', () => {
  it('returns unknown when age is missing', () => {
    const a = assessStellarAge({ spectralClass: 'G2', luminosity: 'V', solarMasses: 1, ageMyr: null });
    expect(a.status).toBe('unknown');
    expect(a.barFraction).toBeNull();
  });

  it('calls a young solar-mass main-sequence star typical', () => {
    const a = assessStellarAge({ spectralClass: 'G2', luminosity: 'Va', solarMasses: 1, ageMyr: 4600 });
    expect(a.status).toBe('typical');
    expect(a.outOfRange).toBe(false);
    expect(a.barFraction).toBeGreaterThan(0);
    expect(a.barFraction).toBeLessThan(1);
    expect(a.expectedMaxMyr).toBeCloseTo(10000, 5);
  });

  it('flags an O-type star that is far too old', () => {
    // O star lifetime is a few Myr; 5 Gyr is wildly implausible.
    const a = assessStellarAge({ spectralClass: 'O5', luminosity: 'V', solarMasses: 30, ageMyr: 5000 });
    expect(a.status).toBe('old');
    expect(a.outOfRange).toBe(true);
    expect(a.barFraction).toBe(1);
    expect(a.label).toBe('old for class');
  });

  it('flags a giant that is implausibly young', () => {
    // A massive giant whose age is far below its main-sequence lifetime.
    const a = assessStellarAge({ spectralClass: 'B2', luminosity: 'III', solarMasses: 8, ageMyr: 1 });
    expect(a.status).toBe('young');
    expect(a.outOfRange).toBe(true);
    expect(a.label).toBe('young for class');
  });

  it('treats a normally-aged giant as evolved but still shows a bar', () => {
    const a = assessStellarAge({ spectralClass: 'K0', luminosity: 'III', solarMasses: 1.2, ageMyr: 9000 });
    expect(a.status).toBe('evolved');
    expect(a.outOfRange).toBe(false);
    expect(a.barFraction).not.toBeNull();
    expect(a.barMaxMyr).not.toBeNull();
  });

  it('shows a bar for a subgiant near the turnoff (the B8 IVab case)', () => {
    const a = assessStellarAge({ spectralClass: 'B8', subType: 'B (Blue-White) Star', luminosity: 'IVab', solarMasses: 4.175781, ageMyr: 252 });
    expect(a.status).toBe('evolved');
    expect(a.barFraction).not.toBeNull();
    expect(a.barFraction!).toBeGreaterThan(0.5); // ~0.9, near the end of MS life
  });

  it('flags an evolved star whose age is implausible even for a giant', () => {
    const a = assessStellarAge({ spectralClass: 'B8', luminosity: 'III', solarMasses: 4, ageMyr: 5000 });
    expect(a.status).toBe('old');
    expect(a.outOfRange).toBe(true);
  });

  it('treats a white dwarf as evolved without a lifetime comparison', () => {
    const a = assessStellarAge({ spectralClass: 'DA', luminosity: 'VII', solarMasses: 0.6, ageMyr: 2000 });
    expect(a.status).toBe('evolved');
    expect(a.barFraction).toBeNull();
  });

  it('treats a bare remnant (no class) as evolved', () => {
    const a = assessStellarAge({ spectralClass: null, luminosity: null, solarMasses: 1.5, ageMyr: 3000 });
    expect(a.status).toBe('evolved');
  });

  it('falls back to the class lifetime range when mass is missing', () => {
    const a = assessStellarAge({ spectralClass: 'M0', luminosity: 'V', solarMasses: null, ageMyr: 5000 });
    expect(a.status).toBe('typical');
    expect(a.expectedMaxMyr).toBe(SPECTRAL_CLASS_REFERENCE['M'].msLifetimeRange[1]);
  });

  it('treats a giant with no class/mass lifetime data as evolved without a bar', () => {
    // Luminosity III but no recognised class letter and no mass ⇒ no lifetime to compare.
    const a = assessStellarAge({ spectralClass: null, subType: null, luminosity: 'III', solarMasses: null, ageMyr: 3000 });
    expect(a.status).toBe('evolved');
    expect(a.barMaxMyr).toBeNull();
  });

  it('reports insufficient data for a main-sequence star with no class or mass', () => {
    const a = assessStellarAge({ spectralClass: null, subType: null, luminosity: 'V', solarMasses: null, ageMyr: 3000 });
    expect(a.status).toBe('unknown');
    expect(a.message).toContain('Insufficient data');
  });

  it('assesses a B star whose class comes only from the subType label', () => {
    // ED often omits spectralClass; the class letter is recovered from subType.
    const a = assessStellarAge({ spectralClass: null, subType: 'B (Blue-White) Star', luminosity: 'V', solarMasses: 5, ageMyr: 50 });
    expect(a.status).toBe('typical');
    expect(a.barFraction).not.toBeNull();
  });

  it('does not main-sequence-compare a brown dwarf (no false "old" flag, no NaN)', () => {
    // Brown dwarf class with no mass would otherwise hit a zero class lifetime.
    for (const cls of ['L5', 'T2', 'Y0']) {
      const a = assessStellarAge({ spectralClass: cls, luminosity: 'V', solarMasses: null, ageMyr: 3000 });
      expect(a.status).toBe('evolved');
      expect(a.barFraction).toBeNull();
      expect(a.outOfRange).toBe(false);
    }
  });

  it('returns a finite bar fraction whenever a bar is shown', () => {
    const inputs = [
      { spectralClass: 'G2', luminosity: 'V', solarMasses: 1, ageMyr: 4600 },
      { spectralClass: 'O5', luminosity: 'V', solarMasses: 30, ageMyr: 6000 },
      { spectralClass: 'B2', luminosity: 'III', solarMasses: 8, ageMyr: 1 },
      { spectralClass: 'M0', luminosity: 'V', solarMasses: null, ageMyr: 5000 },
    ];
    for (const input of inputs) {
      const a = assessStellarAge(input);
      if (a.barFraction !== null) {
        expect(Number.isFinite(a.barFraction)).toBe(true);
      }
    }
  });
});
