import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { JetAngleDialogComponent } from './jet-angle-dialog.component';
import { ChartRenderingService } from '../../data/chart-rendering.service';

function setup(stub: Partial<ChartRenderingService>): ComponentFixture<JetAngleDialogComponent> {
  TestBed.configureTestingModule({
    imports: [JetAngleDialogComponent],
    providers: [provideZonelessChangeDetection(), { provide: ChartRenderingService, useValue: stub }],
  });
  const fixture = TestBed.createComponent(JetAngleDialogComponent);
  fixture.detectChanges();
  return fixture;
}

describe('JetAngleDialogComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renders the generated chart image when generation succeeds', () => {
    const fixture = setup({ generateJetAngleChart: () => 'data:image/png;base64,abc' });
    expect(fixture.componentInstance.chartDataUrl).toBe('data:image/png;base64,abc');
    expect(fixture.nativeElement.querySelector('img.jet-angle-chart-image')).toBeTruthy();
  });

  it('omits the image and survives a chart generation failure', () => {
    const fixture = setup({ generateJetAngleChart: () => { throw new Error('boom'); } });
    expect(fixture.componentInstance.chartDataUrl).toBeNull();
    expect(fixture.nativeElement.querySelector('img.jet-angle-chart-image')).toBeNull();
  });
});
