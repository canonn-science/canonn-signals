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
  /** Descriptive info for this body, used to build the summary paragraph. */
  bodyInfo: CollisionBodyInfo | null;
  /** Descriptive info for the primary partner. Retained for the simple-pair path and as a fallback. */
  partnerInfo: CollisionBodyInfo | null;
  /**
   * Descriptive info for every collision candidate beyond this body (each crossing partner and
   * simultaneous-cluster member), so the summary can enumerate all involved bodies — not just the
   * primary pair. Optional: when absent the prose falls back to {@link partnerInfo} for the pair.
   */
  partnerInfos?: { name: string; info: CollisionBodyInfo | null }[];
  /** System population; 0 when uninhabited or unknown. */
  systemPopulation: number;
  /** System name, used to strip the prefix from body names in the description. */
  systemName: string;
  /** Additional sibling names beyond the primary partner that are also in the crossing-orbit group. */
  simultaneousPartners: string[];
}

/**
 * A simultaneous multi-body collision: a cluster of overlapping contact windows in which this
 * body is within contact of two or more siblings at the same time (a three- or four-body pile-up).
 */
export interface MultiCollision {
  /** Short names of the sibling bodies involved (this body is always implicitly present too). */
  partners: string[];
  /** Earliest contact start across the cluster. */
  start: Date;
  /** Latest contact end across the cluster. */
  end: Date;
  /** Days from now until the cluster opens (negative when already in progress). */
  days: number;
}

/** Days in a Julian year, used to express long intervals (synodic period, time-to-collision) in years. */
const DAYS_PER_YEAR = 365.25;

/** Cardinal-number words for small counts (collisions involve at most a handful of bodies). */
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
/** "two", "three"… for small counts, falling back to the digit string for larger ones. */
function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

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
    const combined = c?.combinedRadiiKm ?? this.data.combinedRadiiKm;
    if (!c || !combined) { return null; }
    return Math.max(0, (1 - c.minSeparationKm / combined) * 100);
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

  /** Body name with the system-name prefix stripped (e.g. "Foo System 1 a" → "1 a"). */
  public shortName(name: string | null | undefined): string {
    if (!name) { return ''; }
    const prefix = this.data.systemName + ' ';
    return name.startsWith(prefix) ? name.slice(prefix.length) : name;
  }

  /**
   * Distinct sibling names this body actually collides with, drawn from the upcoming-collisions
   * list (so a multi-body cluster lists every partner). Falls back to the primary partner when
   * there are no timed windows. Used for the "Bodies" summary line.
   */
  public get collisionPartners(): string[] {
    const names = new Set<string>();
    for (const w of this.data.upcomingCollisions) {
      if (w.partnerName) { names.add(w.partnerName); }
    }
    if (names.size === 0 && this.data.partnerName) { names.add(this.data.partnerName); }
    return [...names];
  }

  /** Short partner name for a contact window (the sibling it is a collision with). */
  public windowPartner(w: CollisionWindow): string {
    return this.shortName(w.partnerName ?? this.data.partnerName);
  }

  /**
   * Every body involved in the collision, this one first: drawn from the upcoming windows, the
   * primary partner, and the simultaneous-cluster members (deduplicated, full names). This is the
   * single source of truth for both the "Bodies" line and the prose, so they never disagree.
   */
  public get involvedBodyNames(): string[] {
    const names = new Set<string>([this.data.bodyName]);
    for (const w of this.data.upcomingCollisions) {
      if (w.partnerName) { names.add(w.partnerName); }
    }
    if (this.data.partnerName) { names.add(this.data.partnerName); }
    for (const n of this.data.simultaneousPartners) { names.add(n); }
    return [...names];
  }

  /** Descriptive info for a body by full name, from bodyInfo / partnerInfos / partnerInfo. Null when unknown. */
  private infoFor(name: string): CollisionBodyInfo | null {
    if (name === this.data.bodyName) { return this.data.bodyInfo; }
    const match = this.data.partnerInfos?.find(p => p.name === name);
    if (match) { return match.info; }
    if (name === this.data.partnerName) { return this.data.partnerInfo; }
    return null;
  }

  /** The involved bodies paired with their short name and descriptive info, for the prose builder. */
  private get involvedBodies(): { name: string; short: string; info: CollisionBodyInfo | null }[] {
    return this.involvedBodyNames.map(name => ({ name, short: this.shortName(name), info: this.infoFor(name) }));
  }

  /** Joins names as "A", "A & B", or "A, B & C" using the given conjunction ("&" or "and"). */
  public joinNames(names: string[], conjunction = '&'): string {
    const list = names.filter(Boolean);
    if (list.length <= 1) { return list[0] ?? ''; }
    if (list.length === 2) { return `${list[0]} ${conjunction} ${list[1]}`; }
    return `${list.slice(0, -1).join(', ')} ${conjunction} ${list[list.length - 1]}`;
  }

  /**
   * Groups the upcoming contact windows by time overlap. When two windows with *different*
   * partners overlap, this body is touching both siblings at once — a simultaneous multi-body
   * collision. Cached because both {@link multiCollisions} and {@link isMultiCollision} read it.
   */
  private clusterCache: { multi: MultiCollision[]; flagged: Set<CollisionWindow> } | null = null;
  private get clusters(): { multi: MultiCollision[]; flagged: Set<CollisionWindow> } {
    if (this.clusterCache) { return this.clusterCache; }
    const windows = [...this.data.upcomingCollisions].sort((a, b) => a.start.getTime() - b.start.getTime());
    const multi: MultiCollision[] = [];
    const flagged = new Set<CollisionWindow>();
    let group: CollisionWindow[] = [];
    let maxEnd = -Infinity;

    const flush = (): void => {
      const partners = new Set(group.map(w => w.partnerName ?? this.data.partnerName ?? ''));
      // Two or more distinct partners overlapping in time = a genuine multi-body pile-up.
      if (partners.size >= 2) {
        group.forEach(w => flagged.add(w));
        multi.push({
          partners: [...partners].map(n => this.shortName(n)).sort(),
          start: new Date(Math.min(...group.map(w => w.start.getTime()))),
          end: new Date(Math.max(...group.map(w => w.end.getTime()))),
          days: Math.min(...group.map(w => w.days)),
        });
      }
      group = [];
    };

    for (const w of windows) {
      if (group.length === 0 || w.start.getTime() <= maxEnd) {
        group.push(w);
        maxEnd = Math.max(maxEnd, w.end.getTime());
      } else {
        flush();
        group = [w];
        maxEnd = w.end.getTime();
      }
    }
    flush();
    this.clusterCache = { multi, flagged };
    return this.clusterCache;
  }

  /** Simultaneous multi-body collisions among the upcoming windows (empty for simple pairs). */
  public get multiCollisions(): MultiCollision[] {
    return this.clusters.multi;
  }

  /** True when this contact window coincides with another partner's — part of a multi-body collision. */
  public isMultiCollision(w: CollisionWindow): boolean {
    return this.clusters.flagged.has(w);
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

    // Body types and atmospheres across every involved body — not just the primary pair.
    const involved = this.involvedBodies;
    const shorts = involved.map(b => b.short);
    const allKnown = involved.length >= 2 && involved.every(b => b.info);
    const sameType = allKnown && involved.every(b => b.info!.subType === involved[0].info!.subType);

    if (sameType) {
      // All the same type: "contains three Rocky bodies (1 a, 1 b and 1 c)".
      parts[0] += ` contains ${numberWord(involved.length)} ${pluralise(involved[0].info!.subType)}` +
        ` (${this.joinNames(shorts, 'and')})`;
      const atmos = involved.map(b => atmoStr(b.info));
      if (atmos.every(a => a && a === atmos[0])) {
        parts[0] += ` with ${atmos[0]}s`;               // "with carbon dioxide atmospheres"
      }
    } else if (allKnown) {
      // Mixed types: list each body with its type, name and atmosphere.
      const items = involved.map(b => {
        const a = atmoStr(b.info);
        return `a ${b.info!.subType} (${b.short})` + (a ? ` with ${a}` : '');
      });
      parts[0] += ` contains ${this.joinNames(items, 'and')}`;
    } else {
      // Some types unknown: still enumerate the bodies by name.
      parts[0] += ` contains ${numberWord(involved.length)} bodies (${this.joinNames(shorts, 'and')})`;
    }
    parts[0] += '.';

    // Orbital periods. For a pair, quantify how close they are; for more, just list them.
    const withPeriods = involved.filter(b => b.info?.orbitalPeriodDays);
    if (withPeriods.length === 2) {
      const pA = withPeriods[0].info!.orbitalPeriodDays, pB = withPeriods[1].info!.orbitalPeriodDays;
      const diffMin = Math.abs(pA - pB) * 24 * 60;
      const diffPct = (Math.abs(pA - pB) / Math.min(pA, pB)) * 100;
      parts.push(
        `They orbit with periods of ${pA.toFixed(2)} and ${pB.toFixed(2)} days` +
        ` (differ by ${diffMin.toFixed(0)} minutes, ${diffPct.toFixed(1)}%).`
      );
    } else if (withPeriods.length > 2) {
      const periodStrs = withPeriods.map(b => b.info!.orbitalPeriodDays.toFixed(2));
      parts.push(`They orbit with periods of ${this.joinNames(periodStrs, 'and')} days.`);
    }

    // Moons and rings across all involved bodies — only mention when present.
    const features: string[] = [];
    for (const b of involved) {
      if (b.info?.moonCount) { features.push(`${b.short} has ${b.info.moonCount} moon${b.info.moonCount > 1 ? 's' : ''}`); }
      if (b.info?.hasRings) { features.push(`${b.short} has rings`); }
    }
    if (features.length > 0) { parts.push(features.join('; ') + '.'); }

    // Synodic period and collision frequency.
    if (d.synodicPeriodDays !== null) {
      const years = d.synodicPeriodDays / DAYS_PER_YEAR;
      const synodicStr = years >= 1
        ? `every ${years.toFixed(1)} years`
        : `every ${d.synodicPeriodDays.toFixed(0)} days`;
      parts.push(`The bodies pass each other ${synodicStr}, but only collide when the alignment falls on their mutual orbital node.`);
    }

    // Collision frequency from the upcoming list. Scale the span unit so short-synodic moon
    // pairs (whose 10 contacts can fall inside a single year) don't read "over the next 0 years".
    if (d.upcomingCollisions.length > 1) {
      const last = d.upcomingCollisions[d.upcomingCollisions.length - 1];
      const spanYears = last.days / DAYS_PER_YEAR;
      const n = d.upcomingCollisions.length;
      const spanStr = spanYears >= 1
        ? `${spanYears.toFixed(0)} years`
        : `${last.days.toFixed(0)} days`;
      parts.push(`${n} collisions are predicted over the next ${spanStr}.`);
    }

    // Multi-body group: name every body that shares crossing orbits.
    if (d.simultaneousPartners.length > 0) {
      parts.push(`${this.joinNames(shorts, 'and')} all have crossing orbits with each other and may collide simultaneously during the same conjunction.`);
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
    // Use the window's own pair radii (partners differ in size); fall back to the status-level value.
    const combined = w.combinedRadiiKm ?? this.data.combinedRadiiKm;
    if (!combined) { return null; }
    return Math.max(0, (1 - w.minSeparationKm / combined) * 100);
  }

  /** Years until the start of a contact window (for display alongside day counts). */
  public yearsUntilFor(w: CollisionWindow): number {
    return w.days / DAYS_PER_YEAR;
  }
}
