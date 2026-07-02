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

  function render(
    kind: string,
    value: number | null | undefined,
    label: string,
    uiUnit?: string,
    sourceUnit?: string,
    sourcePrecise?: boolean,
  ): ConvertIconComponent {
    fixture.componentRef.setInput('kind', kind);
    fixture.componentRef.setInput('value', value);
    fixture.componentRef.setInput('label', label);
    if (uiUnit !== undefined) { fixture.componentRef.setInput('uiUnit', uiUnit); }
    if (sourceUnit !== undefined) { fixture.componentRef.setInput('sourceUnit', sourceUnit); }
    if (sourcePrecise !== undefined) { fixture.componentRef.setInput('sourcePrecise', sourcePrecise); }
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  // The click handler is async: it lazy-loads the dialog via a dynamic import() before opening it.
  // Call it directly and await the returned promise so the assertion sees the resolved open() call.
  const click = (component: ConvertIconComponent, event: Event = new MouseEvent('click')): Promise<void> =>
    (component as unknown as { open(e: Event): Promise<void> }).open(event);

  it('opens the conversion dialog with the kind, base value and label, stopping propagation', async () => {
    const component = render('length', 6371, 'Radius');
    const event = new MouseEvent('click');
    const stop = vi.spyOn(event, 'stopPropagation');
    await click(component, event);

    expect(stop).toHaveBeenCalled();
    expect(opened).toHaveLength(1);
    expect(opened[0].component).toBe(UnitConversionDialogComponent);
    expect(opened[0].config.data).toEqual({
      title: 'Radius', kind: 'length', baseValue: 6371, uiUnit: null, sourceUnit: null, sourcePrecise: true,
    });
  });

  it('passes the UI and source unit labels through to the dialog', async () => {
    const component = render('mass', 2.88e30, 'Mass', 'Solar Masses', 'Earth Masses');
    await click(component);

    expect(opened[0].config.data).toEqual({
      title: 'Mass', kind: 'mass', baseValue: 2.88e30, uiUnit: 'Solar Masses',
      sourceUnit: 'Earth Masses', sourcePrecise: true,
    });
  });

  it('forwards sourcePrecise=false for a back-converted (imprecise) source unit', async () => {
    const component = render('length', 6371, 'Radius', 'km', 'm', false);
    await click(component);

    expect(opened[0].config.data).toEqual({
      title: 'Radius', kind: 'length', baseValue: 6371, uiUnit: 'km', sourceUnit: 'm', sourcePrecise: false,
    });
  });

  it('does not open for a missing or non-finite value', async () => {
    for (const v of [null, undefined, NaN, Infinity]) {
      const component = render('mass', v, 'Mass');
      await click(component);
    }
    expect(opened).toHaveLength(0);
  });
});
