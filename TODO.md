# TODO — Flagged issues (not yet addressed)

Recorded 2026-06-10. These were surfaced during the astronomy/physics review and
the test-coverage work on the `upgrade` branch. None have been fixed.

**Regression check (`upgrade` vs `main`): all of the issues below pre-date this branch
— none are regressions.** `PGSystem.ts` and `body-images.ts` are byte-identical to
`main`. `body-physics.service.ts` is new, but the
`1e12` megatonne constant was copied verbatim from `main`'s
`system-body.component.ts` (`parent.mass * 1e12; // Mt to kg`) during the extraction.

## Physics / source

- **`KG_PER_MEGATONNE = 1e12` looks ~1000× too large** —
  [src/app/data/body-physics.service.ts:10](src/app/data/body-physics.service.ts#L10).
  A megatonne is 10⁶ tonnes = 10⁹ kg, so `1e12` is actually a gigatonne. Used only in
  the `parent.mass` branch of `primaryDensityKgM3`, which is effectively unreachable for
  real parents (stars carry `solarMasses`, planets carry `earthMasses`), so practical
  impact is near-zero — but the constant is wrong as named. Confirm the data source's
  unit for `mass` before changing.  
  Pre-existing on `main` (copied during extraction):
  [src/app/system-body/system-body.component.ts:1019](src/app/system-body/system-body.component.ts#L1019)
  and [:1080](src/app/system-body/system-body.component.ts#L1080) (`parent.mass * 1e12; // Mt to kg`).  
  **Review (2026-06-10): Confirmed.** Constant is `1e12` at
  [body-physics.service.ts:10](src/app/data/body-physics.service.ts#L10). The unit maths is
  correct: 1 megatonne = 10⁶ t = 10⁹ kg, so `1e12` is a gigatonne (10³× too large). The
  branch is genuinely near-unreachable: `primaryDensityKgM3` tries `earthMasses`
  ([:76](src/app/data/body-physics.service.ts#L76)) and `solarMasses`
  ([:82](src/app/data/body-physics.service.ts#L82)) first, and the bare `mass` field is not
  populated for real stars/planets — so practical impact is near-zero. Naming is wrong as
  flagged.

- **`spinResonance` silently fails for retrograde rotators** —
  [src/app/data/stellar-physics.service.ts:29](src/app/data/stellar-physics.service.ts#L29).
  Elite stores retrograde rotation as a *negative* `rotationalPeriod`, so
  `rotationsPerOrbit = orbitalPeriod / rotationalPeriod` goes negative while every
  `candidate = num/denom` is positive — no match is ever found and the result is `'none'`.
  A retrograde tidally-locked (1:1) body is missed. Note the adjacent solar-day code
  *does* `Math.abs` its periods ([system-body.component.ts:1557](src/app/system-body/system-body.component.ts#L1557)),
  so the two disagree. Fix: take `Math.abs` of both periods.  
  Pre-existing on `main` (logic extracted from `SystemBodyComponent`, not a regression):
  [src/app/system-body/system-body.component.ts:2428](src/app/system-body/system-body.component.ts#L2428).  
  **Review (2026-06-10): Confirmed.** At
  [stellar-physics.service.ts:32](src/app/data/stellar-physics.service.ts#L32),
  `rotationsPerOrbit = orbitalPeriod / rotationalPeriod`; with a negative `rotationalPeriod`
  this goes negative, while every `candidate = num/denom` (num, denom ∈ 1..5) is strictly
  positive, so `relError` never drops within tolerance and the result is always `'none'`. A
  retrograde 1:1 (tidally-locked) body is missed. The disagreement is real: the solar-day
  path at [system-body.component.ts:1371-1374](src/app/system-body/system-body.component.ts#L1371-L1374)
  takes `Math.abs` of both periods, whereas the caller at
  [:1062](src/app/system-body/system-body.component.ts#L1062) passes raw values to
  `spinResonance`. `Math.abs` on both periods is the correct fix.

- **`tangentialVelocityKms` returns a negative velocity for retrograde spinners** —
  [src/app/data/stellar-physics.service.ts:49](src/app/data/stellar-physics.service.ts#L49).
  Same root cause: a negative `rotationalPeriod` yields a negative km/s, which then renders
  as e.g. "-12 km/s" or a negative fraction of c. Fix: use the magnitude of the period.  
  Pre-existing on `main` (not a regression):
  [src/app/system-body/system-body.component.ts:2481](src/app/system-body/system-body.component.ts#L2481).  
  **Review (2026-06-10): Confirmed.**
  [tangentialVelocityKms](src/app/data/stellar-physics.service.ts#L49) divides a positive
  circumference by `rotationalPeriodDays * SECONDS_PER_DAY`; a negative period yields a
  negative km/s. The caller at
  [system-body.component.ts:1089-1096](src/app/system-body/system-body.component.ts#L1089-L1096)
  only gates on the period being truthy and passes it through unmodified, so a retrograde
  rotator does render a negative speed. Using the magnitude of the period is the right fix.

- **`rocheExcess` compares against the semi-major axis, not periapsis** —
  [src/app/data/body-physics.service.ts:374](src/app/data/body-physics.service.ts#L374).
  A Roche breach is set by *closest approach* (periapsis), but this tests `semiMajorAxis`. A
  body on an eccentric orbit can read "safe" here yet dip inside the rigid limit at periapsis.
  Also inconsistent with `calculateBodyRocheLimits`, which deliberately exposes
  `periapsis`/`apoapsis` for exactly this comparison. Decide whether `rocheExcess` should use
  periapsis.  
  Pre-existing on `main` (not a regression):
  [src/app/system-body/system-body.component.ts:2979](src/app/system-body/system-body.component.ts#L2979).  
  **Review (2026-06-10): Confirmed.**
  [rocheExcess](src/app/data/body-physics.service.ts#L343) builds `semiMajorAxisM` from
  `semiMajorAxis` ([:374](src/app/data/body-physics.service.ts#L374)) and compares it to
  `rocheLimitM` ([:379](src/app/data/body-physics.service.ts#L379)). The physics is sound: a
  Roche breach is governed by periapsis (closest approach), so an eccentric orbit can read
  "safe" on the semi-major axis yet breach at periapsis. The Roche coefficient `1.26`
  (= 2^(1/3)) is the correct rigid-body value. The inconsistency is real:
  [calculateBodyRocheLimits](src/app/data/body-physics.service.ts#L202) deliberately exposes
  `periapsis`/`apoapsis` ([:228-229](src/app/data/body-physics.service.ts#L228-L229)).
  Switching `rocheExcess` to periapsis is the conservative (and self-consistent) choice.

## Approximations (document, not necessarily fix)

- **Trojan/Lagrange detection keys off `argOfPeriapsis` alone** —
  [src/app/data/orbital-relations.service.ts:63](src/app/data/orbital-relations.service.ts#L63).
  The true angular separation of co-orbital bodies is a difference in *mean longitude*
  (Ω + ω + M), not in argument-of-periapsis by itself. The ±60°/180° geometry is only correct
  when the co-orbital siblings also share the same ascending node and mean anomaly. It's a
  reasonable heuristic for ED's data, but it is an approximation rather than a rigorous L4/L5
  test — worth a code comment so it isn't mistaken for exact.  
  Pre-existing on `main` (not a regression):
  [src/app/system-body/system-body.component.ts:2702](src/app/system-body/system-body.component.ts#L2702).  
  **Review (2026-06-10): Confirmed.** `detectTrojanStatus` computes its ±60°/180° geometry
  purely from `argOfPeriapsis` differences
  ([orbital-relations.service.ts:73,83,87](src/app/data/orbital-relations.service.ts#L73)).
  The astronomy is right: the angular position of a body along a shared orbit is its mean
  longitude λ = Ω + ω + M (longitude of ascending node + argument of periapsis + mean
  anomaly), so ω alone only reproduces the true separation when the co-orbital siblings also
  share Ω and M. For ED's largely coplanar, near-circular co-orbital pairs this is a
  reasonable heuristic, but it is an approximation — a clarifying code comment is warranted.

## pgnames (vendored procedural-generation code)

- **`tryParse` rejects all `…AB-C d<n1>-<n2>` names** —
  [src/assets/pgnames/PGSystem.ts:251](src/assets/pgnames/PGSystem.ts#L251).
  The mid3 digit slice uses `substring(i + 1, vend - i + 1)` — a *length* passed where an
  *end index* is expected — so it slices garbage, `parseInt` → `NaN`, and the parse fails.
  Only names without the `-<n2>` suffix currently parse.  
  **Review (2026-06-10): Confirmed.** At
  [PGSystem.ts:251](src/assets/pgnames/PGSystem.ts#L251) the digits live at indices
  `[i+1 .. vend]`, so the correct call is `substring(i+1, vend+1)`. The code passes
  `vend - i + 1` as the *end* index; since `i > 8` always, that value is far smaller than
  `i+1`, so `String.prototype.substring` swaps the bounds and returns a slice from the
  region-name text. `parseInt` of that (a letter/space run) is `NaN`, and the branch returns
  `[false, sys]`. The existing spec at
  [pgnames.spec.ts:49-55](src/assets/pgnames/pgnames.spec.ts#L49-L55) pins this behaviour
  (`'Blae Eock kc-c d0-0'` → rejected). Names with the `-<n2>` suffix are all rejected.

- **`toModSystemAddress` is lossy (32-bit bitwise overflow)** —
  [src/assets/pgnames/PGSystem.ts:309](src/assets/pgnames/PGSystem.ts#L309).
  The result is assembled with JS bitwise (`|`, `<<`) operators, which are 32-bit, but
  fields are packed above bit 31 (size class, x2/y2/z2). Those bits are truncated, so the
  modulated-address round-trip does not preserve the original values.  
  **Review (2026-06-10): Confirmed.** At
  [PGSystem.ts:328-338](src/assets/pgnames/PGSystem.ts#L328-L338) the `result` is built with
  JS `|`/`<<`, which coerce to 32-bit signed integers and take the shift count mod 32. Shifts
  such as `szclass << 37`, `x2 << 40`, `y2 << 47`, `z2 << 53` therefore wrap (e.g. `<< 53`
  becomes `<< 21`) before the value is ever widened by `BigInt(...)` — the high fields are
  corrupted/truncated, so the round-trip is lossy. Note the *same* 32-bit bug also affects
  `toSystemAddress` ([:299-304](src/assets/pgnames/PGSystem.ts#L299-L304), shifts up to 44);
  it is just not separately flagged here. Behaviour is pinned by
  [pgnames.spec.ts:25-33](src/assets/pgnames/pgnames.spec.ts#L25-L33).

- **`fromSystemAddress` → `toSystemAddress` is not bit-identical** —
  [src/assets/pgnames/PGSystem.ts:287](src/assets/pgnames/PGSystem.ts#L287).
  Region origins are synthesized via `getSectorPos` for non-catalogued sectors, so
  re-encoding a decoded address does not reproduce the original `id64`.  
  Pre-existing on `main` (file byte-identical): `src/assets/pgnames/PGSystem.ts:287`.  
  **Review (2026-06-10): Confirmed, but the stated cause is only secondary.** The synthesis
  claim is true: for an uncatalogued sector, `getRegion` builds an origin from
  `getSectorPos` quantised to the 40960-unit boxel grid
  ([PGRegion.ts:513-523](src/assets/pgnames/PGRegion.ts#L513-L523)), which discards the
  original sub-sector offset, so `toSystemAddress` cannot reproduce the exact `id64`.
  However, the *dominant* reason the round-trip fails is that `toSystemAddress` itself uses
  the same 32-bit bitwise packing as `toModSystemAddress`
  ([PGSystem.ts:299-304](src/assets/pgnames/PGSystem.ts#L299-L304), shifts up to 44 wrap mod
  32) — so the encode is broken for *every* sector, catalogued or not, regardless of region
  synthesis. The conclusion (not bit-identical) is correct; the explanation should lead with
  the bitwise-overflow bug. Pinned (loosely) by
  [pgnames.spec.ts:18-23](src/assets/pgnames/pgnames.spec.ts#L18-L23), which only asserts the
  result is a positive bigint.

## Minor

- **`getBodyImagePath` ignores the `terraformable` flag** —
  [src/app/data/body-images.ts:1260](src/app/data/body-images.ts#L1260).
  The `terraformable` field on terrestrial entries is never used as a filter, so the first
  matching entry wins regardless of it (e.g. `AMWv2` catches all ammonia worlds).  
  Pre-existing on `main` (file byte-identical): `src/app/data/body-images.ts:1260`.  
  **Review (2026-06-10): Confirmed.** The terrestrial loop
  ([body-images.ts:1348-1386](src/app/data/body-images.ts#L1348-L1386)) filters on `subType`,
  `maxSurfaceTemperature`, `maxEarthMasses`, `atmosphere`, `landable`, `tidallyLocked` and
  `isApplicable` — but never reads `terraformable`, even though the field is declared on the
  interface ([:1413](src/app/data/body-images.ts#L1413)) and set on entries such as `AMWv2`
  ([:690-692](src/app/data/body-images.ts#L690-L692)). Since `AMWv2` is the first
  `"Ammonia world"` entry and carries no other constraints, it matches every ammonia world
  and shadows later variants (e.g. `AMWv3`) regardless of terraformable state. Note this only
  bites if the body data actually carries a terraformable flag to filter on; the field's
  intent is clearly unrealised either way.
