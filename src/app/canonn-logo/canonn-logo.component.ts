import {
  Component, ChangeDetectionStrategy, ElementRef, Injector, OnDestroy,
  afterNextRender, effect, inject, input, signal, viewChild,
} from '@angular/core';
import { logger } from '../data/logger';

/**
 * Per-cookie orbit geometry, in the SVG's global coordinate space. Each "cookie"
 * (one of the three biscuits in the Canonn logo) rides its own precisely-fitted
 * ring ellipse: centre (cx, cy), semi-axes A (major) / B (minor), tilt `th`.
 * `th0` is the cookie's home angle on that ring; (hx, hy) is the biscuit's centre,
 * used as the spin / scale pivot. Computed offline from the artwork — it is not
 * derivable from the SVG itself, so it travels with the animation code.
 */
interface CookieGeometry {
  id: string;
  cx: number; cy: number;
  A: number; B: number;
  th: number; th0: number;
  hx: number; hy: number;
}

const COOKIES: readonly CookieGeometry[] = [
  { id: 'orbit-1', cx: 276.08, cy: 255.17, A: 205.88, B: 61.9, th: 1.51584, th0: 0.84908, hx: 237.5, hy: 392.32 },
  { id: 'orbit-2', cx: 273.79, cy: 256.55, A: 206.93, B: 61.75, th: -0.59124, th0: -0.83251, hx: 363.56, hy: 141.52 },
  { id: 'orbit-3', cx: 275.85, cy: 257.2, A: 202.06, B: 63.29, th: 0.44018, th0: 2.36586, hx: 129.22, hy: 236.22 },
];

const PERIOD = 7;        // seconds per full orbit (lower = faster)
const DIR = 1;           // orbit direction (+1)
const SPIN_TURNS = 1;    // biscuit self-rotations per orbit (integer => rests matched at home)
const DEPTH = 0.16;      // biscuit grow/shrink (perspective)
const DECEL_DUR = 0.5;   // seconds to ease the cookies to a halt when stopping
const CORE_SPEED = 1.9;  // how fast the inner artefact stirs (higher = faster)
const OMEGA = (2 * Math.PI) / PERIOD;
const TWO_PI = 2 * Math.PI;
const RAD2DEG = 180 / Math.PI;

/** A cookie's geometry plus its resolved DOM node and pre-computed tilt sin/cos. */
interface Cookie extends CookieGeometry {
  el: SVGGraphicsElement | null;
  ct: number; st: number;
}

/**
 * The orbiting Canonn logo. Injects the `canonn.svg` and drives it with a single
 * requestAnimationFrame loop that runs continuously while the logo is mounted:
 *
 * - the flask, its occluder hole and the inner artefact ("centre piece") always sway
 *   gently, and the masked bubbles fizz via CSS — the logo is never fully static;
 * - only the three cookies obey `animating`: they orbit while it is true, and when it
 *   flips to false they finish the current lap and ease to a halt at their home angle,
 *   then hold there while the centre keeps moving.
 *
 * Used on the home page with `[animating]="searching"`, so the cookies spin exactly
 * while a search is in flight — the SVG equivalent of the old animated-gif behaviour.
 */
@Component({
  selector: 'app-canonn-logo',
  template: '<div #host class="canonn-logo"></div>',
  styleUrl: './canonn-logo.component.scss',
  host: { '[class.is-animating]': 'running()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CanonnLogoComponent implements OnDestroy {
  private readonly injector = inject(Injector);

  /** While true the cookies orbit; flipping to false eases them to rest. */
  readonly animating = input(false);

  readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');

  /** Drives the `is-animating` host class (bubble fizz) and tracks loop liveness. */
  readonly running = signal(false);

  private cookies: Cookie[] = [];
  private vitro: SVGGraphicsElement | null = null;
  private occluder: SVGGraphicsElement | null = null;
  private core: SVGGraphicsElement | null = null;
  private ccx = 0;
  private ccy = 0;

  // mode: 'run' | 'stopping' (finishing the lap at full speed) | 'decel' (easing to
  // rest) | 'stopped' (parked at home). Only the cookies obey this; the flask and
  // artefact simply move whenever the loop is alive.
  private mode: 'run' | 'stopping' | 'decel' | 'stopped' = 'stopped';
  private phi = 0;
  private tSec = 0;
  private last: number | null = null;
  private stopTarget = 0;
  private decFrom = 0;
  private decArc = 0;
  private decDur = 0;
  private decT0 = 0;
  private rafId: number | null = null;

  constructor() {
    afterNextRender(() => this.loadSvg(), { injector: this.injector });

    // Translate the `animating` input into transitions of the cookie state machine,
    // mirroring the play/stop control from the standalone prototype. The loop itself
    // keeps running either way — this only governs the cookies.
    effect(() => {
      if (this.animating()) {
        this.mode = 'run';
      } else if (this.mode === 'run') {
        // Finish the current lap, then decelerate, so the cookies always come to
        // rest exactly at their home angle rather than freezing mid-orbit.
        this.mode = 'stopping';
        this.stopTarget = (Math.floor(this.phi / TWO_PI) + 1) * TWO_PI;
      }
    });
  }

  ngOnDestroy(): void {
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.running.set(false);
  }

  private async loadSvg(): Promise<void> {
    const hostEl = this.host().nativeElement;

    let svgContent: string;
    try {
      const response = await fetch('assets/canonn.svg');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      svgContent = await response.text();
    } catch (error) {
      logger.error('Error loading Canonn logo:', error);
      return;
    }

    // Trusted content: a static SVG bundled in the app's own assets. This assignment
    // is NOT Angular-sanitized, so it must never be sourced from a remote/user-
    // controlled location without sanitizing first.
    hostEl.innerHTML = svgContent;
    if (!hostEl.querySelector('svg')) {
      return;
    }

    this.cookies = COOKIES.map((c) => ({
      ...c,
      el: hostEl.querySelector<SVGGraphicsElement>(`#${c.id}`),
      ct: Math.cos(c.th),
      st: Math.sin(c.th),
    }));
    this.vitro = hostEl.querySelector<SVGGraphicsElement>('#vitro');
    this.occluder = hostEl.querySelector<SVGGraphicsElement>('#occluder');
    this.core = hostEl.querySelector<SVGGraphicsElement>('#core');
    if (this.core) {
      this.ccx = parseFloat(this.core.getAttribute('data-cx') ?? '0');
      this.ccy = parseFloat(this.core.getAttribute('data-cy') ?? '0');
    }

    this.start();
  }

  /** Starts the continuous rAF loop (idempotent — only ever called once, post-load). */
  private start(): void {
    if (this.rafId != null) {
      return;
    }
    this.running.set(true);
    this.last = null;
    this.rafId = requestAnimationFrame(this.frame);
  }

  private readonly frame = (ts: number): void => {
    if (this.last == null) {
      this.last = ts;
    }
    const dt = Math.min(0.05, (ts - this.last) / 1000);
    this.last = ts;
    this.tSec += dt;

    if (this.mode === 'run' || this.mode === 'stopping') {
      this.phi += DIR * OMEGA * dt;
      if (this.mode === 'stopping' && (this.stopTarget - this.phi) <= OMEGA * DECEL_DUR) {
        this.decFrom = this.phi;
        this.decArc = this.stopTarget - this.phi;
        this.decDur = Math.max(0.0001, this.decArc / OMEGA);
        this.decT0 = this.tSec;
        this.mode = 'decel';
      }
    } else if (this.mode === 'decel') {
      const k = Math.min(1, (this.tSec - this.decT0) / this.decDur);
      // E(0)=0, E(1)=1, E'(0)=1 (no speed jump entering the ease), E'(1)=0 (rests softly).
      this.phi = this.decFrom + this.decArc * (-k * k * k + k * k + k);
      if (k >= 1) {
        this.phi = this.stopTarget;
        this.mode = 'stopped';
      }
    }

    // The cookies hold at their home angle once stopped; the flask and artefact keep
    // swaying every frame, so the loop never parks while the logo is mounted.
    this.applyCookies(this.phi);
    this.applyVitro(this.tSec);
    this.applyCore(this.tSec);

    this.rafId = requestAnimationFrame(this.frame);
  };

  private applyCookies(p: number): void {
    for (const c of this.cookies) {
      if (!c.el) {
        continue;
      }
      const ex = c.A * Math.cos(c.th0 + p);
      const ey = c.B * Math.sin(c.th0 + p);
      const px = c.cx + ex * c.ct - ey * c.st;   // exact point on the fitted ring
      const py = c.cy + ex * c.st + ey * c.ct;
      const dx = px - c.hx;
      const dy = py - c.hy;
      const spin = p * SPIN_TURNS * RAD2DEG;
      const s = 1 + DEPTH * (Math.sin(c.th0 + p) - Math.sin(c.th0));
      c.el.setAttribute(
        'transform',
        `translate(${dx.toFixed(2)} ${dy.toFixed(2)}) ` +
          `rotate(${spin.toFixed(2)} ${c.hx} ${c.hy}) ` +
          `translate(${c.hx} ${c.hy}) scale(${s.toFixed(4)}) translate(${-c.hx} ${-c.hy})`,
      );
    }
  }

  private applyVitro(t: number): void {
    const tx = 4.0 * Math.sin(t * 0.50) + 2.0 * Math.sin(t * 0.23);
    const ty = 3.2 * Math.sin(t * 0.40 + 1.0);
    const rot = 1.4 * Math.sin(t * 0.31);
    const sc = 1 + 0.012 * Math.sin(t * 0.70);
    const vt =
      `translate(274.5 256) rotate(${rot.toFixed(3)}) scale(${sc.toFixed(4)}) ` +
      `translate(-274.5 -256) translate(${tx.toFixed(2)} ${ty.toFixed(2)})`;
    this.vitro?.setAttribute('transform', vt);
    this.occluder?.setAttribute('transform', vt);   // flask-shaped hole tracks the flask
  }

  private applyCore(t: number): void {
    t *= CORE_SPEED;
    const bx = 3.0 * Math.sin(t * 0.55);
    const by = 4.0 * Math.sin(t * 0.45 + 0.6);
    const rot = 4.0 * Math.sin(t * 0.70);          // the artefact sways / turns
    const sc = 1 + 0.045 * Math.sin(t * 0.90);     // and gently pulses
    this.core?.setAttribute(
      'transform',
      `translate(${this.ccx} ${this.ccy}) rotate(${rot.toFixed(3)}) scale(${sc.toFixed(4)}) ` +
        `translate(${-this.ccx} ${-this.ccy}) translate(${bx.toFixed(2)} ${by.toFixed(2)})`,
    );
  }
}
