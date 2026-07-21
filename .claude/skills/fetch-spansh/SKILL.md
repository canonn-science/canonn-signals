---
name: fetch-spansh
description: Fetch Elite Dangerous data from the Spansh API. Two modes — `fetch` pulls a whole system's body/station dump by name or id64 (to create/refresh an e2e fixture in e2e/fixtures/, inspect a body's real values when debugging the renderer, or check what Spansh serves); `search` finds individual bodies anywhere in the galaxy by their properties (subtype, gravity, temperature, mass, landability, …) ranked by distance from a reference system. Spansh dumps share the exact {"system":{...}} shape the app consumes and the fixtures store.
---

# Fetch Spansh data

[fetch_spansh.py](fetch_spansh.py) talks to Spansh (`https://spansh.co.uk/api`), which
ingests EDDN and is the upstream source behind the Canonn biostats endpoint the app calls.
It has two modes: **`fetch`** (a whole system's dump) and **`search`** (find bodies by
property). Stdlib Python only — no install. Paths below assume you run from the skill dir.

## `fetch` — whole-system dump

A system dump is in the same `{"system": {bodies, stations, coordinates, ...}}` shape as
every `e2e/fixtures/*.json`, so `fetch` is both an inspection tool and the fixture generator.
`fetch` is the default mode, so the system can be the first argument.

```bash
# Inspect a system on stdout, re-formatted to match the fixtures
python3 fetch_spansh.py Sol

# Already have the id64? Skip name resolution
python3 fetch_spansh.py 10477373803

# Save a new/refreshed e2e fixture (give a path relative to your cwd)
python3 fetch_spansh.py "Alpha Centauri" --out e2e/fixtures/alpha-centauri.json

# Pass through Spansh's exact bytes, unformatted
python3 fetch_spansh.py Sol --raw
```

A bare name is resolved to an id64 via Spansh's typeahead, preferring an exact
(case-insensitive) match; an ambiguous or missing name exits with candidates so you can
retry with the right one or a numeric id64.

## `search` — find bodies by property

`search` is `POST /api/bodies/search`: it ranks bodies **by distance from a reference
system** (`--near`, default Sol) and filters them by their properties. Each result carries
`system_name` and `system_id64` (distinct from the body's own `id64`), so a hit feeds
straight back into `fetch system_id64` — or `fetch "<system_name>"` — to get the dump.

```bash
# Nearest Earth-like worlds to Sol, within 100 ly
python3 fetch_spansh.py search --type "Earth-like world" --within 100

# Landable high-metal worlds under 0.3 g within 50 ly of Merope
python3 fetch_spansh.py search --near Merope --type "High metal content world" \
    --landable --range gravity 0 0.3

# Very hot bodies (>1000 K) near Sol — '_' is an open upper bound — as raw JSON
python3 fetch_spansh.py search --range surface_temperature 1000 _ --within 50 --json
```

| Flag | Filter |
|------|--------|
| `--near SYSTEM` | Reference system distances are measured from (default `Sol`). |
| `--within LY` | Max distance in ly from `--near`. |
| `--type SUBTYPE` | Body subtype, exact Spansh string. Repeatable (matches any). |
| `--landable` | Landable bodies only. |
| `--range FIELD MIN MAX` | Numeric field between MIN and MAX inclusive. `_` = open bound. Repeatable. |
| `--size N` | Max results (default 15). |
| `--farthest` | Rank by farthest instead of nearest. |
| `--json` | Emit raw result objects instead of the summary table. |

Filters combine with AND. By default it prints a distance-ranked summary table to stderr;
`--json` emits the full result objects on stdout.

**`--type` must match a real Spansh subtype string** (e.g. `Water world`, `Class III gas
giant`, `K (Yellow-Orange) Star`). Get the full list — with galaxy-wide counts — from
`GET /api/bodies/field_values/subtype`.

**`--range FIELD` is validated against a whitelist** because Spansh *silently ignores* an
unknown filter key and returns unconstrained results — so a typo (`temperature` for
`surface_temperature`, `mass` for `earth_masses`) would otherwise look like it worked while
returning the wrong bodies. The script errors and lists the valid fields instead. Each
whitelisted field was verified to actually constrain results; searchable fields are:
`earth_masses`, `gravity`, `surface_temperature`, `surface_pressure`, `radius`,
`distance_to_arrival`, `signal_count`, `orbital_period`, `orbital_eccentricity`,
`orbital_inclination`, `semi_major_axis`, `rotational_period`, `axis_tilt`,
`arg_of_periapsis`, `estimated_scan_value`, `estimated_mapping_value`, and the star fields
`solar_masses`, `solar_radius`, `age`. (`is_landable` is a boolean handled by `--landable`;
its filter always means landable-only regardless of value.)

## Creating an e2e fixture

The deterministic Playwright specs stub the network and serve a saved dump from
`e2e/fixtures/` (see [e2e/support/system-fixture.ts](../../../e2e/support/system-fixture.ts)).
To add coverage for a real system:

1. `python3 .claude/skills/fetch-spansh/fetch_spansh.py "<System Name>" --out e2e/fixtures/<slug>.json`
   (run from the repo root so the `--out` path lands correctly).
2. Point a spec at it via `loadFixtureSystem(page, { fixture: '<slug>.json', systemName, id64 })`.

`--out` writes sorted keys, 2-space indent, and the trailing-space item separator Spansh's
own serializer emits, so a generated fixture is byte-consistent with the existing ones and
won't churn the diff. Don't hand-edit the JSON afterward unless you mean to.

## Notes

- A system that's too recently discovered may not be in Spansh yet — the script reports
  this rather than writing an empty fixture. Try again later.
- Endpoints used: `GET /api/systems/field_values/system_names?q=` (name→id64),
  `GET /api/dump/{id64}` (the system dump), and `POST /api/bodies/search` (`search` mode).
  `GET /api/bodies/field_values/subtype` gives the full set of body subtype strings (used by
  [white-dwarf.spec.ts](../../../src/app/data/white-dwarf.spec.ts) and by `--type`).
- `search` reports `count` capped at 10000; a `(capped)` note appears when the real total is
  at or above that. Narrow with `--within` / `--range` to see a true count.
