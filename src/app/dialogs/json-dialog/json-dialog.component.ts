import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { DialogShellComponent } from '../dialog-shell/dialog-shell.component';
import { SystemBody, EdGalaxyData } from '../../home/home.component';

/** Data passed to the body-JSON dialog when it is opened. */
export interface JsonDialogData {
  body: SystemBody;
  edGalaxyData: EdGalaxyData | null;
}

/**
 * Pretty-prints body data as JSON. id64 is a bigint to preserve 64-bit precision;
 * JSON.stringify can't serialize BigInt natively, so it is rendered as its exact decimal
 * string. Shared with the host so the "right-click to copy" shortcut and the dialog agree.
 */
export function formatBodyJson(bodyData: unknown): string {
  return JSON.stringify(bodyData, (_key, value) => (typeof value === 'bigint' ? value.toString() : value), 2);
}

/**
 * Shows the raw body JSON, with a deep link into EDGalaxyData's journal lookup and a
 * copy-to-clipboard action. The JSON is formatted once on construction so the template
 * binding doesn't re-stringify on every change-detection pass.
 */
@Component({
  selector: 'app-json-dialog',
  templateUrl: './json-dialog.component.html',
  styleUrls: ['./json-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogShellComponent, MatButton],
})
export class JsonDialogComponent {
  private readonly data = inject<JsonDialogData>(MAT_DIALOG_DATA);

  public readonly bodyJsonCopied = signal(false);

  /** Pretty-printed body JSON, cached so the template binding doesn't re-stringify per CD pass. */
  public readonly formattedBodyJson = formatBodyJson(this.data.body.bodyData);

  /** Deep link into the EDGalaxyData journal lookup for this body. */
  public readonly edGalaxyHref = this.buildEdGalaxyHref();

  public copyBodyJson(): void {
    navigator.clipboard?.writeText(this.formattedBodyJson)
      .then(() => {
        this.bodyJsonCopied.set(true);
        setTimeout(() => this.bodyJsonCopied.set(false), 1500);
      })
      .catch(() => { /* clipboard unavailable */ });
  }

  private buildEdGalaxyHref(): string {
    const { body, edGalaxyData } = this.data;
    const systemName = encodeURIComponent(edGalaxyData?.Name || body.bodyData.name);
    const systemId64 = edGalaxyData?.SystemAddress || body.bodyData.id64;
    return 'https://edgalaxydata.space/eddn-lookup/bodies.php'
      + `?systemName=${systemName}`
      + `&systemId64=${systemId64}`
      + `&bodyId=${this.edGalaxyBodyId(body)}`;
  }

  /** Body id for the EDGalaxyData lookup, falling back to the parent's id for rings/belts. */
  private edGalaxyBodyId(b: SystemBody): number {
    if (!b || !b.bodyData) { return -1; }
    const bid = typeof b.bodyData.bodyId === 'number' ? b.bodyData.bodyId : -1;
    if (bid && bid > -1) {
      return bid;
    }
    if (b.parent?.bodyData && typeof b.parent.bodyData.bodyId === 'number' && b.parent.bodyData.bodyId > -1) {
      return b.parent.bodyData.bodyId;
    }
    return bid;
  }
}
