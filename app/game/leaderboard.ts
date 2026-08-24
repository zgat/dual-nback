import type { FlipCardCount, FlipDifficulty, GameSettings, Stats } from "./core";

export type NBackTrainingType = "grid" | "cards";
export type HistoryGameType = NBackTrainingType | "flip";

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

export type FlipHistoryEntry = {
  id: string;
  elapsedMs: number;
  createdAt: number;
  cardCount: FlipCardCount;
  difficulty: FlipDifficulty;
  rounds: number;
};

export type LeaderboardData = {
  version: 3;
  timed: Record<NBackTrainingType, TimedLeaderboardEntry[]>;
  challenge: Record<NBackTrainingType, Record<string, number>>;
  flip: Record<FlipDifficulty, FlipHistoryEntry[]>;
};

export type NBackSessionResult = {
  settings: GameSettings;
  stats: Stats;
  elapsedMs: number;
};

export type FlipSessionResult = {
  cardCount: FlipCardCount;
  difficulty: FlipDifficulty;
  rounds: number;
  mistakes: number;
  elapsedMs: number;
};

const LEADERBOARD_KEY = "dual-nback-leaderboard";
const FLIP_HISTORY_CARD_COUNTS: FlipCardCount[] = [6, 8, 9, 12, 16];

export function createEmptyLeaderboard(): LeaderboardData {
  return {
    version: 3,
    timed: { grid: [], cards: [] },
    challenge: { grid: {}, cards: {} },
    flip: { classic: [], moving: [] },
  };
}

export function rankTimedEntries(entries: TimedLeaderboardEntry[]) {
  return [...entries].sort((left, right) => (
    right.accuracy - left.accuracy
    || right.totalRounds - left.totalRounds
    || left.elapsedMs - right.elapsedMs
    || right.createdAt - left.createdAt
  ));
}

export function rankFlipEntries(entries: FlipHistoryEntry[]) {
  return [...entries].sort((left, right) => (
    right.cardCount - left.cardCount
    || left.elapsedMs - right.elapsedMs
    || right.createdAt - left.createdAt
  ));
}

function normalizeTimedEntries(value: unknown): TimedLeaderboardEntry[] {
  if (!Array.isArray(value)) return [];
  const entries = value.filter((entry): entry is TimedLeaderboardEntry => {
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
  });
  return rankTimedEntries(entries).slice(0, 10);
}

function normalizeFlipEntries(value: unknown): FlipHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is FlipHistoryEntry => {
      if (!entry || typeof entry !== "object") return false;
      const candidate = entry as Partial<FlipHistoryEntry>;
      return typeof candidate.id === "string"
        && Number.isFinite(candidate.elapsedMs)
        && Number.isFinite(candidate.createdAt)
        && FLIP_HISTORY_CARD_COUNTS.includes(candidate.cardCount as FlipCardCount)
        && (candidate.difficulty === "classic" || candidate.difficulty === "moving")
        && candidate.rounds === 8;
    })
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, 10);
}

function normalizeFlipHistory(value: unknown): Record<FlipDifficulty, FlipHistoryEntry[]> {
  if (Array.isArray(value)) {
    const entries = normalizeFlipEntries(value);
    return {
      classic: entries.filter((entry) => entry.difficulty === "classic").slice(0, 10),
      moving: entries.filter((entry) => entry.difficulty === "moving").slice(0, 10),
    };
  }
  if (!value || typeof value !== "object") return { classic: [], moving: [] };
  const groups = value as Partial<Record<FlipDifficulty, unknown>>;
  return {
    classic: normalizeFlipEntries(groups.classic).filter((entry) => entry.difficulty === "classic"),
    moving: normalizeFlipEntries(groups.moving).filter((entry) => entry.difficulty === "moving"),
  };
}

function normalizeChallengeCounts(value: unknown) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value).filter(([interval, count]) => Number.isFinite(Number(interval)) && Number.isFinite(count) && Number(count) >= 0),
  ) as Record<string, number>;
}

export function normalizeLeaderboard(value: unknown): LeaderboardData {
  if (!value || typeof value !== "object") return createEmptyLeaderboard();
  const candidate = value as {
    timed?: Partial<Record<NBackTrainingType, unknown>>;
    challenge?: Partial<Record<NBackTrainingType, unknown>>;
    flip?: unknown;
  };
  return {
    version: 3,
    timed: {
      grid: normalizeTimedEntries(candidate.timed?.grid),
      cards: normalizeTimedEntries(candidate.timed?.cards),
    },
    challenge: {
      grid: normalizeChallengeCounts(candidate.challenge?.grid),
      cards: normalizeChallengeCounts(candidate.challenge?.cards),
    },
    flip: normalizeFlipHistory(candidate.flip),
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
  const timed = rankTimedEntries([...data.timed[trainingType], entry]).slice(0, 10);

  return {
    ...data,
    timed: { ...data.timed, [trainingType]: timed },
  };
}

export function recordFlipLeaderboardResult(data: LeaderboardData, result: FlipSessionResult, now = Date.now()): LeaderboardData {
  if (result.mistakes !== 0 || result.rounds !== 8) return data;
  const entry: FlipHistoryEntry = {
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    elapsedMs: result.elapsedMs,
    createdAt: now,
    cardCount: result.cardCount,
    difficulty: result.difficulty,
    rounds: result.rounds,
  };
  return {
    ...data,
    flip: {
      ...data.flip,
      [result.difficulty]: [entry, ...data.flip[result.difficulty]]
        .sort((left, right) => right.createdAt - left.createdAt)
        .slice(0, 10),
    },
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
    // History remains available for the current session when storage is unavailable.
  }
}
