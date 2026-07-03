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

  it('renders the reserved-space shell: map block, data sections and body rows', () => {
    const el = render();
    expect(el.querySelector('.skeleton-map')).not.toBeNull();
    // Location, Society, Distances, Nearest DSSA and Nearest Nebulae make up the two columns.
    expect(el.querySelectorAll('.skeleton-section').length).toBe(5);
    expect(el.querySelectorAll('.skeleton-body-row').length).toBe(6);
    // Every placeholder composes the shared global shimmer primitive.
    expect(el.querySelectorAll('.skeleton').length).toBeGreaterThan(20);
  });

  it('renders the static section headers and row labels as real text (only values shimmer)', () => {
    const el = render();
    const headers = Array.from(el.querySelectorAll('.skeleton-section-header')).map((h) =>
      h.textContent?.trim(),
    );
    expect(headers).toEqual(['Location', 'Society', 'Distances', 'Nearest DSSA', 'Nearest Nebulae']);

    // Static row labels are present verbatim...
    const text = el.textContent ?? '';
    for (const label of ['PG Name', 'Id64', 'Coordinates', 'Permit required', 'Economy', 'Security']) {
      expect(text).toContain(label);
    }
    expect(text).toContain('System Completeness');

    // ...and the value cell to the right of a labelled row carries the shimmer, not the label itself.
    const firstEntry = el.querySelector('.skeleton-entry') as HTMLElement;
    const cells = firstEntry.querySelectorAll(':scope > div');
    expect(cells[0].querySelector('.skeleton')).toBeNull(); // label cell = real text
    expect(cells[1].querySelector('.skeleton')).not.toBeNull(); // value cell = shimmer

    // Distance-style sections (Distances is the 3rd) have no static label, so BOTH cells shimmer.
    const distanceSection = el.querySelectorAll('.skeleton-section')[2];
    const distCells = distanceSection.querySelector('.skeleton-entry')!.querySelectorAll(':scope > div');
    expect(distCells[0].querySelector('.skeleton')).not.toBeNull(); // name cell = shimmer
    expect(distCells[1].querySelector('.skeleton')).not.toBeNull(); // value cell = shimmer
  });

  it('exposes an accessible loading status and hides the decorative shimmer from AT', () => {
    const el = render();
    const status = el.querySelector('.sr-only');
    expect(status?.getAttribute('role')).toBe('status');
    expect(status?.textContent).toContain('Loading');
    expect(el.querySelector('.skeleton-system-inner')?.getAttribute('aria-hidden')).toBe('true');
  });
});
