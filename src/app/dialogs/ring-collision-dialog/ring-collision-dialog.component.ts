import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DatePipe, DecimalPipe } from '@angular/common';
import { DialogShellComponent } from '../dialog-shell/dialog-shell.component';
import { RingCollisionExtent, CollisionWindow } from '../../data/orbital-relations.service';
import { SynodicDiagram, SynodicDiagramInput, synodicDistanceDiagram } from '../../data/collision-diagram';
import { localDateTime, localZoneLabel, formatContactDuration } from '../collision-time-format';

/** Data passed to the ring collision dialog when it is opened from a "Ring Collision" badge. */
export interface RingCollisionDialogData {
  /** The body/ring the badge was shown on. */
  self: RingCollisionExtent;
  /** The other body/ring its radial reach overlaps. */
  partner: RingCollisionExtent;
  /** The overlapping radial band (km), shared by both extents. */
  overlapKm: { lo: number; hi: number } | null;
  /** Sum of the two objects' physical extents (a ring's outer radius, or a body's radius) — the contact threshold. */
  combinedRadiiKm: number | null;
  /** Synodic period (days) between the pair, when the configuration could be timed. */
  synodicPeriodDays: number | null;
  /** Next contact window, or null when timing isn't available for this pair. */
  nextCollision: CollisionWindow | null;
  /** Up to 10 upcoming contact windows in chronological order. */
  upcomingCollisions: CollisionWindow[];
  /** System name, used to strip the prefix from body names for display. */
  systemName: string;
  /**
   * Centre-to-centre distance-over-time samples driving the diagram, or null/omitted when the
   * pair can't be timed or lacks the phase data needed to place it (in which case the diagram is
   * hidden and the dialog falls back to the static radial-overlap description only).
   */
  separationDiagram?: SynodicDiagramInput | null;
}

/** Days in a Julian year, used to express long intervals (synodic period, time-to-collision) in years. */
const DAYS_PER_YEAR = 365.25;

/**
 * Details of a predicted ring collision — either a body's orbit reaching into another body's
 * rings ("Body on Ring") or two different bodies' rings whose radial bands overlap ("Ring on
 * Ring"). Mirrors the planetary {@link CollisionDialogComponent}'s level of detail (a predicted
 * contact window, distance-over-time chart and upcoming-contacts table) when the pair's
 * configuration can be timed with a single-orbit model — see
 * {@link OrbitalRelationsCore.resolveRingOrbitPair}. When it can't (e.g. the two objects only
 * share an ancestor several levels up, such as a shared barycentre), the dialog falls back to
 * just the static radial-band overlap, since there's no single orbital plane/phase to search.
 */
@Component({
  selector: 'app-ring-collision-dialog',
  templateUrl: './ring-collision-dialog.component.html',
  styleUrls: ['./ring-collision-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogShellComponent, DatePipe, DecimalPipe],
})
export class RingCollisionDialogComponent {
  public readonly data = inject<RingCollisionDialogData>(MAT_DIALOG_DATA);

  public readonly heading = this.data.nextCollision ? 'Predicted Ring Collision' : 'Ring Collision Candidate';

  /** "Body on Ring" or "Ring on Ring", depending on which side(s) are rings. */
  public get kindLabel(): string {
    const { self, partner } = this.data;
    return self.kind === 'ring' && partner.kind === 'ring' ? 'Ring on Ring' : 'Body on Ring';
  }

  /** Name with the system-name prefix stripped (e.g. "Foo System 2 Ring" → "2 Ring"). */
  public shortName(name: string): string {
    const prefix = this.data.systemName + ' ';
    return name.startsWith(prefix) ? name.slice(prefix.length) : name;
  }

  /** Plain-language description of an extent's radial reach, for the summary list. */
  public rangeLabel(extent: RingCollisionExtent): string {
    return extent.kind === 'ring' ? 'ring band' : 'orbital reach';
  }

  public get description(): string {
    const { self, partner } = this.data;
    const selfShort = this.shortName(self.name);
    const partnerShort = this.shortName(partner.name);
    const selfNoun = self.kind === 'ring' ? 'ring' : 'orbit';
    const partnerNoun = partner.kind === 'ring' ? 'rings' : 'orbit';
    return `${selfShort}'s ${selfNoun} and ${partnerShort}'s ${partnerNoun} can both occupy the same ` +
      `radial distance from their common host, so they may physically intersect.`;
  }

  public localDateTime(d: Date): string {
    return localDateTime(d);
  }

  public localZoneLabel(d: Date): string {
    return localZoneLabel(d);
  }

  public formatDuration(w: CollisionWindow): string {
    return formatContactDuration(w.start.getTime(), w.end.getTime());
  }

  /** Contact-window duration in minutes (start → end), or null when there is no timed window. */
  public get durationMinutes(): number | null {
    const c = this.data.nextCollision;
    return c ? (c.end.getTime() - c.start.getTime()) / 60000 : null;
  }

  /** Time from now until the contact window opens, expressed in years. */
  public get yearsUntil(): number | null {
    return this.data.nextCollision ? this.data.nextCollision.days / DAYS_PER_YEAR : null;
  }

  /** Synodic period expressed in years (for context alongside the day count). */
  public get synodicPeriodYears(): number | null {
    return this.data.synodicPeriodDays === null ? null : this.data.synodicPeriodDays / DAYS_PER_YEAR;
  }

  /** Years until the start of a contact window (for display alongside day counts). */
  public yearsUntilFor(w: CollisionWindow): number {
    return w.days / DAYS_PER_YEAR;
  }

  /**
   * How deeply the two objects overlap at closest approach, as a percentage of their combined
   * extents: 0% = surfaces just grazing, 100% = centres coincident. Null when unavailable.
   */
  public overlapPercentFor(w: CollisionWindow): number | null {
    const combined = w.combinedRadiiKm ?? this.data.combinedRadiiKm;
    if (!combined) { return null; }
    return Math.max(0, (1 - w.minSeparationKm / combined) * 100);
  }

  public get overlapPercent(): number | null {
    const c = this.data.nextCollision;
    return c ? this.overlapPercentFor(c) : null;
  }

  /**
   * Laid-out distance-over-time diagram, or null when there is no plottable data. Cached because
   * the template reads it several times per change-detection pass and the input is static for
   * the dialog's lifetime.
   */
  private diagramCache: SynodicDiagram | null | undefined;
  public get diagram(): SynodicDiagram | null {
    if (this.diagramCache === undefined) {
      this.diagramCache = this.data.separationDiagram ? synodicDistanceDiagram(this.data.separationDiagram) : null;
    }
    return this.diagramCache;
  }
}
