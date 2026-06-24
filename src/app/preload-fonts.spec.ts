import { preloadDialogFontSubsets } from './preload-fonts';

/**
 * `preloadDialogFontSubsets` warms the Roboto subsets the dialogs use so the first
 * dialog open doesn't fetch+swap fonts and reflow (the "elements jump up" bug).
 */
describe('preloadDialogFontSubsets', () => {
  let originalDescriptor: PropertyDescriptor | undefined;

  function setFonts(value: unknown) {
    originalDescriptor = Object.getOwnPropertyDescriptor(document, 'fonts');
    Object.defineProperty(document, 'fonts', { value, configurable: true });
  }

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(document, 'fonts', originalDescriptor);
    } else {
      // jsdom may not define `fonts` natively; drop the stub we added.
      delete (document as unknown as { fonts?: unknown }).fonts;
    }
    originalDescriptor = undefined;
  });

  it('warms the dialog glyph set at both body (400) and title (500) weights', () => {
    const load = vi.fn((_font: string, _text: string) => Promise.resolve([]));
    setFonts({ load });

    preloadDialogFontSubsets();

    expect(load).toHaveBeenCalledTimes(2);
    const fontArgs = load.mock.calls.map((c) => c[0]);
    expect(fontArgs).toContain('400 1em Roboto');
    expect(fontArgs).toContain('500 1em Roboto');

    // Every call warms the same glyph string, which must cover the greek/math/symbols
    // glyphs that only the dialogs paint (otherwise their subsets stay lazy → the jump).
    for (const call of load.mock.calls) {
      const text = call[1];
      for (const glyph of ['Δ', 'θ', 'ω', '≈', '−', '←', '→', '↔', '☉']) {
        expect(text).toContain(glyph);
      }
    }
  });

  it('is a no-op when the Font Loading API is unavailable', () => {
    setFonts(undefined);
    expect(() => preloadDialogFontSubsets()).not.toThrow();
  });

  it('swallows font-load rejections (best-effort warm-up)', () => {
    const load = vi.fn(() => Promise.reject(new Error('network')));
    setFonts({ load });
    expect(() => preloadDialogFontSubsets()).not.toThrow();
  });
});
