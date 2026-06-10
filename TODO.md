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
