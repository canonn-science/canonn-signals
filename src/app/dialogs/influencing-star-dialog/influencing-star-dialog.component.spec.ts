import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { InfluencingStarDialogComponent, InfluencingStarDialogData } from './influencing-star-dialog.component';

const BASE: InfluencingStarDialogData = {
  bodyName: 'Test Body', starName: 'Test Star A', starSubType: 'G (White-Yellow) Star', method: 'flux-3d', starCount: 2,
};

function setup(data: InfluencingStarDialogData): ComponentFixture<InfluencingStarDialogComponent> {
  TestBed.configureTestingModule({
    imports: [InfluencingStarDialogComponent],
    providers: [provideZonelessChangeDetection(), { provide: MAT_DIALOG_DATA, useValue: data }],
  });
  const fixture = TestBed.createComponent(InfluencingStarDialogComponent);
  fixture.detectChanges();
  return fixture;
}

describe('InfluencingStarDialogComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('builds the body-specific heading and names the resolved star', () => {
    const fixture = setup(BASE);
    expect(fixture.componentInstance.heading).toBe('Influencing Star — Test Body');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Test Star A');
    expect(text).toContain('G (White-Yellow) Star');
  });

  it('explains the trivial single-star case', () => {
    const el: HTMLElement = setup({ ...BASE, method: 'only-star', starCount: 1 }).nativeElement;
    expect(el.textContent).toContain('only one star');
    expect(el.textContent).not.toContain('characteristic orbital-scale distance derived');
  });

  it('explains the 3D flux hypothesis', () => {
    const el: HTMLElement = setup({ ...BASE, method: 'flux-3d' }).nativeElement;
    expect(el.textContent).toContain('real position in 3D space');
  });

  it('explains the characteristic-distance fallback', () => {
    const el: HTMLElement = setup({ ...BASE, method: 'flux-characteristic' }).nativeElement;
    expect(el.textContent).toContain('characteristic orbital-scale distance derived');
    expect(el.textContent).not.toContain('real position in 3D space');
  });
});
