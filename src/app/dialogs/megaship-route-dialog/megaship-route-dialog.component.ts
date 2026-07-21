import { ChangeDetectionStrategy, Component, Signal, computed, effect, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DialogShellComponent } from '../dialog-shell/dialog-shell.component';
import { AppService } from '../../app.service';

/** One stop on a megaship's route, before its system name has been resolved. */
export interface MegashipRouteStopData {
  position: number;
  /** Resolved reactively via `AppService.systemNames()` (there's no reverse id64->name endpoint). */
  systemId64?: number;
  /** Set instead of `systemId64` for routes whose stop names are already known statically (e.g.
   *  the Gnosis's fixed 8-system loop — see `data/gnosis-route.ts`), skipping the id64 lookup entirely. */
  systemName?: string;
  /** ISO date (YYYY-MM-DD) this stop is next due, or null when no date applies (e.g. a Gnosis
   *  stop other than its current one — the loop is live-tracked, not scheduled). */
  dueDate: string | null;
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
  /** Overrides the default "N weekly stops" summary line for a cycle route that isn't weekly
   *  (e.g. the Gnosis's retirement loop). */
  routeDescription?: string;
  /** Overrides the default community-sightings disclaimer (e.g. for the Gnosis's confirmed,
   *  live-tracked route, where that disclaimer would be misleading). */
  disclaimer?: string;
}

/** A route stop with its system name resolved for display (falls back to the raw id64 while resolving). */
export interface MegashipRouteStopDisplay {
  position: number;
  systemName: string;
  dueDate: string | null;
  presentNow: boolean;
}

/**
 * Shows a tracked megaship's full route: every system it visits and the date it's next due
 * there. Per issue canonn-science/canonn-signals#114, most tracked megaships' routes are derived
 * from community sightings rather than an official schedule, so the dialog carries a disclaimer
 * to that effect by default — overridable via `MegashipRouteDialogData.disclaimer` for routes that
 * aren't (e.g. the Gnosis's confirmed, live-tracked loop — issue #121).
 *
 * Most callers pass stops as raw system addresses (`MegashipRouteStopData.systemId64`) so the
 * dialog opens instantly; names are resolved reactively via `AppService.systemNames()` (there's no
 * reverse id64->name endpoint, so each stop piggybacks on a biostats lookup) and fill in as they
 * arrive, the same pattern the Megaships table row uses for its "current location" cell. A route
 * whose stop names are already known statically (again, the Gnosis) can set `systemName` directly
 * per stop instead, skipping that lookup.
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
      systemName: stop.systemName ?? names.get(String(stop.systemId64)) ?? '…',
      dueDate: stop.dueDate,
      presentNow: stop.presentNow,
    }));
  });

  constructor() {
    effect(() => {
      for (const stop of this.data.stops) {
        if (stop.systemId64 !== undefined) {
          this.appService.requestSystemName(stop.systemId64);
        }
      }
    });
  }
}
