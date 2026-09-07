import { readLeaderboard } from "./leaderboard";
import type { LeaderboardData } from "./leaderboard";

type Snapshot = { data: LeaderboardData; revision: number };
type Update = (data: LeaderboardData) => LeaderboardData;

/** A read/write transaction serializes score updates across tabs. Legacy storage is never deleted. */
export function createHistoryStore(
  getFactory: () => IDBFactory | undefined = () => window.indexedDB,
  readLegacy = readLeaderboard,
) {
  let database: Promise<IDBDatabase> | null = null;
  let memory: Snapshot | null = null;
  let storageUnavailable = false;
  // Also preserve ordering when persistence is unavailable (private/disabled storage).
  let pending: Promise<Snapshot | undefined> = Promise.resolve(undefined);

  function open() {
    database ??= new Promise<IDBDatabase>((resolve, reject) => {
      const factory = getFactory();
      if (!factory) { reject(new Error("IndexedDB unavailable")); return; }
      const request = factory.open("dual-nback-history", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("history");
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("History database upgrade blocked"));
      request.onsuccess = () => {
        request.result.onversionchange = () => { request.result.close(); database = null; };
        resolve(request.result);
      };
    });
    return database;
  }

  async function transact(update?: Update): Promise<Snapshot> {
    memory ??= { data: readLegacy(), revision: 0 };
    if (!storageUnavailable) {
      try {
        const db = await open();
        const snapshot = await new Promise<Snapshot>((resolve, reject) => {
          const tx = db.transaction("history", update ? "readwrite" : "readonly");
          const store = tx.objectStore("history");
          const get = store.get("best");
          let next: Snapshot;
          tx.onabort = () => reject(tx.error ?? new Error("History transaction aborted"));
          tx.onerror = () => reject(tx.error);
          tx.oncomplete = () => resolve(next);
          get.onsuccess = () => {
            const current: Snapshot = get.result ?? { data: readLegacy(), revision: 0 };
            try {
              next = update ? { data: update(current.data), revision: current.revision + 1 } : current;
              if (update) store.put(next, "best");
            } catch { tx.abort(); }
          };
        });
        memory = snapshot;
        return snapshot;
      } catch {
        storageUnavailable = true;
      }
    }
    if (update) memory = { data: update(memory.data), revision: memory.revision + 1 };
    return memory;
  }

  function enqueue(update?: Update) {
    const result = pending.then(() => transact(update));
    pending = result.catch(() => undefined);
    return result;
  }

  return { read: () => enqueue(), update: (update: Update) => enqueue(update) };
}

export const historyStore = createHistoryStore();
