import { ChangeDetectionStrategy, Component, Signal, computed, effect, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DialogShellComponent } from '../dialog-shell/dialog-shell.component';
import { AppService } from '../../app.service';

/** One stop on a megaship's route, before its system name has been resolved. */
export interface MegashipRouteStopData {
  position: number;
  systemId64: number;
  /** ISO date (YYYY-MM-DD) this stop is next due. */
  dueDate: string;
  presentNow: boolean;
}

/** Data passed to the megaship route dialog when it is opened from a Megaships table row. */
export interface MegashipRouteDialogData {
  signalName: string;
  shipName: string;
  type: 'cycle' | 'static';
  /** Whether the full rotation has been confirmed by repeated sightings, or is a best guess (cycle only). */
  confirmed: boolean;
  lastSeen: string;
  /** Static ships only. */
  firstSeen?: string;
  weeksConfirmed?: number;
  /** Cycle ships only. */
  routeLen?: number;
  /** Every observed stop, in route order (a single always-present entry for a static ship). */
  stops: MegashipRouteStopData[];
}

/** A route stop with its system name resolved for display (falls back to the raw id64 while resolving). */
export interface MegashipRouteStopDisplay {
  position: number;
  systemName: string;
  dueDate: string;
  presentNow: boolean;
}

/**
 * Shows a tracked megaship's full route: every system it visits and the date it's next due
 * there. Per issue canonn-science/canonn-signals#114, this data is derived from community
 * sightings, not an official schedule, so the dialog carries a disclaimer to that effect.
 *
 * The route arrives as raw system addresses (`MegashipRouteDialogData.stops`) so the dialog
 * opens instantly; names are resolved reactively via `AppService.systemNames()` (there's no
 * reverse id64->name endpoint, so each stop piggybacks on a biostats lookup) and fill in as
 * they arrive, the same pattern the Megaships table row uses for its "current location" cell.
 */
@Component({
  selector: 'app-megaship-route-dialog',
  templateUrl: './megaship-route-dialog.component.html',
  styleUrls: ['./megaship-route-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogShellComponent],
})
export class MegashipRouteDialogComponent {
  public readonly data = inject<MegashipRouteDialogData>(MAT_DIALOG_DATA);
  private readonly appService = inject(AppService);

  public readonly stops: Signal<MegashipRouteStopDisplay[]> = computed(() => {
    const names = this.appService.systemNames();
    return this.data.stops.map(stop => ({
      position: stop.position,
      systemName: names.get(String(stop.systemId64)) ?? '…',
      dueDate: stop.dueDate,
      presentNow: stop.presentNow,
    }));
  });

  constructor() {
    effect(() => {
      for (const stop of this.data.stops) {
        this.appService.requestSystemName(stop.systemId64);
      }
    });
  }
}
