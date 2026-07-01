import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DialogShellComponent } from '../dialog-shell/dialog-shell.component';
import { OrbitalRelationsService } from '../../data/orbital-relations.service';
import { AnomalyDiagram, anomalyDiagram } from '../../data/orbital-diagrams';

/** Data passed to the mean/true anomaly dialog when it is opened. */
export interface AnomalyDialogData {
  /** Which anomaly the row was opened from — only changes the heading/focus, both values are always shown. */
  type: 'mean' | 'true';
  bodyName?: string;
  /** The mean anomaly (degrees) as recorded by Spansh. */
  recordedMeanAnomaly: number;
  /** When the recorded mean anomaly was captured. */
  recordedTimestamp: Date;
  /** The shared epoch every body in this system is calculated at (the list's displayed value). */
  systemEpoch: Date;
  /** Mean anomaly (degrees) propagated to {@link systemEpoch} — what the Orbit list shows. */
  meanAnomalyAtEpoch: number;
  /** Undefined when this body has no recorded eccentricity — true anomaly can't be derived. */
  eccentricity?: number;
  orbitalPeriodDays: number;
  /**
   * Orients the diagram's ellipse relative to the shared 0° reference direction, so a body's
   * marker lands at its real orbital position rather than always drawing periapsis along +x —
   * important when comparing the diagrams of two bodies that actually share a position (e.g. a
   * collision candidate).
   */
  argOfPeriapsisDeg?: number;
}

/**
 * Explains a body's Mean Anomaly and True Anomaly: the value Spansh recorded (and when),
 * the value shown in the Orbit list (propagated to the system's shared epoch), a live
 * value ticking to the current time, and a diagram illustrating how the two anomalies
 * relate. Mirrors {@link ApoPeriDialogComponent}'s "recorded vs. calculated" layout and
 * the orbital-diagram dialog's live rAF-driven marker.
 */
@Component({
  selector: 'app-anomaly-dialog',
  templateUrl: './anomaly-dialog.component.html',
  styleUrls: ['./anomaly-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogShellComponent, DatePipe, DecimalPipe],
})
export class AnomalyDialogComponent {
  public readonly data = inject<AnomalyDialogData>(MAT_DIALOG_DATA);
  private readonly orbital = inject(OrbitalRelationsService);
  private readonly destroyRef = inject(DestroyRef);

  public readonly heading = this.data.type === 'mean' ? 'Mean Anomaly' : 'True Anomaly';
  public readonly hasEccentricity = this.data.eccentricity !== undefined;

  /** Current wall-clock time, ticked by the animation loop to drive the live value/marker. */
  private readonly now = signal(Date.now());

  public readonly trueAnomalyAtEpoch = computed(() =>
    this.hasEccentricity ? this.orbital.meanToTrueAnomaly(this.data.meanAnomalyAtEpoch, this.data.eccentricity!) : undefined,
  );

  public readonly recordedTrueAnomaly = computed(() =>
    this.hasEccentricity ? this.orbital.meanToTrueAnomaly(this.data.recordedMeanAnomaly, this.data.eccentricity!) : undefined,
  );

  public readonly meanAnomalyLive = computed(() =>
    this.orbital.meanAnomalyNow(
      this.data.recordedMeanAnomaly, this.data.orbitalPeriodDays, this.data.recordedTimestamp.toISOString(), this.now(),
    ),
  );

  public readonly trueAnomalyLive = computed(() =>
    this.hasEccentricity ? this.orbital.meanToTrueAnomaly(this.meanAnomalyLive(), this.data.eccentricity!) : undefined,
  );

  public readonly diagram = computed<AnomalyDiagram | null>(() =>
    this.hasEccentricity
      ? anomalyDiagram(this.meanAnomalyLive(), this.trueAnomalyLive()!, this.data.eccentricity, this.data.argOfPeriapsisDeg)
      : null,
  );

  constructor() {
    let rafId = 0;
    // Register the cancel synchronously so the loop is always torn down, even if the
    // dialog is destroyed before the first render runs (cancelAnimationFrame(0) is a no-op).
    this.destroyRef.onDestroy(() => cancelAnimationFrame(rafId));
    afterNextRender(() => {
      let last = 0;
      const tick = (t: number) => {
        // ~10 fps is plenty for the slow drift of a real orbit and keeps it cheap.
        if (t - last > 100) {
          this.now.set(Date.now());
          last = t;
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    });
  }
}
