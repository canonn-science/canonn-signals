import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { AppService } from '../app.service';
import { GNOSIS_ROUTE_STOPS, gnosisRouteIndex } from '../data/gnosis-route';

/** One stop on the Gnosis tube map, positioned in visit order. */
export interface GnosisRouteStopView {
  name: string;
  current: boolean;
}

/**
 * The Gnosis megaship's permanent 8-system retirement-loop "tube map" (issue
 * canonn-science/canonn-signals#121). The caller (`home.component.html`) only mounts this when
 * the currently viewed system is itself one of the 8 stops (`isGnosisRouteSystem`); the current
 * stop is highlighted from `AppService.gnosisData()` — the same live-tracked source used to place
 * the Gnosis marker on the Galaxy Region Map.
 */
@Component({
  selector: 'app-gnosis-route',
  templateUrl: './gnosis-route.component.html',
  styleUrl: './gnosis-route.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GnosisRouteComponent {
  private readonly appService = inject(AppService);

  /** Emits the stop's system name when it's clicked/activated. */
  readonly stopSelected = output<string>();

  readonly stops = computed<GnosisRouteStopView[]>(() => {
    const gnosis = this.appService.gnosisData();
    const currentIndex = gnosis ? gnosisRouteIndex(gnosis.system) : -1;
    return GNOSIS_ROUTE_STOPS.map((name, index) => ({ name, current: index === currentIndex }));
  });

  public select(name: string): void {
    this.stopSelected.emit(name);
  }
}
