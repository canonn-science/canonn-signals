import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AppService } from './app.service';

describe('AppService', () => {
  let service: AppService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(AppService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('appends the override suffix for known bodies', () => {
    expect(service.getBodyDisplayName('KOI 413 1')).toBe('KOI 413 1 (Rhubarb)');
  });

  it('returns the original name for bodies without an override', () => {
    expect(service.getBodyDisplayName('Sol')).toBe('Sol');
  });
});
