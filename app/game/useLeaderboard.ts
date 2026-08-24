"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createEmptyLeaderboard,
  readLeaderboard,
  recordFlipLeaderboardResult,
  recordLeaderboardResult,
  writeLeaderboard,
} from "./leaderboard";
import type { FlipSessionResult, NBackSessionResult } from "./leaderboard";

export function useLeaderboard() {
  const [data, setData] = useState(createEmptyLeaderboard);

  useEffect(() => {
    const hydrateTimer = window.setTimeout(() => setData(readLeaderboard()), 0);
    return () => window.clearTimeout(hydrateTimer);
  }, []);

  const updateAndPersist = useCallback((updater: Parameters<typeof setData>[0]) => {
    setData((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      writeLeaderboard(next);
      return next;
    });
  }, []);

  const recordResult = useCallback((result: NBackSessionResult) => {
    updateAndPersist((current) => recordLeaderboardResult(current, result));
  }, [updateAndPersist]);

  const recordFlipResult = useCallback((result: FlipSessionResult) => {
    updateAndPersist((current) => recordFlipLeaderboardResult(current, result));
  }, [updateAndPersist]);

  return { data, recordResult, recordFlipResult };
}
