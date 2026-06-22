import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { HillLimitDialogComponent } from './hill-limit-dialog.component';
import { ChartRenderingService, HillChartData } from '../../data/chart-rendering.service';

const DATA: HillChartData = {
  parentName: 'Ringed Giant', bodyName: 'Shepherd', parentRadius: 10000,
  outermostRingRadius: 100_000_000, bodyOrbitalRadius: 110000, bodyPeriapsis: 108000,
  bodyApoapsis: 112000, hillRadius: 5000, withinRings: false, isFirstOutside: true,
  rings: [], bodyRadius: 1500, shepherdStatus: 'shepherd',
};

function setup(data: HillChartData): { fixture: ComponentFixture<HillLimitDialogComponent>; draw: ReturnType<typeof vi.fn> } {
  const draw = vi.fn();
  TestBed.configureTestingModule({
    imports: [HillLimitDialogComponent],
    providers: [
      provideZonelessChangeDetection(),
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: ChartRenderingService, useValue: { drawShepherdingHillChart: draw } },
    ],
  });
  const fixture = TestBed.createComponent(HillLimitDialogComponent);
  fixture.detectChanges();
  return { fixture, draw };
}

describe('HillLimitDialogComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('draws the shepherding chart into the canvas on render', async () => {
    const { fixture, draw } = setup(DATA);
    await fixture.whenStable();
    expect(draw).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), DATA);
  });

  it('shows the shepherd verdict and formats radii', () => {
    const { fixture } = setup(DATA);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.status-info')?.textContent).toContain('Shepherd Moon');
    expect(fixture.componentInstance.fmt(110000)).toBe('110,000');
  });
});
