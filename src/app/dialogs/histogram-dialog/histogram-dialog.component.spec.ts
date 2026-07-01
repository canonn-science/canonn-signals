import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { HistogramDialogComponent, HistogramDialogData } from './histogram-dialog.component';

function setup(data: HistogramDialogData): ComponentFixture<HistogramDialogComponent> {
  TestBed.configureTestingModule({
    imports: [HistogramDialogComponent],
    providers: [provideZonelessChangeDetection(), { provide: MAT_DIALOG_DATA, useValue: data }],
  });
  const fixture = TestBed.createComponent(HistogramDialogComponent);
  fixture.detectChanges();
  return fixture;
}

describe('HistogramDialogComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renders one bar per body sub-type with the system name in the title', () => {
    const fixture = setup({
      systemName: 'Sol',
      bodies: [
        { type: 'Star', subType: 'G (White-Yellow) Star' },
        { type: 'Planet', subType: 'High metal content world' },
        { type: 'Planet', subType: 'High metal content world' },
        { type: 'Planet', subType: 'Icy body' },
      ],
    });
    const c = fixture.componentInstance;

    expect(c.title).toBe('Body types — Sol');
    expect(c.histogram().total).toBe(4);
    const rows = fixture.nativeElement.querySelectorAll('.histogram-row');
    expect(rows.length).toBe(3);
  });

  it('scales the widest bar to 100% and others proportionally', () => {
    const fixture = setup({
      systemName: 'Test',
      bodies: [
        { type: 'Planet', subType: 'Icy body' },
        { type: 'Planet', subType: 'Icy body' },
        { type: 'Planet', subType: 'Water world' },
      ],
    });
    const c = fixture.componentInstance;

    expect(c.barWidth(2)).toBe(100);
    expect(c.barWidth(1)).toBe(50);
  });

  it('reports the count of unknown bodies when the total is known', () => {
    const fixture = setup({
      systemName: 'Sol',
      totalBodyCount: 40,
      bodies: [
        { type: 'Star', subType: 'G (White-Yellow) Star' },
        { type: 'Planet', subType: 'Icy body' },
      ],
    });
    const c = fixture.componentInstance;

    expect(c.unknownBodies()).toEqual({ known: true, count: 38 });
    expect(fixture.nativeElement.querySelector('.histogram-unknown')?.textContent?.trim())
      .toBe('38 additional unknown bodies');
  });

  it('uses the singular for a single unknown body', () => {
    const fixture = setup({
      systemName: 'Sol',
      totalBodyCount: 3,
      bodies: [
        { type: 'Star', subType: 'G (White-Yellow) Star' },
        { type: 'Planet', subType: 'Icy body' },
      ],
    });

    expect(fixture.nativeElement.querySelector('.histogram-unknown')?.textContent?.trim())
      .toBe('1 additional unknown body');
  });

  it('hides the unknown-bodies line when every reported body is charted', () => {
    const fixture = setup({
      systemName: 'Sol',
      totalBodyCount: 2,
      bodies: [
        { type: 'Star', subType: 'G (White-Yellow) Star' },
        { type: 'Planet', subType: 'Icy body' },
      ],
    });
    const c = fixture.componentInstance;

    expect(c.unknownBodies()).toEqual({ known: true, count: 0 });
    expect(fixture.nativeElement.querySelector('.histogram-unknown')).toBeNull();
  });

  it('shows a count-free label when the total body count is unknown', () => {
    const fixture = setup({
      systemName: 'Sol',
      bodies: [{ type: 'Planet', subType: 'Icy body' }],
    });
    const c = fixture.componentInstance;

    expect(c.unknownBodies()).toEqual({ known: false, count: 0 });
    expect(fixture.nativeElement.querySelector('.histogram-unknown')?.textContent?.trim())
      .toBe('Additional unknown bodies');
  });

  it('returns 0 width when there are no bodies and shows the empty message', () => {
    const fixture = setup({ systemName: 'Empty', bodies: [] });
    const c = fixture.componentInstance;

    expect(c.barWidth(0)).toBe(0);
    expect(fixture.nativeElement.querySelector('.histogram-empty')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.histogram-row')).toBeNull();
  });
});
