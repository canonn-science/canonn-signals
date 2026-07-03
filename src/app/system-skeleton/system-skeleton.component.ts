import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Reserved-space loading placeholder for the system view, shown while the biostats payload is in
 * flight (see HomeComponent's `@else if (searching)` branch). It mirrors the real layout — title,
 * region map, data columns and body rows — with shimmer blocks (the global `.skeleton` primitive),
 * so the page has structure immediately and swapping in the real data doesn't jump the layout.
 * Progressive fill of the individual panels then happens within the real view.
 */
@Component({
  selector: 'app-system-skeleton',
  templateUrl: './system-skeleton.component.html',
  styleUrl: './system-skeleton.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SystemSkeletonComponent {
  /** Placeholder side panels to render (count only — content is generic shimmer). */
  protected readonly panels = [0, 1];
  /** Placeholder rows within each side panel. */
  protected readonly panelRows = [0, 1, 2, 3];
  /** Placeholder body rows. */
  protected readonly bodyRows = [0, 1, 2, 3, 4, 5];
}
