import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, inject, provideZonelessChangeDetection, Type } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';

import { LazyDialogHostComponent, SKELETON_DELAY_MS } from './lazy-dialog-host.component';
import { LazyDialogConfig, openLazyDialog } from '../lazy-dialog';

/** Stand-in dialog body: renders the payload it receives so we can assert data pass-through. */
@Component({
  selector: 'test-lazy-body',
  template: `<h2>Loaded body</h2><p class="body-label">{{ label }}</p>`,
})
class TestLazyBodyComponent {
  private readonly data = inject<{ label: string }>(MAT_DIALOG_DATA);
  readonly label = this.data.label;
}

/** Flush the loader's resolved/rejected promise chain (the `.then/.catch` microtasks). */
async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('LazyDialogHostComponent', () => {
  let fixture: ComponentFixture<LazyDialogHostComponent>;

  function build(config: LazyDialogConfig): ComponentFixture<LazyDialogHostComponent> {
    TestBed.configureTestingModule({
      imports: [LazyDialogHostComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MAT_DIALOG_DATA, useValue: config },
      ],
    });
    fixture = TestBed.createComponent(LazyDialogHostComponent);
    return fixture;
  }

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const query = (sel: string) => (fixture.nativeElement as HTMLElement).querySelector(sel);

  it('renders nothing before the skeleton delay, then reveals the skeleton', () => {
    vi.useFakeTimers();
    build({ loader: () => new Promise<Type<unknown>>(() => { /* never resolves */ }), data: {} });

    fixture.detectChanges();
    expect(query('.lazy-skeleton')).toBeNull();

    vi.advanceTimersByTime(SKELETON_DELAY_MS);
    fixture.detectChanges();
    expect(query('.lazy-skeleton--title')).not.toBeNull();
    expect(query('.lazy-skeleton--line')).not.toBeNull();
    // Accessible name is present even though the shimmer bars are aria-hidden.
    expect(text()).toContain('Loading');
  });

  it('shows the diagram skeleton layout when requested', () => {
    vi.useFakeTimers();
    build({ loader: () => new Promise<Type<unknown>>(() => { }), data: {}, skeleton: 'diagram' });

    vi.advanceTimersByTime(SKELETON_DELAY_MS);
    fixture.detectChanges();
    expect(query('.lazy-skeleton--diagram')).not.toBeNull();
  });

  it('swaps in the loaded component without ever showing a skeleton on a fast load', async () => {
    vi.useFakeTimers();
    build({ loader: () => Promise.resolve(TestLazyBodyComponent), data: { label: 'hi' } });

    await flush();
    fixture.detectChanges();

    expect(text()).toContain('Loaded body');
    // The delay timer may still fire, but the loaded body takes precedence over the skeleton.
    vi.advanceTimersByTime(SKELETON_DELAY_MS);
    fixture.detectChanges();
    expect(query('.lazy-skeleton')).toBeNull();
  });

  it('passes the wrapped data to the loaded body as MAT_DIALOG_DATA', async () => {
    build({ loader: () => Promise.resolve(TestLazyBodyComponent), data: { label: 'orbital inclination' } });

    await flush();
    fixture.detectChanges();

    expect(query('.body-label')?.textContent).toBe('orbital inclination');
  });

  it('shows an error state when the chunk fails to load', async () => {
    build({ loader: () => Promise.reject(new Error('offline')), data: {} });

    await flush();
    fixture.detectChanges();

    expect(text()).toContain('failed to load');
    expect(query('.lazy-skeleton')).toBeNull();
  });

  it('clears the pending skeleton timer on destroy', () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    build({ loader: () => new Promise<Type<unknown>>(() => { }), data: {} });

    fixture.destroy();
    expect(clearSpy).toHaveBeenCalled();
  });
});

describe('openLazyDialog', () => {
  it('opens the host, wraps loader/skeleton/data, and defaults focus to the dialog container', () => {
    const open = vi.fn().mockReturnValue({});
    const dialog = { open } as unknown as MatDialog;
    const loader = () => Promise.resolve<Type<unknown>>(TestLazyBodyComponent);

    openLazyDialog(dialog, { loader, data: { a: 1 }, skeleton: 'diagram', width: '640px', maxWidth: '95vw' });

    expect(open).toHaveBeenCalledTimes(1);
    const [component, matConfig] = open.mock.calls[0];
    expect(component).toBe(LazyDialogHostComponent);
    expect(matConfig).toEqual({
      autoFocus: 'dialog',
      width: '640px',
      maxWidth: '95vw',
      data: { loader, data: { a: 1 }, skeleton: 'diagram' },
    });
  });

  it('lets options override the default focus target', () => {
    const open = vi.fn().mockReturnValue({});
    const dialog = { open } as unknown as MatDialog;

    openLazyDialog(dialog, {
      loader: () => Promise.resolve(TestLazyBodyComponent),
      data: null,
      autoFocus: 'first-heading',
    });

    expect(open.mock.calls[0][1].autoFocus).toBe('first-heading');
  });
});
