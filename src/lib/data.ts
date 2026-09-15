import { CardDatabase, type CardDataFile } from './cardDb';
import type { DeckListAssets } from './deckListPdf';

// Static files served from public/: the card data (kept current by
// scripts/update-cards.mjs) and the deck list form with its fonts.

async function fetchOk(path: string): Promise<Response> {
  const response = await fetch(`${import.meta.env.BASE_URL}${path}`);
  if (!response.ok) throw new Error(`Couldn't load ${path} (HTTP ${response.status}).`);
  return response;
}

let cardDatabase: Promise<CardDatabase> | undefined;

export function loadCardDatabase(): Promise<CardDatabase> {
  if (!cardDatabase) {
    cardDatabase = fetchOk('data/cards.json')
      .then((response) => response.json() as Promise<CardDataFile>)
      .then((data) => new CardDatabase(data));
    // Let a later call retry rather than replaying the failure forever.
    cardDatabase.catch(() => (cardDatabase = undefined));
  }
  return cardDatabase;
}

let deckListAssets: Promise<DeckListAssets> | undefined;

export function loadDeckListAssets(): Promise<DeckListAssets> {
  if (!deckListAssets) {
    const files = ['play-pokemon-deck-list.pdf', 'RobotoCondensed-Regular.ttf', 'RobotoCondensed-Bold.ttf'];
    deckListAssets = Promise.all(files.map((file) => fetchOk(`form/${file}`).then((r) => r.arrayBuffer()))).then(
      ([form, font, boldFont]) => ({ form, font, boldFont }),
    );
    deckListAssets.catch(() => (deckListAssets = undefined));
  }
  return deckListAssets;
}
