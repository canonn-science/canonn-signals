import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { SystemSkeletonComponent } from './system-skeleton.component';

describe('SystemSkeletonComponent', () => {
  function render(): HTMLElement {
    TestBed.configureTestingModule({
      imports: [SystemSkeletonComponent],
      providers: [provideZonelessChangeDetection()],
    });
    const fixture = TestBed.createComponent(SystemSkeletonComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the reserved-space shell: map block, panels and body rows', () => {
    const el = render();
    expect(el.querySelector('.skeleton-map')).not.toBeNull();
    expect(el.querySelectorAll('.skeleton-panel').length).toBe(2);
    expect(el.querySelectorAll('.skeleton-body-row').length).toBe(6);
    // Every placeholder composes the shared global shimmer primitive.
    expect(el.querySelectorAll('.skeleton').length).toBeGreaterThan(6);
  });

  it('exposes an accessible loading status and hides the decorative shimmer from AT', () => {
    const el = render();
    const status = el.querySelector('.sr-only');
    expect(status?.getAttribute('role')).toBe('status');
    expect(status?.textContent).toContain('Loading');
    expect(el.querySelector('.skeleton-system-inner')?.getAttribute('aria-hidden')).toBe('true');
  });
});
