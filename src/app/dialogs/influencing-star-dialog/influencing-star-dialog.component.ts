import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DialogShellComponent } from '../dialog-shell/dialog-shell.component';
import type { InfluencingStarMethod } from '../../data/influencing-star';

/** Data passed to the influencing-star dialog when it is opened from a body's Biology panel. */
export interface InfluencingStarDialogData {
  bodyName: string;
  starName: string;
  starSubType: string;
  method: InfluencingStarMethod;
  /** Number of stars in the system (including the winner). */
  starCount: number;
}

/**
 * Explains how {@link import('../../data/influencing-star').influencingStar} identified this
 * body's governing star, and how a star's class shapes the biology that can be present.
 */
@Component({
  selector: 'app-influencing-star-dialog',
  templateUrl: './influencing-star-dialog.component.html',
  styleUrls: ['./influencing-star-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogShellComponent],
})
export class InfluencingStarDialogComponent {
  public readonly data = inject<InfluencingStarDialogData>(MAT_DIALOG_DATA);

  public readonly heading = `Influencing Star — ${this.data.bodyName}`;
}
