import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CdkScrollable } from '@angular/cdk/scrolling';
import {
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';

/**
 * Presentational shell shared by the information dialogs (tidal-lock, orbital-diagram).
 * It owns the chrome those dialogs have in common — a titled header, a scrollable
 * content area, and a trailing Close button — so each dialog only has to project its
 * own body. The body is rendered into the content area via the default `<ng-content>`.
 *
 * Two optional projection slots cover the dialogs that need more than a plain header
 * and a Close button:
 *  - `[shell-title-extra]` — extra content alongside the heading text (e.g. a link).
 *  - `[shell-actions]` — extra action buttons placed after the Close button.
 *
 * By default the shell is a fixed height so the info dialogs don't jump in size as their
 * content varies. Set `fitContent` for a dialog whose body should size to its content
 * instead, growing only up to the shared max-height before its content scrolls.
 */
@Component({
  selector: 'app-dialog-shell',
  templateUrl: './dialog-shell.component.html',
  styleUrls: ['./dialog-shell.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.fit-content]': 'fitContent()' },
  imports: [MatDialogTitle, CdkScrollable, MatDialogContent, MatDialogActions, MatButton, MatDialogClose],
})
export class DialogShellComponent {
  /** Heading shown in the dialog title bar. */
  readonly heading = input.required<string>();

  /**
   * When true, the shell sizes to its content (auto height, capped at the shared
   * max-height) instead of the default fixed height. Reflected to the host as a class.
   */
  readonly fitContent = input(false);
}
