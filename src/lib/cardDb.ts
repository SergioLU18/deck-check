import type { CardPrint, DeckCard, Format } from './types';

/** One card in public/data/cards.json, as written by scripts/update-cards.mjs. */
export interface CompactCard {
  /** Card id, "{setId}-{number}". */
  i: string;
  /** Name. */
  n: string;
  /** Supertype: Pokémon, Trainer or Energy. */
  t: 'P' | 'T' | 'E';
  /** Subtypes. */
  s?: string[];
  /** Regulation mark. */
  r?: string;
  /** Image URL, when it doesn't follow the set's pattern; "" when there's no art yet. */
  m?: string;
  /** Collector number, when it isn't the id's suffix. */
  u?: string;
  /** Set name, when it differs from the set's usual one. */
  x?: string;
}

export interface CompactSet {
  /** Name. */
  n: string;
  /** Release date, "YYYY/MM/DD". */
  d: string;
  /** Formats the set is legal in, as letters: s, e, u. Absent when unknown. */
  l?: string;
  /** The set's code ("OBF"), as pokemontcg.io gives it. */
  c?: string;
  /** Image URL pattern for the set's cards, when it isn't DEFAULT_IMAGE_URL. */
  m?: string;
}

export interface CardDataFile {
  version: 2;
  /** When cards were last downloaded, "YYYY-MM-DD". */
  updatedAt: string;
  sets: Record<string, CompactSet>;
  cards: CompactCard[];
}

/** A print's set code and collector number, as deck lists write them: "OBF 125". */
export interface SetRef {
  setCode: string;
  number: string;
}

/**
 * Where most cards' art lives; {set}, {number} and {id} are filled in per
 * card. Keep in step with scripts/update-cards.mjs.
 */
const DEFAULT_IMAGE_URL = 'https://images.pokemontcg.io/{set}/{number}.png';

/** Codes for sets the card data carries none for. */
const SET_CODE_OVERRIDES: Record<string, string> = {
  mee: 'MEE', // Mega Evolution Energy
  mep: 'MEP', // Mega Evolution Black Star Promos
};

const SUPERTYPES = { P: 'Pokémon', T: 'Trainer', E: 'Energy' } as const;
const FORMAT_LETTER: Record<Format, string> = { Standard: 's', Expanded: 'e', Unlimited: 'u' };

/** The set part of a card id: "sv3-125" → "sv3". */
export function setIdOf(cardId: string): string | undefined {
  const dash = cardId.lastIndexOf('-');
  return dash > 0 ? cardId.slice(0, dash) : undefined;
}

/** The collector-number part of a card id: "sv3-125" → "125". */
export function collectorNumberOf(cardId: string): string | undefined {
  const dash = cardId.lastIndexOf('-');
  return dash > 0 ? cardId.slice(dash + 1) : undefined;
}

/** Curly, modifier and stray-accent apostrophes as the plain one the card data uses. */
export const plainApostrophes = (s: string) => s.replace(/[’‘ʼ`´]/g, "'");

/**
 * How card names are compared: case-insensitive, and with any apostrophe read
 * as the plain one — Pokémon TCG Live writes "Boss’s Orders", the card data
 * "Boss's Orders".
 */
export const nameKey = (name: string) => plainApostrophes(name).replace(/\s+/g, ' ').trim().toLowerCase();

/** The local card database: every print there is, searched entirely in the browser. */
export class CardDatabase {
  private readonly sets: Record<string, CompactSet>;
  private readonly byId = new Map<string, CardPrint>();
  /** nameKey → every print of that name, oldest set first. */
  private readonly byName = new Map<string, CardPrint[]>();
  /** Every unique nameKey, for search. */
  private readonly names: string[] = [];
  /** Set code → the sets written with it, oldest first. */
  private readonly setsByCode = new Map<string, string[]>();

  readonly updatedAt: string;

  constructor(data: CardDataFile) {
    this.sets = data.sets;
    this.updatedAt = data.updatedAt;

    for (const card of data.cards) {
      const setId = setIdOf(card.i) ?? '';
      const number = card.u ?? collectorNumberOf(card.i) ?? '';
      const imageUrl = (data.sets[setId]?.m ?? DEFAULT_IMAGE_URL)
        .replace('{set}', setId)
        .replace('{number}', number)
        .replace('{id}', card.i);
      const print: CardPrint = {
        id: card.i,
        name: card.n,
        setId,
        setName: card.x ?? data.sets[setId]?.n ?? setId,
        number,
        supertype: SUPERTYPES[card.t],
        subtypes: card.s ?? [],
        regulationMark: card.r,
        imageUrl: card.m ?? imageUrl,
      };
      this.byId.set(print.id, print);

      const key = nameKey(print.name);
      const prints = this.byName.get(key);
      if (prints) {
        prints.push(print);
      } else {
        this.byName.set(key, [print]);
        this.names.push(key);
      }
    }

    for (const prints of this.byName.values()) {
      prints.sort((a, b) => this.releaseDate(a.setId).localeCompare(this.releaseDate(b.setId)));
    }

    const setIds = Object.keys(data.sets).sort((a, b) => this.releaseDate(a).localeCompare(this.releaseDate(b)));
    for (const setId of setIds) {
      const code = this.setCode(setId)?.toUpperCase();
      if (!code) continue;
      const list = this.setsByCode.get(code);
      if (list) list.push(setId);
      else this.setsByCode.set(code, [setId]);
    }
  }

  get cardCount(): number {
    return this.byId.size;
  }

  /**
   * One result per unique card name — the newest print, for its art. Names
   * that start with the query come before ones that merely contain it.
   */
  search(query: string, limit = 60): CardPrint[] {
    const q = nameKey(query);
    if (!q) return [];
    const starts: CardPrint[] = [];
    const contains: CardPrint[] = [];
    for (const key of this.names) {
      const at = key.indexOf(q);
      if (at < 0) continue;
      const prints = this.byName.get(key)!;
      (at === 0 ? starts : contains).push(prints[prints.length - 1]);
    }
    return [...starts, ...contains].slice(0, limit);
  }

  /** Every print of a card by name (see nameKey), oldest set first. */
  printsFor(name: string): CardPrint[] {
    return [...(this.byName.get(nameKey(name)) ?? [])];
  }

  getById(id: string): CardPrint | undefined {
    return this.byId.get(id);
  }

  /** Release date of a set as "YYYY/MM/DD", or "" when the set is unknown. */
  releaseDate(setId: string): string {
    return this.sets[setId]?.d ?? '';
  }

  /** The code a set is written with in deck lists ("OBF"), if it has one. */
  setCode(setId: string): string | undefined {
    return SET_CODE_OVERRIDES[setId] ?? this.sets[setId]?.c;
  }

  /**
   * Every set written with [code], oldest first. A set and its sub-sets share
   * one: BRS covers Brilliant Stars and its Trainer Gallery.
   */
  setIdsForCode(code: string): string[] {
    return this.setsByCode.get(code.toUpperCase()) ?? [];
  }

  /** The collector number printed on a card, without zero padding: "SWSH001" stays, "007" is "7". */
  collectorNumber(cardId: string): string | undefined {
    const raw = this.byId.get(cardId)?.number ?? collectorNumberOf(cardId);
    return raw && /^\d+$/.test(raw) ? String(Number(raw)) : raw;
  }

  /**
   * A print's set code and collector number, as deck lists and PTCGL write
   * them. Undefined for a card with no print, or a set with no code.
   */
  setRef(cardId: string | undefined): SetRef | undefined {
    if (!cardId) return undefined;
    const setCode = this.setCode(setIdOf(cardId) ?? '');
    const number = this.collectorNumber(cardId);
    return setCode && number ? { setCode, number } : undefined;
  }

  /** Whether a set is legal in a format, or undefined when there's no data. */
  isLegal(setId: string, format: Format): boolean | undefined {
    const letters = this.sets[setId]?.l;
    return letters === undefined ? undefined : letters.includes(FORMAT_LETTER[format]);
  }

  /**
   * The ids of the cards in [cards] that aren't legal in [format]. Cards
   * without a print, or whose set has no legality data, aren't flagged.
   *
   * Trainer and Energy cards are checked by name across all prints: a reprint
   * in any legal set makes the card legal, as the physical game treats it.
   */
  illegalCardIds(cards: DeckCard[], format: Format): Set<string> {
    const illegal = new Set<string>();
    for (const card of cards) {
      const id = card.cardId;
      if (!id) continue;
      const legal = this.isLegal(setIdOf(id) ?? '', format);
      if (legal !== false) continue;
      const supertype = (card.supertype ?? '').toLowerCase();
      if ((supertype === 'trainer' || supertype === 'energy') && this.anyPrintLegal(card.name, format)) {
        continue;
      }
      illegal.add(id);
    }
    return illegal;
  }

  private anyPrintLegal(name: string, format: Format): boolean {
    return this.printsFor(name).some((print) => this.isLegal(print.setId, format) === true);
  }

  /**
   * The print to suggest for a card known only by name: the newest one legal
   * in [format], since that's the one a player most likely owns. Falls back to
   * the newest print overall, so there's always something to show — the deck
   * list warns about legality separately.
   */
  suggestPrint(name: string, format?: Format): CardPrint | undefined {
    const prints = this.printsFor(name);
    if (format) {
      for (let i = prints.length - 1; i >= 0; i--) {
        if (this.isLegal(prints[i].setId, format) === true) return prints[i];
      }
    }
    return prints[prints.length - 1];
  }
}
