import { Component, ChangeDetectionStrategy, ElementRef, afterNextRender, inject, viewChild } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DecimalPipe } from '@angular/common';
import { DialogShellComponent } from '../dialog-shell/dialog-shell.component';
import { ChartRenderingService, RocheChartData } from '../../data/chart-rendering.service';

/**
 * Roche-limit analysis: the rigid and fluid limit curves vs. particle density for a ring
 * (or a body's orbit), with a summary of each ring's position. The chart is drawn into
 * the canvas once it is in the DOM.
 */
@Component({
  selector: 'app-roche-limit-dialog',
  templateUrl: './roche-limit-dialog.component.html',
  styleUrls: ['./roche-limit-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogShellComponent, DecimalPipe],
})
export class RocheLimitDialogComponent {
  private readonly chartRenderer = inject(ChartRenderingService);
  public readonly data = inject<RocheChartData>(MAT_DIALOG_DATA);

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  /** Heading: "Roche Limit Analysis [- parentName] - ringName" (parent omitted for a body orbit). */
  public readonly heading = 'Roche Limit Analysis'
    + (this.data.isBody ? '' : ` - ${this.data.parentName}`)
    + ` - ${this.data.ringName}`;

  constructor() {
    afterNextRender(() => this.chartRenderer.drawRocheChart(this.canvas().nativeElement, this.data));
  }
}
