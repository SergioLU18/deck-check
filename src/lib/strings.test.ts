import { describe, expect, it } from 'vitest';
import { detectLanguage, STRINGS } from './strings';

describe('detectLanguage', () => {
  it('keeps a language the player picked', () => {
    expect(detectLanguage('es', ['en-US'])).toBe('es');
    expect(detectLanguage('en', ['es-MX'])).toBe('en');
  });

  it("follows the browser's first language we speak", () => {
    expect(detectLanguage(null, ['es-MX', 'en-US'])).toBe('es');
    expect(detectLanguage(null, ['fr-FR', 'es'])).toBe('es');
    expect(detectLanguage(null, ['fr-FR', 'en-GB', 'es'])).toBe('en');
  });

  it('falls back to English', () => {
    expect(detectLanguage(null, [])).toBe('en');
    expect(detectLanguage('xx', ['de-DE'])).toBe('en');
  });
});

describe('Spanish strings', () => {
  const { es, en } = STRINGS;

  it('translates every label', () => {
    // Labels that are the same in both languages on purpose.
    const shared = new Set(['regulation']);
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      if (shared.has(key) || typeof en[key] !== 'string') continue;
      expect(es[key], key).not.toBe(en[key]);
    }
  });

  it('agrees in number', () => {
    expect(es.importNotice(1, 0)).toBe('Se importó 1 línea.');
    expect(es.importNotice(12, 2)).toMatch(/^Se importaron 12 líneas\. 2 cartas no se pudieron/);
    expect(es.printCount(1)).toBe('1 versión');
    expect(es.printCount(3)).toBe('3 versiones');
    expect(es.overBy(60, 1)).toMatch(/le sobra 1\.$/);
    expect(en.importNotice(1, 1)).toMatch(/^Imported 1 line\. One card/);
  });
});
