import { Component, ChangeDetectionStrategy, ElementRef, afterNextRender, inject, viewChild } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DialogShellComponent } from '../dialog-shell/dialog-shell.component';
import { ChartRenderingService, HillChartData } from '../../data/chart-rendering.service';
import { formatGroupedInteger } from '../../data/unit-conversions';

/**
 * Shepherding-moon analysis: a logarithmic orbital diagram of the moon against its
 * parent's rings, plus the numeric Hill-sphere results and a shepherd/inner/none verdict.
 * The chart is drawn into the canvas once it is in the DOM.
 */
@Component({
  selector: 'app-hill-limit-dialog',
  templateUrl: './hill-limit-dialog.component.html',
  styleUrls: ['./hill-limit-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogShellComponent],
})
export class HillLimitDialogComponent {
  private readonly chartRenderer = inject(ChartRenderingService);
  public readonly data = inject<HillChartData>(MAT_DIALOG_DATA);

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    afterNextRender(() => this.chartRenderer.drawShepherdingHillChart(this.canvas().nativeElement, this.data));
  }

  public fmt(value: number): string {
    return formatGroupedInteger(value);
  }
}
