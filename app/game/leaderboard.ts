import type { FlipCardCount, FlipDifficulty, FlipSuitCount, GameMode, GameSettings, Stats } from "./core";

export type NBackTrainingType = "grid" | "cards";
export type HistoryGameType = NBackTrainingType | "flip" | "reaction";

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
  accuracy: number;
  correct?: number;
  attempts?: number;
  elapsedMs: number;
  createdAt: number;
  cardCount: FlipCardCount;
  suitCount: FlipSuitCount;
  mode: GameMode;
  difficulty: FlipDifficulty;
  rounds: number;
};

export type FlipHistoryGroups = {
  "self-paced": Record<FlipDifficulty, FlipHistoryEntry[]>;
  challenge: Record<FlipDifficulty, Record<string, number>>;
};

export type ReactionHistoryEntry = {
  id: string;
  averageMs: number;
  bestMs: number;
  falseStarts: number;
  rounds: number;
  createdAt: number;
};

export type LeaderboardData = {
  version: 8;
  timed: Record<NBackTrainingType, TimedLeaderboardEntry[]>;
  challenge: Record<NBackTrainingType, Record<string, number>>;
  flip: FlipHistoryGroups;
  reaction: ReactionHistoryEntry[];
};

export type NBackSessionResult = {
  settings: GameSettings;
  stats: Stats;
  elapsedMs: number;
};

export type FlipSessionResult = {
  cardCount: FlipCardCount;
  suitCount: FlipSuitCount;
  mode: GameMode;
  difficulty: FlipDifficulty;
  rounds: number;
  found: number;
  mistakes: number;
  elapsedMs: number;
};

export type ReactionSessionResult = {
  averageMs: number;
  bestMs: number;
  falseStarts: number;
  rounds: number;
};

const LEADERBOARD_KEY = "dual-nback-leaderboard";
const FLIP_HISTORY_CARD_COUNTS: FlipCardCount[] = [6, 8, 9, 12, 16];

function createEmptyFlipHistory(): FlipHistoryGroups {
  return {
    "self-paced": { classic: [], moving: [] },
    challenge: { classic: {}, moving: {} },
  };
}

export function createEmptyLeaderboard(): LeaderboardData {
  return {
    version: 8,
    timed: { grid: [], cards: [] },
    challenge: { grid: {}, cards: {} },
    flip: createEmptyFlipHistory(),
    reaction: [],
  };
}

export function rankTimedEntries(entries: TimedLeaderboardEntry[]) {
  return [...entries].sort((left, right) => (
    preciseAccuracy(right) - preciseAccuracy(left)
    || right.totalRounds - left.totalRounds
    || left.elapsedMs - right.elapsedMs
    || right.createdAt - left.createdAt
  ));
}

export function rankFlipEntries(entries: FlipHistoryEntry[]) {
  return [...entries].sort((left, right) => (
    preciseAccuracy(right) - preciseAccuracy(left)
    || right.rounds - left.rounds
    || left.elapsedMs - right.elapsedMs
    || right.createdAt - left.createdAt
  ));
}

function preciseAccuracy(entry: { accuracy: number; correct?: number; attempts?: number }) {
  // Older flip records contain only rounded percentages; retain their original precision.
  return Number.isFinite(entry.correct) && Number.isFinite(entry.attempts) && entry.attempts! > 0
    ? entry.correct! / entry.attempts! : entry.accuracy / 100;
}

export function rankReactionEntries(entries: ReactionHistoryEntry[]) {
  return [...entries].sort((left, right) => (
    left.averageMs - right.averageMs
    || left.falseStarts - right.falseStarts
    || right.rounds - left.rounds
    || left.bestMs - right.bestMs
    || right.createdAt - left.createdAt
  ));
}

function normalizeReactionEntries(value: unknown): ReactionHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  const entries = value.filter((entry): entry is ReactionHistoryEntry => {
    if (!entry || typeof entry !== "object") return false;
    const candidate = entry as Partial<ReactionHistoryEntry>;
    return typeof candidate.id === "string"
      && Number.isFinite(candidate.averageMs)
      && Number(candidate.averageMs) > 0
      && Number.isFinite(candidate.bestMs)
      && Number(candidate.bestMs) > 0
      && Number.isFinite(candidate.falseStarts)
      && Number(candidate.falseStarts) >= 0
      && (candidate.rounds === 5 || candidate.rounds === 10)
      && Number.isFinite(candidate.createdAt);
  });
  return rankReactionEntries(entries).slice(0, 10);
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

function normalizeFlipEntries(value: unknown, fallbackMode: GameMode, fallbackDifficulty: FlipDifficulty): FlipHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  const entries = value.flatMap((entry): FlipHistoryEntry[] => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as Partial<FlipHistoryEntry>;
    const mode = candidate.mode === "self-paced" || candidate.mode === "challenge" ? candidate.mode : fallbackMode;
    const difficulty = candidate.difficulty === "moving" || candidate.difficulty === "classic" ? candidate.difficulty : fallbackDifficulty;
    const valid = typeof candidate.id === "string"
      && Number.isFinite(candidate.elapsedMs)
      && Number.isFinite(candidate.createdAt)
      && FLIP_HISTORY_CARD_COUNTS.includes(candidate.cardCount as FlipCardCount)
      && (candidate.rounds === 5 || candidate.rounds === 8)
      && (candidate.accuracy === undefined || Number.isFinite(candidate.accuracy));
    if (!valid) return [];
    return [{
      id: candidate.id!,
      accuracy: Math.min(100, Math.max(0, Math.round(candidate.accuracy ?? 100))),
      ...(Number.isFinite(candidate.correct) && Number.isFinite(candidate.attempts)
        && candidate.correct! >= 0 && candidate.attempts! >= candidate.correct!
        ? { correct: candidate.correct, attempts: candidate.attempts } : {}),
      elapsedMs: candidate.elapsedMs!,
      createdAt: candidate.createdAt!,
      cardCount: candidate.cardCount as FlipCardCount,
      suitCount: candidate.suitCount === 2 ? 2 : 4,
      mode,
      difficulty,
      rounds: candidate.rounds!,
    }];
  });
  return rankFlipEntries(entries).slice(0, 10);
}

function countFlipChallengeEntries(entries: FlipHistoryEntry[]) {
  return entries.reduce<Record<string, number>>((counts, entry) => {
    if (entry.mode !== "challenge" || entry.accuracy !== 100) return counts;
    const cardCount = String(entry.cardCount);
    counts[cardCount] = (counts[cardCount] ?? 0) + 1;
    return counts;
  }, {});
}

function normalizeFlipChallengeCounts(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([cardCount, count]) => (
      FLIP_HISTORY_CARD_COUNTS.includes(Number(cardCount) as FlipCardCount)
      && Number.isFinite(count)
      && Number(count) >= 0
    )),
  ) as Record<string, number>;
}

function groupFlipEntries(entries: FlipHistoryEntry[]): FlipHistoryGroups {
  const groups = createEmptyFlipHistory();
  for (const difficulty of ["classic", "moving"] as const) {
    const difficultyEntries = entries.filter((entry) => entry.difficulty === difficulty);
    groups["self-paced"][difficulty] = rankFlipEntries(
      difficultyEntries.filter((entry) => entry.mode === "self-paced"),
    ).slice(0, 10);
    groups.challenge[difficulty] = countFlipChallengeEntries(difficultyEntries);
  }
  return groups;
}

function normalizeFlipHistory(value: unknown): FlipHistoryGroups {
  if (Array.isArray(value)) return groupFlipEntries(normalizeFlipEntries(value, "challenge", "classic"));
  if (!value || typeof value !== "object") return createEmptyFlipHistory();

  const groups = value as Partial<Record<GameMode | FlipDifficulty, unknown>>;
  if (groups["self-paced"] || groups.challenge) {
    const normalized = createEmptyFlipHistory();
    const timedGroup = groups["self-paced"] && typeof groups["self-paced"] === "object" && !Array.isArray(groups["self-paced"])
      ? groups["self-paced"] as Partial<Record<FlipDifficulty, unknown>>
      : {};
    const challengeGroup = groups.challenge && typeof groups.challenge === "object" && !Array.isArray(groups.challenge)
      ? groups.challenge as Partial<Record<FlipDifficulty, unknown>>
      : {};

    for (const difficulty of ["classic", "moving"] as const) {
      normalized["self-paced"][difficulty] = normalizeFlipEntries(timedGroup[difficulty], "self-paced", difficulty)
        .filter((entry) => entry.mode === "self-paced");
      const challengeValue = challengeGroup[difficulty];
      normalized.challenge[difficulty] = Array.isArray(challengeValue)
        ? countFlipChallengeEntries(normalizeFlipEntries(challengeValue, "challenge", difficulty))
        : normalizeFlipChallengeCounts(challengeValue);
    }
    return normalized;
  }

  const legacyEntries = (["classic", "moving"] as const).flatMap((difficulty) => (
    normalizeFlipEntries(groups[difficulty], "challenge", difficulty)
  ));
  return groupFlipEntries(legacyEntries);
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
    version?: unknown;
    timed?: Partial<Record<NBackTrainingType, unknown>>;
    challenge?: Partial<Record<NBackTrainingType, unknown>>;
    flip?: unknown;
    reaction?: unknown;
  };
  const usesChallengeSuccessCounts = candidate.version === 5 || candidate.version === 6 || candidate.version === 7 || candidate.version === 8;
  return {
    version: 8,
    timed: {
      grid: normalizeTimedEntries(candidate.timed?.grid),
      cards: normalizeTimedEntries(candidate.timed?.cards),
    },
    challenge: {
      grid: usesChallengeSuccessCounts ? normalizeChallengeCounts(candidate.challenge?.grid) : {},
      cards: usesChallengeSuccessCounts ? normalizeChallengeCounts(candidate.challenge?.cards) : {},
    },
    flip: normalizeFlipHistory(candidate.flip),
    reaction: normalizeReactionEntries(candidate.reaction),
  };
}

export function recordLeaderboardResult(data: LeaderboardData, result: NBackSessionResult, now = Date.now()): LeaderboardData {
  const { settings, stats, elapsedMs } = result;
  if (settings.trainingType !== "grid" && settings.trainingType !== "cards") return data;
  const trainingType = settings.trainingType;

  if (settings.mode === "challenge") {
    const succeeded = stats.total > 0 && stats.correct === stats.total;
    if (!succeeded) return data;
    const interval = String(settings.interval);
    return {
      ...data,
      challenge: {
        ...data.challenge,
        [trainingType]: {
          ...data.challenge[trainingType],
          [interval]: (data.challenge[trainingType][interval] ?? 0) + 1,
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
  if (result.rounds !== 5 && result.rounds !== 8) return data;
  if (result.suitCount !== 2 && result.suitCount !== 4) return data;
  if (result.mode !== "self-paced" && result.mode !== "challenge") return data;
  if (result.difficulty !== "classic" && result.difficulty !== "moving") return data;
  const attempts = result.found + result.mistakes;
  if (result.mode === "challenge") {
    if (result.rounds !== 8) return data;
    if (attempts === 0 || result.mistakes !== 0) return data;
    const cardCount = String(result.cardCount);
    return {
      ...data,
      flip: {
        ...data.flip,
        challenge: {
          ...data.flip.challenge,
          [result.difficulty]: {
            ...data.flip.challenge[result.difficulty],
            [cardCount]: (data.flip.challenge[result.difficulty][cardCount] ?? 0) + 1,
          },
        },
      },
    };
  }

  const entry: FlipHistoryEntry = {
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    accuracy: attempts === 0 ? 0 : Math.round((result.found / attempts) * 100),
    correct: result.found,
    attempts,
    elapsedMs: result.elapsedMs,
    createdAt: now,
    cardCount: result.cardCount,
    suitCount: result.suitCount,
    mode: result.mode,
    difficulty: result.difficulty,
    rounds: result.rounds,
  };
  return {
    ...data,
    flip: {
      ...data.flip,
      "self-paced": {
        ...data.flip["self-paced"],
        [result.difficulty]: rankFlipEntries([entry, ...data.flip["self-paced"][result.difficulty]]).slice(0, 10),
      },
    },
  };
}

export function recordReactionLeaderboardResult(data: LeaderboardData, result: ReactionSessionResult, now = Date.now()): LeaderboardData {
  if (result.rounds !== 5 && result.rounds !== 10) return data;
  if (!Number.isFinite(result.averageMs) || result.averageMs <= 0) return data;
  if (!Number.isFinite(result.bestMs) || result.bestMs <= 0) return data;
  if (!Number.isFinite(result.falseStarts) || result.falseStarts < 0) return data;

  const entry: ReactionHistoryEntry = {
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    averageMs: Math.round(result.averageMs),
    bestMs: Math.round(result.bestMs),
    falseStarts: Math.round(result.falseStarts),
    rounds: result.rounds,
    createdAt: now,
  };

  return {
    ...data,
    reaction: rankReactionEntries([entry, ...data.reaction]).slice(0, 10),
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
