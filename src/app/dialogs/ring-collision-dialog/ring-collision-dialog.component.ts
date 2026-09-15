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
  /** The other body/ring it collides with. */
  partner: RingCollisionExtent;
  /** Sum of the two objects' physical extents (a ring's outer radius, or a body's radius) — the contact threshold. */
  combinedRadiiKm: number | null;
  /**
   * The contact band's lower edge (km), when the pair has one: closer than this, one side has
   * passed inside the other's central hole and is no longer touching — the source of a close
   * ring-on-ring pass registering as two collisions either side of closest approach. Null when
   * the pair has no lower edge (a plain combined-radii threshold is enough).
   */
  combinedRadiiMinKm: number | null;
  /** Synodic period (days) between the pair. */
  synodicPeriodDays: number | null;
  /** The soonest contact window. */
  nextCollision: CollisionWindow | null;
  /** Up to 10 upcoming contact windows in chronological order. */
  upcomingCollisions: CollisionWindow[];
  /** System name, used to strip the prefix from body names for display. */
  systemName: string;
  /**
   * Centre-to-centre distance-over-time samples driving the diagram, or null when the phase data
   * needed to place the pair in time is unexpectedly missing (in which case the diagram is
   * hidden) — the dialog is only ever opened for a pair with an already-detected contact window.
   */
  separationDiagram?: SynodicDiagramInput | null;
}

/**
 * Details of a detected ring collision — either a body's orbit reaching into another body's rings
 * ("Body on Ring") or two different bodies' rings whose extents overlap in 3D ("Ring on Ring").
 * Mirrors the planetary {@link CollisionDialogComponent}'s level of detail (a predicted contact
 * window, distance-over-time chart and upcoming-contacts table): unlike planetary collisions,
 * ring collisions are only ever surfaced once a genuine, timed contact has actually been found —
 * see {@link OrbitalRelationsCore.detectRingCollisionStatus} — so this dialog always has a date,
 * never just a "might overlap" guess.
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

  public readonly heading = 'Predicted Ring Collision';

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

  /**
   * True when the pair has a lower contact-band edge, i.e. closer than that they pass *inside*
   * one another rather than staying in contact — see {@link RingCollisionDialogData.combinedRadiiMinKm}.
   * This is what makes a close pass register as two collisions either side of closest approach
   * instead of one continuous window.
   */
  public get isSplitPass(): boolean {
    return !!this.data.combinedRadiiMinKm && this.data.combinedRadiiMinKm > 0;
  }

  public get description(): string {
    const { self, partner } = this.data;
    const selfShort = this.shortName(self.name);
    const partnerShort = this.shortName(partner.name);
    const selfNoun = self.kind === 'ring' ? 'ring' : 'orbit';
    const partnerNoun = partner.kind === 'ring' ? 'rings' : 'orbit';
    const contact = `${selfShort}'s ${selfNoun} and ${partnerShort}'s ${partnerNoun} come into contact as they pass each other`;
    return this.isSplitPass
      ? `${contact}, but pass inside one another at closest approach — so this is actually two separate collisions, one on approach and one receding.`
      : `${contact}.`;
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
    return this.data.nextCollision ? this.data.nextCollision.days / 365.25 : null;
  }

  /** Synodic period expressed in years (for context alongside the day count). */
  public get synodicPeriodYears(): number | null {
    return this.data.synodicPeriodDays === null ? null : this.data.synodicPeriodDays / 365.25;
  }

  /** Years until the start of a contact window (for display alongside day counts). */
  public yearsUntilFor(w: CollisionWindow): number {
    return w.days / 365.25;
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
