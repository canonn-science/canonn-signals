/**
 * Eagerly warm the Roboto unicode-range subsets that ONLY the information dialogs use.
 *
 * The app self-hosts Roboto via `@fontsource/roboto`, which splits each weight into
 * many `unicode-range` subset files (latin, latin-ext, greek, math, symbols, …) under
 * one `Roboto` family. A subset's woff2 is fetched lazily — only when a glyph in its
 * range is first painted. The main system view paints only latin glyphs, so the greek
 * (Δ θ ω), math (≈ −) and symbols (← → ↔ ☉) subsets stay unfetched until the FIRST
 * dialog opens and renders that notation. The fallback→Roboto swap then reflows the
 * affected text, which is the brief "elements jump up" seen on the first dialog open.
 *
 * Warming those exact glyphs at startup moves the fetch to initial load (where it
 * changes nothing — the page never paints them) so every dialog opens with the fonts
 * already cached, eliminating the swap and the jump. It's fire-and-forget: the load is
 * never awaited, so it can't delay first paint.
 *
 * The string is the complete set of non-ASCII glyphs the dialog templates render; keep
 * it in sync if a dialog introduces a glyph from a new subset. Weights 400 (body) and
 * 500 (Material dialog titles/buttons) are both warmed.
 */
const DIALOG_GLYPHS = '°±²³·½×Δθω–—←↑→↔−≈☉';

export function preloadDialogFontSubsets(): void {
  // `document.fonts` is unavailable in very old browsers — degrade to a no-op (the
  // jump simply isn't prevented there). Errors are swallowed: this is a pure warm-up.
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
  if (!fonts) return;

  for (const weight of [400, 500]) {
    fonts.load(`${weight} 1em Roboto`, DIALOG_GLYPHS).catch(() => {
      /* best-effort cache warm — ignore failures */
    });
  }
}
