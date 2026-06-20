import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { AppService } from './app.service';

describe('AppService', () => {
  let service: AppService;

  beforeEach(() => {
    // The constructor kicks off two background fetches; stub them so no real network calls fire.
    // The edastro combined feed must parse as an array; everything else as an object.
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve({
      ok: true,
      text: () => Promise.resolve(url.includes('combined') ? '[]' : '{}'),
    })));
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
      ],
    });
    service = TestBed.inject(AppService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
