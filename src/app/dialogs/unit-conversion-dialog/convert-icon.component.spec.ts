import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

import { ConvertIconComponent } from './convert-icon.component';
import { UnitConversionDialogComponent } from './unit-conversion-dialog.component';

describe('ConvertIconComponent', () => {
  let fixture: ComponentFixture<ConvertIconComponent>;
  let opened: { component: unknown; config: { data?: any } }[];

  beforeEach(() => {
    opened = [];
    const dialogStub = { open: (component: unknown, config: { data?: any } = {}) => { opened.push({ component, config }); } };
    TestBed.configureTestingModule({
      imports: [ConvertIconComponent],
      providers: [provideZonelessChangeDetection(), { provide: MatDialog, useValue: dialogStub }],
    });
    fixture = TestBed.createComponent(ConvertIconComponent);
  });

  function render(kind: string, value: number | null | undefined, label: string): ConvertIconComponent {
    fixture.componentRef.setInput('kind', kind);
    fixture.componentRef.setInput('value', value);
    fixture.componentRef.setInput('label', label);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('opens the conversion dialog with the kind, base value and label, stopping propagation', () => {
    render('length', 6371, 'Radius');
    const event = new MouseEvent('click');
    const stop = vi.spyOn(event, 'stopPropagation');
    fixture.nativeElement.querySelector('fa-icon').dispatchEvent(event);

    expect(stop).toHaveBeenCalled();
    expect(opened).toHaveLength(1);
    expect(opened[0].component).toBe(UnitConversionDialogComponent);
    expect(opened[0].config.data).toEqual({ title: 'Radius', kind: 'length', baseValue: 6371 });
  });

  it('does not open for a missing or non-finite value', () => {
    for (const v of [null, undefined, NaN, Infinity]) {
      render('mass', v, 'Mass');
      fixture.nativeElement.querySelector('fa-icon').dispatchEvent(new MouseEvent('click'));
    }
    expect(opened).toHaveLength(0);
  });
});
