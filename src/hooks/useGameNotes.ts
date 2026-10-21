import { useCallback, useEffect, useState } from 'react';
import { deleteGameNoteApi, fetchGameNotes, putGameNoteApi } from '../lib/api';
import { useErrorMessage } from '../i18n/useErrorMessage';
import type { GameNote, GameNoteInput } from '../types/plan';

/** The user's personal notes (estimate + annotation), keyed by `gameId`. */
export function useGameNotes() {
  const describe = useErrorMessage();
  const [notes, setNotes] = useState<Map<number, GameNote>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchGameNotes();
        if (cancelled) return;
        setNotes(new Map(result.notes.map((note) => [note.gameId, note])));
        setError(null);
      } catch (err) {
        if (!cancelled) setError(describe(err, 'game.note.loadFailed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [describe]);

  const save = useCallback(async (gameId: number, input: GameNoteInput) => {
    const saved = await putGameNoteApi(gameId, input);
    setNotes((current) => new Map(current).set(gameId, saved));
    return saved;
  }, []);

  const remove = useCallback(async (gameId: number) => {
    await deleteGameNoteApi(gameId);
    setNotes((current) => {
      const next = new Map(current);
      next.delete(gameId);
      return next;
    });
  }, []);

  return { notes, loading, error, save, remove };
}
