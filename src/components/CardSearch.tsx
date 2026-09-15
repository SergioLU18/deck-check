import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { CardDatabase } from '../lib/cardDb';
import type { CardPrint, Format } from '../lib/types';
import { CardImage } from './CardImage';
import { Icon } from './Icon';

interface Props {
  db: CardDatabase;
  /** Flags prints that aren't legal in this format. */
  format?: Format;
  /** Skips the search step and opens this card's prints straight away. */
  initialName?: string;
  /** Asks for a quantity after the print is chosen, then hands both back. */
  onAdd?: (print: CardPrint, quantity: number) => void;
  /** Hands the chosen print straight back, no quantity step. */
  onPick?: (print: CardPrint) => void;
  /** Called when backing out of [initialName]'s prints, where there's no search to return to. */
  onCancel?: () => void;
}

/** Search by name → pick a print → pick a quantity. */
export function CardSearch({ db, format, initialName, onAdd, onPick, onCancel }: Props) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const results = useMemo(() => db.search(deferredQuery), [db, deferredQuery]);

  const [name, setName] = useState(initialName);
  // Newest first: the print a player is most likely holding, and the legal ones.
  const prints = useMemo(() => (name ? db.printsFor(name).reverse() : []), [db, name]);

  const [print, setPrint] = useState<CardPrint>();
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState<string>();

  const inputRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  useEffect(() => {
    // Refocus when returning to the search step, but don't steal focus on load.
    if (mounted.current && !name && !print) inputRef.current?.focus();
    mounted.current = true;
  }, [name, print]);

  const choosePrint = (chosen: CardPrint) => {
    if (onPick) {
      onPick(chosen);
      return;
    }
    setPrint(chosen);
    setQuantity(1);
  };

  const backToSearch = () => {
    if (initialName) onCancel?.();
    else setName(undefined);
  };

  const confirm = () => {
    if (!print) return;
    onAdd?.(print, quantity);
    setNotice(`Added ${quantity}× ${print.name}`);
    setPrint(undefined);
    setName(undefined);
  };

  if (print) {
    const ref = db.setRef(print.id);
    return (
      <div className="search">
        <div className="step-head">
          <button className="icon-btn" onClick={() => setPrint(undefined)} aria-label="Back to prints">
            <Icon name="back" />
          </button>
          <h3>{print.name}</h3>
        </div>
        <div className="print-detail">
          <CardImage src={print.imageUrl} alt={`${print.name}, ${print.setName}`} className="large" />
          <p className="print-detail-set">{print.setName}</p>
          <p className="muted">
            {[ref ? `${ref.setCode} ${ref.number}` : `#${print.number}`, print.regulationMark && `Reg. ${print.regulationMark}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <div className="qty-picker" role="group" aria-label="Quantity">
            <button className="icon-btn" onClick={() => setQuantity((q) => q - 1)} disabled={quantity <= 1} aria-label="One fewer">
              <Icon name="minus" />
            </button>
            <output aria-live="polite">{quantity}</output>
            <button className="icon-btn" onClick={() => setQuantity((q) => q + 1)} aria-label="One more">
              <Icon name="plus" />
            </button>
          </div>
          <div className="chips">
            {[1, 2, 3, 4].map((n) => (
              <button key={n} className="chip" aria-pressed={quantity === n} onClick={() => setQuantity(n)}>
                {n}
              </button>
            ))}
          </div>
          <button className="btn primary block" onClick={confirm}>
            Add to deck
          </button>
        </div>
      </div>
    );
  }

  if (name) {
    return (
      <div className="search">
        <div className="step-head">
          <button className="icon-btn" onClick={backToSearch} aria-label="Back">
            <Icon name="back" />
          </button>
          <h3>{name}</h3>
          <span className="muted small">
            {prints.length} {prints.length === 1 ? 'print' : 'prints'}
          </span>
        </div>
        {prints.length === 0 ? (
          <p className="empty">No prints of this card in the database.</p>
        ) : (
          <div className="print-grid">
            {prints.map((p) => {
              const ref = db.setRef(p.id);
              const illegal = format && db.isLegal(p.setId, format) === false;
              return (
                <button key={p.id} className="print-tile" onClick={() => choosePrint(p)}>
                  <CardImage src={p.imageUrl} alt={`${p.name}, ${p.setName} ${p.number}`} />
                  <span className="print-set">{p.setName}</span>
                  <span className="print-meta">
                    {[ref ? `${ref.setCode} ${ref.number}` : `#${p.number}`, p.regulationMark].filter(Boolean).join(' · ')}
                  </span>
                  {illegal && <span className="tag warn">Not {format}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="search">
      <label className="search-box">
        <Icon name="search" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder="Search cards by name"
          aria-label="Search cards by name"
          onChange={(event) => {
            setQuery(event.target.value);
            setNotice(undefined);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && results[0]) setName(results[0].name);
          }}
        />
      </label>
      {notice && (
        <p className="notice" role="status">
          <Icon name="check" size={16} /> {notice}
        </p>
      )}
      {!query.trim() ? (
        <p className="empty">Type a card name — “Charizard ex”, “Iono”, “Basic Fire Energy”.</p>
      ) : results.length === 0 ? (
        <p className="empty">No cards found.</p>
      ) : (
        <ul className="result-list">
          {results.map((result) => (
            <li key={result.name}>
              <button className="result" onClick={() => setName(result.name)}>
                <CardImage src={result.imageUrl} alt="" className="thumb" />
                <span className="result-name">{result.name}</span>
                <span className="muted small">{result.supertype}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
