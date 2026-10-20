import { useState, useCallback, useEffect } from 'react';
import {
  createCollectionApi,
  deleteCollectionApi,
  fetchPlanning,
  patchPlanning,
  renameCollectionApi,
  reorderBacklogApi,
} from '../lib/api';
import type { PatinaDb, EffortLevel } from '../types/steam';

const DEFAULT_DB: PatinaDb = {
  backlog: [],
  pinned: [],
  dropped: [],
  notes: {},
  effort: {},
  schedule: {},
  guides: {},
  collections: [],
  collectionOf: {},
};

export function readDb(): PatinaDb {
  return { ...DEFAULT_DB };
}

export function useLocalDb() {
  const [db, setDb] = useState<PatinaDb>(DEFAULT_DB);

  const refresh = useCallback(() => {
    fetchPlanning()
      .then((next) => setDb({ ...DEFAULT_DB, ...next }))
      .catch(() => setDb(DEFAULT_DB));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggleBacklog = useCallback(
    (appid: string) => {
      const next = !db.backlog.includes(appid);
      setDb((prev) => ({
        ...prev,
        backlog: next ? [...prev.backlog, appid] : prev.backlog.filter((id) => id !== appid),
      }));
      patchPlanning(appid, { inBacklog: next }).then(setDb).catch(refresh);
    },
    [db.backlog, refresh],
  );

  const togglePinned = useCallback(
    (appid: string) => {
      const next = !db.pinned.includes(appid);
      setDb((prev) => ({
        ...prev,
        pinned: next ? [...prev.pinned, appid] : prev.pinned.filter((id) => id !== appid),
      }));
      patchPlanning(appid, { pinned: next }).then(setDb).catch(refresh);
    },
    [db.pinned, refresh],
  );

  const toggleDropped = useCallback(
    (appid: string) => {
      const next = !db.dropped.includes(appid);
      setDb((prev) => ({
        ...prev,
        dropped: next ? [...prev.dropped, appid] : prev.dropped.filter((id) => id !== appid),
      }));
      patchPlanning(appid, { dropped: next }).then(setDb).catch(refresh);
    },
    [db.dropped, refresh],
  );

  const setNote = useCallback(
    (appid: string, note: string) => {
      setDb((prev) => ({ ...prev, notes: { ...prev.notes, [appid]: note } }));
      patchPlanning(appid, { note }).then(setDb).catch(refresh);
    },
    [refresh],
  );

  const setGuide = useCallback(
    (appid: string, guideUrl: string) => {
      setDb((prev) => ({ ...prev, guides: { ...prev.guides, [appid]: guideUrl } }));
      patchPlanning(appid, { guideUrl }).then(setDb).catch(refresh);
    },
    [refresh],
  );

  const setEffort = useCallback(
    (appid: string, effort: EffortLevel) => {
      setDb((prev) => ({ ...prev, effort: { ...prev.effort, [appid]: effort } }));
      patchPlanning(appid, { effort }).then(setDb).catch(refresh);
    },
    [refresh],
  );

  const setSchedule = useCallback(
    (appid: string, month: string) => {
      setDb((prev) => ({ ...prev, schedule: { ...prev.schedule, [appid]: month } }));
      patchPlanning(appid, { schedule: month }).then(setDb).catch(refresh);
    },
    [refresh],
  );

  const createCollection = useCallback(
    (name: string, gameIds: string[] = []) => {
      return createCollectionApi(name, gameIds).then((next) => setDb({ ...DEFAULT_DB, ...next })).catch(refresh);
    },
    [refresh],
  );

  const renameCollection = useCallback(
    (id: number, name: string) => {
      setDb((prev) => ({
        ...prev,
        collections: prev.collections.map((c) => (c.id === id ? { ...c, name } : c)),
      }));
      renameCollectionApi(id, name).then(setDb).catch(refresh);
    },
    [refresh],
  );

  const deleteCollection = useCallback(
    (id: number) => {
      setDb((prev) => ({
        ...prev,
        collections: prev.collections.filter((c) => c.id !== id),
        collectionOf: Object.fromEntries(Object.entries(prev.collectionOf).filter(([, cid]) => cid !== id)),
      }));
      deleteCollectionApi(id).then(setDb).catch(refresh);
    },
    [refresh],
  );

  const setCollection = useCallback(
    (appid: string, collectionId: number | null) => {
      setDb((prev) => {
        const collectionOf = { ...prev.collectionOf };
        if (collectionId) collectionOf[appid] = collectionId;
        else delete collectionOf[appid];
        return { ...prev, collectionOf };
      });
      patchPlanning(appid, { collectionId }).then(setDb).catch(refresh);
    },
    [refresh],
  );

  const reorderBacklog = useCallback(
    (newOrder: string[]) => {
      setDb((prev) => ({ ...prev, backlog: newOrder }));
      reorderBacklogApi(newOrder).then(setDb).catch(refresh);
    },
    [refresh],
  );

  const exportDb = useCallback(() => {
    const data = JSON.stringify(db, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'zenkuri-planning.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [db]);

  return {
    db, refresh, toggleBacklog, togglePinned, toggleDropped, setNote, setGuide, setEffort, setSchedule,
    reorderBacklog, exportDb, createCollection, renameCollection, deleteCollection, setCollection,
  };
}
