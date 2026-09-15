import { describe, expect, it } from 'vitest';
import { card, testDb } from '../test/fixtures';
import { addPrint, changeQuantity, groupCards, replacePrint } from './deck';
import { divisionFor } from './division';

describe('card database', () => {
  it('returns one search result per name, prefix matches first', () => {
    const results = testDb().search('iono');
    expect(results[0].name).toBe('Iono');
    expect(new Set(results.map((r) => r.name)).size).toBe(results.length);
  });

  it('matches curly apostrophes against straight ones', () => {
    expect(testDb().search('Boss’s Orders')[0]?.name).toBe("Boss's Orders");
  });

  it('finds prints whatever the apostrophe or case', () => {
    const plain = testDb().printsFor("Boss's Orders").map((p) => p.id);
    expect(plain.length).toBeGreaterThan(0);
    expect(testDb().printsFor('Boss’s Orders').map((p) => p.id)).toEqual(plain);
    expect(testDb().printsFor("BOSSʼS ORDERS").map((p) => p.id)).toEqual(plain);
    // What "Choose prints" relies on for a card imported by name only.
    expect(testDb().suggestPrint('N’s Castle', 'Standard')?.id).toBe('sv9-152');
  });

  it('lists prints oldest set first', () => {
    const prints = testDb().printsFor('Charizard');
    const dates = prints.map((p) => testDb().releaseDate(p.setId));
    expect(dates).toEqual([...dates].sort());
  });

  it('lends old Trainer printings the subtype of newer ones', () => {
    expect(testDb().printsFor('Switch').every((p) => p.subtypes.length > 0)).toBe(true);
  });

  it('flags cards from sets that have rotated out', () => {
    const db = testDb();
    const illegal = db.illegalCardIds(
      [card('Charizard', 1, 'Pokémon', 'base1-4'), card('Charizard ex', 1, 'Pokémon', 'sv3-125')],
      'Standard',
    );
    expect([...illegal]).toEqual(['base1-4']);
  });

  describe('set codes', () => {
    const code = (cardId: string) => testDb().setRef(cardId)?.setCode;

    it('writes each set with its own code', () => {
      expect(code('sv3-125')).toBe('OBF');
      expect(code('bw2-1')).toBe('EPO');
      expect(code('swsh6-1')).toBe('CRE');
      // Three consecutive Sun & Moon sets, easy to shift by one.
      expect(code('sm2-1')).toBe('GRI');
      expect(code('sm3-1')).toBe('BUS');
      expect(code('sm4-1')).toBe('CIN');
    });

    it('shares a code between a set and its sub-sets', () => {
      expect(testDb().setRef('swsh9tg-TG01')).toEqual({ setCode: 'BRS', number: 'TG01' });
      expect(testDb().setIdsForCode('BRS')).toEqual(['swsh9', 'swsh9tg']);
    });

    it('knows sets from the card data alone', () => {
      // Pitch Black, the last set the 2026 form covers.
      expect(code('me5-1')).toBe('PBL');
    });

    it('has promos pokemontcg.io is missing, filled in from TCGdex', () => {
      expect(testDb().printsFor("N's Zekrom").map((p) => p.id)).toContain('mep-31');
      expect(testDb().getById('mep-31')).toMatchObject({ supertype: 'Pokémon', subtypes: ['Basic'], regulationMark: 'I' });
      expect(testDb().setRef('mep-31')).toEqual({ setCode: 'MEP', number: '31' });
      expect(testDb().isLegal('mep', 'Standard')).toBe(true);
    });

    it('has no code for a card without a print', () => {
      expect(testDb().setRef(undefined)).toBeUndefined();
    });
  });

  it('points every set at art that exists', () => {
    // pokemontcg.io moved newer sets' images to another host.
    expect(testDb().getById('me4-1')?.imageUrl).toBe('https://images.scrydex.com/pokemon/me4-1/small');
    expect(testDb().getById('sv3-125')?.imageUrl).toBe('https://images.pokemontcg.io/sv3/125.png');
  });

  describe('print suggestions', () => {
    it('prefers the newest print legal in the format', () => {
      const db = testDb();
      const suggestion = db.suggestPrint('Charizard', 'Standard');
      expect(suggestion).toBeDefined();
      expect(db.isLegal(suggestion!.setId, 'Standard')).toBe(true);
    });

    it('falls back to the newest print when none are legal', () => {
      // No Base Set-era Bill is Standard legal, but there must be something to show.
      expect(testDb().suggestPrint('Bill', 'Standard')).toBeDefined();
    });

    it("returns nothing for a name the database doesn't have", () => {
      expect(testDb().suggestPrint('Definitely Not A Real Card', 'Standard')).toBeUndefined();
    });
  });
});

describe('deck editing', () => {
  const db = testDb();
  const iono = db.getById('sv2-185')!;
  const charizard = db.getById('sv3-125')!;

  it('tops up a print that is already in the deck', () => {
    const cards = addPrint(addPrint([], iono, 2), iono, 2);
    expect(cards).toHaveLength(1);
    expect(cards[0].quantity).toBe(4);
  });

  it('removes a line when its quantity reaches zero', () => {
    const cards = addPrint([], iono, 1);
    expect(changeQuantity(cards, 0, -1)).toEqual([]);
  });

  it('folds a print change into an existing line for that print', () => {
    const other = db.printsFor('Iono').find((p) => p.id !== iono.id)!;
    const cards = addPrint(addPrint([], iono, 2), other, 1);
    const replaced = replacePrint(cards, 1, iono);
    expect(replaced).toHaveLength(1);
    expect(replaced[0]).toMatchObject({ cardId: iono.id, quantity: 3 });
  });

  it('groups cards into the builder sections', () => {
    const groups = groupCards(addPrint(addPrint([], iono, 4), charizard, 3));
    expect(groups.map(([name]) => name)).toEqual(['Pokémon', 'Supporter']);
  });
});

describe('age division', () => {
  it('goes by birth year against the season, not current age', () => {
    expect(divisionFor(undefined, 2026)).toBeUndefined();
    expect(divisionFor('2014-06-15', 2026)).toBe('junior');
    expect(divisionFor('2013-06-15', 2026)).toBe('senior');
    expect(divisionFor('2010-06-15', 2026)).toBe('senior');
    expect(divisionFor('2009-06-15', 2026)).toBe('masters');
    // A season later every boundary moves by a year.
    expect(divisionFor('2014-06-15', 2027)).toBe('senior');
    expect(divisionFor('2015-06-15', 2027)).toBe('junior');
  });
});
