import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DatePipe, DecimalPipe } from '@angular/common';
import { DialogShellComponent } from '../dialog-shell/dialog-shell.component';

/** Data passed to the apoapsis/periapsis dialog when it is opened. */
export interface ApoPeriDialogData {
  type: 'apo' | 'peri';
  date: Date;
  days: number;
  distanceKm?: number;
  meanAnomaly?: number;
  orbitalPeriod?: number;
  timestamp?: Date;
  currentMeanAnomaly?: number;
  degreesToEvent?: number;
}

/**
 * Details of a body's next apoapsis or periapsis: the event date, distance, and the
 * mean-anomaly propagation used to estimate when it next occurs.
 */
@Component({
  selector: 'app-apo-peri-dialog',
  templateUrl: './apo-peri-dialog.component.html',
  styleUrls: ['./apo-peri-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogShellComponent, DatePipe, DecimalPipe],
})
export class ApoPeriDialogComponent {
  public readonly data = inject<ApoPeriDialogData>(MAT_DIALOG_DATA);

  public readonly heading = this.data.type === 'apo' ? 'Next Apoapsis' : 'Next Periapsis';
}
