import type { GameSettings, Stats } from "./core";

export type NBackTrainingType = "grid" | "cards";

export type TimedLeaderboardEntry = {
  id: string;
  accuracy: number;
  elapsedMs: number;
  correct: number;
  attempts: number;
  createdAt: number;
  n: number;
  totalRounds: number;
  cellCount: number;
  colorCount: number;
};

export type LeaderboardData = {
  version: 1;
  timed: Record<NBackTrainingType, TimedLeaderboardEntry[]>;
  challenge: Record<NBackTrainingType, Record<string, number>>;
};

export type NBackSessionResult = {
  settings: GameSettings;
  stats: Stats;
  elapsedMs: number;
};

const LEADERBOARD_KEY = "dual-nback-leaderboard";

export function createEmptyLeaderboard(): LeaderboardData {
  return {
    version: 1,
    timed: { grid: [], cards: [] },
    challenge: { grid: {}, cards: {} },
  };
}

function normalizeTimedEntries(value: unknown): TimedLeaderboardEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is TimedLeaderboardEntry => {
      if (!entry || typeof entry !== "object") return false;
      const candidate = entry as Partial<TimedLeaderboardEntry>;
      return typeof candidate.id === "string"
        && Number.isFinite(candidate.accuracy)
        && Number.isFinite(candidate.elapsedMs)
        && Number.isFinite(candidate.correct)
        && Number.isFinite(candidate.attempts)
        && Number.isFinite(candidate.createdAt)
        && Number.isFinite(candidate.n)
        && Number.isFinite(candidate.totalRounds)
        && Number.isFinite(candidate.cellCount)
        && Number.isFinite(candidate.colorCount);
    })
    .sort((left, right) => right.accuracy - left.accuracy || left.elapsedMs - right.elapsedMs || right.createdAt - left.createdAt)
    .slice(0, 10);
}

function normalizeChallengeCounts(value: unknown) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value).filter(([interval, count]) => Number.isFinite(Number(interval)) && Number.isFinite(count) && Number(count) >= 0),
  ) as Record<string, number>;
}

export function normalizeLeaderboard(value: unknown): LeaderboardData {
  if (!value || typeof value !== "object") return createEmptyLeaderboard();
  const candidate = value as Partial<LeaderboardData>;
  return {
    version: 1,
    timed: {
      grid: normalizeTimedEntries(candidate.timed?.grid),
      cards: normalizeTimedEntries(candidate.timed?.cards),
    },
    challenge: {
      grid: normalizeChallengeCounts(candidate.challenge?.grid),
      cards: normalizeChallengeCounts(candidate.challenge?.cards),
    },
  };
}

export function recordLeaderboardResult(data: LeaderboardData, result: NBackSessionResult, now = Date.now()): LeaderboardData {
  const { settings, stats, elapsedMs } = result;
  if (settings.trainingType !== "grid" && settings.trainingType !== "cards") return data;
  const trainingType = settings.trainingType;

  if (settings.mode === "challenge") {
    const interval = String(settings.interval);
    return {
      ...data,
      challenge: {
        ...data.challenge,
        [trainingType]: {
          ...data.challenge[trainingType],
          [interval]: (data.challenge[trainingType][interval] ?? 0) + stats.correct,
        },
      },
    };
  }

  const accuracy = stats.total === 0 ? 0 : Math.round((stats.correct / stats.total) * 100);
  const entry: TimedLeaderboardEntry = {
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    accuracy,
    elapsedMs,
    correct: stats.correct,
    attempts: stats.total,
    createdAt: now,
    n: settings.n,
    totalRounds: settings.total,
    cellCount: settings.cellCount,
    colorCount: settings.colorCount,
  };
  const timed = [...data.timed[trainingType], entry]
    .sort((left, right) => right.accuracy - left.accuracy || left.elapsedMs - right.elapsedMs || right.createdAt - left.createdAt)
    .slice(0, 10);

  return {
    ...data,
    timed: { ...data.timed, [trainingType]: timed },
  };
}

export function readLeaderboard() {
  try {
    const saved = typeof window === "undefined" ? null : window.localStorage.getItem(LEADERBOARD_KEY);
    return saved ? normalizeLeaderboard(JSON.parse(saved)) : createEmptyLeaderboard();
  } catch {
    return createEmptyLeaderboard();
  }
}

export function writeLeaderboard(data: LeaderboardData) {
  try {
    window.localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(data));
  } catch {
    // Rankings remain available for the current session when storage is unavailable.
  }
}
