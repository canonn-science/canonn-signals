import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { DialogShellComponent } from '../dialog-shell/dialog-shell.component';
import { ChartRenderingService } from '../../data/chart-rendering.service';
import { JET_SAMPLE_CSV } from '../../data/jet-sample';

/**
 * Explains how the neutron-star jet-cone half-angle is modelled and plots the fitted
 * curve against the measured sample. The bubble chart is generated once on open; if
 * generation fails the explanatory text still renders without it.
 */
@Component({
  selector: 'app-jet-angle-dialog',
  templateUrl: './jet-angle-dialog.component.html',
  styleUrls: ['./jet-angle-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogShellComponent],
})
export class JetAngleDialogComponent {
  private readonly chartRenderer = inject(ChartRenderingService);

  /** Data-URL of the fit-vs-sample bubble chart, or null when generation fails. */
  public readonly chartDataUrl: string | null = this.generateChart();

  private generateChart(): string | null {
    try {
      return this.chartRenderer.generateJetAngleChart(JET_SAMPLE_CSV);
    } catch {
      return null;
    }
  }
}
