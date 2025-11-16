import { Component, Input, OnChanges, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { SystemBody } from '../home/home.component';
import { faCircleChevronRight, faCircleQuestion, faSquareCaretDown, faSquareCaretUp, faUpRightFromSquare, faCode, faLock } from '@fortawesome/free-solid-svg-icons';
import { AppService, CanonnCodexEntry } from '../app.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BodyImage } from '../data/body-images';
import { animate, style, transition, trigger } from '@angular/animations';
import { MatTooltip } from '@angular/material/tooltip';

@UntilDestroy()
@Component({
  selector: 'app-system-body',
  templateUrl: './system-body.component.html',
  styleUrls: ['./system-body.component.scss'],

  animations: [
    trigger("grow", [ // Note the trigger name
      transition(":enter", [
        // :enter is alias to 'void => *'
        style({ height: "0", overflow: "hidden" }),
        animate(250, style({ height: "*" }))
      ]),
      transition(":leave", [
        // :leave is alias to '* => void'
        animate(250, style({ height: 0, overflow: "hidden" }))
      ])
    ])
  ]
})
export class SystemBodyComponent implements OnInit, OnChanges, AfterViewInit {
  public readonly faChevronRight = faCircleChevronRight;
  public readonly faCircleQuestion = faCircleQuestion;
  public readonly faUpRightFromSquare = faUpRightFromSquare;
  public readonly faSquareCaretDown = faSquareCaretDown;
  public readonly faSquareCaretUp = faSquareCaretUp;
  public readonly faCode = faCode;
  public readonly faLock = faLock;
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

  public exandable = false;
  public expanded = false;
  public isExpanded = false;
  public hoveredIndex: number = -1;

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

    this.bodyCoronaImage = "";
    this.bodyImage = "";

    const bodyImageResult = BodyImage.getBodyImagePath(this.body.bodyData);
    if (bodyImageResult) {
      this.bodyImage = `bodies/${bodyImageResult.path}.png`;
      if (bodyImageResult.coronaPath) {
        this.bodyCoronaImage = `bodies/${bodyImageResult.coronaPath}.png`;
      }
    }
    else if (this.body.bodyData.type === "Barycentre") {
      this.bodyImage = `Orbit2.gif`;
    }

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
      const addGuessesAndGenuses = this.biologySignals.length < this.biologySignalCount;
      if (this.body.bodyData.signals.guesses && addGuessesAndGenuses) {
        for (const guessedSignal of this.body.bodyData.signals.guesses) {
          if (this.biologySignals.findIndex(b => b.signal == guessedSignal) !== -1) {
            continue;
          }
          const codexEntry = this.codex?.find(c => c.english_name == guessedSignal);
          if (codexEntry && this.biologySignals.findIndex(b => b.codex?.sub_class == codexEntry.sub_class) !== -1) {
            continue;
          }
          this.biologySignals.push({
            entryId: codexEntry?.entryid ?? 0,
            signal: guessedSignal,
            codex: codexEntry,
            isGuess: true,
          });
        }
      }
      if (this.body.bodyData.signals.genuses && addGuessesAndGenuses) {
        for (const genusSiggnal of this.body.bodyData.signals.genuses) {
          const genusName = genus[genusSiggnal] ?? genusSiggnal;
          if (this.biologySignals.findIndex(b => b.signal.includes(genusName)) !== -1) {
            continue;
          }
          const codexEntry = this.codex?.find(c => c.category == genusName);
          this.biologySignals.push({
            entryId: codexEntry?.entryid ?? 0,
            signal: genusName,
            codex: codexEntry,
            isGuess: true,
          });
        }
      }
    }
    this.hasSignals = this.humanSignalCount > 0 || this.otherSignalCount > 0 || this.geologySignalCount > 0 || this.biologySignalCount > 0 || this.thargoidSignalCount > 0 || this.guardianSignalCount > 0 ||
      this.geologySignals.length > 0 || this.biologySignals.length > 0 || this.thargoidSignals.length > 0 || this.guardianSignals.length > 0;
    this.exandable = !this.hasSignals;
    this.isExpanded = !this.exandable || this.expanded;

    if (this.isRoot) {
      this.styleClass = "";
    }
    else if (!this.isLast) {
      if (!this.isExpanded) {
        this.styleClass = "child-container-title-only";
      }
      else {
        this.styleClass = "child-container-default";
      }
    }
    else {
      if (!this.isExpanded) {
        this.styleClass = "child-container-title-only-last";
      }
      else {
        this.styleClass = "child-container-default-last";
      }
    }
  }

  public toggleExpand(): void {
    this.expanded = !this.expanded;
    this.ngOnChanges();
  }

  public getEccentricityAnalysis(eccentricity: number): string {
    if (eccentricity === 0) return 'Circular';
    if (eccentricity < 0.4) return 'Nearly Circular';
    if (eccentricity < 0.8) return 'Eccentric';
    return 'Highly Eccentric';
  }

  public getAtmosphereCompositionTooltip(): string {
    if (!this.body.bodyData.atmosphereComposition) {
      return '';
    }
    return Object.entries(this.body.bodyData.atmosphereComposition)
      .map(([gas, percentage]) => `${gas}: ${percentage.toFixed(2)}%`)
      .join('\n');
  }

  public getAtmosphereDisplay(): string {
    if (this.body.bodyData.atmosphereType) {
      return this.body.bodyData.atmosphereType;
    }
    if (this.body.bodyData.atmosphereComposition) {
      const largest = Object.entries(this.body.bodyData.atmosphereComposition)
        .reduce((max, [gas, percentage]) => percentage > max[1] ? [gas, percentage] : max);
      return `${largest[0]} ${largest[1].toFixed(2)}%`;
    }
    return '';
  }

  public getApoapsis(): number {
    const semiMajorAxisKm = (this.body.bodyData.semiMajorAxis ?? 0) * 149597870.7;
    const eccentricity = this.body.bodyData.orbitalEccentricity ?? 0;
    return semiMajorAxisKm * (1 + eccentricity);
  }

  public getPeriapsis(): number {
    const semiMajorAxisKm = (this.body.bodyData.semiMajorAxis ?? 0) * 149597870.7;
    const eccentricity = this.body.bodyData.orbitalEccentricity ?? 0;
    return semiMajorAxisKm * (1 - eccentricity);
  }

  public getRingWidth(): number {
    const outer = this.body.bodyData.outerRadius ?? 0;
    const inner = this.body.bodyData.innerRadius ?? 0;
    return outer - inner;
  }

  public getRingArea(): number {
    const outer = this.body.bodyData.outerRadius ?? 0;
    const inner = this.body.bodyData.innerRadius ?? 0;
    return Math.PI * (outer * outer - inner * inner);
  }

  public getRingDensity(): number {
    const mass = this.body.bodyData.mass ?? 0;
    const area = this.getRingArea();
    return area > 0 ? mass / area : 0;
  }

  public isRingNotVisible(): boolean {
    if (this.body.bodyData.type !== 'Ring') {
      return false;
    }
    const density = this.getRingDensity();
    const width = this.getRingWidth();
    return density < 0.1 && width > 1000000;
  }

  public getSolidCompositionTooltip(): string {
    if (!this.body.bodyData.solidComposition) {
      return '';
    }
    return Object.entries(this.body.bodyData.solidComposition)
      .map(([component, percentage]) => `${component}: ${percentage.toFixed(2)}%`)
      .join('\n');
  }



  public ngAfterViewInit(): void {
    // Additional debug after view init
  }

  public trackByMaterial(index: number, material: { name: string, class: string, tooltip: string }): string {
    return material.name;
  }



  public onMouseEnter(index: number): void {
    this.hoveredIndex = index;
  }

  public copyBodyJson(): void {
    const jsonText = JSON.stringify(this.body.bodyData, null, 2);
    const textArea = document.createElement('textarea');
    textArea.value = jsonText;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textArea);
    console.log('Copy success:', success, 'JSON length:', jsonText.length);
  }

  public getSpinResonance(): string {
    if (!this.body.bodyData.rotationalPeriod || !this.body.bodyData.orbitalPeriod) {
      return 'none';
    }
    
    const rotationsPerOrbit = this.body.bodyData.orbitalPeriod / this.body.bodyData.rotationalPeriod;
    const maxDenominator = 5;
    const tolerance = 0.01;
    
    for (let denom = 1; denom <= maxDenominator; denom++) {
      for (let num = 1; num <= maxDenominator; num++) {
        const candidate = num / denom;
        const relError = Math.abs(candidate - rotationsPerOrbit) / candidate;
        if (relError <= tolerance) {
          return `${num}:${denom}`;
        }
      }
    }
    
    return 'none';
  }

  public getSpinResonanceTooltip(): string {
    const resonance = this.getSpinResonance();
    if (resonance === 'none' && this.body.bodyData.rotationalPeriodTidallyLocked) {
      return 'Rotational Period Tidally Locked';
    }
    if (resonance === '1:1' && this.body.bodyData.rotationalPeriodTidallyLocked) {
      if (this.body.bodyData.subType === 'Earth-like world') {
        return 'Eyeball Earth';
      }
      return 'Synchronised';
    }
    return resonance + ' spin resonance';
  }

  public getMaterialBadges(): { name: string, class: string, tooltip: string }[] {
    if (!this.body.bodyData.materials) {
      return [];
    }
    
    const materialData: { [key: string]: { grade: string, abbrev: string } } = {
      // Grade 1 (Very Rare)
      'Antimony': { grade: 'badge-mat1', abbrev: 'Sb' },
      'Polonium': { grade: 'badge-mat1', abbrev: 'Po' },
      'Ruthenium': { grade: 'badge-mat1', abbrev: 'Ru' },
      'Selenium': { grade: 'badge-mat1', abbrev: 'Se' },
      'Technetium': { grade: 'badge-mat1', abbrev: 'Tc' },
      'Tellurium': { grade: 'badge-mat1', abbrev: 'Te' },
      'Yttrium': { grade: 'badge-mat1', abbrev: 'Y' },
      // Grade 2 (Rare)
      'Cadmium': { grade: 'badge-mat2', abbrev: 'Cd' },
      'Mercury': { grade: 'badge-mat2', abbrev: 'Hg' },
      'Molybdenum': { grade: 'badge-mat2', abbrev: 'Mo' },
      'Niobium': { grade: 'badge-mat2', abbrev: 'Nb' },
      'Tin': { grade: 'badge-mat2', abbrev: 'Sn' },
      'Vanadium': { grade: 'badge-mat2', abbrev: 'V' },
      // Grade 3 (Uncommon)
      'Arsenic': { grade: 'badge-mat3', abbrev: 'As' },
      'Chromium': { grade: 'badge-mat3', abbrev: 'Cr' },
      'Germanium': { grade: 'badge-mat3', abbrev: 'Ge' },
      'Manganese': { grade: 'badge-mat3', abbrev: 'Mn' },
      'Phosphorus': { grade: 'badge-mat3', abbrev: 'P' },
      'Tungsten': { grade: 'badge-mat3', abbrev: 'W' },
      'Zinc': { grade: 'badge-mat3', abbrev: 'Zn' },
      'Zirconium': { grade: 'badge-mat3', abbrev: 'Zr' },
      // Grade 4 (Common)
      'Carbon': { grade: 'badge-mat4', abbrev: 'C' },
      'Iron': { grade: 'badge-mat4', abbrev: 'Fe' },
      'Nickel': { grade: 'badge-mat4', abbrev: 'Ni' },
      'Sulphur': { grade: 'badge-mat4', abbrev: 'S' }
    };

    return Object.entries(this.body.bodyData.materials)
      .filter(([material, percentage]) => percentage > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([material, percentage]) => ({
        name: materialData[material]?.abbrev || material,
        class: materialData[material]?.grade || 'badge-gray',
        tooltip: `${material}: ${percentage.toFixed(2)}%`
      }));
  }


}

interface BiologySignal {
  entryId: number;
  signal: string;
  codex: CanonnCodexEntry | null | undefined;
  isGuess: boolean;
}

const genus: { [key: string]: string } = {
  "$Codex_Ent_Aleoids_Genus_Name;": "Aleoida",
  "$Codex_Ent_Bacterial_Genus_Name;": "Bacterium",
  "$Codex_Ent_Brancae_Name;": "Brain Tree",
  "$Codex_Ent_Cactoid_Genus_Name;": "Cactoida",
  "$Codex_Ent_Clepeus_Genus_Name;": "Clypeus",
  "$Codex_Ent_Clypeus_Genus_Name;": "Clypeus",
  "$Codex_Ent_Conchas_Genus_Name;": "Concha",
  "$Codex_Ent_Cone_Name;": "Bark Mounds",
  "$Codex_Ent_Electricae_Genus_Name;": "Electricae",
  "$Codex_Ent_Fonticulus_Genus_Name;": "Fonticulua",
  "$Codex_Ent_Fumerolas_Genus_Name;": "Fumerola",
  "$Codex_Ent_Fungoids_Genus_Name;": "Fungoida",
  "$Codex_Ent_Ground_Struct_Ice_Name;": "Crystalline Shards",
  "$Codex_Ent_Osseus_Genus_Name;": "Osseus",
  "$Codex_Ent_Recepta_Genus_Name;": "Recepta",
  "$Codex_Ent_Seed_Name;": "Brain Trees",
  "$Codex_Ent_Shrubs_Genus_Name;": "Frutexa",
  "$Codex_Ent_Sphere_Name;": "Anemone",
  "$Codex_Ent_Stratum_Genus_Name;": "Stratum",
  "$Codex_Ent_Tube_Name;": "Sinuous Tubers",
  "$Codex_Ent_Tubus_Genus_Name;": "Tubus",
  "$Codex_Ent_Tussocks_Genus_Name;": "Tussock",
  "$Codex_Ent_Vents_Name;": "Amphora Plant",
}