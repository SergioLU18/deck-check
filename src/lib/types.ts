export type Format = 'Standard' | 'Expanded' | 'Unlimited';
export const FORMATS: Format[] = ['Standard', 'Expanded', 'Unlimited'];

/** One printing of a card, as the local card database knows it. */
export interface CardPrint {
  /** "{setId}-{number}", e.g. "sv3-125". */
  id: string;
  name: string;
  setId: string;
  setName: string;
  number: string;
  /** "Pokémon", "Trainer" or "Energy". */
  supertype?: string;
  subtypes: string[];
  regulationMark?: string;
  imageUrl: string;
}

/** A line in a deck: some number of copies of one card. */
export interface DeckCard {
  name: string;
  quantity: number;
  /**
   * The print this line refers to. Undefined for a card known only by name —
   * one a PTCGL import couldn't match — which leaves the deck list's SET,
   * COLL. # and REG columns blank until a print is chosen.
   */
  cardId?: string;
  supertype?: string;
  subtypes: string[];
  imageUrl?: string;
}

export interface Deck {
  id: string;
  name: string;
  format: Format;
  /** In the order they were added, which is the order the deck list prints. */
  cards: DeckCard[];
  createdAt: string;
  updatedAt: string;
}

/** The player details printed at the top of a Play! Pokémon deck list. */
export interface Player {
  name: string;
  playerId: string;
  /** "YYYY-MM-DD". */
  dateOfBirth?: string;
}

export type AgeDivision = 'junior' | 'senior' | 'masters';
