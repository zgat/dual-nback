export type Phase = "idle" | "countdown" | "playing" | "paused" | "finished";
export type MatchType = "exact" | "position" | "color" | "different";
export type GameMode = "self-paced" | "challenge";
export type TrainingType = "grid" | "cards" | "flip";
export type FlipDifficulty = "classic" | "moving";
export type FlipCardCount = 6 | 8 | 9 | 12 | 16;
export type FlipPhase = "idle" | "preview" | "shuffling" | "selecting" | "round-complete" | "finished";

export type ColorToken = {
  name: string;
  value: string;
};

export type GridTrial = {
  type: "grid";
  position: number;
  color: ColorToken;
};

export type CardSuit = {
  name: string;
  symbol: string;
  color: "red" | "black";
};

export type CardRank = {
  name: string;
  value: number;
};

export type CardTrial = {
  type: "cards";
  rank: CardRank;
  suit: CardSuit;
};

export type FlipCard = CardTrial & {
  id: string;
  isTarget: boolean;
};

export type Trial = GridTrial | CardTrial;

export type GameSettings = {
  n: number;
  total: number;
  interval: number;
  cellCount: number;
  colorCount: number;
  mode: GameMode;
  trainingType: TrainingType;
  flipDifficulty: FlipDifficulty;
  flipCardCount: FlipCardCount;
  flipRounds: number;
};

export type Stats = {
  correct: number;
  total: number;
  misses: number;
  streak: number;
  bestStreak: number;
  categoryHits: Record<MatchType, number>;
};

export const COLORS: ColorToken[] = [
  { name: "红", value: "#e65347" },
  { name: "橙", value: "#ed8936" },
  { name: "黄", value: "#d6b92f" },
  { name: "绿", value: "#46a269" },
  { name: "青", value: "#32a2ad" },
  { name: "蓝", value: "#4d6fd1" },
  { name: "紫", value: "#8a5cc4" },
];

export const CARD_SUITS: CardSuit[] = [
  { name: "黑桃", symbol: "♠", color: "black" },
  { name: "红桃", symbol: "♥", color: "red" },
  { name: "梅花", symbol: "♣", color: "black" },
  { name: "方块", symbol: "♦", color: "red" },
];

export const CARD_RANKS: CardRank[] = [
  { name: "A", value: 1 },
  ...Array.from({ length: 9 }, (_, index) => ({ name: String(index + 2), value: index + 2 })),
  { name: "J", value: 11 },
  { name: "Q", value: 12 },
  { name: "K", value: 13 },
];

export const OPTIONS: Array<{ id: MatchType; key: string }> = [
  { id: "exact", key: "1" },
  { id: "position", key: "2" },
  { id: "color", key: "3" },
  { id: "different", key: "4" },
];

export const FLIP_CARD_COUNTS: FlipCardCount[] = [6, 8, 9, 12, 16];
export const FLIP_CONFIG: Record<FlipCardCount, { columns: number; targets: number; previewSeconds: number; boardWidth: number; layout: string }> = {
  6: { columns: 3, targets: 2, previewSeconds: 5, boardWidth: 430, layout: "3 × 2" },
  8: { columns: 4, targets: 3, previewSeconds: 6, boardWidth: 520, layout: "4 × 2" },
  9: { columns: 3, targets: 3, previewSeconds: 7, boardWidth: 430, layout: "3 × 3" },
  12: { columns: 4, targets: 4, previewSeconds: 9, boardWidth: 500, layout: "4 × 3" },
  16: { columns: 4, targets: 5, previewSeconds: 12, boardWidth: 500, layout: "4 × 4" },
};
export const FLIP_CARD_GAP = 8;

export const DEFAULT_SETTINGS: GameSettings = {
  n: 2,
  total: 20,
  interval: 2400,
  cellCount: 6,
  colorCount: 4,
  mode: "self-paced",
  trainingType: "grid",
  flipDifficulty: "classic",
  flipCardCount: 6,
  flipRounds: 5,
};

export const PRESET_INTERVALS = [3000, 2400, 1800, 1200];
export const EMPTY_STATS: Stats = {
  correct: 0,
  total: 0,
  misses: 0,
  streak: 0,
  bestStreak: 0,
  categoryHits: { exact: 0, position: 0, color: 0, different: 0 },
};

function pickDifferent<T>(values: T[], excluded?: T) {
  const choices = excluded === undefined ? values : values.filter((value) => value !== excluded);
  return choices[Math.floor(Math.random() * choices.length)];
}

function shuffle<T>(values: T[]) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapWith]] = [result[swapWith], result[index]];
  }
  return result;
}

export function makeVisibleShuffleSteps(cardCount: number): Array<[number, number]> {
  const positions = shuffle(Array.from({ length: cardCount }, (_, index) => index));
  const steps: Array<[number, number]> = [];
  let pairStart = 0;

  if (cardCount % 2 === 1) {
    steps.push([positions[0], positions[1]], [positions[1], positions[2]]);
    pairStart = 3;
  }

  for (let index = pairStart; index < positions.length; index += 2) {
    steps.push([positions[index], positions[index + 1]]);
  }
  return steps;
}

export function makeFlipCards(cardCount: number, targetCount: number): FlipCard[] {
  const pool = CARD_SUITS.flatMap((suit) => CARD_RANKS.map((rank) => ({
    type: "cards" as const,
    id: `${suit.name}-${rank.name}`,
    rank,
    suit,
  })));
  const cards = shuffle(pool).slice(0, cardCount);
  const targetIds = new Set(shuffle(cards).slice(0, targetCount).map((card) => card.id));
  return cards.map((card) => ({ ...card, isTarget: targetIds.has(card.id) }));
}

export function makeSequence(settings: GameSettings): Trial[] {
  const sequence: Trial[] = [];
  const positions = Array.from({ length: settings.cellCount }, (_, index) => index);
  const colors = COLORS.slice(0, settings.colorCount);

  for (let index = 0; index < settings.total; index += 1) {
    if (index < settings.n) {
      sequence.push(settings.trainingType === "cards"
        ? { type: "cards", rank: pickDifferent(CARD_RANKS), suit: pickDifferent(CARD_SUITS) }
        : { type: "grid", position: pickDifferent(positions), color: pickDifferent(colors) });
      continue;
    }

    const target = sequence[index - settings.n];
    const relation = OPTIONS[Math.floor(Math.random() * OPTIONS.length)].id;
    if (target.type === "cards") {
      sequence.push({
        type: "cards",
        rank: relation === "exact" || relation === "position"
          ? target.rank
          : pickDifferent(CARD_RANKS, target.rank),
        suit: relation === "exact" || relation === "color"
          ? target.suit
          : pickDifferent(CARD_SUITS, target.suit),
      });
    } else {
      sequence.push({
        type: "grid",
        position: relation === "exact" || relation === "position"
          ? target.position
          : pickDifferent(positions, target.position),
        color: relation === "exact" || relation === "color"
          ? target.color
          : pickDifferent(colors, target.color),
      });
    }
  }

  return sequence;
}

export function classify(current: Trial, target: Trial): MatchType {
  if (current.type !== target.type) return "different";
  const samePosition = current.type === "cards"
    ? current.rank === (target as CardTrial).rank
    : current.position === (target as GridTrial).position;
  const sameColor = current.type === "cards"
    ? current.suit === (target as CardTrial).suit
    : current.color === (target as GridTrial).color;
  if (samePosition && sameColor) return "exact";
  if (samePosition) return "position";
  if (sameColor) return "color";
  return "different";
}

export function scorePercent(stats: Stats) {
  return stats.total === 0 ? 0 : Math.round((stats.correct / stats.total) * 100);
}

function normalizeInterval(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_SETTINGS.interval;
  return PRESET_INTERVALS.reduce((closest, interval) => (
    Math.abs(interval - value) < Math.abs(closest - value) ? interval : closest
  ));
}

export function normalizeSettings(value: Partial<GameSettings>): GameSettings {
  const trainingType = value.trainingType === "cards" || value.trainingType === "flip" ? value.trainingType : "grid";
  const flipCardCount = FLIP_CARD_COUNTS.includes(value.flipCardCount as FlipCardCount) ? value.flipCardCount as FlipCardCount : DEFAULT_SETTINGS.flipCardCount;
  return {
    n: trainingType === "cards" ? 2 : Math.min(5, Math.max(1, Math.round(value.n ?? DEFAULT_SETTINGS.n))),
    total: value.total === 30 ? 30 : 20,
    interval: normalizeInterval(value.interval ?? DEFAULT_SETTINGS.interval),
    cellCount: Math.min(16, Math.max(4, Math.round(value.cellCount ?? DEFAULT_SETTINGS.cellCount))),
    colorCount: Math.min(7, Math.max(2, Math.round(value.colorCount ?? DEFAULT_SETTINGS.colorCount))),
    mode: value.mode === "challenge" ? "challenge" : "self-paced",
    trainingType,
    flipDifficulty: value.flipDifficulty === "moving" ? "moving" : "classic",
    flipCardCount,
    flipRounds: value.flipRounds === 8 ? 8 : 5,
  };
}

export function relationDetail(id: MatchType, trainingType: TrainingType) {
  const first = trainingType === "cards" ? "点数" : "位置";
  const second = trainingType === "cards" ? "花色" : "颜色";
  const states: Record<MatchType, [boolean, boolean]> = {
    exact: [true, true],
    position: [true, false],
    color: [false, true],
    different: [false, false],
  };
  const [firstSame, secondSame] = states[id];
  return `${first} ${firstSame ? "✓" : "×"} · ${second} ${secondSame ? "✓" : "×"}`;
}

export function relationLabel(id: MatchType, trainingType: TrainingType) {
  const first = trainingType === "cards" ? "点数" : "位置";
  const second = trainingType === "cards" ? "花色" : "颜色";
  if (id === "exact") return `${first}和${second}都相同`;
  if (id === "position") return `仅${first}相同`;
  if (id === "color") return `仅${second}相同`;
  return `${first}和${second}都不同`;
}

export function formatDuration(milliseconds: number) {
  const seconds = Math.max(0, milliseconds) / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} 秒`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} 分 ${Math.floor(seconds % 60).toString().padStart(2, "0")} 秒`;
}
