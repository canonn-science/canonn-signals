import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DecimalPipe } from '@angular/common';
import { DialogShellComponent } from '../dialog-shell/dialog-shell.component';
import { RingCollisionExtent } from '../../data/orbital-relations.service';

/** Data passed to the ring collision dialog when it is opened from a "Ring Collision" badge. */
export interface RingCollisionDialogData {
  /** The body/ring the badge was shown on. */
  self: RingCollisionExtent;
  /** The other body/ring its radial reach overlaps. */
  partner: RingCollisionExtent;
  /** The overlapping radial band (km), shared by both extents. */
  overlapKm: { lo: number; hi: number } | null;
  /** System name, used to strip the prefix from body names for display. */
  systemName: string;
}

/**
 * Details of a predicted ring collision — either a body's orbit reaching into another body's
 * rings ("Body on Ring") or two different bodies' rings whose radial bands overlap ("Ring on
 * Ring"). Unlike the planetary {@link CollisionDialogComponent}, this reflects a static
 * radial-distance rule of thumb (rings don't move relative to their host, and the two objects
 * often don't share an orbital plane to search precisely), so there is no predicted date or
 * distance-over-time diagram — just whether, and where, the two radial bands can coincide.
 */
@Component({
  selector: 'app-ring-collision-dialog',
  templateUrl: './ring-collision-dialog.component.html',
  styleUrls: ['./ring-collision-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogShellComponent, DecimalPipe],
})
export class RingCollisionDialogComponent {
  public readonly data = inject<RingCollisionDialogData>(MAT_DIALOG_DATA);

  public readonly heading = 'Ring Collision Candidate';

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
      `radial distance from their common host, so they may physically intersect. This is a simplified ` +
      `radial-band check — not a full 3D simulation — so it flags whether the two can coincide, not when.`;
  }
}
