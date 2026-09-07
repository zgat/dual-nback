"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createEmptyLeaderboard,
  recordFlipLeaderboardResult,
  recordLeaderboardResult,
  recordReactionLeaderboardResult,
} from "./leaderboard";
import type { FlipSessionResult, LeaderboardData, NBackSessionResult, ReactionSessionResult } from "./leaderboard";
import { historyStore } from "./historyStore";

const HISTORY_SIGNAL = "dual-nback-history-revision";

export function useLeaderboard() {
  const [data, setData] = useState(createEmptyLeaderboard);
  const revision = useRef(-1);

  const receive = useCallback((snapshot: Awaited<ReturnType<typeof historyStore.read>>) => {
    if (snapshot.revision < revision.current) return;
    revision.current = snapshot.revision;
    setData(snapshot.data);
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = () => { void historyStore.read().then((snapshot) => { if (active) receive(snapshot); }); };
    const onStorage = (event: StorageEvent) => { if (event.key === HISTORY_SIGNAL) refresh(); };
    refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
    };
  }, [receive]);

  const updateAndPersist = useCallback((updater: (current: LeaderboardData) => LeaderboardData) => {
    void historyStore.update(updater).then((snapshot) => {
      receive(snapshot);
      try { window.localStorage.setItem(HISTORY_SIGNAL, String(snapshot.revision)); } catch { /* Device storage may be disabled. */ }
    });
  }, [receive]);

  const recordResult = useCallback((result: NBackSessionResult) => {
    updateAndPersist((current) => recordLeaderboardResult(current, result));
  }, [updateAndPersist]);

  const recordFlipResult = useCallback((result: FlipSessionResult) => {
    updateAndPersist((current) => recordFlipLeaderboardResult(current, result));
  }, [updateAndPersist]);

  const recordReactionResult = useCallback((result: ReactionSessionResult) => {
    updateAndPersist((current) => recordReactionLeaderboardResult(current, result));
  }, [updateAndPersist]);

  return { data, recordResult, recordFlipResult, recordReactionResult };
}
