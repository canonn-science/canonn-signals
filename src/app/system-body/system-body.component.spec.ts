import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, provideZonelessChangeDetection, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import { SystemBodyComponent } from './system-body.component';
import { AppService } from '../app.service';

describe('SystemBodyComponent', () => {
  let component: SystemBodyComponent;
  let fixture: ComponentFixture<SystemBodyComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [SystemBodyComponent],
    providers: [
        provideZonelessChangeDetection(),
        { provide: AppService, useValue: { codexEntries: signal([]), getBodyDisplayName: (n: string) => n } },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(undefined) }) } },
    ],
    schemas: [NO_ERRORS_SCHEMA],
});
    fixture = TestBed.createComponent(SystemBodyComponent);
    component = fixture.componentInstance;
    // Intentionally not calling detectChanges(): the template requires a populated
    // `body` input; these tests exercise the component's pure helpers directly.
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('exposes Math.abs via the abs() helper', () => {
    expect(component.abs(-5)).toBe(5);
    expect(component.abs(5)).toBe(5);
  });

  it('classifies orbital eccentricity', () => {
    expect(component.getEccentricityAnalysis(0)).toBe('Circular');
    expect(component.getEccentricityAnalysis(0.2)).toBe('Nearly Circular');
    expect(component.getEccentricityAnalysis(0.6)).toBe('Eccentric');
    expect(component.getEccentricityAnalysis(0.9)).toBe('Highly Eccentric');
  });
});
