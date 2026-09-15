import type { Deck, Player } from './types';

// Everything lives in this browser's localStorage. Reads and writes can throw
// (private windows, blocked storage), in which case the app just doesn't
// remember anything between visits.

const DECKS_KEY = 'deck-check:decks';
const ACTIVE_DECK_KEY = 'deck-check:active-deck';
const PLAYER_KEY = 'deck-check:player';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not remembered this time; nothing else to do.
  }
}

export const loadDecks = () => read<Deck[]>(DECKS_KEY, []);
export const saveDecks = (decks: Deck[]) => write(DECKS_KEY, decks);

export const loadActiveDeckId = () => read<string | null>(ACTIVE_DECK_KEY, null);
export const saveActiveDeckId = (id: string) => write(ACTIVE_DECK_KEY, id);

/**
 * Saved once and reused for every export — the details are the same on every
 * sheet a player hands in.
 */
export const loadPlayer = () => read<Player>(PLAYER_KEY, { name: '', playerId: '' });
export const savePlayer = (player: Player) => write(PLAYER_KEY, player);
