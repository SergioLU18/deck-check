import { useEffect, useMemo, useRef, useState } from 'react';
import type { CardDatabase } from '../lib/cardDb';
import { loadDeckListAssets } from '../lib/data';
import { countCards, DECK_SIZE } from '../lib/deck';
import type { DeckListPdfResult } from '../lib/deckListPdf';
import { deckListFileName } from '../lib/fileName';
import { DIVISION_LABELS, divisionFor, FORM_SEASON } from '../lib/division';
import type { AgeDivision, Deck, DeckCard, Player } from '../lib/types';
import { Icon } from './Icon';
import { ResolveDialog } from './ResolveDialog';

interface Props {
  deck: Deck;
  db: CardDatabase;
  player: Player;
  onPlayerChange: (player: Player) => void;
  onCardsChange: (cards: DeckCard[]) => void;
}

/** The form has boxes for Standard and Expanded only; null leaves both blank. */
type SheetFormat = 'Standard' | 'Expanded' | null;

const unique = (names: string[]) => [...new Set(names)].join(', ');

/** Fills the deck onto the official Play! Pokémon deck list, with a live preview. */
export function DeckListExport({ deck, db, player, onPlayerChange, onCardsChange }: Props) {
  const [format, setFormat] = useState<SheetFormat>(deck.format === 'Unlimited' ? null : deck.format);
  // Set only when the player overrides what their date of birth implies.
  const [divisionOverride, setDivisionOverride] = useState<AgeDivision | null>(null);
  const division = divisionOverride ?? divisionFor(player.dateOfBirth, FORM_SEASON);

  const [pdf, setPdf] = useState<{ url: string; result: DeckListPdfResult }>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [notice, setNotice] = useState<string>();
  const urlRef = useRef<string | undefined>(undefined);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    // Debounced so typing a name doesn't rebuild the sheet on every keystroke.
    const timer = setTimeout(async () => {
      try {
        // pdf-lib is most of the bundle, so it's only loaded once a sheet is wanted.
        const [{ buildDeckListPdf }, assets] = await Promise.all([import('../lib/deckListPdf'), loadDeckListAssets()]);
        const result = await buildDeckListPdf({
          cards: deck.cards,
          deckName: deck.name,
          player,
          format: format ?? '',
          division,
          db,
          assets,
        });
        if (cancelled) return;
        const url = URL.createObjectURL(new Blob([result.bytes as BlobPart], { type: 'application/pdf' }));
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = url;
        setPdf({ url, result });
        setError(undefined);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [deck.cards, deck.name, player, format, division, db]);

  // The sheet exists to prove a legal deck, so say so on the screen where the
  // format is picked.
  const illegal = useMemo(() => {
    if (!format) return [];
    const ids = db.illegalCardIds(deck.cards, format);
    return deck.cards.filter((card) => card.cardId && ids.has(card.cardId)).map((card) => card.name);
  }, [db, deck.cards, format]);

  const total = countCards(deck.cards);
  const result = pdf?.result;
  const warnings = [
    total !== DECK_SIZE && `This deck has ${total} cards — a tournament deck has exactly ${DECK_SIZE}.`,
    result &&
      result.pageCount > 1 &&
      `The list runs onto ${result.pageCount} sheets, each labelled “Sheet 1 of ${result.pageCount}” and so on. Hand them in together.`,
    result?.missingSetInfo.length &&
      `No set or collector number for ${unique(result.missingSetInfo)}. Choose a print, or write them in by hand.`,
    result?.missingRegulationMark.length && `No regulation mark for ${unique(result.missingRegulationMark)}.`,
    result?.unclassified.length &&
      (new Set(result.unclassified).size === 1
        ? `Couldn't tell what kind of card ${unique(result.unclassified)} is, so it's listed under Trainer.`
        : `Couldn't tell what kind of cards ${unique(result.unclassified)} are, so they're listed under Trainer.`),
    illegal.length > 0 && `Not legal in ${format}: ${unique(illegal)}.`,
  ].filter((w): w is string => typeof w === 'string');

  const hasNameOnlyCards = deck.cards.some((card) => !card.cardId);
  const fileName = deckListFileName(player.name, deck.name);

  return (
    <div className="export">
      <section className="panel export-form" aria-label="Deck list details">
        <h2 className="panel-title">Player</h2>
        <label className="field">
          <span>Player name</span>
          <input
            value={player.name}
            autoComplete="name"
            onChange={(event) => onPlayerChange({ ...player, name: event.target.value })}
          />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Player ID</span>
            <input
              value={player.playerId}
              inputMode="numeric"
              onChange={(event) => onPlayerChange({ ...player, playerId: event.target.value.trim() })}
            />
          </label>
          <label className="field">
            <span>Date of birth</span>
            <input
              type="date"
              value={player.dateOfBirth ?? ''}
              min="1920-01-01"
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => {
                onPlayerChange({ ...player, dateOfBirth: event.target.value || undefined });
                // A new birth date implies a new division; drop any stale override.
                setDivisionOverride(null);
              }}
            />
          </label>
        </div>
        <label className="field">
          <span>Age division ({FORM_SEASON} season)</span>
          <select
            value={division ?? ''}
            onChange={(event) => setDivisionOverride((event.target.value || null) as AgeDivision | null)}
          >
            <option value="">Not set</option>
            {(Object.keys(DIVISION_LABELS) as AgeDivision[]).map((key) => (
              <option key={key} value={key}>
                {DIVISION_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
        <p className="muted small hint">Saved in this browser and reused for every deck.</p>

        <h2 className="panel-title">Format</h2>
        <div className="segmented" role="radiogroup" aria-label="Format">
          {(['Standard', 'Expanded', null] as SheetFormat[]).map((option) => (
            <button key={option ?? 'none'} role="radio" aria-checked={format === option} onClick={() => setFormat(option)}>
              {option ?? 'Leave blank'}
            </button>
          ))}
        </div>

        {warnings.length > 0 && (
          <div className="warnings" role="status">
            <h3>
              <Icon name="alert" size={16} /> Check before handing in
            </h3>
            <ul>
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
            {hasNameOnlyCards && (
              <button className="btn small" onClick={() => setResolving(true)}>
                <Icon name="wand" size={16} /> Choose prints
              </button>
            )}
          </div>
        )}
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}

        <div className="export-actions">
          <a className={`btn primary block${pdf ? '' : ' disabled'}`} href={pdf?.url} download={fileName} aria-disabled={!pdf}>
            <Icon name="download" size={16} /> Download PDF
          </a>
          <a className={`btn block${pdf ? '' : ' disabled'}`} href={pdf?.url} target="_blank" rel="noreferrer" aria-disabled={!pdf}>
            <Icon name="external" size={16} /> Open to print
          </a>
        </div>
      </section>

      <section className="panel preview-panel" aria-label="Preview">
        {error ? (
          <p className="error center">Couldn't build the deck list: {error}</p>
        ) : pdf ? (
          <iframe title="Deck list preview" className="preview" src={`${pdf.url}#view=FitH`} />
        ) : (
          <p className="empty center">Building the deck list…</p>
        )}
        {busy && pdf && <span className="busy-badge">Updating…</span>}
      </section>

      {resolving && (
        <ResolveDialog
          cards={deck.cards}
          db={db}
          format={format ?? undefined}
          onApply={(cards, applied) => {
            onCardsChange(cards);
            setResolving(false);
            setNotice(`Chose prints for ${applied} ${applied === 1 ? 'card' : 'cards'}.`);
          }}
          onClose={() => setResolving(false)}
        />
      )}
    </div>
  );
}
