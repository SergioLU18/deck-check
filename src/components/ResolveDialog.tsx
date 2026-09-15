import { useState } from 'react';
import { useT } from '../i18n';
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
  const t = useT();
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
      <Modal title={t.choosePrintTitle(entry.card.name)} onClose={() => setChanging(null)}>
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
      title={t.choosePrints}
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            {t.cancel}
          </button>
          <button className="btn primary" disabled={!ready} onClick={apply}>
            {t.apply}
          </button>
        </>
      }
    >
      {pending.length === 0 ? (
        <p className="empty">{t.allHavePrints}</p>
      ) : (
        <>
          <p className="muted">{t.resolveHelp}</p>
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
                        : t.notInDatabase}
                    </span>
                  </div>
                  <button className="btn small" onClick={() => setChanging(i)}>
                    {t.change}
                  </button>
                  <input
                    type="checkbox"
                    checked={p.selected}
                    disabled={!p.print}
                    onChange={(event) => update(i, { selected: event.target.checked })}
                    aria-label={t.applyPrintFor(p.card.name)}
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
