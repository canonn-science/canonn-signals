/**
 * Decodes HTML entities (e.g. `&amp;`, `&#39;`) in a string. Assigning to a
 * detached `<textarea>`'s innerHTML decodes entities without executing markup,
 * because textarea content is parsed as plain text, not HTML. Shared by the
 * components that display API-sourced system names.
 */
export function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}
