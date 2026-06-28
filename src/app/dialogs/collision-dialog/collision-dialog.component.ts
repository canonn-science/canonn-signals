import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DatePipe, DecimalPipe } from '@angular/common';
import { DialogShellComponent } from '../dialog-shell/dialog-shell.component';
import { CollisionWindow } from '../../data/orbital-relations.service';

/** Key descriptive facts about one of the two colliding bodies. */
export interface CollisionBodyInfo {
  subType: string;
  atmosphereType: string | null;
  orbitalPeriodDays: number;
  moonCount: number;
  hasRings: boolean;
}

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
  /** Per-body descriptive info used to build the summary paragraph. */
  bodyInfo: CollisionBodyInfo | null;
  partnerInfo: CollisionBodyInfo | null;
  /** System population; 0 when uninhabited or unknown. */
  systemPopulation: number;
  /** System name, used to strip the prefix from body names in the description. */
  systemName: string;
  /** Additional sibling names beyond the primary partner that are also in the crossing-orbit group. */
  simultaneousPartners: string[];
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
   * Prose summary of the collision pair: population, body types, atmospheres, moons/rings,
   * period difference, synodic interval, and a rough collision-frequency hint.
   */
  public get description(): string {
    const d = this.data;
    const parts: string[] = [];

    /** Pluralise a subType string: "Rocky body" → "Rocky bodies", "Gas giant" → "Gas giants". */
    const pluralise = (s: string): string => {
      const words = s.split(' ');
      const last = words[words.length - 1];
      const plural = /[^aeiou]y$/i.test(last)
        ? last.slice(0, -1) + 'ies'
        : last + 's';
      return [...words.slice(0, -1), plural].join(' ');
    };

    /** Body name with the system-name prefix stripped (e.g. "Foo System 1 a" → "1 a"). */
    const shortName = (name: string): string => {
      const prefix = d.systemName + ' ';
      return name.startsWith(prefix) ? name.slice(prefix.length) : name;
    };

    /** Atmosphere description, or empty string when there is none. */
    const atmoStr = (info: CollisionBodyInfo | null): string => {
      const a = info?.atmosphereType;
      if (!a || /^none$|^no atmosphere$/i.test(a)) { return ''; }
      return a.toLowerCase() + ' atmosphere';
    };

    // Population sentence opener.
    if (d.systemPopulation > 0) {
      parts.push(`This inhabited system (${d.systemPopulation.toLocaleString()} inhabitants)`);
    } else {
      parts.push('This uninhabited system');
    }

    // Body types and atmospheres.
    const bi = d.bodyInfo, pi = d.partnerInfo;

    if (bi && pi && bi.subType === pi.subType) {
      // Both the same type: "contains two Rocky bodies"
      parts[0] += ` contains two ${pluralise(bi.subType)}`;
      const atmoA = atmoStr(bi), atmoB = atmoStr(pi);
      if (atmoA && atmoA === atmoB) {
        parts[0] += ` with ${atmoA}s`;           // "with carbon dioxide atmospheres"
      } else if (atmoA && atmoB) {
        parts[0] += `, one with ${atmoA} and one with ${atmoB}`;
      } else if (atmoA) {
        parts[0] += `, one with ${atmoA}`;
      }
    } else if (bi && pi) {
      // Different types: list each separately.
      const aA = atmoStr(bi), aB = atmoStr(pi);
      parts[0] += ` contains a ${bi.subType} (${shortName(d.bodyName)})`;
      if (aA) { parts[0] += ` with ${aA}`; }
      parts[0] += ` and a ${pi.subType} (${shortName(d.partnerName ?? '')})`;
      if (aB) { parts[0] += ` with ${aB}`; }
    } else {
      parts[0] += ` contains two bodies`;
    }

    if (d.partnerName) {
      parts[0] += ` (${shortName(d.bodyName)} and ${shortName(d.partnerName)})`;
    }
    parts[0] += '.';

    // Orbital periods and how close they are.
    if (bi && pi) {
      const pA = bi.orbitalPeriodDays, pB = pi.orbitalPeriodDays;
      const diffMin = Math.abs(pA - pB) * 24 * 60;
      const diffPct = (Math.abs(pA - pB) / Math.min(pA, pB)) * 100;
      parts.push(
        `They orbit with periods of ${pA.toFixed(2)} and ${pB.toFixed(2)} days` +
        ` (differ by ${diffMin.toFixed(0)} minutes, ${diffPct.toFixed(1)}%).`
      );
    }

    // Moons and rings — only mention when present.
    const features: string[] = [];
    if (bi?.moonCount) { features.push(`${shortName(d.bodyName)} has ${bi.moonCount} moon${bi.moonCount > 1 ? 's' : ''}`); }
    if (bi?.hasRings)  { features.push(`${shortName(d.bodyName)} has rings`); }
    if (pi?.moonCount && d.partnerName) { features.push(`${shortName(d.partnerName)} has ${pi.moonCount} moon${pi.moonCount > 1 ? 's' : ''}`); }
    if (pi?.hasRings  && d.partnerName) { features.push(`${shortName(d.partnerName)} has rings`); }
    if (features.length > 0) { parts.push(features.join('; ') + '.'); }

    // Synodic period and collision frequency.
    if (d.synodicPeriodDays !== null) {
      const years = d.synodicPeriodDays / DAYS_PER_YEAR;
      const synodicStr = years >= 1
        ? `every ${years.toFixed(1)} years`
        : `every ${d.synodicPeriodDays.toFixed(0)} days`;
      parts.push(`The bodies pass each other ${synodicStr}, but only collide when the alignment falls on their mutual orbital node.`);
    }

    // Collision frequency from the upcoming list.
    if (d.upcomingCollisions.length > 1) {
      const last = d.upcomingCollisions[d.upcomingCollisions.length - 1];
      const spanYears = last.days / DAYS_PER_YEAR;
      const n = d.upcomingCollisions.length;
      parts.push(`${n} collisions are predicted over the next ${spanYears.toFixed(0)} years.`);
    }

    // Multi-body group.
    if (d.simultaneousPartners.length > 0 && d.partnerName) {
      const allNames = [shortName(d.bodyName), shortName(d.partnerName), ...d.simultaneousPartners.map(n => shortName(n))];
      const listed = allNames.length === 2
        ? allNames.join(' and ')
        : allNames.slice(0, -1).join(', ') + ', and ' + allNames[allNames.length - 1];
      parts.push(`${listed} all have crossing orbits with each other and may collide simultaneously during the same conjunction.`);
    }

    return parts.join(' ');
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
