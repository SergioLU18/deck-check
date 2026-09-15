import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n';
import type { CardDatabase } from '../lib/cardDb';
import { loadDeckListAssets } from '../lib/data';
import { countCards, DECK_SIZE } from '../lib/deck';
import type { DeckListPdfResult } from '../lib/deckListPdf';
import { deckListFileName } from '../lib/fileName';
import { divisionFor, FORM_SEASON } from '../lib/division';
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

const DIVISIONS: AgeDivision[] = ['junior', 'senior', 'masters'];

const unique = (names: string[]) => [...new Set(names)].join(', ');

/** Fills the deck onto the official Play! Pokémon deck list, with a live preview. */
export function DeckListExport({ deck, db, player, onPlayerChange, onCardsChange }: Props) {
  const t = useT();
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
    total !== DECK_SIZE && t.wrongSize(total, DECK_SIZE),
    result && result.pageCount > 1 && t.multipleSheets(result.pageCount),
    result?.missingSetInfo.length && t.missingSetInfo(unique(result.missingSetInfo)),
    result?.missingRegulationMark.length && t.missingRegulationMark(unique(result.missingRegulationMark)),
    result?.unclassified.length && t.unclassified(unique(result.unclassified), new Set(result.unclassified).size),
    illegal.length > 0 && format && t.illegalCards(t.formats[format], unique(illegal)),
  ].filter((w): w is string => typeof w === 'string');

  const hasNameOnlyCards = deck.cards.some((card) => !card.cardId);
  const fileName = deckListFileName(player.name, deck.name);

  return (
    <div className="export">
      <section className="panel export-form" aria-label={t.deckListDetails}>
        <h2 className="panel-title">{t.player}</h2>
        <label className="field">
          <span>{t.playerName}</span>
          <input
            value={player.name}
            autoComplete="name"
            onChange={(event) => onPlayerChange({ ...player, name: event.target.value })}
          />
        </label>
        <div className="field-row">
          <label className="field">
            <span>{t.playerId}</span>
            <input
              value={player.playerId}
              inputMode="numeric"
              onChange={(event) => onPlayerChange({ ...player, playerId: event.target.value.trim() })}
            />
          </label>
          <label className="field">
            <span>{t.dateOfBirth}</span>
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
          <span>{t.ageDivision(FORM_SEASON)}</span>
          <select
            value={division ?? ''}
            onChange={(event) => setDivisionOverride((event.target.value || null) as AgeDivision | null)}
          >
            <option value="">{t.notSet}</option>
            {DIVISIONS.map((key) => (
              <option key={key} value={key}>
                {t.divisions[key]}
              </option>
            ))}
          </select>
        </label>
        <p className="muted small hint">{t.savedHint}</p>

        <h2 className="panel-title">{t.format}</h2>
        <div className="segmented" role="radiogroup" aria-label={t.format}>
          {(['Standard', 'Expanded', null] as SheetFormat[]).map((option) => (
            <button key={option ?? 'none'} role="radio" aria-checked={format === option} onClick={() => setFormat(option)}>
              {option ? t.formats[option] : t.leaveBlank}
            </button>
          ))}
        </div>

        {warnings.length > 0 && (
          <div className="warnings" role="status">
            <h3>
              <Icon name="alert" size={16} /> {t.checkBeforeHandingIn}
            </h3>
            <ul>
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
            {hasNameOnlyCards && (
              <button className="btn small" onClick={() => setResolving(true)}>
                <Icon name="wand" size={16} /> {t.choosePrints}
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
            <Icon name="download" size={16} /> {t.downloadPdf}
          </a>
          <a className={`btn block${pdf ? '' : ' disabled'}`} href={pdf?.url} target="_blank" rel="noreferrer" aria-disabled={!pdf}>
            <Icon name="external" size={16} /> {t.openToPrint}
          </a>
        </div>
      </section>

      <section className="panel preview-panel" aria-label={t.preview}>
        {error ? (
          <p className="error center">{t.buildError(error)}</p>
        ) : pdf ? (
          <iframe title={t.previewTitle} className="preview" src={`${pdf.url}#view=FitH`} />
        ) : (
          <p className="empty center">{t.building}</p>
        )}
        {busy && pdf && <span className="busy-badge">{t.updating}</span>}
      </section>

      {resolving && (
        <ResolveDialog
          cards={deck.cards}
          db={db}
          format={format ?? undefined}
          onApply={(cards, applied) => {
            onCardsChange(cards);
            setResolving(false);
            setNotice(t.choseprints(applied));
          }}
          onClose={() => setResolving(false)}
        />
      )}
    </div>
  );
}
