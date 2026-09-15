import { useCallback, useEffect, useState } from 'react';
import { DeckEditor } from './components/DeckEditor';
import { DeckListExport } from './components/DeckListExport';
import { Icon } from './components/Icon';
import { useLanguage } from './i18n';
import type { CardDatabase } from './lib/cardDb';
import { loadCardDatabase } from './lib/data';
import { countCards, newDeck } from './lib/deck';
import { FORM_SEASON } from './lib/division';
import { loadActiveDeckId, loadDecks, loadPlayer, saveActiveDeckId, saveDecks, savePlayer } from './lib/storage';
import { LANGUAGES } from './lib/strings';
import type { Deck, DeckCard, Player } from './lib/types';

type View = 'build' | 'list';

export function App() {
  const { t, language, setLanguage } = useLanguage();
  const [db, setDb] = useState<CardDatabase>();
  const [dbError, setDbError] = useState<string>();
  const [decks, setDecks] = useState<Deck[]>(() => {
    const saved = loadDecks();
    return saved.length ? saved : [newDeck(t.newDeckName)];
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
    const created = newDeck(t.numberedDeck(decks.length + 1));
    setDecks((list) => [...list, created]);
    setActiveId(created.id);
    setView('build');
  };

  const deleteDeck = () => {
    if (!window.confirm(t.confirmDelete(deck.name.trim() || t.untitledDeck))) return;
    setDecks((list) => {
      const rest = list.filter((d) => d.id !== deck.id);
      return rest.length ? rest : [newDeck(t.newDeckName)];
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
            <select aria-label={t.currentDeck} value={deck.id} onChange={(event) => setActiveId(event.target.value)}>
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name.trim() || t.untitledDeck} · {countCards(d.cards)}
                </option>
              ))}
            </select>
            <button className="btn" onClick={createDeck}>
              <Icon name="plus" size={16} /> {t.newDeckButton}
            </button>
            <button className="icon-btn" onClick={deleteDeck} aria-label={t.deleteDeck} title={t.deleteDeck}>
              <Icon name="trash" />
            </button>
          </div>
          <nav className="tabs" aria-label={t.view}>
            <button className="tab" aria-current={view === 'build' ? 'page' : undefined} onClick={() => setView('build')}>
              {t.build}
            </button>
            <button className="tab" aria-current={view === 'list' ? 'page' : undefined} onClick={() => setView('list')}>
              {t.deckListPdf}
            </button>
          </nav>
          <div className="segmented lang-toggle" role="radiogroup" aria-label={t.language}>
            {LANGUAGES.map(({ code, label, name }) => (
              <button
                key={code}
                role="radio"
                lang={code}
                title={name}
                aria-label={name}
                aria-checked={language === code}
                onClick={() => setLanguage(code)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="main">
        {dbError ? (
          <div className="panel center">
            <p className="error">{t.dbError(dbError)}</p>
            <button className="btn" onClick={loadDb}>
              {t.tryAgain}
            </button>
          </div>
        ) : !db ? (
          <div className="panel center">
            <p className="muted">{t.loadingDb}</p>
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
        {db && t.footerData(db.cardCount, db.updatedAt)}
        {t.footerNote(FORM_SEASON)}
      </footer>
    </div>
  );
}
