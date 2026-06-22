import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DialogShellComponent } from '../dialog-shell/dialog-shell.component';
import { WHITE_DWARF_SPECTRAL_TYPES } from '../../data/white-dwarf';

/** Data passed to the white-dwarf spectral-type reference modal. */
export interface WhiteDwarfTypesDialogData {
  /** Catalogue row `key` to highlight (the viewed star's type), or null for none. */
  typeKey: string | null;
}

/**
 * Reference modal listing every white-dwarf spectral type, highlighting the row for
 * the star the user opened it from. Opened via `MatDialog.open()` with
 * {@link WhiteDwarfTypesDialogData}.
 */
@Component({
  selector: 'app-white-dwarf-types-dialog',
  templateUrl: './white-dwarf-types-dialog.component.html',
  styleUrls: ['./white-dwarf-types-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogShellComponent],
})
export class WhiteDwarfTypesDialogComponent {
  /** The full spectral-type catalogue, in display order. */
  protected readonly types = WHITE_DWARF_SPECTRAL_TYPES;
  protected readonly data = inject<WhiteDwarfTypesDialogData>(MAT_DIALOG_DATA);
}
