import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DialogShellComponent } from '../dialog-shell/dialog-shell.component';
import { LagrangeConfiguration, LagrangeOccupant, LagrangePointId } from '../../data/orbital-relations.service';
import { LagrangeMarker, VIEW_BOX_SIZE, lagrangeDiagram } from '../../data/orbital-diagrams';

export interface LagrangeDialogData {
  /** The resolved co-orbital family, names already mapped to display names by the caller. */
  config: LagrangeConfiguration;
  /**
   * The system name, stripped from body names for the cramped diagram only. The
   * description below the diagram keeps the full names.
   */
  systemName: string;
}

/** A diagram marker fused with whichever bodies occupy that Lagrange point. */
export interface RenderedMarker extends LagrangeMarker {
  occupants: LagrangeOccupant[];
}

/**
 * Standalone modal that draws the five Lagrange points of a co-orbital family on the
 * canonical schematic (primary at the centre, secondary on the orbit, L1–L5 in their
 * textbook positions). Real bodies are dropped onto the points they occupy — with the
 * body the dialog was opened from highlighted — and unoccupied points are drawn as
 * dashed placeholders. Opened from the Trojan / Host badges via MatDialog.
 */
@Component({
  selector: 'app-lagrange-dialog',
  templateUrl: './lagrange-dialog.component.html',
  styleUrls: ['./lagrange-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogShellComponent],
})
export class LagrangeDialogComponent {
  readonly data = inject<LagrangeDialogData>(MAT_DIALOG_DATA);
  readonly diagram = lagrangeDiagram();
  readonly viewBox = `0 0 ${VIEW_BOX_SIZE} ${VIEW_BOX_SIZE}`;
  readonly title = 'Lagrange points';

  /** Each diagram marker fused with the bodies occupying that point, in L1…L5 order. */
  readonly markers = computed<RenderedMarker[]>(() =>
    this.diagram.markers.map(marker => ({
      ...marker,
      occupants: this.data.config.points[marker.id as LagrangePointId] ?? [],
    })),
  );

  /**
   * The compact name for the diagram: the display name with the (repeated) system-name
   * prefix dropped — e.g. "Eorld Byio AA-A h539 A 18" → "A 18". Falls back to the full name
   * when it doesn't carry the prefix (or stripping would leave nothing).
   */
  short(name: string): string {
    const system = this.data.systemName;
    if (system && name.toLowerCase().startsWith(system.toLowerCase())) {
      return name.slice(system.length).trim() || name;
    }
    return name;
  }

  /** Comma-separated short occupant names for a diagram slot (empty for a placeholder). */
  shortNames(occupants: LagrangeOccupant[]): string {
    return occupants.map(o => this.short(o.name)).join(', ');
  }

  /** True when any occupant of a slot is the focused (clicked) body. */
  hasFocus(occupants: LagrangeOccupant[]): boolean {
    return occupants.some(o => o.isFocus);
  }

  /** Display name of the focused (clicked) body, for the explanatory note — '' if none. */
  get focusedNote(): string {
    const { secondary, points } = this.data.config;
    if (secondary?.isFocus) { return secondary.name; }
    for (const slot of Object.values(points)) {
      const focused = slot.find(o => o.isFocus);
      if (focused) { return focused.name; }
    }
    return '';
  }
}
