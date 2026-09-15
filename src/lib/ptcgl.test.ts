import { describe, expect, it } from 'vitest';
import { testDb } from '../test/fixtures';
import { exportPtcgl, parsePtcgl, resolvePtcgl } from './ptcgl';

const LIST = `Pokémon: 7
3 Charizard ex OBF 125
4 Charmander MEW 4

Trainer: 8
4 Iono PAL 185
4 Rare Candy SVI 191

Energy: 6
6 Basic {R} Energy SVE 2

Total Cards: 21`;

describe('parsing', () => {
  it('reads card lines and skips section headers', () => {
    const lines = parsePtcgl(LIST);
    expect(lines).toHaveLength(5);
    expect(lines[0]).toEqual({ quantity: 3, name: 'Charizard ex', setCode: 'OBF', number: '125' });
  });

  it('drops energy type tokens from names', () => {
    const energy = parsePtcgl(LIST)[4];
    expect(energy).toEqual({ quantity: 6, name: 'Basic Energy', setCode: 'SVE', number: '2' });
  });

  it("reads Pokémon TCG Live's curly apostrophes as plain ones", () => {
    const lines = parsePtcgl('2 Boss’s Orders MEG 114\n3 N‘s Castle JTG 152\n1 Nʼs PP Up JTG 153');
    expect(lines.map((l) => l.name)).toEqual(["Boss's Orders", "N's Castle", "N's PP Up"]);
  });

  it('keeps names that contain spaces and punctuation', () => {
    const [line] = parsePtcgl("2 Boss's Orders PAL 172");
    expect(line.name).toBe("Boss's Orders");
  });
});

describe('resolving', () => {
  it('matches each line to its print', () => {
    const result = resolvePtcgl(parsePtcgl(LIST), testDb());
    expect(result.unresolved).toBe(0);
    expect(result.cards.map((c) => c.cardId)).toEqual(['sv3-125', 'sv3pt5-4', 'sv2-185', 'sv1-191', 'sve-2']);
    // The print's own name wins over the text's.
    expect(result.cards[4].name).toBe('Basic Fire Energy');
    expect(result.cards[4].supertype).toBe('Energy');
  });

  it('merges repeated lines', () => {
    const result = resolvePtcgl(parsePtcgl('2 Iono PAL 185\n2 Iono PAL 185'), testDb());
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].quantity).toBe(4);
  });

  it('tolerates zero-padded numbers', () => {
    const result = resolvePtcgl(parsePtcgl('4 Iono PAL 0185'), testDb());
    expect(result.cards[0].cardId).toBe('sv2-185');
  });

  it('finds sub-set cards under their parent set code', () => {
    const result = resolvePtcgl(parsePtcgl('1 Some Trainer Gallery Card BRS TG01'), testDb());
    expect(result.cards[0].cardId).toBe('swsh9tg-TG01');
  });

  it('tolerates promo numbers written without their prefix', () => {
    const result = resolvePtcgl(parsePtcgl('2 Boss’s Orders PR-SW 251'), testDb());
    expect(result.cards[0].cardId).toBe('swshp-SWSH251');
  });

  it('keeps unmatched cards by name', () => {
    const result = resolvePtcgl(parsePtcgl('2 Totally Fake Card ZZZ 1'), testDb());
    expect(result.unresolved).toBe(1);
    expect(result.cards[0]).toMatchObject({ name: 'Totally Fake Card', quantity: 2 });
    expect(result.cards[0].cardId).toBeUndefined();
  });
});

describe('exporting', () => {
  it('round-trips through the PTCGL format', () => {
    const cards = resolvePtcgl(parsePtcgl(LIST), testDb()).cards;
    const text = exportPtcgl(cards, testDb());
    expect(text).toContain('Pokémon: 7\n3 Charizard ex OBF 125\n4 Charmander MEW 4');
    expect(text).toContain('Energy: 6\n6 Basic Fire Energy SVE 2');
    expect(text.endsWith('Total Cards: 21')).toBe(true);
    expect(resolvePtcgl(parsePtcgl(text), testDb()).cards).toEqual(cards);
  });
});
