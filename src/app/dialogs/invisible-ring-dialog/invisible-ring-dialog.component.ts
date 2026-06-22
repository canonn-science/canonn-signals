import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DialogShellComponent } from '../dialog-shell/dialog-shell.component';

/** Data passed to the invisible-ring dialog when it is opened. */
export interface InvisibleRingDialogData {
  ringName: string;
  innerRadius: number;
  outerRadius: number;
  width: number;
  area: number;
  mass: number;
  density: number;
  isInvisible: boolean;
}

/**
 * Explains the "Invisible" ring badge: the density/width criteria a ring must meet to
 * likely be invisible in-game, and where this specific ring sits against them.
 */
@Component({
  selector: 'app-invisible-ring-dialog',
  templateUrl: './invisible-ring-dialog.component.html',
  styleUrls: ['./invisible-ring-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogShellComponent],
})
export class InvisibleRingDialogComponent {
  public readonly data = inject<InvisibleRingDialogData>(MAT_DIALOG_DATA);
}
