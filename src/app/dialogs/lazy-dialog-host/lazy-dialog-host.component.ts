import { NgComponentOutlet } from '@angular/common';
import { CdkScrollable } from '@angular/cdk/scrolling';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  Injector,
  signal,
  Type,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import type { LazyDialogConfig } from '../lazy-dialog';

/**
 * How long the real body chunk may take to load before the skeleton is revealed. A chunk that
 * resolves sooner (the common warm-cache case) swaps straight in, so the skeleton never flashes
 * for loads too fast to perceive.
 */
export const SKELETON_DELAY_MS = 150;

/**
 * A real MatDialog opened synchronously in place of a lazily-imported dialog body. It shows the
 * dialog chrome immediately, reveals a shimmer skeleton if the body's chunk is slow to arrive,
 * then renders the resolved component in its place — so a slow chunk fetch no longer leaves the
 * click with nothing on screen. The wrapped `data` is re-provided as MAT_DIALOG_DATA so the
 * loaded component sees its own payload, not this host's config.
 *
 * Open it through {@link openLazyDialog} rather than directly.
 */
@Component({
  selector: 'app-lazy-dialog-host',
  templateUrl: './lazy-dialog-host.component.html',
  styleUrls: ['./lazy-dialog-host.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgComponentOutlet,
    CdkScrollable,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButton,
  ],
})
export class LazyDialogHostComponent {
  private readonly hostInjector = inject(Injector);
  protected readonly config = inject<LazyDialogConfig>(MAT_DIALOG_DATA);

  /** The resolved dialog component, or null while its chunk is still loading. */
  protected readonly component = signal<Type<unknown> | null>(null);
  /** Whether the skeleton delay has elapsed with the body still loading. */
  protected readonly showSkeleton = signal(false);
  /** Whether the body's chunk failed to load. */
  protected readonly failed = signal(false);

  /** Exposes the wrapped `data` to the loaded body as its MAT_DIALOG_DATA. */
  protected readonly bodyInjector = Injector.create({
    parent: this.hostInjector,
    providers: [{ provide: MAT_DIALOG_DATA, useValue: this.config.data }],
  });

  constructor() {
    const timer = setTimeout(() => this.showSkeleton.set(true), SKELETON_DELAY_MS);
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));

    this.config.loader()
      .then((component) => this.component.set(component))
      .catch(() => this.failed.set(true))
      .finally(() => clearTimeout(timer));
  }
}
