"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  FLIP_CARD_GAP,
  FLIP_CONFIG,
  formatDuration,
  makeFlipCards,
  makeVisibleShuffleSteps,
} from "./core";
import type { FlipCard, FlipPhase, GameSettings, TrainingType } from "./core";
import { GameHome } from "./GameHome";
import type { FlipSessionResult } from "./leaderboard";
import { playFeedbackSound } from "./sound";
import { usePausableTimers } from "./usePausableTimers";

function FlipCardFace({ card }: { card: FlipCard }) {
  return (
    <span className={`flip-card-face ${card.suit.color === "red" ? "is-red" : ""}`}>
      <span className="flip-card-rank">{card.rank.name}</span>
      <span className="flip-card-suit">{card.suit.symbol}</span>
    </span>
  );
}

type FlipMemoryGameProps = {
  settings: GameSettings;
  onSelectTrainingType: (trainingType: TrainingType) => void;
  onUpdateSettings: (patch: Partial<GameSettings>) => void;
  onEditSettings: () => void;
  onSessionActiveChange: (active: boolean) => void;
  onSessionFinished: (result: FlipSessionResult) => void;
  onOpenLeaderboard: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  paused: boolean;
  homeSettingsOpen: boolean;
  homeSettingsHeight: number;
  onHomeSettingsOpenChange: (open: boolean) => void;
  onHomeSettingsHeightChange: (height: number) => void;
};

export function FlipMemoryGame({
  settings,
  onSelectTrainingType,
  onUpdateSettings,
  onEditSettings,
  onSessionActiveChange,
  onSessionFinished,
  onOpenLeaderboard,
  soundEnabled,
  onToggleSound,
  paused,
  homeSettingsOpen,
  homeSettingsHeight,
  onHomeSettingsOpenChange,
  onHomeSettingsHeightChange,
}: FlipMemoryGameProps) {
  const timed = settings.flipMode === "self-paced";
  const moving = settings.flipDifficulty === "moving";
  const cardCount = settings.flipCardCount;
  const suitCount = settings.flipSuitCount;
  const flipConfig = FLIP_CONFIG[cardCount];
  const targetCount = flipConfig.targets;
  const previewMs = flipConfig.previewSeconds * 1000;
  const [flipPhase, setFlipPhase] = useState<FlipPhase>("idle");
  const [round, setRound] = useState(0);
  const [cards, setCards] = useState<FlipCard[]>(() => makeFlipCards(cardCount, targetCount, suitCount));
  const [activeSwap, setActiveSwap] = useState<[number, number] | null>(null);
  const [shuffleProgress, setShuffleProgress] = useState({ current: 0, total: 0 });
  const [foundIds, setFoundIds] = useState<string[]>([]);
  const [mistakeIds, setMistakeIds] = useState<string[]>([]);
  const [stats, setStats] = useState({ found: 0, mistakes: 0 });
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef(0);
  const pausedAtRef = useRef(0);
  const pausedDurationRef = useRef(0);
  const cardsRef = useRef(cards);
  const previewFinishedRef = useRef(false);
  const timers = usePausableTimers();
  const score = stats.found === 0 ? 0 : Math.round((stats.found / (stats.found + stats.mistakes)) * 100);

  const finishPreview = useCallback(() => {
    if (previewFinishedRef.current) return;
    previewFinishedRef.current = true;
    timers.clear("main");
    if (moving) {
      const steps = makeVisibleShuffleSteps(cardCount);
      setFlipPhase("shuffling");
      setShuffleProgress({ current: 0, total: steps.length });

      const playStep = (stepIndex: number, currentCards: FlipCard[]) => {
        if (stepIndex >= steps.length) {
          setActiveSwap(null);
          setFlipPhase("selecting");
          return;
        }

        const swap = steps[stepIndex];
        setActiveSwap(swap);
        setShuffleProgress({ current: stepIndex + 1, total: steps.length });
        timers.schedule("main", () => {
          const nextCards = [...currentCards];
          [nextCards[swap[0]], nextCards[swap[1]]] = [nextCards[swap[1]], nextCards[swap[0]]];
          cardsRef.current = nextCards;
          setCards(nextCards);
          setActiveSwap(null);
          timers.schedule("main", () => playStep(stepIndex + 1, nextCards), 180);
        }, 680);
      };

      timers.schedule("main", () => playStep(0, cardsRef.current), 420);
    } else {
      setFlipPhase("selecting");
    }
  }, [cardCount, moving, timers]);

  const dealRound = useCallback((roundIndex: number) => {
    timers.clearAll();
    const nextCards = makeFlipCards(cardCount, targetCount, suitCount);
    previewFinishedRef.current = false;
    cardsRef.current = nextCards;
    setRound(roundIndex);
    setCards(nextCards);
    setActiveSwap(null);
    setShuffleProgress({ current: 0, total: 0 });
    setFoundIds([]);
    setMistakeIds([]);
    setFlipPhase("preview");
    if (!timed) timers.schedule("main", finishPreview, previewMs);
  }, [cardCount, finishPreview, previewMs, suitCount, targetCount, timed, timers]);

  const beginGame = useCallback(() => {
    if (soundEnabled) playFeedbackSound("advance");
    setStats({ found: 0, mistakes: 0 });
    setElapsedMs(0);
    startedAtRef.current = Date.now();
    pausedAtRef.current = 0;
    pausedDurationRef.current = 0;
    dealRound(0);
  }, [dealRound, soundEnabled]);

  const finishGame = useCallback(() => {
    timers.clearAll();
    const duration = Math.max(0, Date.now() - startedAtRef.current - pausedDurationRef.current);
    setElapsedMs(duration);
    setFlipPhase("finished");
    onSessionFinished({
      cardCount,
      suitCount,
      mode: settings.flipMode,
      difficulty: settings.flipDifficulty,
      rounds: settings.flipRounds,
      found: stats.found,
      mistakes: stats.mistakes,
      elapsedMs: duration,
    });
  }, [cardCount, onSessionFinished, settings.flipDifficulty, settings.flipMode, settings.flipRounds, stats.found, stats.mistakes, suitCount, timers]);

  const advanceRound = () => {
    if (round + 1 >= settings.flipRounds) finishGame();
    else dealRound(round + 1);
  };

  const chooseCard = (card: FlipCard) => {
    if (flipPhase !== "selecting" || foundIds.includes(card.id) || mistakeIds.includes(card.id)) return;
    if (soundEnabled) playFeedbackSound(card.isTarget ? "correct" : "wrong");
    if (card.isTarget) {
      const nextFound = [...foundIds, card.id];
      setFoundIds(nextFound);
      setStats((currentStats) => ({ ...currentStats, found: currentStats.found + 1 }));
      if (nextFound.length === targetCount) setFlipPhase("round-complete");
    } else {
      setMistakeIds((currentIds) => [...currentIds, card.id]);
      setStats((currentStats) => ({ ...currentStats, mistakes: currentStats.mistakes + 1 }));
      timers.schedule(`mistake-${card.id}`, () => {
        setMistakeIds((currentIds) => currentIds.filter((id) => id !== card.id));
      }, 650);
    }
  };

  useEffect(() => {
    if (paused) {
      timers.pauseAll();
      if (flipPhase !== "idle" && flipPhase !== "finished" && !pausedAtRef.current) pausedAtRef.current = Date.now();
    } else {
      if (pausedAtRef.current) pausedDurationRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = 0;
      timers.resumeAll();
    }
  }, [flipPhase, paused, timers]);

  useEffect(() => {
    onSessionActiveChange(flipPhase !== "idle");
  }, [flipPhase, onSessionActiveChange]);

  useEffect(() => () => onSessionActiveChange(false), [onSessionActiveChange]);

  const showAllFaces = flipPhase === "preview" || flipPhase === "round-complete";
  const targets = cards.filter((card) => card.isTarget);
  const targetPromptVisible = flipPhase === "selecting" || flipPhase === "round-complete";

  if (flipPhase === "finished") {
    return (
      <div className={`flip-game flip-phase-${flipPhase} flip-count-${cardCount}`}>
        <div className="stage-heading flip-heading">
          <span className="eyebrow">翻牌记忆 · {timed ? "计时模式" : "挑战模式"} · {moving ? "移动" : "经典"}</span>
          <h1>训练完成</h1>
        </div>
        <section className="result-panel" aria-label="翻牌记忆结果">
          <div className="score-ring" style={{ "--score": `${score * 3.6}deg` } as CSSProperties}>
            <div><strong>{score}</strong><span>%</span><small>选择正确率</small></div>
          </div>
          <div className="result-copy">
            <div className="result-config">
              <span><b>{settings.flipRounds}</b> 轮训练</span>
              <span><b>{cardCount}</b> 张 · {suitCount} 花色</span>
            </div>
            <div className="result-time"><small>总用时</small><strong>{formatDuration(elapsedMs)}</strong></div>
            <p className="result-note">找对 {stats.found} 张 · 误点 {stats.mistakes} 张</p>
            <div className="result-actions">
              <button className="secondary-button" onClick={beginGame}>{timed ? "再练一轮" : "再次挑战"}</button>
              <button className="primary-button" onClick={onEditSettings}>修改设置 <span>→</span></button>
            </div>
            <button type="button" className="result-leaderboard-link" onClick={onOpenLeaderboard}>查看历史最佳 <span>→</span></button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={`flip-game flip-phase-${flipPhase} flip-count-${cardCount}`}>
      {flipPhase === "idle" ? (
        <GameHome
          eyebrow={`翻牌记忆 · ${timed ? "计时模式" : "挑战模式"} · ${moving ? "移动" : "经典"}`}
          title="看清每一张牌"
          description={timed ? "自己决定何时盖牌，全部找出后进入下一轮。" : "限时记牌，盖牌后不限时找完全部目标牌。"}
          settings={settings}
          startLabel={timed ? "开始计时" : "开始挑战"}
          onStart={beginGame}
          onUpdateSettings={onUpdateSettings}
          onSelectTrainingType={onSelectTrainingType}
          soundEnabled={soundEnabled}
          onToggleSound={onToggleSound}
          onOpenLeaderboard={onOpenLeaderboard}
          settingsOpen={homeSettingsOpen}
          settingsHeight={homeSettingsHeight}
          onSettingsOpenChange={onHomeSettingsOpenChange}
          onSettingsHeightChange={onHomeSettingsHeightChange}
        />
      ) : (
        <>
          {targetPromptVisible && (
            <div className="target-prompt" aria-label="本轮目标牌">
              <span>第 {round + 1} / {settings.flipRounds} 轮 · 剩余 {Math.max(0, targetCount - foundIds.length)}</span>
              {targets.map((card) => (
                <span className={card.suit.color === "red" ? "is-red" : ""} key={card.id}>
                  {card.rank.name}{card.suit.symbol}
                  {foundIds.includes(card.id) && <i aria-label="已找到">✓</i>}
                </span>
              ))}
            </div>
          )}

          <div
            className={`flip-board ${cardCount >= 12 ? "is-dense" : ""} ${flipPhase === "shuffling" ? "is-shuffling" : ""}`}
            style={{ "--flip-columns": flipConfig.columns, "--flip-board-width": `${flipConfig.boardWidth}px` } as CSSProperties}
            aria-label={`${cardCount}张扑克牌记忆区`}
          >
            {cards.map((card, index) => {
              const found = foundIds.includes(card.id);
              const mistake = mistakeIds.includes(card.id);
              const faceUp = showAllFaces || found || mistake;
              const swapRole = activeSwap?.[0] === index ? "leading" : activeSwap?.[1] === index ? "trailing" : null;
              const destination = swapRole === "leading" ? activeSwap![1] : swapRole === "trailing" ? activeSwap![0] : index;
              const columnDelta = (destination % flipConfig.columns) - (index % flipConfig.columns);
              const rowDelta = Math.floor(destination / flipConfig.columns) - Math.floor(index / flipConfig.columns);
              const arcDirection = swapRole === "leading" ? -1 : 1;
              const arcX = -Math.sign(rowDelta) * 12 * arcDirection;
              const arcY = Math.sign(columnDelta) * 12 * arcDirection;
              return (
                <button
                  className={`memory-card ${faceUp ? "is-face-up" : "is-face-down"} ${found ? "is-found" : ""} ${mistake ? "is-mistake" : ""} ${swapRole ? `is-swapping is-swap-${swapRole}` : ""}`}
                  onClick={() => chooseCard(card)}
                  disabled={flipPhase !== "selecting" || found || mistake}
                  aria-label={faceUp ? `${card.suit.name}${card.rank.name}${found ? "，目标牌" : mistake ? "，不是目标" : ""}` : "盖住的扑克牌"}
                  style={swapRole ? {
                    "--move-x": `calc(${columnDelta * 100}% + ${columnDelta * FLIP_CARD_GAP}px)`,
                    "--move-y": `calc(${rowDelta * 100}% + ${rowDelta * FLIP_CARD_GAP}px)`,
                    "--move-mid-x": `calc(${columnDelta * 50}% + ${columnDelta * FLIP_CARD_GAP * 0.5 + arcX}px)`,
                    "--move-mid-y": `calc(${rowDelta * 50}% + ${rowDelta * FLIP_CARD_GAP * 0.5 + arcY}px)`,
                  } as CSSProperties : undefined}
                  key={card.id}
                >
                  {faceUp ? <FlipCardFace card={card} /> : <span className="memory-card-back"><i>N²</i></span>}
                </button>
              );
            })}
            {flipPhase === "shuffling" && (
              <div className="shuffle-overlay" aria-live="polite">
                换位 {shuffleProgress.current || 1} / {shuffleProgress.total}
              </div>
            )}
          </div>

          {flipPhase === "preview" && !timed && (
            <div className="preview-timer" style={{ "--preview-duration": `${previewMs}ms`, "--flip-board-width": `${flipConfig.boardWidth}px` } as CSSProperties}><i /></div>
          )}

          {flipPhase === "preview" ? (
            timed ? (
              <button className="start-button" onClick={finishPreview}>记住了，盖牌 <span>→</span></button>
            ) : (
              <button className="start-button is-muted" disabled>记牌中 · {flipConfig.previewSeconds} 秒</button>
            )
          ) : flipPhase === "round-complete" ? (
            <button className="start-button" onClick={advanceRound}>{round + 1 >= settings.flipRounds ? "查看结果" : "下一轮"} <span>→</span></button>
          ) : (
            <button className="start-button pause-button flip-restart" onClick={beginGame}><span aria-hidden="true">↻</span> 重新开始</button>
          )}
        </>
      )}
    </div>
  );
}
