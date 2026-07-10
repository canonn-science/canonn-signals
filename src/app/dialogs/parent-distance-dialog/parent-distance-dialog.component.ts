import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DialogShellComponent } from '../dialog-shell/dialog-shell.component';
import { OrbitalRelationsService } from '../../data/orbital-relations.service';
import { ParentDistanceDiagram, parentDistanceDiagram } from '../../data/orbital-diagrams';
import { InlineLengthUnit, RADIANS_PER_DEGREE, formatLengthInUnit, pickInlineLengthUnit } from '../../data/unit-conversions';

/** Data passed to the parent-distance dialog when it is opened. */
export interface ParentDistanceDialogData {
  bodyName?: string;
  parentName?: string;
  /** Semi-major axis (km) — stored in AU by Spansh, converted by the caller. */
  semiMajorAxisKm: number;
  eccentricity: number;
  apoapsisKm: number;
  periapsisKm: number;
  /** The mean anomaly (degrees) as recorded by Spansh. */
  recordedMeanAnomaly: number;
  /** When the recorded mean anomaly was captured. */
  recordedTimestamp: Date;
  orbitalPeriodDays: number;
  argOfPeriapsisDeg?: number;
}

/**
 * Explains a body's current straight-line distance from its parent: the orbital elements
 * behind it (semi-major axis, eccentricity, periapsis/apoapsis), a live value ticking to
 * the current time via r = a(1 − e²) / (1 + e·cos ν), and a diagram showing where that puts
 * the body on its orbit right now. Mirrors {@link AnomalyDialogComponent}'s live rAF-driven
 * value/marker.
 */
@Component({
  selector: 'app-parent-distance-dialog',
  templateUrl: './parent-distance-dialog.component.html',
  styleUrls: ['./parent-distance-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogShellComponent, DatePipe, DecimalPipe],
})
export class ParentDistanceDialogComponent {
  public readonly data = inject<ParentDistanceDialogData>(MAT_DIALOG_DATA);
  private readonly orbital = inject(OrbitalRelationsService);
  private readonly destroyRef = inject(DestroyRef);

  /** Current wall-clock time, ticked by the animation loop to drive the live value/marker. */
  private readonly now = signal(Date.now());

  /** One shared length unit for a/periapsis/apoapsis/live-r, chosen from the semi-major axis. */
  public readonly unit: InlineLengthUnit = pickInlineLengthUnit(this.data.semiMajorAxisKm);

  public readonly meanAnomalyLive = computed(() =>
    this.orbital.meanAnomalyNow(
      this.data.recordedMeanAnomaly, this.data.orbitalPeriodDays, this.data.recordedTimestamp.toISOString(), this.now(),
    ),
  );

  public readonly trueAnomalyLive = computed(() =>
    this.orbital.meanToTrueAnomaly(this.meanAnomalyLive(), this.data.eccentricity),
  );

  public readonly parentDistanceLiveKm = computed(() => {
    const e = this.data.eccentricity;
    const nu = this.trueAnomalyLive() * RADIANS_PER_DEGREE;
    return (this.data.semiMajorAxisKm * (1 - e * e)) / (1 + e * Math.cos(nu));
  });

  public readonly diagram = computed<ParentDistanceDiagram>(() =>
    parentDistanceDiagram(this.trueAnomalyLive(), this.data.eccentricity, this.data.argOfPeriapsisDeg),
  );

  public formatKm(km: number): string {
    return formatLengthInUnit(km, this.unit);
  }

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
