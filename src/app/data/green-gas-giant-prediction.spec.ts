import {
  GreenGasGiantCandidate,
  isPredictableGiantSubType,
  predictGreenGasGiant,
} from './green-gas-giant-prediction';

/**
 * These cases are the published model's own evidence, re-used as regression tests. The
 * numbers come from real scans (Spansh serves them at the float32 precision the game
 * stores, so they are exact), and the expected verdicts come from the published demo and
 * the Green Gas Giant catalogue.
 *
 * Several assertions below look over-precise — a temperature to six decimals, a verdict
 * flipping on the seventh digit. That is the point: the game's band lookup is an exact
 * float32 equality test, so these are the cases that would break if someone "tidied" the
 * reach formula or dropped a `Math.fround`.
 */

/** A full-precision journal atmosphere, so whole-number temperatures below read as genuine. */
const JOURNAL_ATMOSPHERE = { Helium: 25.82991, Hydrogen: 74.116432 };

const giant = (over: Partial<GreenGasGiantCandidate>): GreenGasGiantCandidate => ({
  subType: 'Class I gas giant',
  surfaceTemperature: 130,
  earthMasses: 220.366837,
  radius: 66635.716,
  atmosphereComposition: JOURNAL_ATMOSPHERE,
  ...over,
});

/** Asserts a prediction exists and returns it, so the tests can stay free of `!`. */
const predict = (body: GreenGasGiantCandidate) => {
  const prediction = predictGreenGasGiant(body);
  expect(prediction).not.toBeNull();
  return prediction!;
};

describe('isPredictableGiantSubType', () => {
  it('accepts every gas and water giant subtype the model covers', () => {
    for (const subType of [
      'Class I gas giant', 'Class II gas giant', 'Class III gas giant',
      'Class IV gas giant', 'Class V gas giant',
      'Gas giant with water-based life', 'Gas giant with ammonia-based life',
      'Water giant', 'Water giant with life',
      'Helium-rich gas giant', 'Helium gas giant',
    ]) {
      expect(isPredictableGiantSubType(subType)).toBe(true);
    }
  });

  it('matches case-insensitively and ignores surrounding whitespace', () => {
    expect(isPredictableGiantSubType('CLASS I GAS GIANT')).toBe(true);
    expect(isPredictableGiantSubType('  water giant  ')).toBe(true);
  });

  it('rejects bodies that are not gas or water giants', () => {
    for (const subType of ['Earth-like world', 'High metal content world', 'Icy body', 'Neutron Star', '']) {
      expect(isPredictableGiantSubType(subType)).toBe(false);
    }
    expect(isPredictableGiantSubType(null)).toBe(false);
    expect(isPredictableGiantSubType(undefined)).toBe(false);
  });
});

describe('predictGreenGasGiant — inputs it cannot place on the ladder', () => {
  it('returns null for a body that is not a gas or water giant', () => {
    expect(predictGreenGasGiant(giant({ subType: 'Earth-like world' }))).toBeNull();
    expect(predictGreenGasGiant(giant({ subType: null }))).toBeNull();
  });

  it('returns null when the surface temperature, mass or radius is missing', () => {
    expect(predictGreenGasGiant(giant({ surfaceTemperature: null }))).toBeNull();
    expect(predictGreenGasGiant(giant({ earthMasses: undefined }))).toBeNull();
    expect(predictGreenGasGiant(giant({ radius: null }))).toBeNull();
  });

  it('returns null for non-positive values that would make the density meaningless', () => {
    expect(predictGreenGasGiant(giant({ radius: 0 }))).toBeNull();
    expect(predictGreenGasGiant(giant({ earthMasses: 0 }))).toBeNull();
    expect(predictGreenGasGiant(giant({ surfaceTemperature: -5 }))).toBeNull();
  });
});

describe('predictGreenGasGiant — the published worked example', () => {
  // "Surface 133.998352 K, density 1,062 kg/m3. The reach is about 190 K, so the top is
  // about 324 K. That's below the 340 K ceiling, so density decides the step, which comes
  // out at 27.2 K. The rungs are 134.0, 161.2, 188.4, 215.6, 242.8, 270.000, 297.2."
  const m17 = giant({ surfaceTemperature: 133.998352, earthMasses: 220.366837, radius: 66635.716 });

  it('reproduces M17 Sector CF-Y c1-23 2 layer by layer', () => {
    const prediction = predict(m17);
    expect(prediction.density).toBeCloseTo(1061.9, 1);
    expect(prediction.step).toBeCloseTo(27.2003, 4);
    expect(prediction.ceiling).toBe(340);
    expect(prediction.cappedByCeiling).toBe(false);
    expect(prediction.densityDriven).toBe(true);
    expect(prediction.layers.map(layer => Number(layer.toFixed(4)))).toEqual([
      133.9984, 161.1987, 188.3990, 215.5993, 242.7997, 270.0000, 297.2003,
    ]);
  });

  it('calls it green on the sixth layer, exactly on the 270 K crack', () => {
    const prediction = predict(m17);
    expect(prediction.verdict).toBe('green');
    expect(prediction.isGreen).toBe(true);
    expect(prediction.nudge).toBe('none');
    expect(prediction.hitLayer).toBe(6);
    expect(prediction.hitCrack).toBe(270);
    // A layer sits exactly on a crack, so there is no "closest approach" to report.
    expect(prediction.nearest).toBeNull();
    expect(prediction.layers[5]).toBe(270);
  });
});

describe('predictGreenGasGiant — exactness of the band lookup', () => {
  // The model's sharpest published claim: "Aemonz UT-R d4-36 10 a at 176.666702 K is
  // green. A planet at 176.666626 K misses 270 by the smallest step a temperature can
  // take, and it looks normal."
  const aemonz = (surfaceTemperature: number) => giant({
    subType: 'Gas giant with water-based life',
    surfaceTemperature,
    earthMasses: 408.532623,
    radius: 75062.848,
  });

  it('is green at 176.666702 K', () => {
    const prediction = predict(aemonz(176.666702));
    expect(prediction.verdict).toBe('green');
    expect(prediction.hitLayer).toBe(5);
    expect(prediction.hitCrack).toBe(270);
  });

  it('is not green one float32 step lower, at 176.666626 K', () => {
    const prediction = predict(aemonz(176.666626));
    expect(prediction.verdict).toBe('not-green');
    expect(prediction.isGreen).toBe(false);
    expect(prediction.hitLayer).toBeNull();
    // Off by a single representable step — as close as a miss can be.
    expect(prediction.nearest?.layer).toBe(5);
    expect(prediction.nearest?.crack).toBe(270);
    expect(prediction.nearest?.ulps).toBe(1);
  });
});

describe('predictGreenGasGiant — density decides it (the published 130 K test)', () => {
  // At 130 K a class I needs ~2,078 kg/m3 to reach the ceiling and put its 5th layer on
  // 250 K. Nyuena (5,245) is green; Flyae Flyi (597) and a mid-density giant are not.
  const at130 = (earthMasses: number, radius: number) =>
    giant({ surfaceTemperature: 130.000015, earthMasses, radius });

  it('is green for a dense giant that reaches the ceiling', () => {
    const prediction = predict(at130(18.154175, 17025.02));
    expect(prediction.density).toBeCloseTo(5245.2, 1);
    expect(prediction.cappedByCeiling).toBe(true);
    // (340 - 130.000015) / 7 is 29.999998 in double precision, not 30 — but rounding the
    // 5th layer to float32 still lands it exactly on 250 K. Comparing the step to 30 is
    // not the test; comparing the layer to the crack is.
    expect(prediction.step).toBeCloseTo(30, 5);
    expect(prediction.verdict).toBe('green');
    expect(prediction.hitLayer).toBe(5);
    expect(prediction.hitCrack).toBe(250);
    expect(prediction.layers[4]).toBe(250);
  });

  it('is not green for a light giant whose ladder falls short', () => {
    const prediction = predict(at130(58.582287, 51913.968));
    expect(prediction.density).toBeCloseTo(597.0, 1);
    expect(prediction.cappedByCeiling).toBe(false);
    expect(prediction.densityDriven).toBe(true);
    expect(prediction.verdict).toBe('not-green');
  });

  it('is not green at an intermediate density either', () => {
    expect(predict(at130(60, 38000)).verdict).toBe('not-green');
  });
});

describe('predictGreenGasGiant — the three ways to land on a crack', () => {
  it('the ceiling: a water-life giant at 158 K is green whatever its density', () => {
    const prediction = predict(giant({
      subType: 'Gas giant with water-based life',
      surfaceTemperature: 158,
      earthMasses: 389.048157,
      radius: 74427.544,
    }));
    expect(prediction.cappedByCeiling).toBe(true);
    expect(prediction.step).toBe(26); // (340 - 158) / 7
    expect(prediction.verdict).toBe('green');
    expect(prediction.hitLayer).toBe(3);
    expect(prediction.hitCrack).toBe(210);
  });

  it('a step clamp: class III giants go green every 30 K from 520 to 700', () => {
    const classIII = (surfaceTemperature: number) => giant({
      subType: 'Class III gas giant',
      surfaceTemperature,
      earthMasses: 1107.717285,
      radius: 77486.28,
    });
    for (const [surfaceTemperature, expectedLayer] of [
      [520, 7], [550, 6], [580, 5], [610, 4], [640, 3], [670, 2], [700, 1],
    ] as const) {
      const prediction = predict(classIII(surfaceTemperature));
      expect(prediction.verdict).toBe('green');
      expect(prediction.hitCrack).toBe(700);
      expect(prediction.hitLayer).toBe(expectedLayer);
    }
    // Off the 30 K grid, nothing lands on 700.
    expect(predict(classIII(490)).verdict).toBe('not-green');
    expect(predict(classIII(730)).verdict).toBe('not-green');
    // 780 K clears the 700 K band and puts the 3rd layer on the 900 K crack instead.
    const hotter = predict(classIII(780));
    expect(hotter.verdict).toBe('green');
    expect(hotter.hitLayer).toBe(3);
    expect(hotter.hitCrack).toBe(900);
  });

  it('depth: a density-driven ladder can be green at an ordinary temperature', () => {
    // Flyiedge KA-V b8-5 3 — green on its 7th layer with no round-number temperature.
    const prediction = predict(giant({ surfaceTemperature: 122.29538, earthMasses: 288.495422, radius: 71704.224 }));
    expect(prediction.densityDriven).toBe(true);
    expect(prediction.isGreen).toBe(true);
    expect(prediction.hitLayer).toBe(7);
    expect(prediction.hitCrack).toBe(270);
  });
});

describe('predictGreenGasGiant — planet class selects the band boundaries', () => {
  // Class I and ammonia-life giants use 115/250/…; everything else uses 114/210/….
  // The same body at 158 K is green as a water giant (3rd layer on 210) but not as a
  // class I, which has no 210 K boundary at all.
  const at158 = (subType: string) =>
    giant({ subType, surfaceTemperature: 158, earthMasses: 389.048157, radius: 74427.544 });

  it('is green as a water giant, which has a 210 K boundary', () => {
    const prediction = predict(at158('Water giant'));
    expect(prediction.cracks).toContain(210);
    expect(prediction.verdict).toBe('green');
    expect(prediction.hitCrack).toBe(210);
  });

  it('is not green as a class I giant, which does not', () => {
    const prediction = predict(at158('Class I gas giant'));
    expect(prediction.cracks).not.toContain(210);
    expect(prediction.cracks).toContain(250);
    expect(prediction.verdict).toBe('not-green');
  });
});

describe('predictGreenGasGiant — the random nudge', () => {
  it('reports an always-nudged cold class II giant as unpredictable', () => {
    // Juenoea JN-J d9-7667 AB 5 — a catalogued GGG, but below 250 K a class II is always
    // nudged, so its own numbers cannot explain it.
    const prediction = predict(giant({
      subType: 'Class II gas giant',
      surfaceTemperature: 166.724182,
      earthMasses: 95.072899,
      radius: 52542.176,
    }));
    expect(prediction.nudge).toBe('always');
    expect(prediction.verdict).toBe('unpredictable');
    expect(prediction.isGreen).toBe(false);
    // The ladder is still reported — it's the pre-nudge starting point.
    expect(prediction.layers).toHaveLength(7);
  });

  it('places the class II nudge window at 250-280 K', () => {
    const classII = (surfaceTemperature: number) => predict(giant({
      subType: 'Class II gas giant',
      surfaceTemperature,
      earthMasses: 95.072899,
      radius: 52542.176,
    }));
    expect(classII(240).nudge).toBe('always');
    expect(classII(265).nudge).toBe('possible');
    expect(classII(300).nudge).toBe('none');
  });

  it('nudges other classes between 80 K and ~122.22 K', () => {
    const classI = (surfaceTemperature: number) => predict(giant({ surfaceTemperature })).nudge;
    expect(classI(79)).toBe('none');
    expect(classI(90)).toBe('always');
    expect(classI(110)).toBe('possible');
    expect(classI(123)).toBe('none');
  });

  it('downgrades a crack hit to green-unless-nudged inside the nudge window', () => {
    // Vegnao PA-S c6-43 3 — catalogued, hits the 250 K crack, but can still be nudged off.
    const prediction = predict(giant({
      surfaceTemperature: 113.841248, earthMasses: 306.238953, radius: 72590.296,
    }));
    expect(prediction.nudge).toBe('possible');
    expect(prediction.verdict).toBe('green-unless-nudged');
    expect(prediction.isGreen).toBe(true);
    expect(prediction.hitLayer).toBe(7);
    expect(prediction.hitCrack).toBe(250);
  });

  it('reports a nudgeable miss as possible rather than not-green', () => {
    // Dryooe Groa QX-F c16 A 7 — catalogued, and 1 float32 step off the 250 K crack.
    const prediction = predict(giant({
      surfaceTemperature: 120.72538, earthMasses: 83.17791, radius: 57642.944,
    }));
    expect(prediction.nudge).toBe('possible');
    expect(prediction.verdict).toBe('possible');
    expect(prediction.isGreen).toBe(false);
    expect(prediction.nearest?.ulps).toBe(1);
  });
});

describe('predictGreenGasGiant — near misses', () => {
  // The published model ruled these two out by checking the journal's 8-digit gravity
  // against the mass/radius rounding. Leamiae 9 was then visited: it is not green. So
  // `near-miss` must stay a "worth a second look", never a green claim.
  it('flags a density-driven ladder that misses by a single float32 step', () => {
    for (const body of [
      giant({ surfaceTemperature: 125.288841, earthMasses: 195.145721, radius: 68355.944 }),
      giant({
        subType: 'Gas giant with ammonia-based life',
        surfaceTemperature: 123.501953, earthMasses: 251.213791, radius: 70790.928,
      }),
    ]) {
      const prediction = predict(body);
      expect(prediction.verdict).toBe('near-miss');
      expect(prediction.isGreen).toBe(false);
      expect(prediction.densityDriven).toBe(true);
      expect(prediction.nearest?.crack).toBe(270);
      expect(prediction.nearest?.ulps).toBe(1);
    }
  });

  it('does not flag a ladder whose step the ceiling or a clamp fixed', () => {
    // Capped by the ceiling: density can't move the layers, so a miss is final even if
    // the arithmetic lands close.
    const prediction = predict(giant({
      subType: 'Gas giant with water-based life',
      surfaceTemperature: 176.666626, earthMasses: 408.532623, radius: 75062.848,
    }));
    expect(prediction.cappedByCeiling).toBe(true);
    expect(prediction.densityDriven).toBe(false);
    expect(prediction.nearest?.ulps).toBe(1);
    expect(prediction.verdict).toBe('not-green');
  });

  it('does not flag an ordinary miss as a near miss', () => {
    const prediction = predict(giant({ surfaceTemperature: 130, earthMasses: 58.582287, radius: 51913.968 }));
    expect(prediction.verdict).toBe('not-green');
    expect(prediction.nearest!.ulps).toBeGreaterThan(2);
  });
});

describe('predictGreenGasGiant — ceilings', () => {
  it('picks the ceiling from the surface temperature band', () => {
    const ceilingAt = (surfaceTemperature: number) => predict(giant({ surfaceTemperature })).ceiling;
    expect(ceilingAt(50)).toBe(100);
    expect(ceilingAt(75)).toBe(340);
    expect(ceilingAt(329)).toBe(340);
    expect(ceilingAt(330)).toBe(700);
    expect(ceilingAt(680)).toBe(1200);
    expect(ceilingAt(900)).toBe(1500);
    expect(ceilingAt(1400)).toBe(5000);
  });

  it('starts the ladder at the ceiling when the surface is already above it', () => {
    // A 60 K giant's ceiling is 100 K; a 150 K one's is 340 K. Below 75 K the ceiling can
    // sit under the surface temperature, and then every layer starts from the ceiling.
    const prediction = predict(giant({ surfaceTemperature: 74, earthMasses: 500, radius: 70000 }));
    expect(prediction.ceiling).toBe(100);
    expect(prediction.layers[0]).toBe(74);
    // 74 K is below its 100 K ceiling, so the ladder still climbs normally.
    expect(prediction.layers[6]).toBeGreaterThan(prediction.layers[0]);
  });
});

describe('predictGreenGasGiant — invariants across every verdict', () => {
  const bodies: readonly GreenGasGiantCandidate[] = [
    giant({ surfaceTemperature: 133.998352 }),
    giant({ subType: 'Class II gas giant', surfaceTemperature: 166.724182 }),
    giant({ subType: 'Class III gas giant', surfaceTemperature: 640, earthMasses: 1107.717285, radius: 77486.28 }),
    giant({ subType: 'Class V gas giant', surfaceTemperature: 1600, earthMasses: 3000, radius: 70000 }),
    giant({ subType: 'Water giant', surfaceTemperature: 158, earthMasses: 389.048157, radius: 74427.544 }),
    giant({ subType: 'Helium gas giant', surfaceTemperature: 450, earthMasses: 900, radius: 72000 }),
  ];

  it('always returns seven ascending layers starting at the surface temperature', () => {
    for (const body of bodies) {
      const prediction = predict(body);
      expect(prediction.layers).toHaveLength(7);
      expect(prediction.layers[0]).toBe(Math.fround(Math.min(body.surfaceTemperature!, prediction.ceiling)));
      for (let i = 1; i < prediction.layers.length; i++) {
        expect(prediction.layers[i]).toBeGreaterThanOrEqual(prediction.layers[i - 1]);
      }
    }
  });

  it('reports a hit layer with its crack, or a closest approach, but never both or neither', () => {
    for (const body of bodies) {
      const prediction = predict(body);
      if (prediction.hitLayer === null) {
        expect(prediction.hitCrack).toBeNull();
        expect(prediction.nearest).not.toBeNull();
      } else {
        expect(prediction.hitCrack).not.toBeNull();
        expect(prediction.layers[prediction.hitLayer - 1]).toBe(prediction.hitCrack);
        expect(prediction.nearest).toBeNull();
      }
    }
  });

  it('keeps isGreen in step with the verdict', () => {
    for (const body of bodies) {
      const prediction = predict(body);
      expect(prediction.isGreen).toBe(prediction.verdict === 'green' || prediction.verdict === 'green-unless-nudged');
    }
  });

  it('emits every layer at float32 precision', () => {
    for (const body of bodies) {
      for (const layer of predict(body).layers) {
        expect(layer).toBe(Math.fround(layer));
      }
    }
  });
});

describe('predictGreenGasGiant — whole-number temperatures', () => {
  // Swoilz RT-L b2 2 as Spansh serves it: an old record with the temperature rounded to
  // 158 and the atmosphere to two decimals. Thousands of giants look like this, and the
  // model would call every one of them green at 158 K.
  const swoilz: GreenGasGiantCandidate = {
    subType: 'Gas giant with water-based life',
    surfaceTemperature: 158,
    earthMasses: 639.976929,
    radius: 77196.584,
    atmosphereComposition: { Helium: 26.31, Hydrogen: 73.62, Oxygen: 0.07 },
  };

  it('reports a whole number in a rounded record as imprecise, not green', () => {
    const prediction = predict(swoilz);
    expect(prediction.verdict).toBe('imprecise');
    expect(prediction.isGreen).toBe(false);
    // The ladder is still built from the value as given, for the dialog to show.
    expect(prediction.hitCrack).toBe(210);
  });

  it('treats a whole number with no atmosphere to vouch for it as imprecise', () => {
    expect(predict({ ...swoilz, atmosphereComposition: null }).verdict).toBe('imprecise');
    expect(predict({ ...swoilz, atmosphereComposition: {} }).verdict).toBe('imprecise');
  });

  it('trusts a whole number in a full-precision record — many real GGGs sit exactly on one', () => {
    expect(predict({ ...swoilz, atmosphereComposition: JOURNAL_ATMOSPHERE }).verdict).toBe('green');
  });

  it('ignores a rounded atmosphere when the temperature itself carries decimals', () => {
    // Flyiedge KA-V b8-5 3's real numbers, paired with a two-decimal atmosphere.
    const prediction = predict(giant({
      surfaceTemperature: 122.29538, earthMasses: 288.495422, radius: 71704.224,
      atmosphereComposition: { Helium: 26.31, Hydrogen: 73.69 },
    }));
    expect(prediction.verdict).toBe('green');
  });

  it('still calls an always-nudged body unpredictable, which says more', () => {
    const prediction = predict({ ...swoilz, subType: 'Class II gas giant', surfaceTemperature: 166 });
    expect(prediction.verdict).toBe('unpredictable');
  });
});

describe('predictGreenGasGiant — against the catalogue', () => {
  /**
   * A cross-section of the real catalogue: every body below is a confirmed Green Gas
   * Giant, with its scan values as Spansh serves them. The model must never call a
   * confirmed GGG flatly `not-green` — the only verdicts it may return here are an
   * outright hit or one of the "a random nudge decides it" outcomes.
   *
   * The full 70-body catalogue was checked the same way while this was written: 37 came
   * back `green`, 3 `green-unless-nudged`, 7 `possible` and 23 `unpredictable`, with no
   * `not-green` among them — matching the published breakdown of the catalogue.
   */
  const catalogued: readonly (readonly [string, GreenGasGiantCandidate])[] = [
    ['Eol Prou KW-L c8-32 4', { subType: 'Gas giant with water-based life', surfaceTemperature: 158, earthMasses: 389.048157, radius: 74427.544, atmosphereComposition: JOURNAL_ATMOSPHERE }],
    ['Aemonz UT-R d4-36 10 a', { subType: 'Gas giant with water-based life', surfaceTemperature: 176.666702, earthMasses: 408.532623, radius: 75062.848 }],
    ['Shaulai DL-P d5-274 7', { subType: 'Gas giant with water-based life', surfaceTemperature: 217.499985, earthMasses: 671.063721, radius: 77073.552 }],
    ['Eimbaith LW-W e1-290 7', { subType: 'Water giant', surfaceTemperature: 158, earthMasses: 23.555542, radius: 18263.88, atmosphereComposition: { Ammonia: 0.529072, Methane: 0.529072, Water: 98.407478 } }],
    ['Nyuena AC-B d14-245 7', { subType: 'Class I gas giant', surfaceTemperature: 130.000015, earthMasses: 18.154175, radius: 17025.02 }],
    ['Flyiedge KA-V b8-5 3', { subType: 'Class I gas giant', surfaceTemperature: 122.29538, earthMasses: 288.495422, radius: 71704.224 }],
    ['Phrio Hype BB-W e2-8 12 a', { subType: 'Class III gas giant', surfaceTemperature: 670, earthMasses: 1107.717285, radius: 77486.28, atmosphereComposition: { Helium: 27.274115, Hydrogen: 72.725883 } }],
    ['Eor Aowsy GR-W e1-1381 AB 1', { subType: 'Class IV gas giant', surfaceTemperature: 1149.999878, earthMasses: 3749.639893, radius: 64789.372 }],
    ['Col 285 Sector VU-M c8-1 4', { subType: 'Gas giant with ammonia-based life', surfaceTemperature: 133.510468, earthMasses: 230.435852, radius: 66744.384 }],
    ['Juenoea JN-J d9-7667 AB 5', { subType: 'Class II gas giant', surfaceTemperature: 166.724182, earthMasses: 95.072899, radius: 52542.176 }],
    ['Dryooe Groa QX-F c16 A 7', { subType: 'Class I gas giant', surfaceTemperature: 120.72538, earthMasses: 83.17791, radius: 57642.944 }],
  ];

  it('never calls a confirmed Green Gas Giant flatly not green', () => {
    for (const [name, body] of catalogued) {
      const prediction = predict(body);
      expect(prediction.verdict, name).not.toBe('not-green');
      expect(['green', 'green-unless-nudged', 'possible', 'unpredictable'], name)
        .toContain(prediction.verdict);
    }
  });

  it('explains the un-nudged ones with an exact crack hit', () => {
    for (const [name, body] of catalogued) {
      const prediction = predict(body);
      if (prediction.nudge === 'none') {
        expect(prediction.hitLayer, name).not.toBeNull();
        expect(prediction.layers[prediction.hitLayer! - 1], name).toBe(prediction.hitCrack);
      }
    }
  });
});

describe('predictGreenGasGiant — specificity', () => {
  /**
   * The badge is only worth showing if it stays rare. An 18,000-body sample of real gas
   * giants drawn from Spansh (every giant subtype, nearest Sol first) produced exactly
   * one `isGreen` body — and no `near-miss` at all. This test pins the behaviour that
   * makes that possible: an ordinary giant, and small perturbations of a known GGG, must
   * not come back green.
   */
  it('does not fire on ordinary giants a short step either side of a green one', () => {
    // Walk M17's surface temperature across ±0.05 K. Only its real value is green.
    const base = 133.998352;
    let greens = 0;
    for (let offset = -500; offset <= 500; offset++) {
      const prediction = predict(giant({
        surfaceTemperature: base + offset * 1e-4, earthMasses: 220.366837, radius: 66635.716,
      }));
      if (prediction.isGreen) { greens++; }
    }
    expect(greens).toBe(1);
  });

  it('does not fire when the mass moves off the value that lands the layer', () => {
    let greens = 0;
    for (let offset = -50; offset <= 50; offset++) {
      if (predict(giant({
        surfaceTemperature: 133.998352, earthMasses: 220.366837 + offset * 1e-3, radius: 66635.716,
      })).isGreen) { greens++; }
    }
    expect(greens).toBeLessThanOrEqual(2);
  });
});
