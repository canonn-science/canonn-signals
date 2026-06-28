import { ChangeDetectionStrategy, Component, Signal, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DialogShellComponent } from '../dialog-shell/dialog-shell.component';
import { BodyHistogram, HistogramBodyInput, buildBodyHistogram } from '../../data/body-histogram';

/** Data the histogram dialog needs, passed via MatDialog's `data`. */
export interface HistogramDialogData {
  systemName: string;
  bodies: HistogramBodyInput[];
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

  get title(): string {
    return `Body types — ${this.data.systemName}`;
  }

  /** Bar width as a percentage of the widest bar, so the largest count fills the track. */
  barWidth(count: number): number {
    const max = this.histogram().maxCount;
    return max > 0 ? (count / max) * 100 : 0;
  }
}
