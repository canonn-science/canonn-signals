#!/usr/bin/env python3
"""
find_lagrange_systems.py

Scans a Spansh galaxy.json.gz dump for star systems that contain co-orbital bodies
at Lagrange points (L1–L5), using the same detection logic as the canonn-signals app
(src/app/data/orbital-relations.service.ts).

Usage:
    python find_lagrange_systems.py <path/to/galaxy.json.gz> [output.csv]

The galaxy dump is expected to be a JSON array with one system object per line:
    [
    {"name": "Sol", "bodies": [...], ...},
    {"name": "Alpha Centauri", "bodies": [...], ...},
    ...
    ]

The output CSV has columns:  systemName, L1, L2, L3, L4, L5
"""

import gzip
import csv
import sys
import os
from math import fabs

try:
    import orjson as json
except ImportError:
    import json


# ── Tolerances (mirrored from orbital-relations.service.ts) ─────────────────
ANGLE_TOLERANCE_DEG = 1.0        # L3 / L4 / L5 angular match
ALIGNMENT_TOLERANCE_DEG = 5.0   # L1 / L2 arg-of-periapsis + ascending-node alignment


# ── Streaming system reader (same approach as ringspeed.py) ─────────────────

def iter_systems(path: str):
    """Yield one parsed system dict at a time from a galaxy.json.gz dump."""
    with gzip.open(path, "rt", encoding="utf-8", errors="ignore") as f:
        first = True
        for raw_line in f:
            line = raw_line.strip()
            if not line:
                continue
            if first:
                first = False
                if line == "[":
                    continue
                if line.startswith("["):
                    line = line[1:].lstrip()
            if line == "]":
                break
            if line.endswith(","):
                line = line[:-1]
            if line.endswith("]"):
                line = line[:-1].rstrip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except Exception:
                continue


# ── Angle helpers ────────────────────────────────────────────────────────────

def signed_angle_diff(a: float, b: float) -> float:
    """Signed angular difference a − b, normalised to (−180, 180]."""
    return ((a - b + 540.0) % 360.0) - 180.0


def normalised_abs_diff(a: float, b: float) -> float:
    """Absolute angular difference, normalised to [0, 180]."""
    d = fabs(a - b) % 360.0
    return min(d, 360.0 - d)


# ── Parent-key helpers ───────────────────────────────────────────────────────

def immediate_parent_key(body: dict) -> tuple[str, int] | None:
    """
    Returns (parent_type, parent_bodyId) for the body's immediate parent,
    or None when the body has no parents entry.

    The Spansh 'parents' field is a list of single-key dicts like:
        [{"Star": 2}, {"Null": 0}]
    The *first* element is the immediate parent.
    """
    parents = body.get("parents")
    if not parents:
        return None
    first = parents[0]
    # first is a dict with exactly one key: the parent type
    for ptype, pid in first.items():
        return (ptype, pid)
    return None


# ── Lagrange detection (per-system) ─────────────────────────────────────────

def detect_lagrange_points(system: dict) -> dict[str, list[str]]:
    """
    Returns a dict {L1: [...], L2: [...], L3: [...], L4: [...], L5: [...]} mapping
    each Lagrange point to the list of body names occupying it (empty = none found).
    """
    bodies: list[dict] = system.get("bodies", [])

    # Map bodyId → body for quick parent-type look-up.
    by_id: dict[int, dict] = {b["bodyId"]: b for b in bodies if "bodyId" in b}

    # Group bodies by their immediate parent key.
    # Key: (parent_type, parent_bodyId) → list of body dicts
    parent_groups: dict[tuple, list[dict]] = {}
    for body in bodies:
        pk = immediate_parent_key(body)
        if pk is None:
            continue
        parent_groups.setdefault(pk, []).append(body)

    found: dict[str, list[str]] = {lp: [] for lp in ("L1", "L2", "L3", "L4", "L5")}

    for (ptype, pid), siblings in parent_groups.items():
        # Lagrange points require a massive body as the primary — skip barycentres.
        if ptype == "Null":
            continue
        # Classify each body in this sibling group.
        for body in siblings:
            lp = _classify_body(body, siblings)
            bname = body.get("name", str(body.get("bodyId", "?")))
            if lp is not None:
                found[lp].append(bname)
            # A host body (has occupants at both L4 and L5) contributes both.
            if _is_host(body, siblings):
                if bname not in found["L4"]:
                    found["L4"].append(bname)
                if bname not in found["L5"]:
                    found["L5"].append(bname)

        # L1/L2 detection (different SMA, same period, aligned arg + node).
        for body in siblings:
            lp = _classify_l1_l2(body, siblings)
            if lp is not None:
                bname = body.get("name", str(body.get("bodyId", "?")))
                found[lp].append(bname)

    return found


def _has_required_fields(body: dict) -> bool:
    return (
        body.get("orbitalPeriod") is not None
        and body.get("semiMajorAxis") is not None
        and body.get("argOfPeriapsis") is not None
    )


def _same_sma_siblings(body: dict, siblings: list[dict]) -> list[dict]:
    """Co-orbital siblings with the same period AND semi-major axis."""
    return [
        s for s in siblings
        if s is not body
        and s.get("orbitalPeriod") == body.get("orbitalPeriod")
        and s.get("semiMajorAxis") == body.get("semiMajorAxis")
        and s.get("argOfPeriapsis") is not None
    ]


def _is_host(body: dict, siblings: list[dict]) -> bool:
    """
    True when body has a co-orbital neighbour at ~+60° AND one at ~−60°,
    making it the reference body (host) of a Trojan pair.
    """
    if not _has_required_fields(body):
        return False
    arg = body["argOfPeriapsis"]
    has_leading = False
    has_trailing = False
    for s in _same_sma_siblings(body, siblings):
        diff = signed_angle_diff(s["argOfPeriapsis"], arg)
        if fabs(diff - 60.0) < ANGLE_TOLERANCE_DEG:
            has_leading = True
        if fabs(diff + 60.0) < ANGLE_TOLERANCE_DEG:
            has_trailing = True
    return has_leading and has_trailing


def _classify_body(body: dict, siblings: list[dict]) -> str | None:
    """
    Returns 'L3', 'L4', or 'L5' when body occupies that point relative to a
    sibling, or None when it is not a Trojan/L3 body (or is a host).
    Mirrors OrbitalRelationsService.detectTrojanStatus.
    """
    if not _has_required_fields(body):
        return None
    # A host is not itself labelled a Lagrange occupant.
    if _is_host(body, siblings):
        return None

    arg = body["argOfPeriapsis"]
    for s in _same_sma_siblings(body, siblings):
        norm_diff = normalised_abs_diff(arg, s["argOfPeriapsis"])
        if fabs(norm_diff - 60.0) < ANGLE_TOLERANCE_DEG:
            rel = signed_angle_diff(arg, s["argOfPeriapsis"])
            return "L4" if rel > 0 else "L5"
        if fabs(norm_diff - 180.0) < ANGLE_TOLERANCE_DEG:
            return "L3"
    return None


def _classify_l1_l2(body: dict, siblings: list[dict]) -> str | None:
    """
    Returns 'L1' or 'L2' when body is co-orbital with a sibling at a different
    semi-major axis and aligned in arg-of-periapsis + ascending-node.
    Mirrors the second branch of detectTrojanStatus.
    """
    if not _has_required_fields(body):
        return None
    arg = body["argOfPeriapsis"]
    node = body.get("ascendingNode", 0.0) or 0.0
    sma = body["semiMajorAxis"]

    for s in siblings:
        if s is body:
            continue
        if s.get("orbitalPeriod") != body.get("orbitalPeriod"):
            continue
        if s.get("semiMajorAxis") == sma:
            continue   # same SMA → handled by L3/L4/L5 branch
        if s.get("argOfPeriapsis") is None or s.get("ascendingNode") is None:
            continue

        arg_diff = fabs(signed_angle_diff(arg, s["argOfPeriapsis"]))
        node_diff = fabs(signed_angle_diff(node, s.get("ascendingNode", 0.0) or 0.0))

        if arg_diff < ALIGNMENT_TOLERANCE_DEG and node_diff < ALIGNMENT_TOLERANCE_DEG:
            return "L1" if sma < s["semiMajorAxis"] else "L2"
    return None


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print("Usage: python find_lagrange_systems.py <galaxy.json.gz> [output.csv]", file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) >= 3 else "lagrange_systems.csv"

    if not os.path.exists(input_path):
        print(f"Error: input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Scanning {input_path} …", file=sys.stderr)
    print(f"Writing results to {output_path}", file=sys.stderr)

    systems_scanned = 0
    systems_with_bodies = 0
    systems_with_lagrange = 0
    bodies_scanned = 0

    with open(output_path, "w", newline="", encoding="utf-8") as csvfile:

        writer = csv.writer(csvfile)
        writer.writerow(["systemName", "L1", "L2", "L3", "L4", "L5",
                         "L1_bodies", "L2_bodies", "L3_bodies", "L4_bodies", "L5_bodies"])

        for system in iter_systems(input_path):
            systems_scanned += 1

            bodies = system.get("bodies")
            if not bodies:
                if systems_scanned % 100_000 == 0:
                    print(f"  … {systems_scanned:,} systems scanned ({systems_with_bodies:,} with bodies / "
                          f"{bodies_scanned:,} bodies), {systems_with_lagrange:,} with Lagrange", file=sys.stderr)
                continue

            systems_with_bodies += 1
            bodies_scanned += len(bodies)
            if systems_scanned % 100_000 == 0:
                print(f"  … {systems_scanned:,} systems scanned ({systems_with_bodies:,} with bodies / "
                      f"{bodies_scanned:,} bodies), {systems_with_lagrange:,} with Lagrange", file=sys.stderr)

            name = system.get("name", "<unnamed>")
            points = detect_lagrange_points(system)

            if any(points.values()):
                systems_with_lagrange += 1
                writer.writerow([
                    name,
                    bool(points["L1"]),
                    bool(points["L2"]),
                    bool(points["L3"]),
                    bool(points["L4"]),
                    bool(points["L5"]),
                    "|".join(points["L1"]),
                    "|".join(points["L2"]),
                    "|".join(points["L3"]),
                    "|".join(points["L4"]),
                    "|".join(points["L5"]),
                ])

    print(f"\nDone. Scanned {systems_scanned:,} systems total.", file=sys.stderr)
    print(f"  {systems_with_bodies:,} had bodies ({bodies_scanned:,} bodies total).", file=sys.stderr)
    print(f"  {systems_with_lagrange:,} had at least one Lagrange point.", file=sys.stderr)


if __name__ == "__main__":
    main()
