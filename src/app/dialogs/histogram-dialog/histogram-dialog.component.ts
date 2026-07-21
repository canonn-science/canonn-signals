import { ChangeDetectionStrategy, Component, Signal, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DialogShellComponent } from '../dialog-shell/dialog-shell.component';
import { BodyHistogram, HistogramBodyInput, buildBodyHistogram } from '../../data/body-histogram';

/** Data the histogram dialog needs, passed via MatDialog's `data`. */
export interface HistogramDialogData {
  systemName: string;
  bodies: HistogramBodyInput[];
  /**
   * Reported total body count for the system (`bodyCount`), used to surface how many
   * bodies are still unknown. `null`/omitted when the total itself is unknown.
   */
  totalBodyCount?: number | null;
}

/**
 * Standalone modal that shows a "histogram of bodies": a horizontal bar chart counting
 * each body sub-type in the system, grouped stars-then-planets. All counting/sorting is
 * done by the framework-free {@link buildBodyHistogram} helper so it stays unit-testable.
 */
@Component({
  selector: 'app-histogram-dialog',
  templateUrl: './histogram-dialog.component.html',
  styleUrls: ['./histogram-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, DialogShellComponent],
})
export class HistogramDialogComponent {
  readonly data = inject<HistogramDialogData>(MAT_DIALOG_DATA);

  readonly histogram: Signal<BodyHistogram> = computed(() => buildBodyHistogram(this.data.bodies ?? []));

  /**
   * Bodies the system has but the histogram can't chart (no data yet). When the reported
   * total is known, this is `total − charted` (clamped at 0 in case of a stale/under-reported
   * count); `known` is false when the total itself is unknown, so the view falls back to a
   * count-free label.
   */
  readonly unknownBodies: Signal<{ known: boolean; count: number }> = computed(() => {
    const total = this.data.totalBodyCount;
    if (total === null || total === undefined) return { known: false, count: 0 };
    return { known: true, count: Math.max(0, total - this.histogram().total) };
  });

  get title(): string {
    return `Body types — ${this.data.systemName}`;
  }

  /** Bar width as a percentage of the widest bar, so the largest count fills the track. */
  barWidth(count: number): number {
    const max = this.histogram().maxCount;
    return max > 0 ? (count / max) * 100 : 0;
  }
}
