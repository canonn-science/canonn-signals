import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ClickableDirective } from './clickable.directive';

@Component({
  imports: [ClickableDirective],
  template: `
    <div class="clickable" (click)="clicks = clicks + 1">div</div>
    <button class="clickable" (click)="clicks = clicks + 1">button</button>
  `,
})
class HostComponent {
  clicks = 0;
}

describe('ClickableDirective', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  function elements() {
    const div = fixture.nativeElement.querySelector('div.clickable') as HTMLElement;
    const button = fixture.nativeElement.querySelector('button.clickable') as HTMLElement;
    return { div, button };
  }

  it('adds button role and tabindex to a non-semantic element', () => {
    const { div } = elements();
    expect(div.getAttribute('role')).toBe('button');
    expect(div.getAttribute('tabindex')).toBe('0');
  });

  it('does not override semantics of a native button', () => {
    const { button } = elements();
    expect(button.getAttribute('role')).toBeNull();
    expect(button.getAttribute('tabindex')).toBeNull();
  });

  it('triggers the click handler on Enter and Space', () => {
    const { div } = elements();
    div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    div.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(fixture.componentInstance.clicks).toBe(2);
  });

  it('does not double-fire keyboard activation on a native button', () => {
    const { button } = elements();
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(fixture.componentInstance.clicks).toBe(0);
  });
});
