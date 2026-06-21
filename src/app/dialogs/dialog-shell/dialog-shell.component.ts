import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
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
 * own body. The body is rendered into the content area via `<ng-content>`.
 */
@Component({
  selector: 'app-dialog-shell',
  templateUrl: './dialog-shell.component.html',
  styleUrls: ['./dialog-shell.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogTitle, CdkScrollable, MatDialogContent, MatDialogActions, MatButton, MatDialogClose],
})
export class DialogShellComponent {
  /** Heading shown in the dialog title bar. */
  @Input({ required: true }) heading!: string;
}
