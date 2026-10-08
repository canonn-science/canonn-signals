import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { GreenGasGiantDialogComponent, GreenGasGiantDialogData } from './green-gas-giant-dialog.component';
import { GreenGasGiantCandidate, predictGreenGasGiant } from '../../data/green-gas-giant-prediction';

function dialogData(
  body: GreenGasGiantCandidate,
  over: Partial<Omit<GreenGasGiantDialogData, 'prediction'>> = {},
): GreenGasGiantDialogData {
  const prediction = predictGreenGasGiant(body);
  expect(prediction).not.toBeNull();
  return {
    bodyName: 'Test Giant 2',
    subType: body.subType ?? '',
    prediction: prediction!,
    isCatalogued: false,
    ...over,
  };
}

function setup(data: GreenGasGiantDialogData): ComponentFixture<GreenGasGiantDialogComponent> {
  TestBed.configureTestingModule({
    imports: [GreenGasGiantDialogComponent],
    providers: [provideZonelessChangeDetection(), { provide: MAT_DIALOG_DATA, useValue: data }],
  });
  const fixture = TestBed.createComponent(GreenGasGiantDialogComponent);
  fixture.detectChanges();
  return fixture;
}

/** M17 Sector CF-Y c1-23 2 — green, density-driven, 6th layer on the 270 K boundary. */
const GREEN: GreenGasGiantCandidate = {
  subType: 'Class I gas giant',
  surfaceTemperature: 133.998352,
  earthMasses: 220.366837,
  radius: 66635.716,
};

describe('GreenGasGiantDialogComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renders the green verdict, the body, and the layer that lands on the boundary', () => {
    const fixture = setup(dialogData(GREEN, { bodyName: 'M17 Sector CF-Y c1-23 2' }));
    const text: string = fixture.nativeElement.textContent;
    expect(fixture.componentInstance.heading).toBe('Predicted Green Gas Giant');
    // The verdict is the dialog title, said once — not repeated as a headline under it.
    expect(text.split('Predicted Green Gas Giant')).toHaveLength(2);
    expect(text).toContain('M17 Sector CF-Y c1-23 2');
    expect(text).toContain('Class I gas giant');
    // The hit layer, at the precision the model actually compares at.
    expect(text).toContain('270.000000 K');
    expect(text).toContain('exactly on the 270 K boundary');
  });

  it('draws the ladder with a highlighted rung and a green planet edge', () => {
    const fixture = setup(dialogData(GREEN));
    const svg: SVGElement = fixture.nativeElement.querySelector('svg.ggg-ladder');
    expect(svg).toBeTruthy();
    expect(svg.querySelectorAll('.rung')).toHaveLength(7);
    expect(svg.querySelectorAll('.rung--hit')).toHaveLength(1);
    expect(svg.querySelectorAll('.crack--hit')).toHaveLength(1);
    expect(svg.querySelectorAll('.stripe')).toHaveLength(7);
    expect(svg.querySelectorAll('.stripe--hit')).toHaveLength(1);
    expect(svg.querySelector('.planet-edge--green')).toBeTruthy();
    // The stripe on a boundary belongs to no band, so it carries no data-band attribute
    // and the stylesheet paints it the renderer's default green.
    expect(svg.querySelector('.stripe--hit')!.hasAttribute('data-band')).toBe(false);
  });

  it('gives the diagram an aria-label describing the verdict, since the SVG is invisible to AT', () => {
    const svg = setup(dialogData(GREEN)).nativeElement.querySelector('svg.ggg-ladder');
    expect(svg.getAttribute('role')).toBe('img');
    const label = svg.getAttribute('aria-label');
    expect(label).toContain('Cloud-layer diagram');
    expect(label).toContain('renders green');
  });

  it('reports the numbers that placed the layers, and says density set the spacing', () => {
    const fixture = setup(dialogData(GREEN));
    const text: string = fixture.nativeElement.textContent;
    expect(fixture.componentInstance.densityDisplay).toBe('1,062');
    expect(text).toContain('1,062 kg/m³');
    expect(text).toContain('27.2003 K');
    expect(text).toContain('340 K');
    expect(fixture.componentInstance.spacingExplanation).toContain('bulk density sets the spacing');
  });

  it('says the ceiling set the spacing when the layers reach it', () => {
    const fixture = setup(dialogData({
      subType: 'Gas giant with water-based life',
      surfaceTemperature: 158, earthMasses: 389.048157, radius: 74427.544,
    }));
    expect(fixture.componentInstance.spacingExplanation).toContain('340 K ceiling');
    expect(fixture.componentInstance.spacingExplanation).toContain('surface temperature alone');
  });

  it('titles a catalogued body as confirmed and names the model\'s verdict in the callout', () => {
    const fixture = setup(dialogData(GREEN, { isCatalogued: true }));
    const text: string = fixture.nativeElement.textContent;
    expect(fixture.componentInstance.heading).toBe('Confirmed Green Gas Giant');
    expect(text).toContain('confirmed green');
    expect(text).toContain('What the model makes of it:');
    expect(fixture.nativeElement.querySelector('.catalogued')).toBeTruthy();
  });

  it('shows no "confirmed" callout for an uncatalogued candidate', () => {
    const fixture = setup(dialogData(GREEN, { isCatalogued: false }));
    expect(fixture.nativeElement.querySelector('.catalogued')).toBeNull();
  });

  it('explains a not-green verdict and reports the closest approach instead of a hit', () => {
    const fixture = setup(dialogData({
      subType: 'Gas giant with water-based life',
      surfaceTemperature: 176.666626, earthMasses: 408.532623, radius: 75062.848,
    }));
    expect(fixture.componentInstance.heading).toBe('Not a Green Gas Giant');
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('closest: 0.000031 K off the 270 K boundary, the smallest gap the game can store');
    expect(fixture.nativeElement.querySelector('.rung--hit')).toBeNull();
  });

  it('explains an unpredictable verdict and still draws the pre-offset ladder', () => {
    const fixture = setup(dialogData({
      subType: 'Class II gas giant',
      surfaceTemperature: 166.724182, earthMasses: 95.072899, radius: 52542.176,
    }));
    expect(fixture.componentInstance.heading).toBe('Green Gas Giant: cannot be predicted');
    expect(fixture.componentInstance.detail).toContain('always gets a random temperature offset');
    expect(fixture.nativeElement.querySelectorAll('svg.ggg-ladder .rung')).toHaveLength(7);
  });

  it('does not title a body green when only a random offset could make it so', () => {
    // Dryooe Groa QX-F c16 A 7 — no layer on a boundary, but its class may be nudged.
    const fixture = setup(dialogData({
      subType: 'Class I gas giant',
      surfaceTemperature: 120.72538, earthMasses: 83.17791, radius: 57642.944,
    }));
    expect(fixture.componentInstance.heading).toBe('Green Gas Giant: depends on a random offset');
    expect(fixture.componentInstance.heading).not.toContain('Possible');
  });

  it('explains a green-unless-nudged verdict as still green, with the caveat', () => {
    // Vegnao PA-S c6-43 3 — hits the 250 K boundary but sits inside the nudge window.
    const fixture = setup(dialogData({
      subType: 'Class I gas giant',
      surfaceTemperature: 113.841248, earthMasses: 306.238953, radius: 72590.296,
    }));
    expect(fixture.componentInstance.heading).toBe('Predicted Green Gas Giant, unless nudged');
    expect(fixture.componentInstance.detail).toContain('random temperature offset');
  });

  it('explains a whole-number temperature from a rounded record as too imprecise to call', () => {
    const fixture = setup(dialogData({
      subType: 'Gas giant with water-based life',
      surfaceTemperature: 158, earthMasses: 639.976929, radius: 77196.584,
      atmosphereComposition: { Helium: 26.31, Hydrogen: 73.62, Oxygen: 0.07 },
    }));
    expect(fixture.componentInstance.heading).toBe('Green Gas Giant: temperature too rounded');
    expect(fixture.componentInstance.detail).toContain('Check the temperature in your own scan');
    // The rounded value still puts a layer on 210 K in the picture, but that is not a green verdict.
    const svg: SVGElement = fixture.nativeElement.querySelector('svg.ggg-ladder');
    expect(svg.querySelector('.stripe--hit')).toBeTruthy();
    expect(svg.querySelector('.planet-edge--green')).toBeNull();
    expect(svg.getAttribute('aria-label')).not.toContain('renders green');
  });

  it('lists all seven layers with the surface marked', () => {
    const fixture = setup(dialogData(GREEN));
    const rows = fixture.nativeElement.querySelectorAll('.layers tbody tr');
    expect(rows).toHaveLength(7);
    expect(rows[0].textContent).toContain('(surface)');
    expect(rows[5].classList.contains('hit')).toBe(true);
  });

  it('credits the model\'s authors and links the source', () => {
    const fixture = setup(dialogData(GREEN));
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Cloud-layer model by CMDRs Arcanic and Regza, Green Gas Giant catalogue by CMDR Arcanic');
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('.credit a');
    expect(link.href).toContain('ed-ggg.github.io/edggg/densitydemo.html');
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener noreferrer');
  });
});
