"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createEmptyLeaderboard,
  recordFlipLeaderboardResult,
  recordLeaderboardResult,
  recordReactionLeaderboardResult,
} from "./leaderboard";
import type { FlipSessionResult, LeaderboardData, NBackSessionResult, ReactionSessionResult } from "./leaderboard";
import { historyStore } from "./historyStore";

const HISTORY_SIGNAL = "dual-nback-history-revision";

export function useLeaderboard(store = historyStore) {
  const [data, setData] = useState(createEmptyLeaderboard);
  const [storageAvailable, setStorageAvailable] = useState(true);

  const receive = useCallback((snapshot: Awaited<ReturnType<typeof historyStore.read>>) => {
    // Store operations are serialized; a recovered snapshot can have a different durable revision.
    setData(snapshot.data);
    setStorageAvailable(snapshot.storageAvailable);
    if (snapshot.storageAvailable) {
      // A read can flush recovered writes too; notify other tabs after either operation.
      try { window.localStorage.setItem(HISTORY_SIGNAL, String(snapshot.revision)); } catch { /* Device storage may be disabled. */ }
    }
  }, []);

  const retrySaving = useCallback(() => store.read().then(receive), [receive, store]);

  useEffect(() => {
    if (storageAvailable) return;
    // One delayed retry, then retry on focus, a new result, or explicit user action.
    const timer = window.setTimeout(retrySaving, 5000);
    return () => window.clearTimeout(timer);
  }, [retrySaving, storageAvailable]);

  useEffect(() => {
    let active = true;
    const refresh = () => { void store.read().then((snapshot) => { if (active) receive(snapshot); }); };
    const onStorage = (event: StorageEvent) => { if (event.key === HISTORY_SIGNAL) refresh(); };
    refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
    };
  }, [receive, store]);

  const updateAndPersist = useCallback((updater: (current: LeaderboardData) => LeaderboardData) => {
    void store.update(updater).then(receive);
  }, [receive, store]);

  const recordResult = useCallback((result: NBackSessionResult) => {
    const createdAt = Date.now();
    updateAndPersist((current) => recordLeaderboardResult(current, result, createdAt));
  }, [updateAndPersist]);

  const recordFlipResult = useCallback((result: FlipSessionResult) => {
    const createdAt = Date.now();
    updateAndPersist((current) => recordFlipLeaderboardResult(current, result, createdAt));
  }, [updateAndPersist]);

  const recordReactionResult = useCallback((result: ReactionSessionResult) => {
    const createdAt = Date.now();
    updateAndPersist((current) => recordReactionLeaderboardResult(current, result, createdAt));
  }, [updateAndPersist]);

  return { data, storageAvailable, retrySaving, recordResult, recordFlipResult, recordReactionResult };
}
