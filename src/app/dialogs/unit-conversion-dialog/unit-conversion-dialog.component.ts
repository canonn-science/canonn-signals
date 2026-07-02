import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTooltip } from '@angular/material/tooltip';
import { DialogShellComponent } from '../dialog-shell/dialog-shell.component';
import { ClickableDirective } from '../../clickable.directive';
import {
  buildConversions,
  buildMassComparisons,
  ConversionRow,
  MassComparison,
  QuantityKind,
} from '../../data/unit-conversions';

/** Data passed to the unit-conversion dialog when it is opened. */
export interface UnitConversionDialogData {
  /** Heading / what the value represents (e.g. "Semi-major axis"). */
  title: string;
  /** Which quantity the base value is, selecting the unit table. */
  kind: QuantityKind;
  /** The value, already expressed in the kind's base unit. */
  baseValue: number;
  /** Conversion-row label for the unit shown inline in the UI (accented), or null. */
  uiUnit?: string | null;
  /** Conversion-row label for the unit the value natively arrives in (badged), or null. */
  sourceUnit?: string | null;
  /**
   * Whether the data source delivers the value in exactly `sourceUnit`. When false, the
   * value reaches us in a different unit and the source row is a back-conversion — badged
   * "Journal / unprecise" and left rounded rather than shown at full precision. Defaults true.
   */
  sourcePrecise?: boolean;
}

/**
 * Lists a single value across every scale unit of its kind, each copyable to the
 * clipboard so users can paste the figure in whatever unit suits their tool. Mass also
 * gets a light-hearted set of everyday-object comparisons. Opened via `MatDialog.open()`
 * with {@link UnitConversionDialogData}; the rows are computed once on construction.
 */
@Component({
  selector: 'app-unit-conversion-dialog',
  templateUrl: './unit-conversion-dialog.component.html',
  styleUrls: ['./unit-conversion-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogShellComponent, MatTooltip, ClickableDirective],
})
export class UnitConversionDialogComponent {
  private readonly data = inject<UnitConversionDialogData>(MAT_DIALOG_DATA);

  protected readonly title = this.data.title;
  /** Conversion-row label the value natively arrives in (source badge), if any. */
  protected readonly sourceUnit = this.data.sourceUnit ?? null;
  /** Whether the source row holds the exact figure (true) or a back-conversion (false). */
  protected readonly sourcePrecise = this.data.sourcePrecise ?? true;
  protected readonly rows: ConversionRow[] =
    buildConversions(this.data.kind, this.data.baseValue, this.sourceUnit, this.sourcePrecise);
  /** Conversion-row label shown inline in the UI (accented row), if any. */
  protected readonly uiUnit = this.data.uiUnit ?? null;
  protected readonly comparisons: MassComparison[] =
    this.data.kind === 'mass' ? buildMassComparisons(this.data.baseValue) : [];

  /** Index of the row whose value was just copied, for the transient "Copied!" label. */
  protected readonly copiedIndex = signal<number | null>(null);

  protected copy(row: ConversionRow, index: number): void {
    navigator.clipboard?.writeText(row.copyText)
      .then(() => {
        this.copiedIndex.set(index);
        setTimeout(() => this.copiedIndex.set(null), 1500);
      })
      .catch(() => { /* clipboard unavailable */ });
  }
}
