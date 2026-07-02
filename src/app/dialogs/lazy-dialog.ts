import { Type } from '@angular/core';
import { MatDialog, MatDialogConfig, MatDialogRef } from '@angular/material/dialog';
import { LazyDialogHostComponent } from './lazy-dialog-host/lazy-dialog-host.component';

/** Skeleton layout shown while a dialog body loads: stacked text rows, or a large diagram block. */
export type LazyDialogSkeleton = 'text' | 'diagram';

/** What the host needs to render a lazily-imported dialog body once its chunk arrives. */
export interface LazyDialogConfig {
  /**
   * Loads the real dialog component's chunk on demand, e.g.
   * `() => import('./foo-dialog.component').then(m => m.FooDialogComponent)`.
   */
  loader: () => Promise<Type<unknown>>;
  /** Value provided to the loaded component as its MAT_DIALOG_DATA. */
  data: unknown;
  /** Which skeleton to show while the chunk loads. Defaults to `'text'`. */
  skeleton?: LazyDialogSkeleton;
}

/** {@link LazyDialogConfig} merged with the `MatDialog.open` options (width, backdrop, …). */
export type OpenLazyDialogOptions = LazyDialogConfig & Omit<MatDialogConfig, 'data'>;

/**
 * Opens a lazily-imported dialog through {@link LazyDialogHostComponent}: the dialog appears at
 * once with a (delayed) loading skeleton and swaps to the real body when its chunk resolves,
 * instead of the click doing nothing until the `import()` completes.
 *
 * Pass the loader, the inner `data`, an optional `skeleton`, and any `MatDialog.open` options in
 * one object. Focus defaults to the dialog container so it survives the skeleton-to-body swap;
 * set `autoFocus` to override.
 */
export function openLazyDialog(
  dialog: MatDialog,
  options: OpenLazyDialogOptions,
): MatDialogRef<LazyDialogHostComponent> {
  const { loader, data, skeleton, ...matOptions } = options;
  return dialog.open<LazyDialogHostComponent, LazyDialogConfig>(LazyDialogHostComponent, {
    autoFocus: 'dialog',
    ...matOptions,
    data: { loader, data, skeleton },
  });
}
