import { ChangeDetectionStrategy, Component } from '@angular/core';

/** A static row label paired with the on-screen width its (shimmering) value placeholder should take. */
interface SkeletonRow {
  readonly label: string;
  /** Approximate width of the value placeholder, in px — varied per row so the column reads naturally. */
  readonly value: number;
}

/** A distance-style row (system/nebula name + "N.N ly") where both cells are per-system, so both shimmer. */
interface SkeletonDistanceRow {
  /** Width of the name placeholder (left), in px. */
  readonly name: number;
  /** Width of the distance placeholder (right), in px. */
  readonly value: number;
}

/**
 * Reserved-space loading placeholder for the system view, shown while the biostats payload is in
 * flight (see HomeComponent's `@else if (searching)` branch). It mirrors the real layout — accent
 * title bar, region map, two data columns, completeness bar and body rows — so the page has its
 * final structure immediately and swapping in the real data doesn't jump.
 *
 * The section headers ("Location", "Society", "Distances") and the row labels ("PG Name", "Region",
 * "Economy", …) are identical for every system, so they render as real text; only the per-system
 * *value* cells (and the map, completeness fill and body rows, which are unknown until data arrives)
 * carry the `.skeleton` shimmer.
 */
@Component({
  selector: 'app-system-skeleton',
  templateUrl: './system-skeleton.component.html',
  styleUrl: './system-skeleton.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SystemSkeletonComponent {
  /** "Location" — present for essentially every system, so a reliable shape to reserve. */
  protected readonly locationRows: readonly SkeletonRow[] = [
    { label: 'PG Name', value: 96 },
    { label: 'Region', value: 120 },
    { label: 'Id64', value: 110 },
    { label: 'Coordinates', value: 140 },
    { label: 'Permit required', value: 30 },
    { label: 'Info updated', value: 100 },
  ];

  /** "Society" — shown for populated systems; a common second section that fills the column. */
  protected readonly societyRows: readonly SkeletonRow[] = [
    { label: 'Economy', value: 96 },
    { label: 'Government', value: 110 },
    { label: 'Allegiance', value: 80 },
    { label: 'Controlling faction', value: 130 },
    { label: 'Security', value: 60 },
  ];

  /** "Distances" — always present, but each row's system name is per-system too, so both cells shimmer. */
  protected readonly distanceRows: readonly SkeletonDistanceRow[] = [
    { name: 132, value: 58 },
    { name: 104, value: 54 },
    { name: 150, value: 64 },
    { name: 116, value: 50 },
  ];

  /** "Nearest DSSA" — nearest Deep Space Support Array outposts (name + distance). */
  protected readonly dssaRows: readonly SkeletonDistanceRow[] = [
    { name: 138, value: 60 },
    { name: 110, value: 54 },
    { name: 126, value: 64 },
  ];

  /** "Nearest Nebulae" — nearest catalogued nebulae (name + distance). */
  protected readonly nebulaeRows: readonly SkeletonDistanceRow[] = [
    { name: 122, value: 58 },
    { name: 148, value: 62 },
  ];

  /** Placeholder body rows (bodies are unknown until data arrives, so these stay generic). */
  protected readonly bodyRows = [0, 1, 2, 3, 4, 5];
}
