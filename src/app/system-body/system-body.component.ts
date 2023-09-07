import { Component, Input, OnChanges, OnInit } from '@angular/core';
import { SystemBody } from '../home/home.component';
import { faCircleChevronRight, faCircleQuestion, faUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';
import { AppService, CanonnCodexEntry } from '../app.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BodyImage } from '../data/body-images';

@UntilDestroy()
@Component({
  selector: 'app-system-body',
  templateUrl: './system-body.component.html',
  styleUrls: ['./system-body.component.scss']
})
export class SystemBodyComponent implements OnInit, OnChanges {
  public readonly faChevronRight = faCircleChevronRight;
  public readonly faCircleQuestion = faCircleQuestion;
  public readonly faUpRightFromSquare = faUpRightFromSquare;
  @Input() body!: SystemBody;
  @Input() isRoot: boolean = false;
  @Input() isLast: boolean = false;
  public styleClass = "child-container-default";
  private codex: CanonnCodexEntry[] | null = null;
  public hasSignals = false;
  public humanSignalCount: number = 0;
  public otherSignalCount: number = 0;

  public geologySignalCount: number = 0;
  public geologySignals: string[] = [];

  public biologySignalCount: number = 0;
  public biologySignals: BiologySignal[] = [];

  public thargoidSignalCount: number = 0;
  public thargoidSignals: string[] = [];

  public guardianSignalCount: number = 0;
  public guardianSignals: string[] = [];

  public bodyImage: string = "";
  public bodyCoronaImage: string = "";

  public constructor(private readonly appService: AppService) {
  }

  public ngOnInit(): void {
    this.appService.codexEntries
      .pipe(untilDestroyed(this))
      .subscribe(c => {
        this.codex = c;
        this.ngOnChanges();
      });
  }

  public ngOnChanges(): void {
    if (!this.body) {
      return;
    }

    if (this.isRoot) {
      this.styleClass = "";
    }
    else if (!this.isLast) {
      if (this.body.bodyData.type == 'Barycentre') {
        this.styleClass = "child-container-barycentre";
      }
      else {
        this.styleClass = "child-container-default";
      }
    }
    else {
      if (this.body.bodyData.type == 'Barycentre') {
        this.styleClass = "child-container-barycentre-last";
      }
      else {
        this.styleClass = "child-container-default-last";
      }
    }

    const bodyImageResult = BodyImage.getBodyImagePath(this.body.bodyData);

    this.bodyImage = bodyImageResult?.path ?? "";
    this.bodyCoronaImage = bodyImageResult?.coronaPath ?? "";

    if (this.body.bodyData.signals) {
      this.humanSignalCount = this.body.bodyData.signals.signals ? this.body.bodyData.signals.signals['$SAA_SignalType_Human;'] : 0;
      this.otherSignalCount = this.body.bodyData.signals.signals ? this.body.bodyData.signals.signals['$SAA_SignalType_Other;'] : 0;
      this.geologySignalCount = this.body.bodyData.signals.signals ? this.body.bodyData.signals.signals['$SAA_SignalType_Geological;'] : 0;
      this.biologySignalCount = this.body.bodyData.signals.signals ? this.body.bodyData.signals.signals['$SAA_SignalType_Biological;'] : 0;
      this.thargoidSignalCount = this.body.bodyData.signals.signals ? this.body.bodyData.signals.signals['$SAA_SignalType_Thargoid;'] : 0;
      this.guardianSignalCount = this.body.bodyData.signals.signals ? this.body.bodyData.signals.signals['$SAA_SignalType_Guardian;'] : 0;
      this.geologySignals = this.body.bodyData.signals.geology ?? [];
      this.thargoidSignals = this.body.bodyData.signals.thargoid ?? [];
      this.guardianSignals = this.body.bodyData.signals.guardian ?? [];
      this.biologySignals = [];
      if (this.body.bodyData.signals.biology) {
        for (const biologySignal of this.body.bodyData.signals.biology) {
          const codexEntry = this.codex?.find(c => c.english_name == biologySignal);
          this.biologySignals.push({
            entryId: codexEntry?.entryid ?? 0,
            signal: biologySignal,
            codex: codexEntry,
            isGuess: false,
          });
        }
      }
      if (this.body.bodyData.signals.guesses && this.biologySignals.length < this.biologySignalCount) {
        for (const guessedSignal of this.body.bodyData.signals.guesses) {
          if (this.biologySignals.findIndex(b => b.signal == guessedSignal) !== -1) {
            continue;
          }
          const codexEntry = this.codex?.find(c => c.english_name == guessedSignal);
          this.biologySignals.push({
            entryId: codexEntry?.entryid ?? 0,
            signal: guessedSignal,
            codex: codexEntry,
            isGuess: true,
          });
        }
      }
    }
    this.hasSignals = this.humanSignalCount > 0 || this.otherSignalCount > 0 || this.geologySignals.length > 0 || this.biologySignals.length > 0 || this.thargoidSignals.length > 0 || this.guardianSignals.length > 0;
  }
}

interface BiologySignal {
  entryId: number;
  signal: string;
  codex: CanonnCodexEntry | null | undefined;
  isGuess: boolean;
}
