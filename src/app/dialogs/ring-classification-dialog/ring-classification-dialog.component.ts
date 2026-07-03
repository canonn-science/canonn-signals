import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DialogShellComponent } from '../dialog-shell/dialog-shell.component';
import { ringClassificationDiagram } from '../../data/ring-classification-diagram';

export interface RingClassificationRingInfo {
  name: string;
  /** km */
  innerRadius: number;
  /** km */
  outerRadius: number;
}

/** Data passed to the ring-classification dialog when it is opened from a Taylor or Pauper ring badge. */
export interface RingClassificationDialogData {
  kind: 'taylor' | 'pauper';
  /** The parent body's name. */
  bodyName: string;
  /** The specific ring that was clicked, for highlighting in the illustration. */
  ringName: string;
  /** Parent body radius (R), km. */
  parentRadius: number;
  /** All visible rings that fed the classification, sorted by inner radius. */
  rings: RingClassificationRingInfo[];
  /** Outermost outer edge minus innermost inner edge across `rings`, km. */
  span: number;
  /** Innermost inner edge across `rings`, km. */
  innermostInner: number;
  /** Outermost outer edge across `rings`, km. */
  outermostOuter: number;
  /** 0.25R in km — the Taylor threshold, and the Pauper badge's "not narrow" floor. */
  narrowThresholdKm: number;
  /** 14R in km — the Pauper badge's minimum inner-edge distance. */
  pauperInnerEdgeThresholdKm: number;
  /** 2R in km — the Pauper badge's maximum span. */
  pauperMaxSpanKm: number;
}

/**
 * Explains the "Taylor" (unusually narrow) and "Pauper" (unusually wide and distant) ring
 * badges: the criteria a ring system must meet, this body's numbers against them, and a
 * to-scale illustration of the body and its visible rings.
 */
@Component({
  selector: 'app-ring-classification-dialog',
  templateUrl: './ring-classification-dialog.component.html',
  styleUrls: ['./ring-classification-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogShellComponent],
})
export class RingClassificationDialogComponent {
  public readonly data = inject<RingClassificationDialogData>(MAT_DIALOG_DATA);

  public get heading(): string {
    return this.data.kind === 'taylor' ? 'Taylor Ring Explanation' : 'Pauper Ring Explanation';
  }

  public readonly diagram = computed(() =>
    ringClassificationDiagram(this.data.parentRadius, this.data.rings, this.data.ringName));

  public fmt(value: number): string {
    return value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  public ratio(value: number): string {
    return (value / this.data.parentRadius).toFixed(1);
  }
}
