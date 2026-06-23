import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { RocheLimitDialogComponent } from './roche-limit-dialog.component';
import { ChartRenderingService, RocheChartData } from '../../data/chart-rendering.service';

const DATA: RocheChartData = {
  parentName: 'Star A', ringName: 'Star A A Ring', densityRange: [1, 2], rigidLimits: [1, 2],
  fluidLimits: [1, 2], primaryRadius: 50000, isBody: false,
  rings: [{ name: 'A Ring', innerRadius: 60000, outerRadius: 100000, type: 'Rocky', density: 1500 }],
};

function setup(data: RocheChartData): { fixture: ComponentFixture<RocheLimitDialogComponent>; draw: ReturnType<typeof vi.fn> } {
  const draw = vi.fn();
  TestBed.configureTestingModule({
    imports: [RocheLimitDialogComponent],
    providers: [
      provideZonelessChangeDetection(),
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: ChartRenderingService, useValue: { drawRocheChart: draw } },
    ],
  });
  const fixture = TestBed.createComponent(RocheLimitDialogComponent);
  fixture.detectChanges();
  return { fixture, draw };
}

describe('RocheLimitDialogComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('draws the Roche chart and builds a ring heading including the parent', () => {
    const { fixture, draw } = setup(DATA);
    expect(fixture.componentInstance.heading).toBe('Roche Limit Analysis - Star A - Star A A Ring');
    expect(draw).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), DATA);
    expect(fixture.nativeElement.querySelector('.ring-entry')).toBeTruthy();
  });

  it('omits the parent from the heading for a body orbit', () => {
    const { fixture } = setup({ ...DATA, isBody: true, ringName: 'Moon' });
    expect(fixture.componentInstance.heading).toBe('Roche Limit Analysis - Moon');
  });
});
