import type { CardPrint, Deck, DeckCard } from './types';

export const DECK_SIZE = 60;

export type CardGroup = 'Pokémon' | 'Supporter' | 'Item' | 'Tool' | 'Stadium' | 'Energy' | 'Other';

export function isPokemon(supertype?: string): boolean {
  const st = (supertype ?? '').toLowerCase();
  return st === 'pokemon' || st === 'pokémon';
}

export const countCards = (cards: DeckCard[]) => cards.reduce((sum, card) => sum + card.quantity, 0);

/** The deck builder's sections, in display order, empty ones left out. */
export function groupCards(cards: DeckCard[]): [CardGroup, DeckCard[]][] {
  const groups: Record<CardGroup, DeckCard[]> = {
    'Pokémon': [],
    Supporter: [],
    Item: [],
    Tool: [],
    Stadium: [],
    Energy: [],
    Other: [],
  };
  for (const card of cards) {
    const st = (card.supertype ?? '').toLowerCase();
    if (isPokemon(st)) {
      groups['Pokémon'].push(card);
    } else if (st === 'trainer') {
      const sub = card.subtypes.map((s) => s.toLowerCase());
      if (sub.includes('supporter')) groups.Supporter.push(card);
      else if (sub.includes('item')) groups.Item.push(card);
      else if (sub.some((s) => s.includes('tool'))) groups.Tool.push(card);
      else if (sub.includes('stadium')) groups.Stadium.push(card);
      else groups.Other.push(card);
    } else if (st === 'energy') {
      groups.Energy.push(card);
    } else {
      groups.Other.push(card);
    }
  }
  return (Object.entries(groups) as [CardGroup, DeckCard[]][]).filter(([, list]) => list.length > 0);
}

export function cardFromPrint(print: CardPrint, quantity: number): DeckCard {
  return {
    name: print.name,
    quantity,
    cardId: print.id,
    supertype: print.supertype,
    subtypes: print.subtypes,
    imageUrl: print.imageUrl,
  };
}

/** Cards are the same line when they're the same print, or the same name with no print. */
const keyOf = (card: DeckCard) => card.cardId ?? card.name;

/** Adds [incoming] to [cards], topping up the quantity of lines already there. */
export function mergeCards(cards: DeckCard[], incoming: DeckCard[]): DeckCard[] {
  const next = cards.map((card) => ({ ...card }));
  for (const card of incoming) {
    const existing = next.find((c) => keyOf(c) === keyOf(card));
    if (existing) existing.quantity += card.quantity;
    else next.push({ ...card });
  }
  return next;
}

export const addPrint = (cards: DeckCard[], print: CardPrint, quantity: number) =>
  mergeCards(cards, [cardFromPrint(print, quantity)]);

/** Changes a line's quantity, removing it when it reaches zero. */
export function changeQuantity(cards: DeckCard[], index: number, delta: number): DeckCard[] {
  const quantity = cards[index].quantity + delta;
  if (quantity <= 0) return cards.filter((_, i) => i !== index);
  return cards.map((card, i) => (i === index ? { ...card, quantity } : card));
}

/**
 * Swaps the print a line refers to, keeping its quantity and place. If the
 * deck already has a line for the new print, the two are folded together.
 */
export function replacePrint(cards: DeckCard[], index: number, print: CardPrint): DeckCard[] {
  const current = cards[index];
  const duplicate = cards.findIndex((card, i) => i !== index && card.cardId === print.id);
  if (duplicate !== -1) {
    return cards
      .map((card, i) => (i === duplicate ? { ...card, quantity: card.quantity + current.quantity } : card))
      .filter((_, i) => i !== index);
  }
  return cards.map((card, i) => (i === index ? cardFromPrint(print, current.quantity) : card));
}

export function newDeck(name = 'New deck'): Deck {
  const now = new Date().toISOString();
  return {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    name,
    format: 'Standard',
    cards: [],
    createdAt: now,
    updatedAt: now,
  };
}
