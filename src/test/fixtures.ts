import { readFileSync } from 'node:fs';
import { CardDatabase, type CardDataFile } from '../lib/cardDb';
import type { DeckListAssets } from '../lib/deckListPdf';
import type { DeckCard } from '../lib/types';

// Tests run against the real card data in public/data rather than a mock, so
// they catch data problems as well as logic ones.

let db: CardDatabase | undefined;

export function testDb(): CardDatabase {
  db ??= new CardDatabase(JSON.parse(readFileSync('public/data/cards.json', 'utf8')) as CardDataFile);
  return db;
}

export function testAssets(): DeckListAssets {
  const read = (file: string) => new Uint8Array(readFileSync(`public/form/${file}`));
  return {
    form: read('play-pokemon-deck-list.pdf'),
    font: read('RobotoCondensed-Regular.ttf'),
    boldFont: read('RobotoCondensed-Bold.ttf'),
  };
}

export const card = (name: string, quantity: number, supertype: string, cardId?: string): DeckCard => ({
  name,
  quantity,
  supertype,
  cardId,
  subtypes: [],
});
