import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltip } from '@angular/material/tooltip';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faRightLeft } from '@fortawesome/free-solid-svg-icons';
import { ClickableDirective } from '../../clickable.directive';
import { QuantityKind } from '../../data/unit-conversions';
import { UnitConversionDialogComponent, UnitConversionDialogData } from './unit-conversion-dialog.component';

/**
 * Small "⇄" affordance rendered after a property value. Clicking it opens the
 * unit-conversion dialog for that value, listing it in every scale unit of its kind.
 * Stops the click from bubbling so it never triggers a surrounding row's own click
 * (e.g. the apoapsis/Roche/Hill chart dialogs). A no-op when the value is missing or
 * non-finite, so callers can bind it unconditionally.
 */
@Component({
  selector: 'app-convert-icon',
  template: `<fa-icon class="convert-icon clickable"
                      matTooltip="Show in other units"
                      [icon]="faRightLeft"
                      (click)="open($event)"></fa-icon>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FaIconComponent, MatTooltip, ClickableDirective],
})
export class ConvertIconComponent {
  private readonly dialog = inject(MatDialog);
  protected readonly faRightLeft = faRightLeft;

  /** Quantity kind, selecting which unit table the dialog shows. */
  readonly kind = input.required<QuantityKind>();
  /** The value in the kind's base unit (km, days, kg, km/s, kg/m³, km², atm). */
  readonly value = input.required<number | null | undefined>();
  /** Dialog heading / what the value represents. */
  readonly label = input.required<string>();
  /** Conversion-row label for the unit shown inline in the UI; that row is accented in the dialog. */
  readonly uiUnit = input<string | null | undefined>();
  /** Conversion-row label for the unit the value natively arrives in (journal/API); badged in the dialog. */
  readonly sourceUnit = input<string | null | undefined>();

  protected open(event: Event): void {
    event.stopPropagation();
    const baseValue = this.value();
    if (baseValue == null || !Number.isFinite(baseValue)) { return; }
    this.dialog.open<UnitConversionDialogComponent, UnitConversionDialogData>(UnitConversionDialogComponent, {
      width: '600px',
      maxWidth: '95vw',
      autoFocus: 'first-heading',
      data: {
        title: this.label(),
        kind: this.kind(),
        baseValue,
        uiUnit: this.uiUnit() ?? null,
        sourceUnit: this.sourceUnit() ?? null,
      },
    });
  }
}
