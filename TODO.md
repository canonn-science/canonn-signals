# TODO — Flagged issues (not yet addressed)

These were surfaced during the astronomy/physics review and the test-coverage work on
the `upgrade` branch. None are regressions — the logic was extracted verbatim from
`SystemBodyComponent` into the data services, so each bug pre-dates this branch.

## Physics / source


- **Trojan L4/L5 labels appear swapped** —
  [orbital-relations.service.ts:248](src/app/data/orbital-relations.service.ts#L248).
  `detectTrojanStatus` labels a co-orbital sibling with argOfPeriapsis **+60°**
  relative to the host as **L4 (leading)** (`relativePos > 0 ? 'L4' : 'L5'`). But the
  module's own ED/Spansh angle convention negates both angles before propagation
  ([:543](src/app/data/orbital-relations.service.ts#L543)), under which a **+Δω** sibling
  sits 60° **behind** the host in the direction of motion — i.e. **L5**, not L4. A review
  derived this numerically and cross-checked the negation convention against the
  Elite-Observatory-confirmed Col 285 Sector GA-S b19-0 8 a/b contact. If correct, every
  L4 badge should read L5 and vice versa, and `lagrangeConfiguration` fills the diagram's
  L4/L5 slots inverted. **The specs enshrine the current (suspected-wrong) labels**, so the
  fix is `detectTrojanStatus` **plus** its spec pins. **Confirm against the game/an orrery
  first** (e.g. which body leads in Pro Eurl JF-A d88 B 2 / B 3) before flipping — this is
  flagged, not yet fixed.
