import { AfterViewInit, Directive, ElementRef, Renderer2, inject } from '@angular/core';

/** Tooltip text for a speculative body's value cells (see the directive doc below). */
export const SPECULATIVE_VALUE_TOOLTIP = 'Data extrapolated from Thargoid system map';

/**
 * Applied automatically to every `.body-data-entry` row (matched by class, no template
 * wiring needed at each call site) inside a speculative body panel — i.e. one nested under
 * `.system-body.speculative-values` (see system-body.component.html/.scss, which also
 * appends the "?" mark itself via CSS `::after`). Gives that CSS-generated "?" a real,
 * hoverable explanation without adding a binding to every individual value in the template.
 * Uses a native `title` rather than `matTooltip` so it needs no dependency on the host
 * component — it reads the ancestor's `.speculative-values` class directly off the DOM.
 * Skips rows marked `.no-speculative-mark` — either known for certain (the star's spectral
 * class/luminosity) or already self-qualified as a guess (the star's age range).
 */
@Directive({
  selector: '.body-data-entry',
  standalone: true,
})
export class SpeculativeValueTooltipDirective implements AfterViewInit {
  private readonly el: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly renderer = inject(Renderer2);

  ngAfterViewInit(): void {
    const valueCell = this.el.nativeElement.querySelector<HTMLElement>(':scope > div:last-child');
    if (!valueCell || valueCell.classList.contains('no-speculative-mark')) {
      return;
    }
    if (this.el.nativeElement.closest('.speculative-values')) {
      this.renderer.setAttribute(valueCell, 'title', SPECULATIVE_VALUE_TOOLTIP);
    }
  }
}
