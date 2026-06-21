import { ChangeDetectionStrategy, Component, Signal, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { HrDiagram, hrPlot } from '../../data/hr-diagram';
import {
  StellarAgeAssessment,
  assessStellarAge,
  formatMillionYears,
} from '../../data/stellar-reference';

/** Stellar fields the H-R dialog needs, passed via MatDialog's data. */
export interface HrDiagramData {
  bodyName?: string;
  subType?: string | null;
  spectralClass?: string | null;
  luminosity?: string | null;
  solarMasses?: number | null;
  solarRadius?: number | null;
  surfaceTemperature?: number | null;
  absoluteMagnitude?: number | null;
  /** Age in millions of years. */
  ageMyr?: number | null;
}

/**
 * Standalone modal that plots a star on a Hertzsprung–Russell diagram (temperature vs
 * absolute magnitude) and compares its age to the main-sequence lifetime implied by its
 * class. Opened from the body detail rows / title badge via MatDialog. All geometry and
 * the age assessment come from framework-free helpers so they stay unit-testable.
 */
@Component({
  selector: 'app-hr-diagram-dialog',
  templateUrl: './hr-diagram-dialog.component.html',
  styleUrls: ['./hr-diagram-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, MatDialogTitle, CdkScrollable, MatDialogContent, MatDialogActions, MatDialogClose, MatButton],
})
export class HrDiagramDialogComponent {
  readonly data = inject<HrDiagramData>(MAT_DIALOG_DATA);

  readonly diagram: Signal<HrDiagram> = computed(() =>
    hrPlot({
      surfaceTemperature: this.data.surfaceTemperature,
      absoluteMagnitude: this.data.absoluteMagnitude,
      spectralClass: this.data.spectralClass,
      subType: this.data.subType,
      luminosity: this.data.luminosity,
      solarRadius: this.data.solarRadius,
    }),
  );

  readonly assessment: Signal<StellarAgeAssessment> = computed(() =>
    assessStellarAge({
      spectralClass: this.data.spectralClass,
      subType: this.data.subType,
      luminosity: this.data.luminosity,
      solarMasses: this.data.solarMasses,
      ageMyr: this.data.ageMyr,
    }),
  );

  get title(): string {
    return this.data.bodyName ? `H–R diagram — ${this.data.bodyName}` : 'Hertzsprung–Russell diagram';
  }

  /**
   * Formats a millions-of-years value in the same "N million years" units the body detail
   * screen uses for a star's age, so every age and lifetime figure in the dialog matches
   * the units the user just clicked from.
   */
  formatAge(myr: number | null | undefined): string {
    return myr == null ? '—' : formatMillionYears(myr);
  }
}
