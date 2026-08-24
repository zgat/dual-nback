"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createEmptyLeaderboard,
  readLeaderboard,
  recordLeaderboardResult,
  writeLeaderboard,
} from "./leaderboard";
import type { NBackSessionResult } from "./leaderboard";

export function useLeaderboard() {
  const [data, setData] = useState(createEmptyLeaderboard);

  useEffect(() => {
    const hydrateTimer = window.setTimeout(() => setData(readLeaderboard()), 0);
    return () => window.clearTimeout(hydrateTimer);
  }, []);

  const recordResult = useCallback((result: NBackSessionResult) => {
    setData((current) => {
      const next = recordLeaderboardResult(current, result);
      writeLeaderboard(next);
      return next;
    });
  }, []);

  return { data, recordResult };
}
