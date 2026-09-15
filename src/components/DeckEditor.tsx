import { useMemo, useState } from 'react';
import type { CardDatabase } from '../lib/cardDb';
import { addPrint, changeQuantity, countCards, DECK_SIZE, groupCards, mergeCards, replacePrint } from '../lib/deck';
import { exportPtcgl, type PtcglImportResult } from '../lib/ptcgl';
import { FORMATS, type Deck, type DeckCard, type Format } from '../lib/types';
import { CardImage } from './CardImage';
import { CardSearch } from './CardSearch';
import { Icon } from './Icon';
import { ImportDialog } from './ImportDialog';
import { Modal } from './Modal';

interface Props {
  deck: Deck;
  db: CardDatabase;
  onChange: (patch: Partial<Deck>) => void;
  onExport: () => void;
}

export function DeckEditor({ deck, db, onChange, onExport }: Props) {
  const [importing, setImporting] = useState(false);
  const [switching, setSwitching] = useState<number | null>(null);
  const [notice, setNotice] = useState<string>();

  const total = countCards(deck.cards);
  const status = total === DECK_SIZE ? 'ok' : total > DECK_SIZE ? 'over' : 'under';
  const groups = useMemo(() => groupCards(deck.cards), [deck.cards]);
  const illegal = useMemo(() => db.illegalCardIds(deck.cards, deck.format), [db, deck.cards, deck.format]);

  const setCards = (cards: DeckCard[]) => onChange({ cards });

  const handleImport = (result: PtcglImportResult, mode: 'replace' | 'add') => {
    setCards(mode === 'replace' ? result.cards : mergeCards(deck.cards, result.cards));
    setImporting(false);
    const lines = result.resolved + result.unresolved;
    const n = result.unresolved;
    setNotice(
      n
        ? `Imported ${lines} lines. ${
            n === 1 ? "One card couldn't be matched to a print, so it was" : `${n} cards couldn't be matched to a print, so they were`
          } added by name — choose prints before exporting.`
        : `Imported ${lines} lines.`,
    );
  };

  const copyList = async () => {
    try {
      await navigator.clipboard.writeText(exportPtcgl(deck.cards, db));
      setNotice('Copied the list in Pokémon TCG Live format.');
    } catch {
      setNotice("Couldn't copy to the clipboard.");
    }
  };

  const switchingCard = switching !== null ? deck.cards[switching] : undefined;

  return (
    <div className="build">
      <section className="panel deck-panel" aria-label="Deck">
        <div className="deck-fields">
          <label className="field">
            <span>Deck name</span>
            <input value={deck.name} onChange={(event) => onChange({ name: event.target.value })} />
          </label>
          <label className="field">
            <span>Format</span>
            <select value={deck.format} onChange={(event) => onChange({ format: event.target.value as Format })}>
              {FORMATS.map((format) => (
                <option key={format}>{format}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="deck-toolbar">
          <span className={`counter ${status}`} aria-label={`${total} of ${DECK_SIZE} cards`}>
            {total} / {DECK_SIZE}
          </span>
          <span className="spacer" />
          <button className="btn" onClick={() => setImporting(true)}>
            <Icon name="import" size={16} /> Import
          </button>
          <button className="btn" onClick={copyList} disabled={!deck.cards.length}>
            <Icon name="copy" size={16} /> Copy list
          </button>
          <button className="btn primary" onClick={onExport}>
            <Icon name="download" size={16} /> Deck list PDF
          </button>
        </div>

        {status === 'over' && <p className="warn-text small">A deck has exactly {DECK_SIZE} cards — this one has {total - DECK_SIZE} too many.</p>}
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}

        {deck.cards.length === 0 ? (
          <p className="empty">No cards yet. Search for cards to add, or import a list from Pokémon TCG Live.</p>
        ) : (
          groups.map(([group, cards]) => (
            <section key={group} className="group">
              <h3 className="group-head">
                {group} <span className="muted">({countCards(cards)})</span>
              </h3>
              <ul className="card-list">
                {cards.map((card) => {
                  const index = deck.cards.indexOf(card);
                  return (
                    <CardRow
                      key={card.cardId ?? card.name}
                      card={card}
                      db={db}
                      illegalIn={card.cardId && illegal.has(card.cardId) ? deck.format : undefined}
                      onQuantity={(delta) => setCards(changeQuantity(deck.cards, index, delta))}
                      onChangePrint={() => setSwitching(index)}
                    />
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </section>

      <aside className="panel search-panel" aria-label="Add cards">
        <h2 className="panel-title">Add cards</h2>
        <CardSearch db={db} format={deck.format} onAdd={(print, quantity) => setCards(addPrint(deck.cards, print, quantity))} />
      </aside>

      {importing && (
        <ImportDialog
          db={db}
          deckHasCards={deck.cards.length > 0}
          onImport={handleImport}
          onClose={() => setImporting(false)}
        />
      )}

      {switchingCard && (
        <Modal title={`Change print — ${switchingCard.name}`} onClose={() => setSwitching(null)}>
          <CardSearch
            db={db}
            format={deck.format}
            initialName={switchingCard.name}
            onPick={(print) => {
              setCards(replacePrint(deck.cards, switching!, print));
              setSwitching(null);
            }}
            onCancel={() => setSwitching(null)}
          />
        </Modal>
      )}
    </div>
  );
}

interface CardRowProps {
  card: DeckCard;
  db: CardDatabase;
  /** The deck's format, when this card isn't legal in it. */
  illegalIn?: Format;
  onQuantity: (delta: number) => void;
  onChangePrint: () => void;
}

function CardRow({ card, db, illegalIn, onQuantity, onChangePrint }: CardRowProps) {
  const print = card.cardId ? db.getById(card.cardId) : undefined;
  const ref = db.setRef(card.cardId);
  const meta = [ref ? `${ref.setCode} ${ref.number}` : print?.setName, print?.regulationMark].filter(Boolean).join(' · ');
  const last = card.quantity === 1;

  return (
    <li className="card-row">
      <button className="thumb-btn" onClick={onChangePrint} title="Change print" aria-label={`Change print of ${card.name}`}>
        {/* The print's current art first, so cards saved before art was found pick it up. */}
        <CardImage src={print?.imageUrl || card.imageUrl} alt="" className="thumb" />
      </button>
      <div className="card-info">
        <span className="card-name">{card.name}</span>
        <span className="card-meta">
          {card.cardId ? <span className="muted small">{meta}</span> : <span className="tag warn">No print chosen</span>}
          {illegalIn && <span className="tag danger">Not {illegalIn}</span>}
        </span>
      </div>
      <div className="stepper">
        <button
          className="icon-btn"
          onClick={() => onQuantity(-1)}
          aria-label={last ? `Remove ${card.name}` : `One fewer ${card.name}`}
        >
          <Icon name={last ? 'trash' : 'minus'} size={16} />
        </button>
        <output>{card.quantity}</output>
        <button className="icon-btn" onClick={() => onQuantity(1)} aria-label={`One more ${card.name}`}>
          <Icon name="plus" size={16} />
        </button>
      </div>
    </li>
  );
}
