import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { SystemBody } from '../home/home.component';

@Component({
  selector: 'app-system-body',
  templateUrl: './system-body.component.html',
  styleUrls: ['./system-body.component.scss']
})
export class SystemBodyComponent implements OnChanges {
  @Input() body!: SystemBody;
  public hasSignals = false;
  public humanSignalCount: number = 0;
  public otherSignalCount: number = 0;

  public geologySignalCount: number = 0;
  public geologySignals: string[] = [];

  public biologySignalCount: number = 0;
  public biologySignals: string[] = [];

  public genusesSignals: string[] = [];

  public thargoidSignalCount: number = 0;
  public thargoidSignals: string[] = [];

  public guardianSignalCount: number = 0;
  public guardianSignals: string[] = [];

  public bodyImage: string = "";

  public ngOnChanges(changes: SimpleChanges): void {
    if (!this.body) {
      return;
    }
    switch (this.body.bodyData.type) {
      case "Star": {
        switch (this.body.bodyData.spectralClass) {
          case "G2": {
            this.bodyImage = "G Star.png";
            break;
          }
          default: {
            this.bodyImage = "";
            break;
          }
        }
        break;
      }
      default: {
        this.bodyImage = "";
        break;
      }
    }
    if (this.body.bodyData.signals) {
      this.humanSignalCount = this.body.bodyData.signals.signals ? this.body.bodyData.signals.signals['$SAA_SignalType_Human;'] : 0;
      this.otherSignalCount = this.body.bodyData.signals.signals ? this.body.bodyData.signals.signals['$SAA_SignalType_Other;'] : 0;
      this.geologySignalCount = this.body.bodyData.signals.signals ? this.body.bodyData.signals.signals['$SAA_SignalType_Geological;'] : 0;
      this.biologySignalCount = this.body.bodyData.signals.signals ? this.body.bodyData.signals.signals['$SAA_SignalType_Biological;'] : 0;
      this.thargoidSignalCount = this.body.bodyData.signals.signals ? this.body.bodyData.signals.signals['$SAA_SignalType_Thargoid;'] : 0;
      this.guardianSignalCount = this.body.bodyData.signals.signals ? this.body.bodyData.signals.signals['$SAA_SignalType_Guardian;'] : 0;
      this.geologySignals = this.body.bodyData.signals.geology ?? [];
      this.biologySignals = this.body.bodyData.signals.biology ?? [];
      this.genusesSignals = this.body.bodyData.signals.genuses ?? [];
      this.thargoidSignals = this.body.bodyData.signals.thargoids ?? [];
      this.guardianSignals = this.body.bodyData.signals.guardians ?? [];
    }
    this.hasSignals = this.humanSignalCount > 0 || this.otherSignalCount > 0 || this.geologySignals.length > 0 || this.biologySignals.length > 0 || this.genusesSignals.length > 0 || this.thargoidSignals.length > 0 || this.guardianSignals.length > 0;
  }
}
