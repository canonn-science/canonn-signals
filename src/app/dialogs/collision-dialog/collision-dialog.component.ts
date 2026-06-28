import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DatePipe, DecimalPipe } from '@angular/common';
import { DialogShellComponent } from '../dialog-shell/dialog-shell.component';
import { CollisionWindow } from '../../data/orbital-relations.service';

/** Data passed to the collision dialog when it is opened from a body's "Collision" badge. */
export interface CollisionDialogData {
  bodyName: string;
  partnerName: string | null;
  synodicPeriodDays: number | null;
  nextCollision: CollisionWindow | null;
  /** Up to 10 upcoming contact windows in chronological order. */
  upcomingCollisions: CollisionWindow[];
  /** Sum of the two bodies' radii (km) — the contact threshold. */
  combinedRadiiKm: number | null;
}

/** Days in a Julian year, used to express long intervals (synodic period, time-to-collision) in years. */
const DAYS_PER_YEAR = 365.25;

/**
 * Details of a predicted collision between two sibling bodies: when the contact window opens
 * and closes (local time and UTC), how deeply the bodies overlap, the synodic period, and the
 * caveats about what these "collisions" actually are in-game.
 */
@Component({
  selector: 'app-collision-dialog',
  templateUrl: './collision-dialog.component.html',
  styleUrls: ['./collision-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogShellComponent, DatePipe, DecimalPipe],
})
export class CollisionDialogComponent {
  public readonly data = inject<CollisionDialogData>(MAT_DIALOG_DATA);

  public readonly heading = this.data.nextCollision ? 'Predicted Collision' : 'Collision Candidate';

  /** Contact-window duration in minutes (start → end), or null when there is no timed window. */
  public get durationMinutes(): number | null {
    const c = this.data.nextCollision;
    return c ? (c.end.getTime() - c.start.getTime()) / 60000 : null;
  }

  /**
   * How deeply the bodies interpenetrate at closest approach, as a percentage of their combined
   * radii: 0% = surfaces just grazing, 100% = centres coincident (a dead-on hit). Null when the
   * separation or combined radii are unavailable.
   */
  public get overlapPercent(): number | null {
    const c = this.data.nextCollision;
    if (!c || !this.data.combinedRadiiKm) { return null; }
    return Math.max(0, (1 - c.minSeparationKm / this.data.combinedRadiiKm) * 100);
  }

  /** Plain-language severity for the overlap, mirroring the Canonn collision-table wording. */
  public get overlapLabel(): string | null {
    const pct = this.overlapPercent;
    if (pct === null) { return null; }
    if (pct < 2) { return 'Glancing blow'; }
    if (pct < 50) { return 'Minor impact'; }
    if (pct < 98) { return 'Major impact'; }
    return 'Head-on collision';
  }

  /** Time from now until the contact window opens, expressed in years. */
  public get yearsUntil(): number | null {
    return this.data.nextCollision ? this.data.nextCollision.days / DAYS_PER_YEAR : null;
  }

  /** Synodic period expressed in years (for context alongside the day count). */
  public get synodicPeriodYears(): number | null {
    return this.data.synodicPeriodDays === null ? null : this.data.synodicPeriodDays / DAYS_PER_YEAR;
  }

  /**
   * Contact-window duration as a human-readable string: e.g. "2 days 4 hours and 5 minutes".
   * Any unit whose value is zero is omitted entirely.
   */
  public formatDuration(w: CollisionWindow): string {
    const totalMinutes = Math.round((w.end.getTime() - w.start.getTime()) / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    const parts: string[] = [];
    if (days > 0) { parts.push(`${days} day${days !== 1 ? 's' : ''}`); }
    if (hours > 0) { parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`); }
    if (minutes > 0) { parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`); }
    if (parts.length === 0) { return 'less than 1 minute'; }
    if (parts.length === 1) { return parts[0]; }
    return parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
  }

  /** Overlap percentage for a given contact window (0% = grazing, 100% = dead-on). */
  public overlapPercentFor(w: CollisionWindow): number | null {
    if (!this.data.combinedRadiiKm) { return null; }
    return Math.max(0, (1 - w.minSeparationKm / this.data.combinedRadiiKm) * 100);
  }

  /** Years until the start of a contact window (for display alongside day counts). */
  public yearsUntilFor(w: CollisionWindow): number {
    return w.days / DAYS_PER_YEAR;
  }
}
