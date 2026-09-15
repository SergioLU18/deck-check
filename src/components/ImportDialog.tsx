import { useMemo, useState } from 'react';
import { useT } from '../i18n';
import type { CardDatabase } from '../lib/cardDb';
import { parsePtcgl, resolvePtcgl, type PtcglImportResult } from '../lib/ptcgl';
import { Modal } from './Modal';

interface Props {
  db: CardDatabase;
  deckHasCards: boolean;
  onImport: (result: PtcglImportResult, mode: 'replace' | 'add') => void;
  onClose: () => void;
}

// Left in English in every language: it's what Pokémon TCG Live exports.
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
  const t = useT();
  const [text, setText] = useState('');
  const lines = useMemo(() => parsePtcgl(text), [text]);
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);

  const submit = (mode: 'replace' | 'add') => onImport(resolvePtcgl(lines, db), mode);

  return (
    <Modal
      title={t.importTitle}
      onClose={onClose}
      footer={
        <>
          <span className="muted small">{lines.length ? t.importSummary(lines.length, count) : t.nothingRecognised}</span>
          <span className="spacer" />
          {deckHasCards && (
            <button className="btn" disabled={!lines.length} onClick={() => submit('add')}>
              {t.addToDeck}
            </button>
          )}
          <button className="btn primary" disabled={!lines.length} onClick={() => submit('replace')}>
            {deckHasCards ? t.replaceCards : t.import}
          </button>
        </>
      }
    >
      <p className="muted">{t.importHelp}</p>
      <textarea
        className="import-text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={EXAMPLE}
        spellCheck={false}
        autoFocus
        aria-label={t.listText}
      />
    </Modal>
  );
}
