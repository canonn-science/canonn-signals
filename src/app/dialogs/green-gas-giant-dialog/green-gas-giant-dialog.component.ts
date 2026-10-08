import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DialogShellComponent } from '../dialog-shell/dialog-shell.component';
import { greenGasGiantLadderDiagram } from '../../data/green-gas-giant-ladder';
import { GreenGasGiantPrediction, GreenGasGiantVerdict } from '../../data/green-gas-giant-prediction';
import { formatGroupedInteger } from '../../data/unit-conversions';

/** Data passed to the Green Gas Giant dialog when it is opened from a gas giant. */
export interface GreenGasGiantDialogData {
  /** The body being explained. */
  bodyName: string;
  /** Its subType, as reported — e.g. "Class I gas giant". */
  subType: string;
  /** The cloud-layer model's output for this body. */
  prediction: GreenGasGiantPrediction;
  /** True when this body is in the community Green Gas Giant catalogue, i.e. confirmed by a visit. */
  isCatalogued: boolean;
}

/** Title + explanation shown for each verdict, independent of any one body. */
const VERDICT_COPY: Readonly<Record<GreenGasGiantVerdict, { title: string; detail: string }>> = {
  'green': {
    title: 'Predicted Green Gas Giant',
    detail: 'A cloud layer sits exactly on a band boundary, and this class never gets a random '
      + 'temperature offset. Expect it to render green.',
  },
  'green-unless-nudged': {
    title: 'Predicted Green Gas Giant, unless nudged',
    detail: 'A cloud layer sits exactly on a band boundary, so it should render green. But this '
      + 'class can get a random temperature offset first, which would move the layer off it. '
      + 'Only a visit settles it.',
  },
  'possible': {
    title: 'Possible Green Gas Giant',
    detail: 'No cloud layer sits on a band boundary, but this class can get a random temperature '
      + 'offset first, which could move one onto it. Only a visit settles it.',
  },
  'unpredictable': {
    title: 'Green Gas Giant: cannot be predicted',
    detail: 'This class always gets a random temperature offset before its layers are built, and '
      + 'no public data records it. The layers below are the starting point before that offset, '
      + 'not a prediction.',
  },
  'imprecise': {
    title: 'Green Gas Giant: temperature too rounded',
    detail: 'The recorded temperature is a whole number in a record that was rounded at source, '
      + 'and the model needs about six decimal places. The layers below use the whole number as '
      + 'given. Check the temperature in your own scan.',
  },
  'near-miss': {
    title: 'Green Gas Giant near miss',
    detail: 'A cloud layer misses a band boundary by the smallest gap the game can store, or two. '
      + 'Scans round mass and radius slightly, so the true values could still land it on the '
      + 'boundary. Worth a look, though most near misses are not green.',
  },
  'not-green': {
    title: 'Not a Green Gas Giant',
    detail: 'No cloud layer sits on a band boundary, and this class never gets a random '
      + 'temperature offset. It renders normally.',
  },
};

/**
 * Explains why a gas giant does or does not render green, using the cloud-layer model
 * published by CMDRs Arcanic and Regza (https://ed-ggg.github.io/edggg/densitydemo.html).
 *
 * The dialog shows the verdict, a to-scale illustration of the seven cloud layers against
 * the temperature bands they're coloured from, the numbers that placed them (density,
 * spacing, ceiling, reach), and a per-layer table. For a catalogued Green Gas Giant it
 * also says so, since a confirmed sighting outranks any prediction.
 */
@Component({
  selector: 'app-green-gas-giant-dialog',
  templateUrl: './green-gas-giant-dialog.component.html',
  styleUrls: ['./green-gas-giant-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogShellComponent],
})
export class GreenGasGiantDialogComponent {
  public readonly data = inject<GreenGasGiantDialogData>(MAT_DIALOG_DATA);

  public readonly diagram = computed(() => greenGasGiantLadderDiagram(this.data.prediction));

  /** The dialog title: the verdict itself, or "confirmed" for a catalogued body. */
  public get heading(): string {
    return this.data.isCatalogued ? 'Confirmed Green Gas Giant' : this.verdictTitle;
  }

  public get verdictTitle(): string {
    return VERDICT_COPY[this.data.prediction.verdict].title;
  }

  public get detail(): string {
    return VERDICT_COPY[this.data.prediction.verdict].detail;
  }

  /** Bulk density with a thousands separator, e.g. "1,062". */
  public get densityDisplay(): string {
    return formatGroupedInteger(Math.round(this.data.prediction.density));
  }

  /** What set the layer spacing, in one phrase — the sentence under the numbers. */
  public get spacingExplanation(): string {
    const { cappedByCeiling, densityDriven, ceiling } = this.data.prediction;
    if (cappedByCeiling) {
      return `The layers reach the ${formatGroupedInteger(ceiling)} K ceiling, so the surface `
        + 'temperature alone sets the spacing.';
    }
    if (densityDriven) {
      return 'The layers stop short of the ceiling, so bulk density sets the spacing. That is why '
        + 'two giants at the same temperature can differ.';
    }
    return 'This class holds the spacing at a fixed limit, so neither density nor the ceiling '
      + 'sets it.';
  }

  /** A layer's temperature at the precision the model actually compares at. */
  public layerDisplay(temperature: number): string {
    return temperature.toFixed(6);
  }

  /** Why a given layer is or isn't the green one, for the table's third column. */
  public layerNote(layer: number): string {
    const { hitLayer, hitCrack, nearest } = this.data.prediction;
    if (hitLayer === layer && hitCrack !== null) {
      return `exactly on the ${formatGroupedInteger(hitCrack)} K boundary`;
    }
    if (nearest?.layer === layer) {
      const gap = nearest.delta < 0.01 ? nearest.delta.toFixed(6) : nearest.delta.toFixed(2);
      const smallest = nearest.ulps === 1 ? ', the smallest gap the game can store' : '';
      return `closest: ${gap} K off the ${formatGroupedInteger(nearest.crack)} K boundary${smallest}`;
    }
    return '';
  }
}
