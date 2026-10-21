import { useState } from 'react';
import { useT } from '../i18n';
import { useErrorMessage } from '../i18n/useErrorMessage';
import type { GameNote, GameNoteInput } from '../types/plan';

interface PersonalNoteEditorProps {
  gameId: number;
  /** already saved note (absent = none yet) */
  note: GameNote | undefined;
  onSave: (gameId: number, input: GameNoteInput) => Promise<unknown>;
  onDelete: (gameId: number) => Promise<unknown>;
}

const ESTIMATE_MAX = 60;
const NOTE_MAX = 4000;

type Status = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; message: string };

/** Compact "Personal note" block: free-text estimate + annotation, shown in the rankings. */
export function PersonalNoteEditor({ gameId, note, onSave, onDelete }: PersonalNoteEditorProps) {
  const t = useT('game');
  const describe = useErrorMessage();
  const [estimate, setEstimate] = useState(note?.estimate ?? '');
  const [text, setText] = useState(note?.note ?? '');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const dirty = estimate !== (note?.estimate ?? '') || text !== (note?.note ?? '');
  const empty = estimate.trim() === '' && text.trim() === '';
  const busy = status.kind === 'saving';

  async function save() {
    setStatus({ kind: 'saving' });
    try {
      await onSave(gameId, { estimate: estimate.trim() === '' ? null : estimate.trim(), note: text.trim() });
      setStatus({ kind: 'saved' });
    } catch (err) {
      setStatus({ kind: 'error', message: describe(err, 'game.note.saveFailed') });
    }
  }

  async function remove() {
    setStatus({ kind: 'saving' });
    try {
      await onDelete(gameId);
      setEstimate('');
      setText('');
      setStatus({ kind: 'idle' });
    } catch (err) {
      setStatus({ kind: 'error', message: describe(err, 'game.note.deleteFailed') });
    }
  }

  return (
    <div className="ficha-notes">
      <h2 className="ficha-title micro">{t('note.title')}</h2>
      <p className="mb-2 text-xs text-gray-500">{t('note.hint')}</p>
      <label htmlFor="detail-estimate" className="micro">{t('note.estimate')}</label>
      <input
        id="detail-estimate"
        value={estimate}
        maxLength={ESTIMATE_MAX}
        onChange={(event) => { setEstimate(event.target.value); setStatus({ kind: 'idle' }); }}
        placeholder={t('note.estimatePlaceholder')}
        className="field"
      />
      <label htmlFor="detail-ranking-note" className="micro mt-3">{t('note.note')}</label>
      <textarea
        id="detail-ranking-note"
        value={text}
        maxLength={NOTE_MAX}
        rows={3}
        onChange={(event) => { setText(event.target.value); setStatus({ kind: 'idle' }); }}
        placeholder={t('note.notePlaceholder')}
        className="field"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={save} disabled={busy || !dirty || empty} className="btn btn-secondary btn-sm">
          {busy ? t('note.saving') : t('note.save')}
        </button>
        {note && (
          <button type="button" onClick={remove} disabled={busy} className="btn btn-ghost btn-sm">{t('note.delete')}</button>
        )}
        <span role="status" className="text-xs text-gray-500">
          {status.kind === 'saved' && t('note.saved')}
        </span>
      </div>
      {status.kind === 'error' && <p role="alert" className="mt-2 text-xs text-zk-danger">{status.message}</p>}
    </div>
  );
}
