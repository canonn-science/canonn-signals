import { of } from 'rxjs';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, provideZonelessChangeDetection } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';

import { HomeComponent } from './home.component';
import { AppService } from '../app.service';

/**
 * HomeComponent hosts a large, Material-heavy template. These tests create the
 * component via TestBed with lightweight provider stubs (without rendering the
 * template) and exercise its pure presentation helpers.
 */
describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: HttpClient, useValue: { get: () => of('') } },
        {
          provide: AppService,
          useValue: {
            edastroSystems: of([]),
            independentOutposts: of([]),
            codexEntries: of([]),
            getBodyDisplayName: (n: string) => n,
          },
        },
        { provide: ActivatedRoute, useValue: { queryParams: of({}) } },
        { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    // Intentionally not calling detectChanges(): these tests exercise the pure
    // presentation helpers directly rather than rendering the Material template.
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('formats RAJ2000 degrees into an h/m/s string', () => {
    expect(component.formatRAJ2000(0)).toBe('0h 00m 00.0s');
  });

  it('formats DEJ2000 degrees with a sign', () => {
    expect(component.formatDEJ2000(0)).toContain('+0°');
    expect(component.formatDEJ2000(-1).startsWith('-')).toBe(true);
  });

  it('strips a leading @ from a SIMBAD ident', () => {
    expect(component.formatSimbadId('@Sol')).toBe('Sol');
    expect(component.formatSimbadId('Sol')).toBe('Sol');
  });
});
