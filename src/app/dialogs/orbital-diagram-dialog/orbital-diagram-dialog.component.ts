import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Signal,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DialogShellComponent } from '../dialog-shell/dialog-shell.component';
import { OrbitalRelationsService } from '../../data/orbital-relations.service';
import {
  AxialTiltDiagram,
  InclinationDiagram,
  PeriapsisDiagram,
  VIEW_BOX_SIZE,
  axialTiltDiagram,
  inclinationDiagram,
  periapsisDiagram,
} from '../../data/orbital-diagrams';

export type OrbitalDiagramType = 'tilt' | 'inclination' | 'periapsis';

/** Keplerian elements needed to place a body at its live position along its orbit. */
export interface OrbitElements {
  meanAnomalyDeg: number;
  orbitalPeriodDays: number;
  meanAnomalyTimestamp: string;
  eccentricity: number;
  argOfPeriapsisDeg: number;
}

export interface OrbitalDiagramData {
  /** Which orientation angle this diagram illustrates. */
  type: OrbitalDiagramType;
  /** The angle in degrees (axial tilt already converted from radians by the caller). */
  degrees: number;
  /** Orbital eccentricity, used to shape the periapsis ellipse. */
  eccentricity?: number;
  /** Display name of this body (the one the diagram is about). */
  bodyName?: string;
  /** Display name of the body this one orbits, shown at the centre. */
  parentName?: string;
  /** Orbital elements for the inclination diagram's live body position (when available). */
  orbit?: OrbitElements;
}

/**
 * Standalone modal that draws a data-driven diagram of a body's axial tilt,
 * orbital inclination, or argument of periapsis from its actual angle, alongside
 * a short explanation. Opened from the body detail rows via MatDialog.
 *
 * For the inclination diagram the orbiting body is placed at its live position:
 * its mean anomaly is propagated to the current wall-clock time on an animation
 * loop, so the marker advances along the orbit in real time.
 */
@Component({
  selector: 'app-orbital-diagram-dialog',
  templateUrl: './orbital-diagram-dialog.component.html',
  styleUrls: ['./orbital-diagram-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, DialogShellComponent],
})
export class OrbitalDiagramDialogComponent {
  readonly data = inject<OrbitalDiagramData>(MAT_DIALOG_DATA);
  private readonly orbital = inject(OrbitalRelationsService);
  private readonly destroyRef = inject(DestroyRef);
  readonly viewBox = `0 0 ${VIEW_BOX_SIZE} ${VIEW_BOX_SIZE}`;

  /** Current wall-clock time, ticked by the animation loop to drive the live marker. */
  private readonly now = signal(Date.now());

  readonly tilt: Signal<AxialTiltDiagram | null> = computed(() =>
    this.data.type === 'tilt' ? axialTiltDiagram(this.data.degrees) : null,
  );
  readonly inclination: Signal<InclinationDiagram | null> = computed(() =>
    this.data.type === 'inclination' ? inclinationDiagram(this.data.degrees, this.liveOrbitAngle()) : null,
  );
  readonly periapsis: Signal<PeriapsisDiagram | null> = computed(() =>
    this.data.type === 'periapsis' ? periapsisDiagram(this.data.degrees, this.data.eccentricity) : null,
  );

  constructor() {
    // Animate the inclination marker only when we actually have orbital elements.
    if (this.data.type === 'inclination' && this.data.orbit) {
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

  /** The body's current argument of latitude (ω + ν) from its propagated mean anomaly. */
  private liveOrbitAngle(): number | undefined {
    const o = this.data.orbit;
    if (!o) return undefined;
    const meanNow = this.orbital.meanAnomalyNow(o.meanAnomalyDeg, o.orbitalPeriodDays, o.meanAnomalyTimestamp, this.now());
    const trueAnomaly = this.orbital.meanToTrueAnomaly(meanNow, o.eccentricity);
    return o.argOfPeriapsisDeg + trueAnomaly;
  }

  get title(): string {
    switch (this.data.type) {
      case 'tilt':
        return 'Axial tilt';
      case 'inclination':
        return 'Orbital inclination';
      case 'periapsis':
        return 'Argument of periapsis';
    }
  }
}
