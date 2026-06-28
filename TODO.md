# TODO — Flagged issues (not yet addressed)

These were surfaced during the astronomy/physics review and the test-coverage work on
the `upgrade` branch. None have been fixed, and none are regressions — the logic was
extracted verbatim from `SystemBodyComponent` into the data services, so each bug
pre-dates this branch.

## Physics / source

- **`KG_PER_MEGATONNE = 1e12` is 1000× too large** —
  [body-physics.service.ts:10](src/app/data/body-physics.service.ts#L10).
  A megatonne is 10⁶ t = 10⁹ kg, so `1e12` is a gigatonne. Used only in the `parent.mass`
  branch of `primaryDensityKgM3` ([:80](src/app/data/body-physics.service.ts#L80)), which is
  unreachable for real parents — the `earthMasses` ([:76](src/app/data/body-physics.service.ts#L76))
  and `solarMasses` ([:82](src/app/data/body-physics.service.ts#L82)) branches are tried first
  and the bare `mass` field is not populated for real stars/planets. Practical impact is
  near-zero, but the constant is wrong as named. Confirm the data source's unit for `mass`
  before changing.

- **`spinResonance` silently fails for retrograde rotators** —
  [stellar-physics.service.ts:29](src/app/data/stellar-physics.service.ts#L29).
  Elite stores retrograde rotation as a negative `rotationalPeriod`, so
  `rotationsPerOrbit = orbitalPeriod / rotationalPeriod`
  ([:32](src/app/data/stellar-physics.service.ts#L32)) goes negative while every
  `candidate = num / denom` ([:38](src/app/data/stellar-physics.service.ts#L38)) is strictly
  positive — no match is ever found and the result is `'none'`, so a retrograde tidally-locked
  (1:1) body is missed. The adjacent solar-day code at
  [system-body.component.ts:1303-1306](src/app/system-body/system-body.component.ts#L1303-L1306)
  already `Math.abs`-es both periods, so the two disagree. Fix: take `Math.abs` of both periods.

- **`classifyNeutronStar` mislabels retrograde neutron stars as "Millisecond Pulsar"** —
  [stellar-physics.service.ts:104](src/app/data/stellar-physics.service.ts#L104).
  Same root cause: `period = rotationalPeriodDays * SECONDS_PER_DAY`
  ([:115](src/app/data/stellar-physics.service.ts#L115)) has no `Math.abs`, so a negative
  period satisfies the first branch `period < 0.01`
  ([:118](src/app/data/stellar-physics.service.ts#L118)) — any retrograde neutron star,
  however slowly it spins, is labelled "Millisecond Pulsar" (or "Hyper-Massive Millisecond
  Pulsar"). Fix: take `Math.abs` of the period.

- **`rocheExcess` compares against the semi-major axis, not periapsis** —
  [body-physics.service.ts:354](src/app/data/body-physics.service.ts#L354).
  A Roche breach is set by closest approach (periapsis), but `semiMajorAxisM`
  ([:385](src/app/data/body-physics.service.ts#L385)) is compared to `rocheLimitM`
  ([:388-390](src/app/data/body-physics.service.ts#L388-L390)). A body on an eccentric orbit
  can read "safe" here yet dip inside the rigid limit at periapsis. Inconsistent with
  `calculateBodyRocheLimits` ([:202](src/app/data/body-physics.service.ts#L202)), which already
  exposes `periapsis`/`apoapsis` ([:228-229](src/app/data/body-physics.service.ts#L228-L229))
  for exactly this comparison. Fix: use periapsis. (The `1.26` coefficient = 2^(1/3) is the
  correct rigid-body value.)

## Approximations (document, not necessarily fix)

- **Trojan/Lagrange detection keys off `argOfPeriapsis` alone** —
  [orbital-relations.service.ts:56](src/app/data/orbital-relations.service.ts#L56).
  `detectTrojanStatus` computes its ±60°/180° geometry purely from `argOfPeriapsis`
  differences ([:73](src/app/data/orbital-relations.service.ts#L73),
  [:83](src/app/data/orbital-relations.service.ts#L83),
  [:87](src/app/data/orbital-relations.service.ts#L87)). The true angular position of a
  co-orbital body is its mean longitude λ = Ω + ω + M, so ω alone is only correct when the
  siblings also share the ascending node Ω and mean anomaly M. A reasonable heuristic for
  ED's largely coplanar, near-circular pairs, but an approximation — worth a clarifying code
  comment so it isn't mistaken for an exact L4/L5 test.

## pgnames (vendored procedural-generation code)

- **`tryParse` rejects all `…AB-C d<n1>-<n2>` names** —
  [PGSystem.ts:251](src/app/data/pgnames/PGSystem.ts#L251).
  The mid3 digit slice uses `substring(i + 1, vend - i + 1)` — a *length* passed where an
  *end index* is expected. The digits live at `[i+1 .. vend]`, so the correct call is
  `substring(i + 1, vend + 1)`. Since `i > 8` always, `vend - i + 1` is smaller than `i + 1`,
  so `substring` swaps the bounds and returns a slice of the region-name text; `parseInt` → `NaN`
  and the parse fails. Only names without the `-<n2>` suffix currently parse. Behaviour pinned
  by [pgnames.spec.ts:49-55](src/app/data/pgnames/pgnames.spec.ts#L49-L55)
  (`'Blae Eock kc-c d0-0'` → rejected).

- **`toModSystemAddress` is lossy (32-bit bitwise overflow)** —
  [PGSystem.ts:309](src/app/data/pgnames/PGSystem.ts#L309).
  The result is assembled with JS `|`/`<<`
  ([:330-336](src/app/data/pgnames/PGSystem.ts#L330-L336)), which coerce to 32-bit signed
  integers and take the shift count mod 32. Shifts packed above bit 31 — `szclass << 37`,
  `x2 << 40`, `y2 << 47`, `z2 << 53` — wrap (e.g. `<< 53` becomes `<< 21`) before the value is
  widened by `BigInt(...)`, so the high fields are truncated and the round-trip is lossy.
  Behaviour pinned by [pgnames.spec.ts:25-33](src/app/data/pgnames/pgnames.spec.ts#L25-L33).

- **`fromSystemAddress` → `toSystemAddress` is not bit-identical** —
  [PGSystem.ts:287](src/app/data/pgnames/PGSystem.ts#L287).
  Two causes. The dominant one is the same 32-bit bitwise packing as `toModSystemAddress`:
  `toSystemAddress` shifts up to 44 ([:301-304](src/app/data/pgnames/PGSystem.ts#L301-L304))
  wrap mod 32, so the encode is broken for every sector. Secondarily, for an uncatalogued
  sector `getRegion` synthesises the origin from `getSectorPos` quantised to the 40960-unit
  boxel grid ([PGRegion.ts:514-522](src/app/data/pgnames/PGRegion.ts#L514-L522)), discarding the
  original sub-sector offset. Loosely pinned by
  [pgnames.spec.ts:18-23](src/app/data/pgnames/pgnames.spec.ts#L18-L23), which only asserts a
  positive bigint result.
