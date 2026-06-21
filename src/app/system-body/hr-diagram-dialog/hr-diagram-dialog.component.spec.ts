import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { HrDiagramData, HrDiagramDialogComponent } from './hr-diagram-dialog.component';

function setup(data: HrDiagramData): ComponentFixture<HrDiagramDialogComponent> {
  TestBed.configureTestingModule({
    imports: [HrDiagramDialogComponent],
    providers: [provideZonelessChangeDetection(), { provide: MAT_DIALOG_DATA, useValue: data }],
  });
  const fixture = TestBed.createComponent(HrDiagramDialogComponent);
  fixture.detectChanges();
  return fixture;
}

describe('HrDiagramDialogComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('plots a normal main-sequence star and reports a typical age', () => {
    const fixture = setup({
      bodyName: 'Sol', spectralClass: 'G2', luminosity: 'V',
      solarMasses: 1, surfaceTemperature: 5778, absoluteMagnitude: 4.83, ageMyr: 4600,
    });
    const c = fixture.componentInstance;
    expect(c.diagram().point).not.toBeNull();
    expect(c.assessment().status).toBe('typical');
    expect(fixture.nativeElement.querySelector('.star')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.age-bar')).toBeTruthy();
  });

  it('flags an implausibly old hot star and titles with the body name', () => {
    const fixture = setup({
      bodyName: 'Test A', spectralClass: 'O5', luminosity: 'V',
      solarMasses: 30, surfaceTemperature: 40000, absoluteMagnitude: -5, ageMyr: 6000,
    });
    const c = fixture.componentInstance;
    expect(c.title).toContain('Test A');
    expect(c.assessment().status).toBe('old');
    expect(c.assessment().outOfRange).toBe(true);
  });

  it('handles a body that cannot be plotted', () => {
    const fixture = setup({ bodyName: 'BH', spectralClass: null, luminosity: null, ageMyr: 3000 });
    expect(fixture.componentInstance.diagram().point).toBeNull();
    expect(fixture.nativeElement.querySelector('.note')).toBeTruthy();
  });

  it('plots a white dwarf in its region via a radius-derived magnitude', () => {
    const fixture = setup({
      bodyName: 'LAWD 96', spectralClass: 'DA5', subType: 'White Dwarf (DA) Star',
      luminosity: 'VII', solarMasses: 1.26, solarRadius: 0.0038452,
      surfaceTemperature: 27735, absoluteMagnitude: null, ageMyr: 1298,
    });
    const c = fixture.componentInstance;
    expect(c.diagram().point).not.toBeNull();
    expect(c.diagram().regions.find((r) => r.key === 'whitedwarfs')!.current).toBe(true);
    expect(c.assessment().status).toBe('evolved');
  });

  it('formats ages in million-years units, with an em dash for missing values', () => {
    const c = setup({ ageMyr: 4600 }).componentInstance;
    expect(c.formatAge(2920)).toBe('2,920 million years');
    expect(c.formatAge(null)).toBe('—');
    expect(c.title).toBe('Hertzsprung–Russell diagram'); // no bodyName → default title
  });
});
