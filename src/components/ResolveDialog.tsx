import { useState } from 'react';
import type { CardDatabase } from '../lib/cardDb';
import type { CardPrint, DeckCard, Format } from '../lib/types';
import { CardImage } from './CardImage';
import { CardSearch } from './CardSearch';
import { Modal } from './Modal';

interface Props {
  cards: DeckCard[];
  db: CardDatabase;
  /** Biases suggestions towards a print that's legal to play. */
  format?: Format;
  onApply: (cards: DeckCard[], applied: number) => void;
  onClose: () => void;
}

interface Pending {
  index: number;
  card: DeckCard;
  print?: CardPrint;
  selected: boolean;
}

/**
 * Attaches a print to cards known only by name. A review step rather than a
 * silent auto-fill: the sheet has to name the print the player is actually
 * handing over, and a card like Riolu has dozens.
 */
export function ResolveDialog({ cards, db, format, onApply, onClose }: Props) {
  const [pending, setPending] = useState<Pending[]>(() =>
    cards.flatMap((card, index) => {
      if (card.cardId) return [];
      const print = db.suggestPrint(card.name, format);
      // A card with no match can't be applied, so don't pretend it's ready.
      return [{ index, card, print, selected: !!print }];
    }),
  );
  const [changing, setChanging] = useState<number | null>(null);

  const update = (i: number, patch: Partial<Pending>) =>
    setPending((list) => list.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const apply = () => {
    const next = [...cards];
    let applied = 0;
    for (const { index, card, print, selected } of pending) {
      if (!selected || !print) continue;
      next[index] = {
        ...card,
        cardId: print.id,
        imageUrl: print.imageUrl,
        // A print also settles which table the card belongs in.
        supertype: print.supertype ?? card.supertype,
        subtypes: print.subtypes.length ? print.subtypes : card.subtypes,
      };
      applied++;
    }
    onApply(next, applied);
  };

  if (changing !== null) {
    const entry = pending[changing];
    return (
      <Modal title={`Choose a print — ${entry.card.name}`} onClose={() => setChanging(null)}>
        <CardSearch
          db={db}
          format={format}
          initialName={entry.card.name}
          onPick={(print) => {
            update(changing, { print, selected: true });
            setChanging(null);
          }}
          onCancel={() => setChanging(null)}
        />
      </Modal>
    );
  }

  const ready = pending.some((p) => p.selected && p.print);

  return (
    <Modal
      title="Choose prints"
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!ready} onClick={apply}>
            Apply
          </button>
        </>
      }
    >
      {pending.length === 0 ? (
        <p className="empty">Every card in this deck already has a print.</p>
      ) : (
        <>
          <p className="muted">
            These cards were added by name only, so the deck list can't fill in their set, collector number or
            regulation mark. Suggested prints are the newest legal ones — check they match the cards you're playing.
          </p>
          <ul className="resolve-list">
            {pending.map((p, i) => {
              const ref = db.setRef(p.print?.id);
              return (
                <li key={p.index} className="resolve-row">
                  <CardImage src={p.print?.imageUrl} alt="" className="thumb" />
                  <div className="resolve-info">
                    <strong>
                      {p.card.quantity}× {p.card.name}
                    </strong>
                    <span className={p.print ? 'muted small' : 'warn-text small'}>
                      {p.print
                        ? [p.print.setName, ref ? `${ref.setCode} ${ref.number}` : `#${p.print.number}`, p.print.regulationMark]
                            .filter(Boolean)
                            .join(' · ')
                        : 'No card with this name in the database'}
                    </span>
                  </div>
                  <button className="btn small" onClick={() => setChanging(i)}>
                    Change
                  </button>
                  <input
                    type="checkbox"
                    checked={p.selected}
                    disabled={!p.print}
                    onChange={(event) => update(i, { selected: event.target.checked })}
                    aria-label={`Apply print for ${p.card.name}`}
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Modal>
  );
}
