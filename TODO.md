# TODO — Flagged issues (not yet addressed)

Recorded 2026-06-10. These were surfaced during the astronomy/physics review and
the test-coverage work on the `upgrade` branch. None have been fixed.

**Regression check (`upgrade` vs `main`): all of the issues below pre-date this branch
— none are regressions.** `PGSystem.ts` and `body-images.ts` are byte-identical to
`main` (`git diff main upgrade` is empty). `body-physics.service.ts` is new, but the
`1e12` megatonne constant was copied verbatim from `main`'s
`system-body.component.ts` (`parent.mass * 1e12; // Mt to kg`) during the extraction.

## Physics / source

- [ ] **`KG_PER_MEGATONNE = 1e12` looks ~1000× too large** —
  [src/app/data/body-physics.service.ts:10](src/app/data/body-physics.service.ts#L10).
  A megatonne is 10⁶ tonnes = 10⁹ kg, so `1e12` is actually a gigatonne. Used only in
  the `parent.mass` branch of `primaryDensityKgM3`, which is effectively unreachable for
  real parents (stars carry `solarMasses`, planets carry `earthMasses`), so practical
  impact is near-zero — but the constant is wrong as named. Confirm the data source's
  unit for `mass` before changing.  
  Pre-existing on `main` (copied during extraction):
  [src/app/system-body/system-body.component.ts:1019](src/app/system-body/system-body.component.ts#L1019)
  and [:1080](src/app/system-body/system-body.component.ts#L1080) (`parent.mass * 1e12; // Mt to kg`).

- [ ] **`spinResonance` silently fails for retrograde rotators** —
  [src/app/data/stellar-physics.service.ts:29](src/app/data/stellar-physics.service.ts#L29).
  Elite stores retrograde rotation as a *negative* `rotationalPeriod`, so
  `rotationsPerOrbit = orbitalPeriod / rotationalPeriod` goes negative while every
  `candidate = num/denom` is positive — no match is ever found and the result is `'none'`.
  A retrograde tidally-locked (1:1) body is missed. Note the adjacent solar-day code
  *does* `Math.abs` its periods ([system-body.component.ts:1557](src/app/system-body/system-body.component.ts#L1557)),
  so the two disagree. Fix: take `Math.abs` of both periods.  
  Pre-existing on `main` (logic extracted from `SystemBodyComponent`, not a regression):
  [src/app/system-body/system-body.component.ts:2428](src/app/system-body/system-body.component.ts#L2428).

- [ ] **`tangentialVelocityKms` returns a negative velocity for retrograde spinners** —
  [src/app/data/stellar-physics.service.ts:49](src/app/data/stellar-physics.service.ts#L49).
  Same root cause: a negative `rotationalPeriod` yields a negative km/s, which then renders
  as e.g. "-12 km/s" or a negative fraction of c. Fix: use the magnitude of the period.  
  Pre-existing on `main` (not a regression):
  [src/app/system-body/system-body.component.ts:2481](src/app/system-body/system-body.component.ts#L2481).

- [ ] **`rocheExcess` compares against the semi-major axis, not periapsis** —
  [src/app/data/body-physics.service.ts:374](src/app/data/body-physics.service.ts#L374).
  A Roche breach is set by *closest approach* (periapsis), but this tests `semiMajorAxis`. A
  body on an eccentric orbit can read "safe" here yet dip inside the rigid limit at periapsis.
  Also inconsistent with `calculateBodyRocheLimits`, which deliberately exposes
  `periapsis`/`apoapsis` for exactly this comparison. Decide whether `rocheExcess` should use
  periapsis.  
  Pre-existing on `main` (not a regression):
  [src/app/system-body/system-body.component.ts:2979](src/app/system-body/system-body.component.ts#L2979).

## Approximations (document, not necessarily fix)

- [ ] **Trojan/Lagrange detection keys off `argOfPeriapsis` alone** —
  [src/app/data/orbital-relations.service.ts:63](src/app/data/orbital-relations.service.ts#L63).
  The true angular separation of co-orbital bodies is a difference in *mean longitude*
  (Ω + ω + M), not in argument-of-periapsis by itself. The ±60°/180° geometry is only correct
  when the co-orbital siblings also share the same ascending node and mean anomaly. It's a
  reasonable heuristic for ED's data, but it is an approximation rather than a rigorous L4/L5
  test — worth a code comment so it isn't mistaken for exact.  
  Pre-existing on `main` (not a regression):
  [src/app/system-body/system-body.component.ts:2702](src/app/system-body/system-body.component.ts#L2702).

## pgnames (vendored procedural-generation code)

- [ ] **`tryParse` rejects all `…AB-C d<n1>-<n2>` names** —
  [src/assets/pgnames/PGSystem.ts:251](src/assets/pgnames/PGSystem.ts#L251).
  The mid3 digit slice uses `substring(i + 1, vend - i + 1)` — a *length* passed where an
  *end index* is expected — so it slices garbage, `parseInt` → `NaN`, and the parse fails.
  Only names without the `-<n2>` suffix currently parse.  
  Pre-existing on `main` (file byte-identical): `src/assets/pgnames/PGSystem.ts:251`.

- [ ] **`toModSystemAddress` is lossy (32-bit bitwise overflow)** —
  [src/assets/pgnames/PGSystem.ts:309](src/assets/pgnames/PGSystem.ts#L309).
  The result is assembled with JS bitwise (`|`, `<<`) operators, which are 32-bit, but
  fields are packed above bit 31 (size class, x2/y2/z2). Those bits are truncated, so the
  modulated-address round-trip does not preserve the original values.  
  Pre-existing on `main` (file byte-identical): `src/assets/pgnames/PGSystem.ts:309`.

- [ ] **`fromSystemAddress` → `toSystemAddress` is not bit-identical** —
  [src/assets/pgnames/PGSystem.ts:287](src/assets/pgnames/PGSystem.ts#L287).
  Region origins are synthesized via `getSectorPos` for non-catalogued sectors, so
  re-encoding a decoded address does not reproduce the original `id64`.  
  Pre-existing on `main` (file byte-identical): `src/assets/pgnames/PGSystem.ts:287`.

## Minor

- [ ] **`getBodyImagePath` ignores the `terraformable` flag** —
  [src/app/data/body-images.ts:1260](src/app/data/body-images.ts#L1260).
  The `terraformable` field on terrestrial entries is never used as a filter, so the first
  matching entry wins regardless of it (e.g. `AMWv2` catches all ammonia worlds).  
  Pre-existing on `main` (file byte-identical): `src/app/data/body-images.ts:1260`.
