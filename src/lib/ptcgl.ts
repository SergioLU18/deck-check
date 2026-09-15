import { plainApostrophes, type CardDatabase } from './cardDb';
import { cardFromPrint, isPokemon, mergeCards } from './deck';
import type { DeckCard } from './types';

/**
 * Pokémon TCG Live deck text: parsing it into a deck, and writing a deck back
 * out as it. Set codes come from the card database, so sets released after
 * this was written work without changes here.
 */

export interface PtcglLine {
  quantity: number;
  name: string;
  setCode: string;
  number: string;
}

export interface PtcglImportResult {
  cards: DeckCard[];
  resolved: number;
  unresolved: number;
}

// "{qty} {name with spaces} {SET_CODE} {number}". The greedy name lets the
// pattern backtrack from the right, so names can contain anything.
const LINE_PATTERN = /^(\d+)\s+(.*)\s+([A-Z][A-Z0-9-]{1,6})\s+(\w+)\s*$/;

export function parsePtcgl(text: string): PtcglLine[] {
  const lines: PtcglLine[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    // Section headers like "Pokémon: 12" or "Total Cards: 60".
    if (!/^\d/.test(line) && line.includes(':')) continue;

    const match = LINE_PATTERN.exec(line);
    if (!match) continue;

    // Energy type tokens like "{F}" aren't part of the card's name. PTCGL's
    // curly apostrophes become the plain one the card data uses, so a card
    // that can't be matched here can still be found by name later.
    const name = plainApostrophes(match[2])
      .replace(/\{[^}]+\}\s*/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    lines.push({
      quantity: Number(match[1]),
      name: name || 'Energy',
      setCode: match[3].toUpperCase(),
      number: match[4],
    });
  }
  return lines;
}

/** Matches each line to a print in the local database, merging duplicates. */
export function resolvePtcgl(lines: PtcglLine[], db: CardDatabase): PtcglImportResult {
  let cards: DeckCard[] = [];
  let resolved = 0;
  let unresolved = 0;
  for (const line of lines) {
    const card = resolveLine(line, db);
    if (card.cardId) resolved++;
    else unresolved++;
    cards = mergeCards(cards, [card]);
  }
  return { cards, resolved, unresolved };
}

function resolveLine(line: PtcglLine, db: CardDatabase): DeckCard {
  // A code can cover several sets — BRS is Brilliant Stars and its Trainer
  // Gallery — so the number is tried in each. The database uses bare numbers
  // ("sv1-8"); a zero-padded "008" is tolerated.
  const setIds = db.setIdsForCode(line.setCode);
  const numbers = [line.number, line.number.replace(/^0+(?=\d)/, '')];
  for (const setId of setIds) {
    for (const number of numbers) {
      const print = db.getById(`${setId}-${number}`);
      if (print) return cardFromPrint(print, line.quantity);
    }
  }

  // Fall back to the card's prints by name, matching set and number. An
  // unknown code is tried as a set id. The set prefix includes its dash so
  // sv1 doesn't match sv10, and the number its leading dash so "-12" doesn't
  // match "-112". A number written without its letter prefix counts too:
  // "PR-SW 251" is SWSH251.
  const number = line.number.toLowerCase();
  const wanted = digitsOf(line.number);
  const prefixes = (setIds.length ? setIds : [line.setCode]).map((setId) => `${setId.toLowerCase()}-`);
  const match = db.printsFor(line.name).find((print) => {
    const id = print.id.toLowerCase();
    if (!prefixes.some((prefix) => id.startsWith(prefix))) return false;
    return id.endsWith(`-${number}`) || (wanted !== '' && digitsOf(print.number) === wanted);
  });
  if (match) return cardFromPrint(match, line.quantity);

  return { name: line.name, quantity: line.quantity, subtypes: [] };
}

/** A collector number without its letter prefix or zero padding: "SWSH251" → "251". */
const digitsOf = (number: string) => number.replace(/^\D+/, '').replace(/^0+(?=\d)/, '');

export function exportPtcgl(cards: DeckCard[], db: CardDatabase): string {
  const pokemon: DeckCard[] = [];
  const trainers: DeckCard[] = [];
  const energy: DeckCard[] = [];
  const other: DeckCard[] = [];
  for (const card of cards) {
    const st = (card.supertype ?? '').toLowerCase();
    if (isPokemon(st)) pokemon.push(card);
    else if (st === 'trainer') trainers.push(card);
    else if (st === 'energy') energy.push(card);
    else other.push(card);
  }

  const out: string[] = [];
  const section = (header: string, list: DeckCard[]) => {
    if (!list.length) return;
    out.push(`${header}: ${list.reduce((sum, card) => sum + card.quantity, 0)}`);
    for (const card of list) {
      const ref = db.setRef(card.cardId);
      out.push(`${card.quantity} ${card.name}${ref ? ` ${ref.setCode} ${ref.number}` : ''}`);
    }
    out.push('');
  };
  section('Pokémon', pokemon);
  section('Trainer', trainers);
  section('Energy', energy);
  section('Other', other);
  out.push(`Total Cards: ${cards.reduce((sum, card) => sum + card.quantity, 0)}`);
  return out.join('\n').trim();
}
