import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { UnitConversionDialogComponent, UnitConversionDialogData } from './unit-conversion-dialog.component';

function setup(data: UnitConversionDialogData): ComponentFixture<UnitConversionDialogComponent> {
  TestBed.configureTestingModule({
    imports: [UnitConversionDialogComponent],
    providers: [provideZonelessChangeDetection(), { provide: MAT_DIALOG_DATA, useValue: data }],
  });
  const fixture = TestBed.createComponent(UnitConversionDialogComponent);
  fixture.detectChanges();
  return fixture;
}

describe('UnitConversionDialogComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renders the heading and one row per length unit', () => {
    const el: HTMLElement = setup({ title: 'Semi-major axis', kind: 'length', baseValue: 149597870.7 }).nativeElement;
    expect(el.textContent).toContain('Semi-major axis');
    const rows = el.querySelectorAll('.conversion-table tbody tr');
    expect(rows.length).toBe(6);
    expect(el.textContent).toContain('AU');
    expect(el.textContent).toContain('Light seconds');
  });

  it('shows mass comparisons for the mass kind', () => {
    const el: HTMLElement = setup({ title: 'Mass', kind: 'mass', baseValue: 5.972e24 }).nativeElement;
    expect(el.querySelector('.comparisons')).toBeTruthy();
    expect(el.textContent).toContain('African bush elephants');
  });

  it('omits the comparisons section for non-mass kinds', () => {
    const el: HTMLElement = setup({ title: 'Radius', kind: 'length', baseValue: 6371 }).nativeElement;
    expect(el.querySelector('.comparisons')).toBeNull();
  });

  it('copies a value to the clipboard on click and flips it to "Copied!"', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const fixture = setup({ title: 'Radius', kind: 'length', baseValue: 6371 });
    const el = fixture.nativeElement as HTMLElement;
    const valueCell = el.querySelector('.conversion-table tbody tr td.value') as HTMLElement;

    valueCell.click();
    expect(writeText).toHaveBeenCalledOnce();

    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
    expect(el.textContent).toContain('Copied!');

    vi.advanceTimersByTime(1500);
    fixture.detectChanges();
    expect(el.textContent).not.toContain('Copied!');
    vi.useRealTimers();
  });

  it('does not throw when the clipboard is unavailable', () => {
    Object.assign(navigator, { clipboard: undefined });
    const fixture = setup({ title: 'Radius', kind: 'length', baseValue: 6371 });
    const valueCell = (fixture.nativeElement as HTMLElement).querySelector('td.value') as HTMLElement;
    expect(() => valueCell.click()).not.toThrow();
  });
});
