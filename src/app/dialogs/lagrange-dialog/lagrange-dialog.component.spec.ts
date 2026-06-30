import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { LagrangeConfiguration } from '../../data/orbital-relations.service';
import { LagrangeDialogComponent, LagrangeDialogData } from './lagrange-dialog.component';

function setup(config: LagrangeConfiguration, systemName = ''): ComponentFixture<LagrangeDialogComponent> {
  const data: LagrangeDialogData = { config, systemName };
  TestBed.configureTestingModule({
    imports: [LagrangeDialogComponent],
    providers: [provideZonelessChangeDetection(), { provide: MAT_DIALOG_DATA, useValue: data }],
  });
  const fixture = TestBed.createComponent(LagrangeDialogComponent);
  fixture.detectChanges();
  return fixture;
}

const EORLD_SYSTEM = 'Eorld Byio AA-A h539';

/**
 * A host configuration: a focused secondary with Trojans at L4 and L5 (Eorld Byio shape).
 * Names are full (system-prefixed) display names, as the caller passes them.
 */
function hostConfig(): LagrangeConfiguration {
  return {
    primaryName: 'Eorld Byio AA-A h539 A',
    secondary: { name: 'Eorld Byio AA-A h539 barycentre 35', bodyId: 35, isFocus: true },
    points: {
      L1: [], L2: [], L3: [],
      L4: [{ name: 'Eorld Byio AA-A h539 A 18', bodyId: 38, isFocus: false }],
      L5: [{ name: 'Eorld Byio AA-A h539 A 19', bodyId: 39, isFocus: false }],
    },
  };
}

/** A lone ±60° pair with no host: secondary slot is a placeholder, focus on the L5 body. */
function lonePairConfig(): LagrangeConfiguration {
  return {
    primaryName: 'Pro Eurl JF-A d88 B',
    secondary: null,
    points: {
      L1: [], L2: [], L3: [],
      L4: [{ name: 'Pro Eurl JF-A d88 B 3', bodyId: 33, isFocus: false }],
      L5: [{ name: 'Pro Eurl JF-A d88 B 2', bodyId: 30, isFocus: true }],
    },
  };
}

describe('LagrangeDialogComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renders a viewBox and all five Lagrange markers in order', () => {
    const c = setup(hostConfig(), EORLD_SYSTEM).componentInstance;
    expect(c.title).toBe('Lagrange points');
    expect(c.viewBox).toBe('0 0 120 120');
    expect(c.markers().map(m => m.id)).toEqual(['L1', 'L2', 'L3', 'L4', 'L5']);
    // The computed fuses occupancy onto the geometry.
    expect(c.markers().find(m => m.id === 'L4')!.occupants).toHaveLength(1);
    expect(c.markers().find(m => m.id === 'L1')!.occupants).toHaveLength(0);
  });

  it('draws real bodies as filled markers and empty points as placeholders', () => {
    const el = setup(hostConfig(), EORLD_SYSTEM).nativeElement as HTMLElement;
    // Secondary + L4 + L5 are occupied (3 bodies); L1/L2/L3 are placeholders (3).
    expect(el.querySelectorAll('circle.body')).toHaveLength(3);
    expect(el.querySelectorAll('circle.placeholder')).toHaveLength(3);
    // The focused (clicked) body — the secondary host here — is highlighted exactly once.
    expect(el.querySelectorAll('.focus')).not.toHaveLength(0);
    expect(el.querySelectorAll('circle.body.focus')).toHaveLength(1);
  });

  it('uses short (system-stripped) names in the diagram but full names in the description', () => {
    const el = setup(hostConfig(), EORLD_SYSTEM).nativeElement as HTMLElement;
    const svgText = el.querySelector('svg')!.textContent ?? '';
    const explanation = el.querySelector('.explanation')!.textContent ?? '';

    // Diagram: short names, with the repeated system prefix dropped.
    expect(svgText).toContain('A 18');
    expect(svgText).toContain('barycentre 35');
    expect(svgText).not.toContain('Eorld Byio AA-A h539 A 18');
    // Description: the full (system-prefixed) name of the focused body.
    expect(explanation).toContain('Eorld Byio AA-A h539 barycentre 35');
  });

  it('shows a placeholder secondary (with caption) when no host is recorded', () => {
    const el = setup(lonePairConfig(), 'Pro Eurl JF-A d88').nativeElement as HTMLElement;
    // L1/L2/L3 + the empty secondary slot = 4 placeholders; L4 + L5 are bodies.
    expect(el.querySelectorAll('circle.placeholder')).toHaveLength(4);
    expect(el.querySelectorAll('circle.body')).toHaveLength(2);
    const svgText = el.querySelector('svg')!.textContent ?? '';
    expect(svgText).toContain('secondary');
    expect(svgText).toContain('B 2'); // short
  });

  it('reports the focused body full name for the explanatory note', () => {
    expect(setup(hostConfig(), EORLD_SYSTEM).componentInstance.focusedNote)
      .toBe('Eorld Byio AA-A h539 barycentre 35');
  });

  it('reports the focused Lagrange-point body full name for the explanatory note', () => {
    expect(setup(lonePairConfig(), 'Pro Eurl JF-A d88').componentInstance.focusedNote)
      .toBe('Pro Eurl JF-A d88 B 2');
  });
});
