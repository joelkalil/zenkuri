import { useState, useCallback } from 'react';
import type { PatinaDb, EffortLevel } from '../types/steam';

const DB_KEY = 'platina-db';

const DEFAULT_DB: PatinaDb = {
  backlog: [],
  pinned: [],
  notes: {},
  effort: {},
  schedule: {},
};

export function readDb(): PatinaDb {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return { ...DEFAULT_DB };
    return { ...DEFAULT_DB, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_DB };
  }
}

function writeDb(db: PatinaDb): void {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

export function useLocalDb() {
  const [db, setDb] = useState<PatinaDb>(readDb);

  const update = useCallback((updater: (prev: PatinaDb) => PatinaDb) => {
    setDb((prev) => {
      const next = updater(prev);
      writeDb(next);
      return next;
    });
  }, []);

  const toggleBacklog = useCallback(
    (appid: string) => {
      update((prev) => ({
        ...prev,
        backlog: prev.backlog.includes(appid)
          ? prev.backlog.filter((id) => id !== appid)
          : [...prev.backlog, appid],
      }));
    },
    [update],
  );

  const togglePinned = useCallback(
    (appid: string) => {
      update((prev) => ({
        ...prev,
        pinned: prev.pinned.includes(appid)
          ? prev.pinned.filter((id) => id !== appid)
          : [...prev.pinned, appid],
      }));
    },
    [update],
  );

  const setNote = useCallback(
    (appid: string, note: string) => {
      update((prev) => ({ ...prev, notes: { ...prev.notes, [appid]: note } }));
    },
    [update],
  );

  const setEffort = useCallback(
    (appid: string, effort: EffortLevel) => {
      update((prev) => ({ ...prev, effort: { ...prev.effort, [appid]: effort } }));
    },
    [update],
  );

  const setSchedule = useCallback(
    (appid: string, month: string) => {
      update((prev) => ({ ...prev, schedule: { ...prev.schedule, [appid]: month } }));
    },
    [update],
  );

  const reorderBacklog = useCallback(
    (newOrder: string[]) => {
      update((prev) => ({ ...prev, backlog: newOrder }));
    },
    [update],
  );

  const exportDb = useCallback(() => {
    const data = JSON.stringify(readDb(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'platina-db.json';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return { db, toggleBacklog, togglePinned, setNote, setEffort, setSchedule, reorderBacklog, exportDb };
}
