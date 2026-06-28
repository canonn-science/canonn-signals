#!/usr/bin/env python3
"""Fetch Elite Dangerous data from Spansh (https://spansh.co.uk).

Two modes:

  fetch   Download a whole system's dump by name or id64. Spansh ingests EDDN and
          exposes a per-system "dump" in the same `{"system": {bodies, stations, ...}}`
          shape this app receives from Canonn's biostats endpoint — the exact shape every
          file in `e2e/fixtures/` is stored in. So `fetch ... --out e2e/fixtures/x.json`
          is the fixture generator.

  search  Find individual bodies anywhere in the galaxy by their properties (subtype,
          gravity, temperature, mass, ...) ranked by distance from a reference system.
          This is Spansh's `POST /api/bodies/search`. Every result carries its system
          name + id64, so a hit can be fed straight back into `fetch` to get its dump.

`fetch` is the default mode, so `fetch_spansh.py Sol` still works.
Stdlib only (urllib + json); no install step.

Examples:
  # Whole-system dump on stdout (re-formatted to match the fixtures)
  python3 fetch_spansh.py Sol

  # Save a new e2e fixture (resolves the name to an id64 first)
  python3 fetch_spansh.py "Alpha Centauri" --out e2e/fixtures/alpha-centauri.json

  # Find the nearest Earth-like worlds to Sol
  python3 fetch_spansh.py search --type "Earth-like world" --within 100

  # Landable high-g rocky bodies near Merope, hot ones only, as JSON
  python3 fetch_spansh.py search --near Merope --type "Rocky body" --landable \
      --range gravity 2 _ --range surface_temperature 500 _ --json
"""

import argparse
import json
import sys
import urllib.parse
import urllib.request

API = "https://spansh.co.uk/api"
TIMEOUT = 30

# An open bound in `--range FIELD MIN MAX`: passes through as a value far outside any real
# range, so Spansh's between-comparison effectively becomes one-sided (its own `<`/`>`
# operators don't behave, but `<=>` against a huge bound does).
OPEN = "_"
NEG_INF, POS_INF = -1e30, 1e30

# Numeric body fields Spansh actually filters on, each verified to constrain results (see
# SKILL.md). This is a hard whitelist on purpose: Spansh *silently ignores* an unknown
# filter key and returns unconstrained results, so a typo like `temperature` (it's
# `surface_temperature`) or `mass` (`earth_masses`) would look like it worked but quietly
# return the wrong bodies. Rejecting unknown fields up front turns that trap into an error.
SEARCHABLE_NUMERIC = {
    "earth_masses", "gravity", "surface_temperature", "surface_pressure", "radius",
    "distance_to_arrival", "signal_count",
    "orbital_period", "orbital_eccentricity", "orbital_inclination", "semi_major_axis",
    "rotational_period", "axis_tilt", "arg_of_periapsis",
    "estimated_scan_value", "estimated_mapping_value",
    "solar_masses", "solar_radius", "age",  # stars
}


def _get(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": "canonn-signals/fetch-spansh"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return json.load(resp)


def _post(path: str, payload: dict):
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{API}/{path}",
        data=body,
        headers={"Content-Type": "application/json", "User-Agent": "canonn-signals/fetch-spansh"},
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return json.load(resp)


# --------------------------------------------------------------------------- fetch mode

def resolve_id64(name: str) -> int:
    """Resolve a system name to its id64 via Spansh's typeahead, preferring an exact
    (case-insensitive) name match and erroring with candidates when it's ambiguous."""
    url = f"{API}/systems/field_values/system_names?q={urllib.parse.quote(name)}"
    matches = _get(url).get("min_max", [])
    if not matches:
        sys.exit(f"No Spansh system matches '{name}'.")
    exact = [m for m in matches if m["name"].lower() == name.lower()]
    if len(exact) == 1:
        return exact[0]["id64"]
    if len(exact) > 1:
        sys.exit(f"'{name}' is ambiguous on Spansh: {[m['id64'] for m in exact]}")
    names = ", ".join(m["name"] for m in matches[:10])
    sys.exit(f"No exact match for '{name}'. Did you mean one of: {names}?")


def fetch_dump(id64: int):
    dump = _get(f"{API}/dump/{id64}")
    if not dump or not dump.get("system"):
        sys.exit(f"Spansh has no dump for id64 {id64} (system may be too new — try again later).")
    return dump


def format_fixture(dump) -> str:
    """Serialise exactly like the existing `e2e/fixtures/*.json` (sorted keys, 2-space
    indent, the trailing-space item separator Spansh's own serializer emits)."""
    return json.dumps(dump, indent=2, separators=(", ", ": "), sort_keys=True)


def run_fetch(args) -> None:
    id64 = int(args.system) if args.system.isdigit() else resolve_id64(args.system)
    dump = fetch_dump(id64)
    text = json.dumps(dump) if args.raw else format_fixture(dump)

    if args.out:
        with open(args.out, "w") as f:
            f.write(text + "\n")
        name = dump["system"].get("name", id64)
        print(f"Wrote {name} (id64 {id64}) → {args.out}", file=sys.stderr)
    else:
        print(text)


# -------------------------------------------------------------------------- search mode
#
# Filter grammar (each verified empirically against the live API — see SKILL.md):
#   distance   {"min": "0", "max": "100"}            ly from reference_system
#   enum/value {"value": ["Earth-like world", ...]}  exact string match, OR within the list
#   numeric    {"comparison": "<=>", "value": [a,b]} between a and b inclusive
#   landable   {"value": ["Y"]}                       presence ⇒ landable-only (value ignored)

def build_filters(args) -> dict:
    filters = {}
    if args.within is not None:
        filters["distance"] = {"min": "0", "max": str(args.within)}
    if args.type:
        filters["subtype"] = {"value": args.type}
    if args.landable:
        filters["is_landable"] = {"value": ["Y"]}
    for field, lo, hi in args.range or []:
        if field not in SEARCHABLE_NUMERIC:
            sys.exit(
                f"'{field}' isn't a searchable numeric field (Spansh would silently ignore it).\n"
                f"Known fields: {', '.join(sorted(SEARCHABLE_NUMERIC))}"
            )
        lo_v = NEG_INF if lo == OPEN else float(lo)
        hi_v = POS_INF if hi == OPEN else float(hi)
        filters[field] = {"comparison": "<=>", "value": [lo_v, hi_v]}
    return filters


def run_search(args) -> None:
    payload = {
        "filters": build_filters(args),
        "sort": [{"distance": {"direction": "desc" if args.farthest else "asc"}}],
        "size": args.size,
        "page": 0,
        "reference_system": args.near,
    }
    resp = _post("bodies/search", payload)
    if "error" in resp:
        sys.exit(f"Spansh rejected the search: {resp['error']}. Filters: {payload['filters']}")
    results = resp.get("results", [])

    if args.json:
        print(json.dumps(results, indent=2))
        return

    ref = resp.get("reference", {}).get("name", args.near)
    total = resp.get("count", len(results))
    capped = " (capped)" if total >= 10000 else ""
    print(f"{len(results)} of ~{total}{capped} bodies, by distance from {ref}:", file=sys.stderr)
    if not results:
        return
    for b in results:
        bits = [f"{b.get('distance', 0):8.1f} ly", f"{b.get('name', '?'):<28}", b.get("subtype", "?")]
        if b.get("gravity") is not None:
            bits.append(f"g={b['gravity']:.2f}")
        if b.get("surface_temperature") is not None:
            bits.append(f"{b['surface_temperature']:.0f}K")
        if b.get("is_landable"):
            bits.append("landable")
        print("  " + "  ".join(bits))


# --------------------------------------------------------------------------------- main

def main() -> None:
    ap = argparse.ArgumentParser(description="Fetch Elite Dangerous data from Spansh.")
    sub = ap.add_subparsers(dest="mode")

    s = sub.add_parser("search", help="Find bodies by property, ranked by distance.")
    s.add_argument("--near", default="Sol", help="Reference system to measure distance from (default: Sol).")
    s.add_argument("--within", type=float, help="Max distance in ly from --near.")
    s.add_argument("--type", action="append", metavar="SUBTYPE",
                   help="Body subtype, e.g. 'Earth-like world'. Repeatable (matches any).")
    s.add_argument("--landable", action="store_true", help="Landable bodies only.")
    s.add_argument("--range", action="append", nargs=3, metavar=("FIELD", "MIN", "MAX"),
                   help=f"Numeric field between MIN and MAX (e.g. gravity 0 1). Use '{OPEN}' for an open bound. Repeatable.")
    s.add_argument("--size", type=int, default=15, help="Max results (default: 15).")
    s.add_argument("--farthest", action="store_true", help="Sort by farthest instead of nearest.")
    s.add_argument("--json", action="store_true", help="Emit raw result objects as JSON.")
    s.set_defaults(func=run_search)

    f = sub.add_parser("fetch", help="Download a whole system's dump.")
    f.add_argument("system", help="System name (resolved via typeahead) or a numeric id64.")
    f.add_argument("--out", help="Write to this file instead of stdout (e.g. e2e/fixtures/foo.json).")
    f.add_argument("--raw", action="store_true", help="Emit Spansh's exact bytes, unformatted.")
    f.set_defaults(func=run_fetch)

    # `fetch` is the default mode: if the first token isn't a known subcommand, treat the
    # invocation as `fetch <system> ...` so `fetch_spansh.py Sol` keeps working.
    argv = sys.argv[1:]
    if argv and argv[0] not in ("search", "fetch", "-h", "--help"):
        argv = ["fetch"] + argv

    args = ap.parse_args(argv)
    if not getattr(args, "func", None):
        ap.print_help()
        sys.exit(2)
    args.func(args)


if __name__ == "__main__":
    main()
