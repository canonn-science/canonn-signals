import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [AppComponent],
    providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
    ],
    schemas: [NO_ERRORS_SCHEMA],
}));

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
