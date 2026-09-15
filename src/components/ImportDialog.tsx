import { useMemo, useState } from 'react';
import type { CardDatabase } from '../lib/cardDb';
import { parsePtcgl, resolvePtcgl, type PtcglImportResult } from '../lib/ptcgl';
import { Modal } from './Modal';

interface Props {
  db: CardDatabase;
  deckHasCards: boolean;
  onImport: (result: PtcglImportResult, mode: 'replace' | 'add') => void;
  onClose: () => void;
}

const EXAMPLE = `Pokémon: 7
3 Charizard ex OBF 125
4 Charmander MEW 4
...
Trainer: 4
4 Iono PAL 185
...
Energy: 1
6 Basic {R} Energy SVE 2`;

export function ImportDialog({ db, deckHasCards, onImport, onClose }: Props) {
  const [text, setText] = useState('');
  const lines = useMemo(() => parsePtcgl(text), [text]);
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);

  const submit = (mode: 'replace' | 'add') => onImport(resolvePtcgl(lines, db), mode);

  return (
    <Modal
      title="Import a deck list"
      onClose={onClose}
      footer={
        <>
          <span className="muted small">
            {lines.length ? `${lines.length} lines · ${count} cards` : 'Nothing recognised yet'}
          </span>
          <span className="spacer" />
          {deckHasCards && (
            <button className="btn" disabled={!lines.length} onClick={() => submit('add')}>
              Add to deck
            </button>
          )}
          <button className="btn primary" disabled={!lines.length} onClick={() => submit('replace')}>
            {deckHasCards ? 'Replace cards' : 'Import'}
          </button>
        </>
      }
    >
      <p className="muted">
        Paste a list exported from Pokémon TCG Live (or Limitless). Each line is matched to a print by its set code and
        number; anything that can't be matched is kept by name so you can choose its print later.
      </p>
      <textarea
        className="import-text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={EXAMPLE}
        spellCheck={false}
        autoFocus
        aria-label="Deck list text"
      />
    </Modal>
  );
}
