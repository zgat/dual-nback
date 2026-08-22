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
  onOpenSettings: () => void;
  onSessionActiveChange: (active: boolean) => void;
};

export function FlipMemoryGame({
  settings,
  onSelectTrainingType,
  onOpenSettings,
  onSessionActiveChange,
}: FlipMemoryGameProps) {
  const moving = settings.flipDifficulty === "moving";
  const cardCount = settings.flipCardCount;
  const flipConfig = FLIP_CONFIG[cardCount];
  const targetCount = flipConfig.targets;
  const previewMs = (flipConfig.previewSeconds + (moving ? 2 : 0)) * 1000;
  const bestStorageKey = `flip-memory-best-${settings.flipDifficulty}-${cardCount}`;
  const [flipPhase, setFlipPhase] = useState<FlipPhase>("idle");
  const [round, setRound] = useState(0);
  const [cards, setCards] = useState<FlipCard[]>(() => makeFlipCards(cardCount, targetCount));
  const [activeSwap, setActiveSwap] = useState<[number, number] | null>(null);
  const [shuffleProgress, setShuffleProgress] = useState({ current: 0, total: 0 });
  const [foundIds, setFoundIds] = useState<string[]>([]);
  const [mistakeIds, setMistakeIds] = useState<string[]>([]);
  const [stats, setStats] = useState({ found: 0, mistakes: 0 });
  const [elapsedMs, setElapsedMs] = useState(0);
  const [bestScore, setBestScore] = useState(() => typeof window === "undefined" ? 0 : Number(window.localStorage.getItem(bestStorageKey) || 0));
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const cardsRef = useRef(cards);
  const previewFinishedRef = useRef(false);
  const score = stats.found === 0 ? 0 : Math.round((stats.found / (stats.found + stats.mistakes)) * 100);

  const clearFlipTimer = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const finishPreview = useCallback(() => {
    if (previewFinishedRef.current) return;
    previewFinishedRef.current = true;
    clearFlipTimer();
    if (moving) {
      const steps = makeVisibleShuffleSteps(cardCount);
      setFlipPhase("shuffling");
      setShuffleProgress({ current: 0, total: steps.length });

      const playStep = (stepIndex: number, currentCards: FlipCard[]) => {
        if (stepIndex >= steps.length) {
          setActiveSwap(null);
          setFlipPhase("selecting");
          timerRef.current = null;
          return;
        }

        const swap = steps[stepIndex];
        setActiveSwap(swap);
        setShuffleProgress({ current: stepIndex + 1, total: steps.length });
        timerRef.current = window.setTimeout(() => {
          const nextCards = [...currentCards];
          [nextCards[swap[0]], nextCards[swap[1]]] = [nextCards[swap[1]], nextCards[swap[0]]];
          cardsRef.current = nextCards;
          setCards(nextCards);
          setActiveSwap(null);
          timerRef.current = window.setTimeout(() => playStep(stepIndex + 1, nextCards), 180);
        }, 680);
      };

      timerRef.current = window.setTimeout(() => playStep(0, cardsRef.current), 420);
    } else {
      setFlipPhase("selecting");
    }
  }, [cardCount, clearFlipTimer, moving]);

  const dealRound = useCallback((roundIndex: number) => {
    clearFlipTimer();
    const nextCards = makeFlipCards(cardCount, targetCount);
    previewFinishedRef.current = false;
    cardsRef.current = nextCards;
    setRound(roundIndex);
    setCards(nextCards);
    setActiveSwap(null);
    setShuffleProgress({ current: 0, total: 0 });
    setFoundIds([]);
    setMistakeIds([]);
    setFlipPhase("preview");
    timerRef.current = window.setTimeout(finishPreview, previewMs);
  }, [cardCount, clearFlipTimer, finishPreview, previewMs, targetCount]);

  const beginGame = useCallback(() => {
    setStats({ found: 0, mistakes: 0 });
    setElapsedMs(0);
    startedAtRef.current = Date.now();
    dealRound(0);
  }, [dealRound]);

  const finishGame = useCallback(() => {
    clearFlipTimer();
    const duration = Math.max(0, Date.now() - startedAtRef.current);
    setElapsedMs(duration);
    setFlipPhase("finished");
    setBestScore((previous) => {
      const next = Math.max(previous, score);
      window.localStorage.setItem(bestStorageKey, String(next));
      return next;
    });
  }, [bestStorageKey, clearFlipTimer, score]);

  const advanceRound = () => {
    if (round + 1 >= settings.flipRounds) finishGame();
    else dealRound(round + 1);
  };

  const chooseCard = (card: FlipCard) => {
    if (flipPhase !== "selecting" || foundIds.includes(card.id) || mistakeIds.includes(card.id)) return;
    if (card.isTarget) {
      const nextFound = [...foundIds, card.id];
      setFoundIds(nextFound);
      setStats((currentStats) => ({ ...currentStats, found: currentStats.found + 1 }));
      if (nextFound.length === targetCount) setFlipPhase("round-complete");
    } else {
      setMistakeIds((currentIds) => [...currentIds, card.id]);
      setStats((currentStats) => ({ ...currentStats, mistakes: currentStats.mistakes + 1 }));
    }
  };

  useEffect(() => clearFlipTimer, [clearFlipTimer]);

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
          <span className="eyebrow">翻牌记忆 · {cardCount} 张 · {moving ? "移动进阶" : "经典模式"}</span>
          <h1>训练完成</h1>
          <p>记忆牌面和位置，找到每轮指定的目标牌。</p>
        </div>
        <section className="result-panel" aria-label="翻牌记忆结果">
          <div className="score-ring" style={{ "--score": `${score * 3.6}deg` } as CSSProperties}>
            <div><strong>{score}</strong><span>%</span><small>选择正确率</small></div>
          </div>
          <div className="result-copy">
            <span className="result-kicker">翻牌记忆</span>
            <h2>{score >= 90 ? "位置记得很稳。" : score >= 75 ? "表现不错，再巩固一轮。" : "可以降低牌数或先用经典模式。"}</h2>
            <div className="result-config">
              <span><b>{settings.flipRounds}</b> 轮训练</span>
              <span><b>{cardCount}</b> 张牌 / 轮</span>
            </div>
            <div className="result-time"><small>总用时</small><strong>{formatDuration(elapsedMs)}</strong></div>
            <p className="result-note">找对 {stats.found} 张 · 误点 {stats.mistakes} 张 · 历史最佳 {bestScore || score}%</p>
            <div className="result-actions">
              <button className="secondary-button" onClick={beginGame}>再练一轮</button>
              <button className="primary-button" onClick={onOpenSettings}>调整难度 <span>→</span></button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={`flip-game flip-phase-${flipPhase} flip-count-${cardCount}`}>
      {flipPhase === "idle" && (
        <div className="stage-heading flip-heading">
          <span className="eyebrow">翻牌记忆 · {cardCount} 张 · {moving ? "移动进阶" : "经典模式"}</span>
          <h1>看清每一张牌</h1>
          <p>{moving ? `${cardCount} 张牌盖住后会逐步换位，再按记忆找出目标。` : `先记住 ${cardCount} 张牌，盖牌后按原位置找出目标。`}</p>
          <div className="idle-switches">
            <div className="training-switch three-options" aria-label="选择训练内容">
              <button onClick={() => onSelectTrainingType("grid")}><span aria-hidden="true">▦</span> 彩色方格</button>
              <button onClick={() => onSelectTrainingType("cards")}><span aria-hidden="true">♠</span> 扑克 2-Back</button>
              <button className="is-selected" onClick={() => onSelectTrainingType("flip")}><span aria-hidden="true">▤</span> 翻牌记忆</button>
            </div>
          </div>
        </div>
      )}

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

      {flipPhase === "preview" && (
        <div className="preview-timer" style={{ "--preview-duration": `${previewMs}ms`, "--flip-board-width": `${flipConfig.boardWidth}px` } as CSSProperties}><i /></div>
      )}

      {flipPhase === "idle" ? (
        <button className="start-button" onClick={beginGame}>开始翻牌记忆 <span>→</span></button>
      ) : flipPhase === "preview" ? (
        <button className="start-button" onClick={finishPreview}>记住了，盖牌 <span>→</span></button>
      ) : flipPhase === "round-complete" ? (
        <button className="start-button" onClick={advanceRound}>{round + 1 >= settings.flipRounds ? "查看结果" : "下一轮"} <span>→</span></button>
      ) : (
        <button className="start-button pause-button flip-restart" onClick={beginGame}><span aria-hidden="true">↻</span> 重新开始</button>
      )}
    </div>
  );
}
