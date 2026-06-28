import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { CanonnLogoComponent } from './canonn-logo.component';

/** Minimal SVG carrying every id/class the animation driver resolves. */
const FAKE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 549 512">
  <g id="orbit-1" class="orbiter"></g>
  <g id="orbit-2" class="orbiter"></g>
  <g id="orbit-3" class="orbiter"></g>
  <g id="vitro"></g>
  <g id="occluder"></g>
  <g id="core" data-cx="505.77" data-cy="523.99"></g>
  <rect class="bubble"></rect>
</svg>`;

describe('CanonnLogoComponent', () => {
  let fixture: ComponentFixture<CanonnLogoComponent>;
  let component: CanonnLogoComponent;
  let fetchMock: ReturnType<typeof vi.fn>;
  let cancelSpy: ReturnType<typeof vi.fn<(id: number) => void>>;
  let rafSeq: number;

  function configure(svg = FAKE_SVG, ok = true): void {
    fetchMock = vi.fn(() => Promise.resolve({ ok, status: ok ? 200 : 404, text: () => Promise.resolve(svg) }));
    vi.stubGlobal('fetch', fetchMock);
    TestBed.configureTestingModule({
      imports: [CanonnLogoComponent],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = TestBed.createComponent(CanonnLogoComponent);
    component = fixture.componentInstance;
  }

  beforeEach(() => {
    rafSeq = 0;
    cancelSpy = vi.fn<(id: number) => void>();
    // Benign stubs: the component schedules its own loop via these, but the tests drive
    // frames directly (see `frame`/`runUntilCookiesStop`). Returning a truthy id keeps the
    // loop's "is running" bookkeeping intact; never invoking the callback keeps it
    // deterministic and avoids clobbering Angular's own zoneless raf scheduling.
    vi.stubGlobal('requestAnimationFrame', () => ++rafSeq);
    vi.stubGlobal('cancelAnimationFrame', (id: number) => cancelSpy(id));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Flushes the afterNextRender + async fetch chain that injects the SVG. */
  async function load(): Promise<void> {
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0));
  }

  /** Pushes the new input through change detection so the state-machine effect runs. */
  async function flush(): Promise<void> {
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0));
  }

  function host(): HTMLDivElement {
    return (component as any).host().nativeElement as HTMLDivElement;
  }

  /** Invokes the component's rAF callback directly with a monotonic timestamp. */
  let ts = 0;
  function frame(stepMs = 50): void {
    ts += stepMs;
    (component as any).frame(ts);
  }

  /** Drives frames until the cookies stop (or the cap is hit); returns the frame count. */
  function runUntilCookiesStop(maxFrames = 1000): number {
    let frames = 0;
    while ((component as any).mode !== 'stopped' && frames < maxFrames) {
      frame();
      frames++;
    }
    return frames;
  }

  beforeEach(() => { ts = 0; });

  it('creates and runs the centre while holding the cookies still when idle', async () => {
    configure();
    await load();
    expect(component).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('assets/canonn.svg');
    expect(host().querySelector('svg')).toBeTruthy();

    // The loop runs for the flask/artefact even with no search in flight...
    expect(component.running()).toBe(true);
    frame(0);
    const core1 = host().querySelector('#core')!.getAttribute('transform');
    frame();
    const core2 = host().querySelector('#core')!.getAttribute('transform');
    expect(core2).not.toBe(core1); // ...the centre piece keeps moving...

    // ...while the cookies sit at their home pose (no orbital spin/scale).
    expect((component as any).mode).toBe('stopped');
    const cookie = host().querySelector('#orbit-1')!.getAttribute('transform')!;
    expect(cookie).toContain('rotate(0.00 ');
    expect(cookie).toContain('scale(1.0000)');
  });

  it('drives the cookies, flask and artefact while animating', async () => {
    configure();
    fixture.componentRef.setInput('animating', true);
    await load();

    expect(component.running()).toBe(true);

    frame(0); // prime `last`
    frame();

    expect(host().querySelector('#orbit-1')!.getAttribute('transform')).toContain('translate');
    expect(host().querySelector('#vitro')!.getAttribute('transform')).toContain('translate');
    expect(host().querySelector('#occluder')!.getAttribute('transform')).toContain('translate');
    expect(host().querySelector('#core')!.getAttribute('transform')).toContain('translate(505.77 523.99)');
  });

  it('eases the cookies to rest while the centre keeps moving', async () => {
    configure();
    fixture.componentRef.setInput('animating', true);
    await load();
    frame(0);
    frame();

    fixture.componentRef.setInput('animating', false);
    await flush(); // effect: enter the stopping ramp

    const frames = runUntilCookiesStop();
    expect(frames).toBeLessThan(1000); // the cookies actually came to rest
    expect((component as any).mode).toBe('stopped');

    // Cookies parked at their home pose: no perspective scaling, and the transform
    // stops changing frame-to-frame...
    const cookie1 = host().querySelector('#orbit-1')!.getAttribute('transform')!;
    expect(cookie1).toContain('scale(1.0000)');
    const core1 = host().querySelector('#core')!.getAttribute('transform');
    frame();
    expect(host().querySelector('#orbit-1')!.getAttribute('transform')).toBe(cookie1);

    // ...but the loop is still live and the centre keeps swaying.
    expect(component.running()).toBe(true);
    expect(host().querySelector('#core')!.getAttribute('transform')).not.toBe(core1);
  });

  it('cancels a pending stop when animation is re-enabled', async () => {
    configure();
    fixture.componentRef.setInput('animating', true);
    await load();
    frame(0);
    frame();

    fixture.componentRef.setInput('animating', false);
    await flush();
    frame(); // begin the stopping ramp
    expect((component as any).mode).toBe('stopping');

    fixture.componentRef.setInput('animating', true);
    await flush();

    expect(component.running()).toBe(true);
    expect((component as any).mode).toBe('run');
  });

  it('logs and bails when the SVG cannot be fetched', async () => {
    configure(FAKE_SVG, false);
    fixture.componentRef.setInput('animating', true);
    await load();
    expect(host().querySelector('svg')).toBeNull();
    expect(component.running()).toBe(false);
  });

  it('bails when the fetched markup contains no <svg>', async () => {
    configure('<div>not an svg</div>');
    fixture.componentRef.setInput('animating', true);
    await load();
    expect(component.running()).toBe(false);
  });

  it('cancels the frame loop on destroy', async () => {
    configure();
    fixture.componentRef.setInput('animating', true);
    await load();
    frame(0); // schedules a frame -> rafId is set

    fixture.destroy();
    expect(cancelSpy).toHaveBeenCalled();
  });
});
