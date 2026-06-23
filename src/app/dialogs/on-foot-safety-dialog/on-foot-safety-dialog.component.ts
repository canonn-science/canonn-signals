import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DecimalPipe } from '@angular/common';
import { MatButton } from '@angular/material/button';
import { DialogShellComponent } from '../dialog-shell/dialog-shell.component';
import {
  DELTA_BY_SUBTYPE_ATMOSPHERE, DELTA_BY_SUBTYPE_NO_ATM, DELTA_BY_SUBTYPE,
  DELTA_BY_ATMOSPHERE, DELTA_BY_PRESSURE, DELTA_GLOBAL,
} from '../../data/temperature-estimation';

/** Data passed to the on-foot safety dialog when it is opened. */
export interface OnFootSafetyDialogData {
  bodyName: string;
  subType: string;
  atmosphereType: string | null;
  surfacePressure: number | null;
  surfaceTemperature: number | null;
  gravity: number | null;
  estimatedMin: number | null;
  estimatedMax: number | null;
  badgeClass: string;
  lookupSource: string;
  p5Delta: number;
  p95Delta: number;
}

/**
 * On-foot safety assessment for a landable body: the cool/warm temperature estimates,
 * how they map onto the suit's safe band and gravity ceiling, and the reference dataset
 * the estimates derive from (downloadable as CSV).
 */
@Component({
  selector: 'app-on-foot-safety-dialog',
  templateUrl: './on-foot-safety-dialog.component.html',
  styleUrls: ['./on-foot-safety-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogShellComponent, DecimalPipe, MatButton],
})
export class OnFootSafetyDialogComponent {
  public readonly data = inject<OnFootSafetyDialogData>(MAT_DIALOG_DATA);

  public readonly heading = `On-Foot Safety Analysis — ${this.data.bodyName}`;

  public downloadReferenceData(): void {
    const rows: string[] = ['Source,SubType,AtmosphereType,p5_delta_K,p95_delta_K'];
    for (const key of Object.keys(DELTA_BY_SUBTYPE_ATMOSPHERE)) {
      const [st, at] = key.split('|');
      const d = DELTA_BY_SUBTYPE_ATMOSPHERE[key];
      rows.push(`subtype+atmosphere,"${st}","${at}",${d.p5},${d.p95}`);
    }
    for (const st of Object.keys(DELTA_BY_SUBTYPE_NO_ATM)) {
      const d = DELTA_BY_SUBTYPE_NO_ATM[st];
      rows.push(`subtype+no-atmosphere,"${st}","No atmosphere",${d.p5},${d.p95}`);
    }
    for (const st of Object.keys(DELTA_BY_SUBTYPE)) {
      const d = DELTA_BY_SUBTYPE[st];
      rows.push(`subtype,"${st}",,${d.p5},${d.p95}`);
    }
    for (const at of Object.keys(DELTA_BY_ATMOSPHERE)) {
      const d = DELTA_BY_ATMOSPHERE[at];
      rows.push(`atmosphere,,"${at}",${d.p5},${d.p95}`);
    }
    for (const pc of Object.keys(DELTA_BY_PRESSURE)) {
      const d = DELTA_BY_PRESSURE[pc];
      rows.push(`pressure_class,,"${pc} pressure",${d.p5},${d.p95}`);
    }
    rows.push(`global,,,${DELTA_GLOBAL.p5},${DELTA_GLOBAL.p95}`);
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'on-foot-temperature-reference.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
}
