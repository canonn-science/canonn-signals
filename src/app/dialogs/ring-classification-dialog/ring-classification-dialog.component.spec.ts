import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { RingClassificationDialogComponent, RingClassificationDialogData } from './ring-classification-dialog.component';

function setup(data: RingClassificationDialogData): ComponentFixture<RingClassificationDialogComponent> {
  TestBed.configureTestingModule({
    imports: [RingClassificationDialogComponent],
    providers: [provideZonelessChangeDetection(), { provide: MAT_DIALOG_DATA, useValue: data }],
  });
  const fixture = TestBed.createComponent(RingClassificationDialogComponent);
  fixture.detectChanges();
  return fixture;
}

const TAYLOR_DATA: RingClassificationDialogData = {
  kind: 'taylor',
  bodyName: 'Gas Giant',
  ringName: 'A',
  parentRadius: 50000,
  rings: [{ name: 'A', innerRadius: 60000, outerRadius: 70000 }],
  span: 10000,
  innermostInner: 60000,
  outermostOuter: 70000,
  narrowThresholdKm: 12500,
  pauperInnerEdgeThresholdKm: 700000,
  pauperMaxSpanKm: 100000,
};

const PAUPER_DATA: RingClassificationDialogData = {
  kind: 'pauper',
  bodyName: 'Gas Giant',
  ringName: 'A',
  parentRadius: 50000,
  rings: [{ name: 'A', innerRadius: 750000, outerRadius: 800000 }],
  span: 50000,
  innermostInner: 750000,
  outermostOuter: 800000,
  narrowThresholdKm: 12500,
  pauperInnerEdgeThresholdKm: 700000,
  pauperMaxSpanKm: 100000,
};

describe('RingClassificationDialogComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('shows the Taylor heading and explanation for a taylor dialog', () => {
    const el: HTMLElement = setup(TAYLOR_DATA).nativeElement;
    expect(el.textContent).toContain('Taylor Ring Explanation');
    expect(el.textContent).toContain('Taylor Ring');
    expect(el.textContent).toContain('Elizabeth Taylor');
    expect(el.textContent).not.toContain('Pauper Ring');
  });

  it('shows the Pauper heading and explanation for a pauper dialog', () => {
    // Both dialogs' intros legitimately mention "Elizabeth Taylor" (the engagement-ring lore
    // behind both names), so the negative checks target the "Taylor Ring" badge name
    // specifically, not the bare word "Taylor".
    const el: HTMLElement = setup(PAUPER_DATA).nativeElement;
    expect(el.textContent).toContain('Pauper Ring Explanation');
    expect(el.textContent).toContain('Pauper Ring');
    expect(el.textContent).toContain('Elizabeth Taylor');
    expect(el.textContent).not.toContain('Taylor Ring Explanation');
    expect(el.querySelector('.intro')!.textContent).not.toContain('Taylor Ring');
  });

  it('lists each visible ring with its inner/outer radius', () => {
    const el: HTMLElement = setup(TAYLOR_DATA).nativeElement;
    expect(el.textContent).toContain('A Ring');
    expect(el.textContent).toContain('60,000');
    expect(el.textContent).toContain('70,000');
  });

  it('draws one circle per visible ring plus the body, in the SVG illustration', () => {
    const el: HTMLElement = setup(PAUPER_DATA).nativeElement;
    const circles = el.querySelectorAll('svg circle');
    expect(circles.length).toBe(2); // 1 ring + the body
    expect(el.querySelector('svg circle.body')).toBeTruthy();
    expect(el.querySelector('svg circle.ring.focused')).toBeTruthy(); // ringName matches the only ring
  });

  it('renders body-radius multiples via ratio()', () => {
    const fixture = setup(PAUPER_DATA);
    expect(fixture.componentInstance.ratio(750000)).toBe('15.0');
  });
});
