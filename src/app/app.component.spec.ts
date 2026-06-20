import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, provideZonelessChangeDetection } from '@angular/core';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(() => {
    // AppService's constructor fires background fetches; stub them out.
    // The edastro combined feed must parse as an array; everything else as an object.
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve({
      ok: true,
      text: () => Promise.resolve(url.includes('combined') ? '[]' : '{}'),
    })));
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
          provideZonelessChangeDetection(),
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('exposes a background image signal defaulting to an asset', () => {
    const app = TestBed.createComponent(AppComponent).componentInstance;
    expect(app.backgroundImage()).toContain('assets/');
  });
});
