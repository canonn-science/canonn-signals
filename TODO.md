# TODO — Flagged issues (not yet addressed)

These were surfaced during the astronomy/physics review and the test-coverage work on
the `upgrade` branch. None are regressions — the logic was extracted verbatim from
`SystemBodyComponent` into the data services, so each bug pre-dates this branch.

## Physics / source


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
