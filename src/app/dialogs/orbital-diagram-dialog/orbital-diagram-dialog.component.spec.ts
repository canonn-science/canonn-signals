import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { OrbitalDiagramData, OrbitalDiagramDialogComponent } from './orbital-diagram-dialog.component';

function setup(data: OrbitalDiagramData): ComponentFixture<OrbitalDiagramDialogComponent> {
  TestBed.configureTestingModule({
    imports: [OrbitalDiagramDialogComponent],
    providers: [provideZonelessChangeDetection(), { provide: MAT_DIALOG_DATA, useValue: data }],
  });
  const fixture = TestBed.createComponent(OrbitalDiagramDialogComponent);
  fixture.detectChanges();
  return fixture;
}

describe('OrbitalDiagramDialogComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('builds only the tilt geometry for a tilt diagram', () => {
    const fixture = setup({ type: 'tilt', degrees: 23.4 });
    const c = fixture.componentInstance;
    expect(c.title).toBe('Axial tilt');
    expect(c.tilt()).not.toBeNull();
    expect(c.inclination()).toBeNull();
    expect(c.periapsis()).toBeNull();
    expect(fixture.nativeElement.querySelector('.axis')).toBeTruthy();
  });

  it('builds only the inclination geometry for an inclination diagram', () => {
    const fixture = setup({ type: 'inclination', degrees: 12 });
    const c = fixture.componentInstance;
    expect(c.title).toBe('Orbital inclination');
    expect(c.inclination()).not.toBeNull();
    expect(c.tilt()).toBeNull();
    expect(fixture.nativeElement.querySelector('.orbit-plane')).toBeTruthy();
  });

  it('builds only the periapsis ellipse for a periapsis diagram', () => {
    const fixture = setup({ type: 'periapsis', degrees: 90, eccentricity: 0.4 });
    const c = fixture.componentInstance;
    expect(c.title).toBe('Argument of periapsis');
    expect(c.periapsis()).not.toBeNull();
    expect(c.inclination()).toBeNull();
    // The orbit is an ellipse (rx !== ry) and a periapsis marker is rendered.
    expect(c.periapsis()!.ellipse.rx).not.toBeCloseTo(c.periapsis()!.ellipse.ry, 3);
    expect(fixture.nativeElement.querySelector('.marker')).toBeTruthy();
  });

  it('places the body from live orbital elements when provided', () => {
    const fixture = setup({
      type: 'inclination',
      degrees: 30,
      orbit: {
        meanAnomalyDeg: 90,
        orbitalPeriodDays: 1,
        meanAnomalyTimestamp: '2026-01-01T00:00:00Z',
        eccentricity: 0.1,
        argOfPeriapsisDeg: 0,
      },
    });
    // A non-default orbital angle moves the body off the major-axis end of the orbit line.
    const d = fixture.componentInstance.inclination()!;
    const atDefault = d.bodyPoint.x === d.orbitLine.x2 && d.bodyPoint.y === d.orbitLine.y2;
    expect(atDefault).toBe(false);
  });

  it('renders the angle value and a viewBox', () => {
    const fixture = setup({ type: 'tilt', degrees: 45 });
    expect(fixture.componentInstance.viewBox).toBe('0 0 120 120');
    expect(fixture.nativeElement.querySelector('.value').textContent).toContain('45');
  });
});
