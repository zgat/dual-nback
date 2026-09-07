import { readLeaderboard } from "./leaderboard";
import type { LeaderboardData } from "./leaderboard";

type Snapshot = { data: LeaderboardData; revision: number };
export type HistorySnapshot = Snapshot & { storageAvailable: boolean };
type Update = (data: LeaderboardData) => LeaderboardData;

/** A read/write transaction serializes score updates across tabs. Legacy storage is never deleted. */
export function createHistoryStore(
  getFactory: () => IDBFactory | undefined = () => window.indexedDB,
  readLegacy = readLeaderboard,
) {
  let database: Promise<IDBDatabase> | null = null;
  let memory: Snapshot | null = null;
  const unsaved: Update[] = [];
  // Also preserve ordering when persistence is unavailable (private/disabled storage).
  let pending: Promise<HistorySnapshot | undefined> = Promise.resolve(undefined);

  function open() {
    database ??= new Promise<IDBDatabase>((resolve, reject) => {
      const factory = getFactory();
      if (!factory) { reject(new Error("IndexedDB unavailable")); return; }
      const request = factory.open("dual-nback-history", 1);
      let abandoned = false;
      request.onupgradeneeded = () => request.result.createObjectStore("history");
      request.onerror = () => reject(request.error);
      request.onblocked = () => {
        abandoned = true;
        reject(new Error("History database upgrade blocked"));
      };
      request.onsuccess = () => {
        if (abandoned) { request.result.close(); return; }
        request.result.onversionchange = () => { request.result.close(); database = null; };
        resolve(request.result);
      };
    });
    return database;
  }

  async function transact(update?: Update): Promise<HistorySnapshot> {
    memory ??= { data: readLegacy(), revision: 0 };
    if (update) {
      // Keep failed operations, rather than overwriting a newer database snapshot on recovery.
      memory = { data: update(memory.data), revision: memory.revision + 1 };
      unsaved.push(update);
    }
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const db = await open();
        const snapshot = await new Promise<Snapshot>((resolve, reject) => {
          const tx = db.transaction("history", unsaved.length ? "readwrite" : "readonly");
          const store = tx.objectStore("history");
          const get = store.get("best");
          let next: Snapshot;
          tx.onabort = () => reject(tx.error ?? new Error("History transaction aborted"));
          tx.oncomplete = () => resolve(next);
          get.onsuccess = () => {
            const current: Snapshot = get.result ?? { data: readLegacy(), revision: 0 };
            try {
              next = unsaved.length ? {
                data: unsaved.reduce((data, apply) => apply(data), current.data),
                revision: current.revision + unsaved.length,
              } : current;
              if (unsaved.length) store.put(next, "best");
            } catch { tx.abort(); }
          };
        });
        memory = snapshot;
        unsaved.length = 0;
        return { ...snapshot, storageAvailable: true };
      } catch {
        const failedConnection = database;
        database = null;
        void failedConnection?.then((db) => db.close(), () => undefined);
      }
    }
    return { ...memory, storageAvailable: false };
  }

  function enqueue(update?: Update) {
    const result = pending.then(() => transact(update));
    pending = result.catch(() => undefined);
    return result;
  }

  return { read: () => enqueue(), update: (update: Update) => enqueue(update) };
}

export const historyStore = createHistoryStore();
