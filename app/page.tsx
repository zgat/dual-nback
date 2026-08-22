"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

type Phase = "idle" | "countdown" | "playing" | "paused" | "finished";
type MatchType = "exact" | "position" | "color" | "different";
type GameMode = "self-paced" | "challenge";
type TrainingType = "grid" | "cards";

type ColorToken = {
  name: string;
  value: string;
};

type GridTrial = {
  type: "grid";
  position: number;
  color: ColorToken;
};

type CardSuit = {
  name: string;
  symbol: string;
  color: "red" | "black";
};

type CardRank = {
  name: string;
  value: number;
};

type CardTrial = {
  type: "cards";
  rank: CardRank;
  suit: CardSuit;
};

type Trial = GridTrial | CardTrial;

type GameSettings = {
  n: number;
  total: number;
  interval: number;
  cellCount: number;
  colorCount: number;
  mode: GameMode;
  trainingType: TrainingType;
};

type Stats = {
  correct: number;
  total: number;
  misses: number;
  streak: number;
  bestStreak: number;
  categoryHits: Record<MatchType, number>;
};

const COLORS: ColorToken[] = [
  { name: "红", value: "#e65347" },
  { name: "橙", value: "#ed8936" },
  { name: "黄", value: "#d6b92f" },
  { name: "绿", value: "#46a269" },
  { name: "青", value: "#32a2ad" },
  { name: "蓝", value: "#4d6fd1" },
  { name: "紫", value: "#8a5cc4" },
];

const CARD_SUITS: CardSuit[] = [
  { name: "黑桃", symbol: "♠", color: "black" },
  { name: "红桃", symbol: "♥", color: "red" },
  { name: "梅花", symbol: "♣", color: "black" },
  { name: "方块", symbol: "♦", color: "red" },
];

const CARD_RANKS: CardRank[] = [
  { name: "A", value: 1 },
  ...Array.from({ length: 9 }, (_, index) => ({ name: String(index + 2), value: index + 2 })),
  { name: "J", value: 11 },
  { name: "Q", value: 12 },
  { name: "K", value: 13 },
];

const OPTIONS: Array<{ id: MatchType; key: string }> = [
  { id: "exact", key: "1" },
  { id: "position", key: "2" },
  { id: "color", key: "3" },
  { id: "different", key: "4" },
];

const DEFAULT_SETTINGS: GameSettings = {
  n: 2,
  total: 20,
  interval: 2400,
  cellCount: 6,
  colorCount: 4,
  mode: "self-paced",
  trainingType: "grid",
};
const PRESET_INTERVALS = [3000, 2400, 1800];
const EMPTY_STATS: Stats = {
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

function makeSequence(settings: GameSettings): Trial[] {
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

function classify(current: Trial, target: Trial): MatchType {
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

function scorePercent(stats: Stats) {
  return stats.total === 0 ? 0 : Math.round((stats.correct / stats.total) * 100);
}

function clampInterval(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_SETTINGS.interval;
  return Math.round(Math.min(20000, Math.max(1500, value)) / 100) * 100;
}

function normalizeSettings(value: Partial<GameSettings>): GameSettings {
  const trainingType = value.trainingType === "cards" ? "cards" : "grid";
  return {
    n: trainingType === "cards" ? 2 : Math.min(5, Math.max(1, Math.round(value.n ?? DEFAULT_SETTINGS.n))),
    total: value.total === 30 ? 30 : 20,
    interval: clampInterval(value.interval ?? DEFAULT_SETTINGS.interval),
    cellCount: Math.min(16, Math.max(4, Math.round(value.cellCount ?? DEFAULT_SETTINGS.cellCount))),
    colorCount: Math.min(7, Math.max(2, Math.round(value.colorCount ?? DEFAULT_SETTINGS.colorCount))),
    mode: value.mode === "challenge" ? "challenge" : "self-paced",
    trainingType,
  };
}

function relationDetail(id: MatchType, trainingType: TrainingType) {
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

function relationLabel(id: MatchType, trainingType: TrainingType) {
  const first = trainingType === "cards" ? "点数" : "位置";
  const second = trainingType === "cards" ? "花色" : "颜色";
  if (id === "exact") return `${first}和${second}都相同`;
  if (id === "position") return `仅${first}相同`;
  if (id === "color") return `仅${second}相同`;
  return `${first}和${second}都不同`;
}

function formatDuration(milliseconds: number) {
  const seconds = Math.max(0, milliseconds) / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} 秒`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} 分 ${Math.floor(seconds % 60).toString().padStart(2, "0")} 秒`;
}

export default function Home() {
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [draftSettings, setDraftSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState(-1);
  const [current, setCurrent] = useState<Trial | null>(null);
  const [stimulusVisible, setStimulusVisible] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [selected, setSelected] = useState<MatchType | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState<MatchType | null>(null);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [bestScore, setBestScore] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  const sequenceRef = useRef<Trial[]>([]);
  const settingsRef = useRef(settings);
  const phaseRef = useRef<Phase>(phase);
  const roundRef = useRef(-1);
  const responseRef = useRef<MatchType | null>(null);
  const statsRef = useRef<Stats>(EMPTY_STATS);
  const trialTimerRef = useRef<number | null>(null);
  const stimulusTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const finalizeRef = useRef<() => void>(() => undefined);
  const sessionStartedAtRef = useRef(0);
  const sessionEndedAtRef = useRef(0);
  const pauseStartedAtRef = useRef(0);
  const pausedDurationRef = useRef(0);

  const clearTimers = useCallback(() => {
    if (trialTimerRef.current !== null) window.clearTimeout(trialTimerRef.current);
    if (stimulusTimerRef.current !== null) window.clearTimeout(stimulusTimerRef.current);
    if (countdownTimerRef.current !== null) window.clearInterval(countdownTimerRef.current);
    trialTimerRef.current = null;
    stimulusTimerRef.current = null;
    countdownTimerRef.current = null;
  }, []);

  const startTrial = useCallback((index: number) => {
    const trial = sequenceRef.current[index];
    if (!trial) return;

    roundRef.current = index;
    sessionEndedAtRef.current = 0;
    responseRef.current = null;
    setRound(index);
    setCurrent(trial);
    setSelected(null);
    setCorrectAnswer(null);
    setStimulusVisible(true);

    if (settingsRef.current.mode === "challenge") {
      const showFor = Math.min(2400, Math.round(settingsRef.current.interval * 0.42));
      stimulusTimerRef.current = window.setTimeout(() => setStimulusVisible(false), showFor);
      trialTimerRef.current = window.setTimeout(() => finalizeRef.current(), settingsRef.current.interval);
    }
  }, []);

  const finishSession = useCallback((finalStats: Stats) => {
    clearTimers();
    phaseRef.current = "finished";
    setPhase("finished");
    setStimulusVisible(false);
    const endedAt = sessionEndedAtRef.current || Date.now();
    setElapsedMs(Math.max(0, endedAt - sessionStartedAtRef.current - pausedDurationRef.current));

    const score = scorePercent(finalStats);
    setBestScore((previous) => {
      const next = Math.max(previous, score);
      window.localStorage.setItem("dual-nback-best", String(next));
      return next;
    });
  }, [clearTimers]);

  finalizeRef.current = () => {
    if (phaseRef.current !== "playing") return;
    const index = roundRef.current;
    const n = settingsRef.current.n;
    let nextStats = statsRef.current;

    if (index >= n) {
      const expected = classify(sequenceRef.current[index], sequenceRef.current[index - n]);
      const answered = responseRef.current;
      const isCorrect = answered === expected;
      const nextStreak = isCorrect ? nextStats.streak + 1 : 0;

      nextStats = {
        correct: nextStats.correct + Number(isCorrect),
        total: nextStats.total + 1,
        misses: nextStats.misses + Number(answered === null),
        streak: nextStreak,
        bestStreak: Math.max(nextStats.bestStreak, nextStreak),
        categoryHits: {
          ...nextStats.categoryHits,
          [expected]: nextStats.categoryHits[expected] + Number(isCorrect),
        },
      };

      statsRef.current = nextStats;
      setStats(nextStats);
    }

    if (index >= settingsRef.current.total - 1) {
      finishSession(nextStats);
    } else {
      startTrial(index + 1);
    }
  };

  const beginCountdown = useCallback(() => {
    clearTimers();
    sequenceRef.current = makeSequence(settingsRef.current);
    statsRef.current = EMPTY_STATS;
    responseRef.current = null;
    roundRef.current = -1;
    phaseRef.current = "countdown";
    setPhase("countdown");
    setRound(-1);
    setCurrent(null);
    setStats(EMPTY_STATS);
    setElapsedMs(0);
    setSelected(null);
    setCorrectAnswer(null);
    setCountdown(3);

    let remaining = 3;
    countdownTimerRef.current = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (countdownTimerRef.current !== null) window.clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
        phaseRef.current = "playing";
        setPhase("playing");
        sessionStartedAtRef.current = Date.now();
        sessionEndedAtRef.current = 0;
        pausedDurationRef.current = 0;
        pauseStartedAtRef.current = 0;
        startTrial(0);
      } else {
        setCountdown(remaining);
      }
    }, 700);
  }, [clearTimers, startTrial]);

  const pauseGame = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    clearTimers();
    phaseRef.current = "paused";
    setPhase("paused");
    setStimulusVisible(false);
    pauseStartedAtRef.current = Date.now();
  }, [clearTimers]);

  const togglePause = useCallback(() => {
    if (phaseRef.current === "playing") {
      pauseGame();
    } else if (phaseRef.current === "paused") {
      if (pauseStartedAtRef.current) {
        pausedDurationRef.current += Date.now() - pauseStartedAtRef.current;
        pauseStartedAtRef.current = 0;
      }
      phaseRef.current = "playing";
      setPhase("playing");
      startTrial(Math.max(0, roundRef.current));
    }
  }, [pauseGame, startTrial]);

  const respond = useCallback((answer: MatchType) => {
    if (phaseRef.current !== "playing" || responseRef.current !== null) return;
    const index = roundRef.current;
    const n = settingsRef.current.n;
    if (index < n) return;

    const expected = classify(sequenceRef.current[index], sequenceRef.current[index - n]);
    responseRef.current = answer;
    setSelected(answer);
    setCorrectAnswer(expected);
    if (settingsRef.current.mode === "self-paced") {
      if (index >= settingsRef.current.total - 1) sessionEndedAtRef.current = Date.now();
      trialTimerRef.current = window.setTimeout(() => finalizeRef.current(), 450);
    }
  }, []);

  const advanceWarmup = useCallback(() => {
    if (
      phaseRef.current === "playing"
      && settingsRef.current.mode === "self-paced"
      && roundRef.current < settingsRef.current.n
    ) {
      finalizeRef.current();
    }
  }, []);

  const optionClass = (id: MatchType) => {
    if (!selected) return "";
    if (selected === id) return selected === correctAnswer ? "is-correct" : "is-wrong";
    if (correctAnswer === id) return "is-answer";
    return "";
  };

  const openSettings = () => {
    if (phaseRef.current === "playing") pauseGame();
    setDraftSettings(settingsRef.current);
    setShowSettings(true);
  };

  const saveSettings = () => {
    const normalized = normalizeSettings(draftSettings);
    settingsRef.current = normalized;
    setSettings(normalized);
    setDraftSettings(normalized);
    window.localStorage.setItem("dual-nback-settings", JSON.stringify(normalized));
    setShowSettings(false);
    if (phaseRef.current === "paused") {
      clearTimers();
      phaseRef.current = "idle";
      setPhase("idle");
      setRound(-1);
      setCurrent(null);
      setStimulusVisible(false);
    }
  };

  const selectMode = (mode: GameMode) => {
    if (phaseRef.current !== "idle") return;
    const next = { ...settingsRef.current, mode };
    settingsRef.current = next;
    setSettings(next);
    setDraftSettings(next);
    window.localStorage.setItem("dual-nback-settings", JSON.stringify(next));
  };

  const selectTrainingType = (trainingType: TrainingType) => {
    if (phaseRef.current !== "idle") return;
    const next = normalizeSettings({ ...settingsRef.current, trainingType });
    settingsRef.current = next;
    setSettings(next);
    setDraftSettings(next);
    window.localStorage.setItem("dual-nback-settings", JSON.stringify(next));
  };

  const levelUp = () => {
    if (settingsRef.current.trainingType === "cards") return;
    const next = { ...settingsRef.current, n: Math.min(5, settingsRef.current.n + 1) };
    settingsRef.current = next;
    setSettings(next);
    setDraftSettings(next);
    window.localStorage.setItem("dual-nback-settings", JSON.stringify(next));
    beginCountdown();
  };

  useEffect(() => {
    try {
      const savedSettings = window.localStorage.getItem("dual-nback-settings");
      const savedBest = Number(window.localStorage.getItem("dual-nback-best") || 0);
      if (savedSettings) {
        const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) } as GameSettings;
        const sanitized = normalizeSettings(parsed);
        settingsRef.current = sanitized;
        setSettings(sanitized);
        setDraftSettings(sanitized);
      }
      setBestScore(savedBest);
    } catch {
      // The game remains fully playable when storage is unavailable.
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || showSettings) return;
      const option = OPTIONS.find((item) => item.key === event.key);
      if (option) respond(option.id);
      const key = event.key.toLowerCase();
      if ((key === "enter" || key === " ") && settingsRef.current.mode === "self-paced") {
        event.preventDefault();
        advanceWarmup();
      }
      if (key === "p" || key === "escape") togglePause();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [advanceWarmup, respond, showSettings, togglePause]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const accuracy = scorePercent(stats);
  const warmup = phase === "playing" && round < settings.n;
  const responseDisabled = phase !== "playing" || warmup || selected !== null;
  const progress = round < 0 ? 0 : ((round + 1) / settings.total) * 100;
  const wrongAnswers = Math.max(0, stats.total - stats.correct - stats.misses);
  const customPace = !PRESET_INTERVALS.includes(draftSettings.interval);
  const gridColumns = settings.cellCount <= 4 ? 2 : settings.cellCount <= 9 ? 3 : 4;
  const modeLabel = settings.mode === "self-paced" ? "计时模式" : "挑战模式";
  const isCardMode = settings.trainingType === "cards";
  const draftIsCardMode = draftSettings.trainingType === "cards";
  const trainingLabel = isCardMode ? "扑克牌" : "彩色方格";
  const memoryDimensions = isCardMode ? "点数与花色" : "位置与颜色";
  const currentCard = current?.type === "cards" ? current : null;
  const currentGrid = current?.type === "grid" ? current : null;

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => phase !== "playing" && setPhase("idle")} aria-label="回到游戏首页">
          <span className="brand-mark">N²</span>
          <span>双重记忆</span>
        </button>
        <div className="round-pill" aria-live="polite">
          {phase === "idle" ? `${isCardMode ? "扑克 · " : ""}${settings.n}-BACK` : `第 ${Math.max(0, round + 1)} / ${settings.total} 轮`}
        </div>
        <div className="top-actions">
          {(phase === "countdown" || phase === "playing" || phase === "paused") && (
            <button className="restart-button" onClick={beginCountdown} aria-label="重新开始本轮训练">
              <span aria-hidden="true">↻</span>
              <b>重新开始</b>
            </button>
          )}
          <button className="icon-button" onClick={openSettings} aria-label="打开训练设置">⚙</button>
        </div>
        <div className="top-progress" style={{ width: `${progress}%` }} />
      </header>

      <section className="game-stage">
        <div className="stage-heading">
          <span className="eyebrow">{trainingLabel} · {modeLabel} · {settings.n}-BACK</span>
          <h1>{phase === "finished" ? "训练完成" : `记住${memoryDimensions}`}</h1>
          <p>
            {warmup
              ? `先记住前 ${settings.n} 轮，之后开始四选一判断。`
              : phase === "paused"
                ? "训练已暂停，准备好后继续。"
                : settings.mode === "self-paced"
                  ? `不限时思考，作答后才进入下一轮。`
                  : `把当前${isCardMode ? "牌面" : "色块"}与 ${settings.n} 轮前比较，选择唯一符合的关系。`}
          </p>
          {isCardMode ? (
            <div className="suit-legend" aria-label="黑桃、红桃、梅花、方块四种花色">
              {CARD_SUITS.map((suit) => <i className={suit.color === "red" ? "is-red" : ""} key={suit.name} title={suit.name}>{suit.symbol}</i>)}
            </div>
          ) : (
            <div className="color-legend" aria-label={`${settings.colorCount}种训练颜色`}>
              {COLORS.slice(0, settings.colorCount).map((color) => <i key={color.name} title={color.name} style={{ backgroundColor: color.value }} />)}
            </div>
          )}
          {phase === "idle" && (
            <div className="idle-switches">
              <div className="training-switch" aria-label="选择训练内容">
                <button className={!isCardMode ? "is-selected" : ""} onClick={() => selectTrainingType("grid")}>
                  <span aria-hidden="true">▦</span> 彩色方格
                </button>
                <button className={isCardMode ? "is-selected" : ""} onClick={() => selectTrainingType("cards")}>
                  <span aria-hidden="true">♠</span> 扑克牌
                </button>
              </div>
              <div className="mode-switch" aria-label="选择节奏模式">
                <button className={settings.mode === "self-paced" ? "is-selected" : ""} onClick={() => selectMode("self-paced")}>
                  计时模式<small>不限时 · 作答后换轮</small>
                </button>
                <button className={settings.mode === "challenge" ? "is-selected" : ""} onClick={() => selectMode("challenge")}>
                  挑战模式<small>固定节奏 · 自动换轮</small>
                </button>
              </div>
            </div>
          )}
        </div>

        {phase === "finished" ? (
          <section className="result-panel" aria-label="训练结果">
            <div className="score-ring" style={{ "--score": `${accuracy * 3.6}deg` } as CSSProperties}>
              <div><strong>{accuracy}</strong><span>%</span><small>综合正确率</small></div>
            </div>
            <div className="result-copy">
              <span className="result-kicker">本轮表现</span>
              <h2>{accuracy >= 85 ? "判断稳定，可以继续挑战。" : accuracy >= 70 ? "节奏不错，再巩固一轮。" : "先放慢节奏，辨清两个维度。"}</h2>
              <div className="result-config" aria-label="本轮训练设置">
                {isCardMode ? (
                  <>
                    <span><b>13</b> 个点数</span>
                    <span><b>4</b> 种花色</span>
                  </>
                ) : (
                  <>
                    <span><b>{settings.cellCount}</b> 个格子</span>
                    <span><b>{settings.colorCount}</b> 种颜色</span>
                  </>
                )}
              </div>
              {settings.mode === "self-paced" && (
                <div className="result-time">
                  <small>总用时</small>
                  <strong>{formatDuration(elapsedMs)}</strong>
                </div>
              )}
              <div className="result-metrics">
                {OPTIONS.map((option) => (
                  <span key={option.id}><b>{stats.categoryHits[option.id]}</b> {relationLabel(option.id, settings.trainingType)}</span>
                ))}
              </div>
              <p className="result-note">答错 {wrongAnswers} 次 · 未作答 {stats.misses} 次 · 最长连续正确 {stats.bestStreak} 轮</p>
              <div className="result-actions">
                <button className="secondary-button" onClick={beginCountdown}>再练一轮</button>
                {isCardMode ? (
                  <button className="primary-button" onClick={openSettings}>调整设置 <span>→</span></button>
                ) : (
                  <button className="primary-button" onClick={levelUp} disabled={settings.n >= 5}>
                    {settings.n >= 5 ? "已到最高难度" : `升到 ${settings.n + 1}-Back`} <span>→</span>
                  </button>
                )}
              </div>
            </div>
          </section>
        ) : (
          <>
            {isCardMode ? (
              <div className="card-board" aria-label="扑克牌训练区">
                <div className={`playing-card ${currentCard?.suit.color === "red" ? "is-red" : ""} ${!stimulusVisible || !currentCard ? "is-back" : ""}`} aria-hidden="true">
                  {stimulusVisible && currentCard ? (
                    <>
                      <span className="card-corner is-top"><b>{currentCard.rank.name}</b><i>{currentCard.suit.symbol}</i></span>
                      <span className="card-suit-center">{currentCard.suit.symbol}</span>
                      <span className="card-corner is-bottom"><b>{currentCard.rank.name}</b><i>{currentCard.suit.symbol}</i></span>
                    </>
                  ) : (
                    <span className="card-back-mark">N²</span>
                  )}
                </div>
                <span className="sr-only" aria-live="assertive">
                  {stimulusVisible && currentCard ? `${currentCard.suit.name}${currentCard.rank.name}` : ""}
                </span>
                {phase === "countdown" && <div className="board-overlay countdown-number">{countdown}</div>}
                {phase === "paused" && <div className="board-overlay"><span>已暂停</span><small>按 P 或下方按钮继续</small></div>}
                {phase === "idle" && (
                  <div className="board-overlay intro-overlay">
                    <span>扑克牌 2-Back</span>
                    <small>{settings.mode === "self-paced" ? "记住点数与花色 · 作答后换轮" : "记住点数与花色 · 固定节奏"}</small>
                  </div>
                )}
              </div>
            ) : (
              <div
                className="game-grid"
                aria-label={`${settings.cellCount}个位置棋盘`}
                style={{ "--grid-columns": gridColumns } as CSSProperties}
              >
                {Array.from({ length: settings.cellCount }).map((_, index) => (
                  <div
                    className={`grid-cell ${stimulusVisible && currentGrid?.position === index ? "is-active" : ""}`}
                    style={stimulusVisible && currentGrid?.position === index ? { "--stimulus-color": currentGrid.color.value } as CSSProperties : undefined}
                    key={index}
                    aria-hidden="true"
                  />
                ))}
                <span className="sr-only" aria-live="assertive">
                  {stimulusVisible && currentGrid ? `${currentGrid.color.name}色，位置 ${currentGrid.position + 1}` : ""}
                </span>
                {phase === "countdown" && <div className="board-overlay countdown-number">{countdown}</div>}
                {phase === "paused" && <div className="board-overlay"><span>已暂停</span><small>按 P 或下方按钮继续</small></div>}
                {phase === "idle" && (
                  <div className="board-overlay intro-overlay">
                    <span>{modeLabel}</span>
                    <small>{settings.mode === "self-paced" ? "不限时 · 作答后进入下一轮" : "固定节奏 · 自动进入下一轮"}</small>
                  </div>
                )}
              </div>
            )}

            {warmup && settings.mode === "self-paced" ? (
              <button className="warmup-next" onClick={advanceWarmup}>
                记住了，下一轮 <span>Enter ↵</span>
              </button>
            ) : (
              <div className="response-area four-options" aria-label="选择与 N 轮前的关系">
                {OPTIONS.map((option) => (
                  <button
                    className={`match-button relation-button ${optionClass(option.id)}`}
                    onClick={() => respond(option.id)}
                    disabled={responseDisabled}
                    aria-label={relationLabel(option.id, settings.trainingType)}
                    key={option.id}
                  >
                    <b>{relationDetail(option.id, settings.trainingType)}</b>
                  </button>
                ))}
              </div>
            )}

            {phase === "idle" ? (
              <button className="start-button" onClick={beginCountdown}>
                {settings.mode === "self-paced" ? "开始计时" : "开始挑战"} <span>→</span>
              </button>
            ) : phase === "countdown" ? (
              <button className="start-button is-muted" disabled>准备开始…</button>
            ) : (
              <button className="start-button pause-button" onClick={togglePause}>
                {phase === "paused" ? "继续训练" : "暂停训练"} <span>{phase === "paused" ? "→" : "Ⅱ"}</span>
              </button>
            )}
          </>
        )}
      </section>

      <footer className="statusbar">
        <span>
          <i className="status-dot" />
          {isCardMode ? "13 个点数 · 4 种花色" : `${settings.cellCount} 个位置 · ${settings.colorCount} 种颜色`}
        </span>
        <span>正确率 <b>{stats.total ? `${accuracy}%` : "—"}</b></span>
        <span>节奏 <b>{modeLabel}</b></span>
        <span>历史最佳 <b>{bestScore ? `${bestScore}%` : "—"}</b></span>
      </footer>

      {showSettings && (
        <div className="modal-backdrop" onMouseDown={() => setShowSettings(false)}>
          <section className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="settings-header">
              <div><span className="eyebrow">TRAINING SETUP</span><h2 id="settings-title">训练设置</h2></div>
              <button className="close-button" onClick={() => setShowSettings(false)} aria-label="关闭设置">×</button>
            </div>

            <fieldset className="setting-group training-setting">
              <legend>训练内容</legend>
              <div className="choice-row two-columns training-options">
                <button
                  className={!draftIsCardMode ? "is-selected" : ""}
                  onClick={() => setDraftSettings((value) => normalizeSettings({ ...value, trainingType: "grid" }))}
                >
                  彩色方格<small>位置 × 颜色 · 可调 N-Back</small>
                </button>
                <button
                  className={draftIsCardMode ? "is-selected" : ""}
                  onClick={() => setDraftSettings((value) => normalizeSettings({ ...value, trainingType: "cards" }))}
                >
                  扑克牌<small>点数 × 花色 · 固定 2-Back</small>
                </button>
              </div>
            </fieldset>

            <fieldset className="setting-group mode-setting">
              <legend>节奏模式</legend>
              <div className="choice-row two-columns mode-options">
                <button className={draftSettings.mode === "self-paced" ? "is-selected" : ""} onClick={() => setDraftSettings((value) => ({ ...value, mode: "self-paced" }))}>
                  计时模式<small>不限时，作答后换轮并记录总用时</small>
                </button>
                <button className={draftSettings.mode === "challenge" ? "is-selected" : ""} onClick={() => setDraftSettings((value) => ({ ...value, mode: "challenge" }))}>
                  挑战模式<small>固定节奏，自动进入下一轮</small>
                </button>
              </div>
            </fieldset>

            <div className="setting-row">
              <div>
                <b>N-Back 难度</b>
                <small>{draftIsCardMode ? "扑克牌玩法固定比较 2 轮前的牌面" : "需要回忆多少轮之前的位置与颜色"}</small>
              </div>
              {draftIsCardMode ? (
                <strong className="fixed-setting-value">2</strong>
              ) : (
                <div className="stepper">
                  <button onClick={() => setDraftSettings((value) => ({ ...value, n: Math.max(1, value.n - 1) }))} aria-label="降低难度">−</button>
                  <strong>{draftSettings.n}</strong>
                  <button onClick={() => setDraftSettings((value) => ({ ...value, n: Math.min(5, value.n + 1) }))} aria-label="提高难度">＋</button>
                </div>
              )}
            </div>

            {draftIsCardMode ? (
              <div className="card-pool-setting" aria-label="扑克牌训练牌组">
                <div className="card-pool-summary">
                  <span><b>13</b> 个点数</span>
                  <span><b>4</b> 种花色</span>
                </div>
                <div className="setting-suits" aria-hidden="true">
                  {CARD_SUITS.map((suit) => <i className={suit.color === "red" ? "is-red" : ""} key={suit.name}>{suit.symbol}</i>)}
                </div>
                <small>使用 A、2–10、J、Q、K 和完整四种花色。</small>
              </div>
            ) : (
              <>
                <div className="setting-row">
                  <div><b>位置方块数</b><small>可选 4–16 个位置；越少越容易</small></div>
                  <div className="stepper">
                    <button onClick={() => setDraftSettings((value) => ({ ...value, cellCount: Math.max(4, value.cellCount - 1) }))} aria-label="减少位置方块">−</button>
                    <strong>{draftSettings.cellCount}</strong>
                    <button onClick={() => setDraftSettings((value) => ({ ...value, cellCount: Math.min(16, value.cellCount + 1) }))} aria-label="增加位置方块">＋</button>
                  </div>
                </div>

                <div className="setting-row">
                  <div><b>颜色数量</b><small>从彩虹色中选择 2–7 种；越少越容易</small></div>
                  <div className="stepper">
                    <button onClick={() => setDraftSettings((value) => ({ ...value, colorCount: Math.max(2, value.colorCount - 1) }))} aria-label="减少颜色">−</button>
                    <strong>{draftSettings.colorCount}</strong>
                    <button onClick={() => setDraftSettings((value) => ({ ...value, colorCount: Math.min(7, value.colorCount + 1) }))} aria-label="增加颜色">＋</button>
                  </div>
                </div>
              </>
            )}

            {draftSettings.mode === "challenge" && <fieldset className="setting-group">
              <legend>每轮节奏</legend>
              <div className="choice-row pace-options">
                {[{ label: "舒缓", value: 3000 }, { label: "标准", value: 2400 }, { label: "快速", value: 1800 }].map((option) => (
                  <button className={draftSettings.interval === option.value ? "is-selected" : ""} onClick={() => setDraftSettings((value) => ({ ...value, interval: option.value }))} key={option.value}>
                    {option.label}<small>{option.value / 1000} 秒</small>
                  </button>
                ))}
                <button
                  className={customPace ? "is-selected" : ""}
                  onClick={() => setDraftSettings((value) => ({ ...value, interval: PRESET_INTERVALS.includes(value.interval) ? 5000 : value.interval }))}
                >
                  自定义<small>{customPace ? `${(draftSettings.interval / 1000).toFixed(1)} 秒` : "1.5–20 秒"}</small>
                </button>
              </div>
              {customPace && (
                <div className="custom-pace-row">
                  <label htmlFor="custom-pace">每轮时长</label>
                  <div className="duration-input">
                    <input
                      id="custom-pace"
                      type="number"
                      min="1.5"
                      max="20"
                      step="0.5"
                      value={draftSettings.interval / 1000}
                      onChange={(event) => setDraftSettings((value) => ({ ...value, interval: Number(event.target.value) * 1000 }))}
                      aria-describedby="custom-pace-help"
                    />
                    <span>秒</span>
                  </div>
                  <small id="custom-pace-help">{draftIsCardMode ? "牌面" : "色块"}显示时间也会随节奏适当延长</small>
                </div>
              )}
            </fieldset>}

            <fieldset className="setting-group">
              <legend>训练长度</legend>
              <div className="choice-row two-columns">
                {[20, 30].map((total) => (
                  <button className={draftSettings.total === total ? "is-selected" : ""} onClick={() => setDraftSettings((value) => ({ ...value, total }))} key={total}>
                    {total} 轮<small>{draftSettings.mode === "self-paced" ? "按自己的速度完成" : `约 ${Math.ceil((total * draftSettings.interval) / 60000)} 分钟`}</small>
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="how-to">
              <b>四选一规则</b>
              <p>
                {draftIsCardMode
                  ? "把当前牌的点数、花色分别与 2 轮前比较，从点数同/不同、花色同/不同的四种组合中选择答案。"
                  : "把当前位置、颜色分别与 N 轮前比较，从位置同/不同、颜色同/不同的四种组合中选择答案。"}
                计时模式在作答后换轮，挑战模式会自动换轮。
              </p>
            </div>

            <button className="start-button" onClick={saveSettings}>保存设置</button>
          </section>
        </div>
      )}
    </main>
  );
}
