import { writeFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { card, testAssets, testDb } from '../test/fixtures';
import { buildDeckListPdf, layoutFor, splitDeck, type DeckListOptions } from './deckListPdf';
import { deckListFileName } from './fileName';
import type { DeckCard, Player } from './types';

const player: Player = { name: 'Ash Ketchum', playerId: '1234567' };

const build = (cards: DeckCard[], options: Partial<DeckListOptions> = {}) =>
  buildDeckListPdf({
    cards,
    deckName: 'Test Deck',
    player,
    format: 'Standard',
    db: testDb(),
    assets: testAssets(),
    ...options,
  });

describe('building the sheet', () => {
  it('fills a deck onto a single sheet', async () => {
    const result = await build(
      [
        card('Charizard ex', 3, 'Pokémon', 'sv3-125'),
        card('Charmander', 4, 'Pokémon', 'sv3-26'),
        card("Professor's Research", 4, 'Trainer', 'sv1-189'),
        card('Basic Fire Energy', 8, 'Energy'),
      ],
      { division: 'masters' },
    );
    expect(result.pageCount).toBe(1);
    const reloaded = await PDFDocument.load(result.bytes);
    expect(reloaded.getPageCount()).toBe(1);
    expect(reloaded.getPage(0).getSize()).toEqual({ width: 612, height: 792 });
  });

  it('re-proportions a lopsided deck onto one sheet', async () => {
    // 12 Pokémon lines against 10 printed rows, but only 4 Trainers against 18.
    const result = await build([
      ...Array.from({ length: 12 }, (_, i) => card(`Pokemon ${i}`, 1, 'Pokémon')),
      ...Array.from({ length: 4 }, (_, i) => card(`Trainer ${i}`, 1, 'Trainer')),
    ]);
    expect(result.pageCount).toBe(1);
  });

  it('spills onto a continuation sheet when no layout can fit it', async () => {
    // 36 lines against a 32-row sheet.
    const result = await build([
      ...Array.from({ length: 14 }, (_, i) => card(`Pokemon ${i}`, 1, 'Pokémon')),
      ...Array.from({ length: 20 }, (_, i) => card(`Trainer ${i}`, 1, 'Trainer')),
      ...Array.from({ length: 2 }, (_, i) => card(`Energy ${i}`, 1, 'Energy')),
    ]);
    expect(result.pageCount).toBe(2);
    expect((await PDFDocument.load(result.bytes)).getPageCount()).toBe(2);
  });

  it('counts pages by whichever section overflows the most', async () => {
    const result = await build([
      ...Array.from({ length: 5 }, (_, i) => card(`Pokemon ${i}`, 1, 'Pokémon')),
      // 37 trainer lines against 18 ruled rows → 3 pages.
      ...Array.from({ length: 37 }, (_, i) => card(`Trainer ${i}`, 1, 'Trainer')),
    ]);
    expect(result.pageCount).toBe(3);
  });

  it('produces the blank form for an empty deck', async () => {
    const result = await build([]);
    expect(result.pageCount).toBe(1);
    expect(result.missingSetInfo).toEqual([]);
    expect(result.unclassified).toEqual([]);
  });

  it("survives characters the font can't draw", async () => {
    const result = await build([card('Nidoran ♀', 1, 'Pokémon', 'base3-57'), card('ピカチュウ', 1, 'Pokémon')], {
      player: { name: 'サトシ', playerId: '1' },
    });
    expect(result.pageCount).toBe(1);
  });
});

describe('what goes in each column', () => {
  const split = (cards: DeckCard[]) => splitDeck(cards, testDb());

  it('reports cards it could not fully fill in', () => {
    const sections = split([
      // No print: no set code, collector number or regulation mark.
      card('Mystery Pokemon', 1, 'Pokémon'),
      // No supertype and no print: falls back to the Trainer table.
      card('Mystery Card', 1, ''),
    ]);
    expect(sections.missingSetInfo).toEqual(['Mystery Pokemon']);
    expect(sections.missingRegulationMark).toEqual(['Mystery Pokemon']);
    expect(sections.unclassified).toEqual(['Mystery Card']);
    expect(sections.trainer.map((e) => e.name)).toEqual(['Mystery Card']);
  });

  it('fills set, number and regulation mark from the print', () => {
    const [entry] = split([card('Charizard ex', 3, 'Pokémon', 'sv3-125')]).pokemon;
    expect(entry).toEqual({ quantity: 3, name: 'Charizard ex', setCode: 'OBF', number: '125', regulationMark: 'G' });
  });

  it('classifies a card saved without a supertype from its print', () => {
    const sections = split([card('Iono', 4, '', 'sv2-185')]);
    expect(sections.trainer).toHaveLength(1);
    expect(sections.unclassified).toEqual([]);
  });

  it('writes NA for a card older than any set the form lists', () => {
    // Base Set (1999) predates Black & White, the oldest set on the sheet.
    const sections = split([card('Charizard', 1, 'Pokémon', 'base1-4')]);
    expect(sections.pokemon[0].setCode).toBe('NA');
    expect(sections.pokemon[0].number).toBe('4');
    // NA counts as filled in.
    expect(sections.missingSetInfo).toEqual([]);
  });

  it("leaves the set blank rather than guessing NA for a set it doesn't know", () => {
    // Could equally be a brand-new release missing from the PTCGL map.
    const sections = split([card('Mystery', 1, 'Pokémon', 'zzz-1')]);
    expect(sections.pokemon[0].setCode).toBeUndefined();
    expect(sections.missingSetInfo).toEqual(['Mystery']);
  });

  it('keeps the code of a set the form lists', () => {
    const sections = split([card('Snivy', 1, 'Pokémon', 'bw1-1')]);
    expect(sections.pokemon[0].setCode).toBe('BLW');
    expect(sections.missingSetInfo).toEqual([]);
  });

  it("writes promos the way the form's legend does", () => {
    const code = (cardId: string) => split([card('Promo', 1, 'Pokémon', cardId)]).pokemon[0];
    expect(code('swshp-SWSH001')).toMatchObject({ setCode: 'PR', number: 'SWSH001' });
    expect(code('bwp-BW01').setCode).toBe('PR');
    expect(code('svp-1').setCode).toBe('SVP');
    expect(code('mcd11-1').setCode).toBe('MCD');
    expect(code('mep-31')).toMatchObject({ setCode: 'MEP', number: '31', regulationMark: 'I' });
  });

  it("spells out symbols the font doesn't have", () => {
    const sections = split([card('Nidoran ♀', 1, 'Pokémon'), card('Victini ◇', 1, 'Pokémon')]);
    expect(sections.pokemon.map((e) => e.name)).toEqual(['Nidoran F', 'Victini Prism Star']);
  });
});

describe('table layout', () => {
  it('leaves the printed form alone when the deck fits it', () => {
    expect(layoutFor({ pokemon: 10, trainer: 18, energy: 4 }).redrawn).toBe(false);
  });

  it('re-proportions only when it saves a sheet', () => {
    expect(layoutFor({ pokemon: 20, trainer: 5, energy: 3 }).redrawn).toBe(true);
    // Too many lines for any single sheet — keep the official artwork.
    expect(layoutFor({ pokemon: 20, trainer: 20, energy: 4 }).redrawn).toBe(false);
  });

  it('never invents rows beyond what the page holds', () => {
    const layout = layoutFor({ pokemon: 20, trainer: 5, energy: 3 });
    expect(layout.pokemon.rows + layout.trainer.rows + layout.energy.rows).toBe(32);
  });

  it('keeps room for at least one card in every table', () => {
    const layout = layoutFor({ pokemon: 28, trainer: 1, energy: 0 });
    expect(layout.energy.rows).toBeGreaterThanOrEqual(1);
    expect(layout.trainer.rows).toBeGreaterThanOrEqual(1);
  });

  it('never needs a second page once resized', () => {
    for (const p of [12, 20, 25]) {
      for (const t of [1, 5, 10]) {
        const layout = layoutFor({ pokemon: p, trainer: t, energy: 2 });
        if (!layout.redrawn) continue;
        expect(layout.pokemon.rows).toBeGreaterThanOrEqual(p);
        expect(layout.trainer.rows).toBeGreaterThanOrEqual(t);
        expect(layout.energy.rows).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('leaves a blank line in every table when there is slack', () => {
    const layout = layoutFor({ pokemon: 20, trainer: 5, energy: 1 });
    expect(layout.pokemon.rows).toBeGreaterThan(20);
    expect(layout.trainer.rows).toBeGreaterThan(5);
    expect(layout.energy.rows).toBeGreaterThan(1);
  });

  it('lands redrawn tables where the printed ones are', () => {
    // That equivalence is what makes a redraw invisible.
    const stock = layoutFor({ pokemon: 1, trainer: 1, energy: 1 });
    const resized = layoutFor({ pokemon: 20, trainer: 5, energy: 3 });
    expect(resized.pokemon.headerTop).toBe(stock.pokemon.headerTop);
    expect(Math.abs(resized.energy.bottom - stock.energy.bottom)).toBeLessThan(0.5);
  });
});

it('names the file after the player, falling back to the deck', () => {
  expect(deckListFileName('Sergio López', 'Charizard')).toBe('sergio lópez-deck-list.pdf');
  expect(deckListFileName('  ', 'Charizard / Pidgeot')).toBe('charizard pidgeot-deck-list.pdf');
});

// Set these to write sample sheets for eyeballing, e.g.
//   DECK_LIST_PDF_OUT=/tmp/sheet.pdf npm test
const samplePlayer: Player = { name: 'Ash Ketchum', playerId: '1234567', dateOfBirth: '1997-04-01' };

it.runIf(process.env.DECK_LIST_PDF_OUT)('writes a sample sheet', async () => {
  const result = await build(
    [
      card('Charizard ex', 3, 'Pokémon', 'sv3-125'),
      card('Charmander', 4, 'Pokémon', 'sv3-26'),
      card('Pidgeot ex', 2, 'Pokémon', 'sv3-164'),
      card('Pidgey', 2, 'Pokémon', 'sv3-16'),
      card('Radiant Charizard', 1, 'Pokémon', 'swsh12pt5-20'),
      card('Rotom V', 2, 'Pokémon', 'swsh11-45'),
      // Base Set predates every set the form lists — exercises the NA rule.
      card('Charizard', 1, 'Pokémon', 'base1-4'),
      card("Professor's Research", 4, 'Trainer', 'sv1-189'),
      card('Iono', 4, 'Trainer', 'sv2-185'),
      card("Boss's Orders", 2, 'Trainer', 'sv2-172'),
      card('Rare Candy', 4, 'Trainer', 'sv1-191'),
      card('Ultra Ball', 4, 'Trainer', 'sv1-196'),
      card('Nest Ball', 3, 'Trainer', 'sv1-181'),
      card('Super Rod', 2, 'Trainer', 'sv2-188'),
      card('Forest Seal Stone', 2, 'Trainer', 'swsh12-156'),
      card('Artazon', 3, 'Trainer', 'sv2-171'),
      card('Basic Fire Energy', 8, 'Energy', 'sve-2'),
    ],
    { player: samplePlayer, division: 'masters' },
  );
  writeFileSync(process.env.DECK_LIST_PDF_OUT!, result.bytes);
});

it.runIf(process.env.DECK_LIST_RESIZED_OUT)('writes a re-proportioned sample', async () => {
  const result = await build(
    [
      ...Array.from({ length: 20 }, (_, i) => card(`Pokemon Number ${i}`, 1, 'Pokémon', `sv3-${i + 1}`)),
      ...Array.from({ length: 5 }, (_, i) => card(`Trainer Number ${i}`, 2, 'Trainer')),
      card('Basic Fire Energy', 6, 'Energy'),
    ],
    { player: samplePlayer, format: 'Expanded', division: 'senior' },
  );
  expect(result.pageCount).toBe(1);
  writeFileSync(process.env.DECK_LIST_RESIZED_OUT!, result.bytes);
});

it.runIf(process.env.DECK_LIST_OVERFLOW_OUT)('writes an overflowing sample', async () => {
  const result = await build(
    [
      ...Array.from({ length: 14 }, (_, i) => card(`Pokemon Number ${i}`, 1, 'Pokémon', `sv3-${i + 1}`)),
      ...Array.from({ length: 22 }, (_, i) => card(`Trainer Number ${i}`, 1, 'Trainer')),
      ...Array.from({ length: 6 }, (_, i) => card(`Energy Number ${i}`, 1, 'Energy')),
    ],
    { player: samplePlayer, division: 'masters' },
  );
  expect(result.pageCount).toBe(2);
  writeFileSync(process.env.DECK_LIST_OVERFLOW_OUT!, result.bytes);
});
