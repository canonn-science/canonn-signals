import { Directive, ElementRef, HostListener, inject } from '@angular/core';

/**
 * Makes a non-semantic element (e.g. a `<div>`/`<span>` with a `(click)` handler)
 * operable by keyboard and assistive technology. It applies the `.clickable`
 * class — already used across the body views for `cursor: pointer` — so every
 * existing clickable element becomes accessible without per-element markup:
 *
 *  - exposes `role="button"` and `tabindex="0"` so the element is focusable and
 *    announced as a button (unless the author already set those, e.g. on a real
 *    `<button>` or an element with a more specific role);
 *  - triggers the element's own `(click)` handler on Enter/Space, matching native
 *    button behaviour.
 */
@Directive({
  selector: '.clickable',
  host: {
    '[attr.role]': 'role',
    '[attr.tabindex]': 'tabindex',
  },
})
export class ClickableDirective {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Don't override semantics the author set explicitly (real buttons, links, etc.). */
  protected get role(): string | null {
    const native = this.el.nativeElement;
    if (native.hasAttribute('role')) { return native.getAttribute('role'); }
    const tag = native.tagName.toLowerCase();
    return tag === 'button' || tag === 'a' ? null : 'button';
  }

  protected get tabindex(): string | null {
    const native = this.el.nativeElement;
    if (native.hasAttribute('tabindex')) { return native.getAttribute('tabindex'); }
    const tag = native.tagName.toLowerCase();
    return tag === 'button' || tag === 'a' ? null : '0';
  }

  @HostListener('keydown.enter', ['$event'])
  @HostListener('keydown.space', ['$event'])
  protected onActivate(event: Event): void {
    // Ignore synthesized/native button activation to avoid double-firing.
    const tag = this.el.nativeElement.tagName.toLowerCase();
    if (tag === 'button' || tag === 'a') { return; }
    event.preventDefault();
    this.el.nativeElement.click();
  }
}
