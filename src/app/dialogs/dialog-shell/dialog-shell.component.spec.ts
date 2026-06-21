import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { DialogShellComponent } from './dialog-shell.component';

/** Host that drives the shell with a heading and some projected body content. */
@Component({
  imports: [DialogShellComponent],
  template: `
    <app-dialog-shell [heading]="heading">
      <p class="projected">Body content</p>
    </app-dialog-shell>
  `,
})
class HostComponent {
  heading = 'Some Title';
}

describe('DialogShellComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  function setup() {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideZonelessChangeDetection()],
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders the heading in the title bar', () => {
    const el: HTMLElement = setup().nativeElement;
    const heading = el.querySelector('h2[mat-dialog-title]');
    expect(heading?.textContent?.trim()).toBe('Some Title');
  });

  it('projects the body content into the dialog content area', () => {
    const el: HTMLElement = setup().nativeElement;
    const content = el.querySelector('mat-dialog-content .projected');
    expect(content?.textContent).toContain('Body content');
  });

  it('renders a Close action button', () => {
    const el: HTMLElement = setup().nativeElement;
    const close = el.querySelector('mat-dialog-actions button');
    expect(close?.textContent?.trim()).toBe('Close');
  });
});
