import { useCallback, useEffect, useState } from 'react';
import { DeckEditor } from './components/DeckEditor';
import { DeckListExport } from './components/DeckListExport';
import { Icon } from './components/Icon';
import type { CardDatabase } from './lib/cardDb';
import { loadCardDatabase } from './lib/data';
import { countCards, newDeck } from './lib/deck';
import { loadActiveDeckId, loadDecks, loadPlayer, saveActiveDeckId, saveDecks, savePlayer } from './lib/storage';
import type { Deck, DeckCard, Player } from './lib/types';

type View = 'build' | 'list';

export function App() {
  const [db, setDb] = useState<CardDatabase>();
  const [dbError, setDbError] = useState<string>();
  const [decks, setDecks] = useState<Deck[]>(() => {
    const saved = loadDecks();
    return saved.length ? saved : [newDeck()];
  });
  const [activeId, setActiveId] = useState(() => loadActiveDeckId() ?? '');
  const [player, setPlayer] = useState<Player>(loadPlayer);
  const [view, setView] = useState<View>('build');

  const loadDb = useCallback(() => {
    setDbError(undefined);
    loadCardDatabase().then(setDb, (e: unknown) => setDbError(e instanceof Error ? e.message : String(e)));
  }, []);
  useEffect(loadDb, [loadDb]);

  const deck = decks.find((d) => d.id === activeId) ?? decks[0];

  useEffect(() => saveDecks(decks), [decks]);
  useEffect(() => savePlayer(player), [player]);
  useEffect(() => saveActiveDeckId(deck.id), [deck.id]);

  const updateDeck = (patch: Partial<Deck>) =>
    setDecks((list) =>
      list.map((d) => (d.id === deck.id ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d)),
    );

  const createDeck = () => {
    const created = newDeck(`Deck ${decks.length + 1}`);
    setDecks((list) => [...list, created]);
    setActiveId(created.id);
    setView('build');
  };

  const deleteDeck = () => {
    if (!window.confirm(`Delete “${deck.name.trim() || 'Untitled deck'}”? This can't be undone.`)) return;
    setDecks((list) => {
      const rest = list.filter((d) => d.id !== deck.id);
      return rest.length ? rest : [newDeck()];
    });
    setActiveId('');
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">
            <span className="brand-mark" aria-hidden="true" />
            Deck Check
          </span>
          <div className="deck-switcher">
            <select aria-label="Current deck" value={deck.id} onChange={(event) => setActiveId(event.target.value)}>
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name.trim() || 'Untitled deck'} · {countCards(d.cards)}
                </option>
              ))}
            </select>
            <button className="btn" onClick={createDeck}>
              <Icon name="plus" size={16} /> New
            </button>
            <button className="icon-btn" onClick={deleteDeck} aria-label="Delete deck" title="Delete deck">
              <Icon name="trash" />
            </button>
          </div>
          <nav className="tabs" aria-label="View">
            <button className="tab" aria-current={view === 'build' ? 'page' : undefined} onClick={() => setView('build')}>
              Build
            </button>
            <button className="tab" aria-current={view === 'list' ? 'page' : undefined} onClick={() => setView('list')}>
              Deck list PDF
            </button>
          </nav>
        </div>
      </header>

      <main className="main">
        {dbError ? (
          <div className="panel center">
            <p className="error">Couldn't load the card database: {dbError}</p>
            <button className="btn" onClick={loadDb}>
              Try again
            </button>
          </div>
        ) : !db ? (
          <div className="panel center">
            <p className="muted">Loading the card database…</p>
          </div>
        ) : view === 'build' ? (
          <DeckEditor key={deck.id} deck={deck} db={db} onChange={updateDeck} onExport={() => setView('list')} />
        ) : (
          <DeckListExport
            key={deck.id}
            deck={deck}
            db={db}
            player={player}
            onPlayerChange={setPlayer}
            onCardsChange={(cards: DeckCard[]) => updateDeck({ cards })}
          />
        )}
      </main>

      <footer className="footer muted small">
        {db && `${db.cardCount.toLocaleString()} cards, data as of ${db.updatedAt}. `}
        Exports onto the official 2026 season deck list. Decks and player details stay in this browser.
      </footer>
    </div>
  );
}
