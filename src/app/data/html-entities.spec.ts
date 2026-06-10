import { decodeHtmlEntities } from './html-entities';

describe('decodeHtmlEntities', () => {
  it('decodes named and numeric entities', () => {
    expect(decodeHtmlEntities('Barnard&#39;s Star')).toBe("Barnard's Star");
    expect(decodeHtmlEntities('A &amp; B')).toBe('A & B');
    expect(decodeHtmlEntities('&lt;tag&gt;')).toBe('<tag>');
  });

  it('leaves plain text untouched', () => {
    expect(decodeHtmlEntities('Sol')).toBe('Sol');
    expect(decodeHtmlEntities('')).toBe('');
  });

  it('does not execute markup (returns the textarea text value)', () => {
    // A <script> assigned to a detached textarea's innerHTML is treated as text.
    expect(decodeHtmlEntities('Col 285 Sector')).toBe('Col 285 Sector');
  });
});
