"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FLIP_CONFIG, FLIP_SWAP_DURATION_MS, makeFlipCards, makeVisibleShuffleSteps } from "./core";
import type { FlipCard, FlipPhase, GameSettings } from "./core";
import type { FlipSessionResult } from "./leaderboard";
import { playFeedbackSound } from "./sound";
import { usePausableTimers } from "./usePausableTimers";
import { useSessionClock } from "./useSessionClock";

export function useFlipMemoryGame({settings, soundEnabled, paused, onSessionActiveChange, onSessionFinished}: {
  settings: GameSettings;
  soundEnabled: boolean;
  paused: boolean;
  onSessionActiveChange: (active: boolean) => void;
  onSessionFinished: (result: FlipSessionResult) => void;
}) {
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
  const clock = useSessionClock();
  const cardsRef = useRef(cards);
  const previewFinishedRef = useRef(false);
  const timers = usePausableTimers();
  const score = stats.found === 0 ? 0 : Math.round((stats.found / (stats.found + stats.mistakes)) * 100);
  const challengeSuccess = !timed && stats.found > 0 && stats.mistakes === 0;

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
        }, FLIP_SWAP_DURATION_MS);
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
    clock.start();
    dealRound(0);
  }, [clock, dealRound, soundEnabled]);

  const finishGame = useCallback(() => {
    timers.clearAll();
    const duration = clock.finish();
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
  }, [cardCount, clock, onSessionFinished, settings.flipDifficulty, settings.flipMode, settings.flipRounds, stats.found, stats.mistakes, suitCount, timers]);

  const advanceRound = () => {
    if (round + 1 >= settings.flipRounds) finishGame();
    else dealRound(round + 1);
  };

  const chooseCard = (card: FlipCard) => {
    if (paused || flipPhase !== "selecting" || foundIds.includes(card.id) || mistakeIds.includes(card.id)) return;
    if (soundEnabled) playFeedbackSound(card.isTarget ? "correct" : "wrong");
    if (card.isTarget) {
      const nextFound = [...foundIds, card.id];
      setFoundIds(nextFound);
      setStats((currentStats) => ({ ...currentStats, found: currentStats.found + 1 }));
      if (nextFound.length === targetCount) {
        if (round + 1 >= settings.flipRounds) clock.finish();
        setFlipPhase("round-complete");
      }
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
      clock.pause();
    } else {
      clock.resume();
      timers.resumeAll();
    }
  }, [clock, paused, timers]);

  useEffect(() => {
    onSessionActiveChange(flipPhase !== "idle");
  }, [flipPhase, onSessionActiveChange]);

  useEffect(() => () => onSessionActiveChange(false), [onSessionActiveChange]);

  return { timed, moving, cardCount, suitCount, flipConfig, targetCount, previewMs, flipPhase, round, cards, activeSwap, shuffleProgress, foundIds, mistakeIds, stats, elapsedMs, score, challengeSuccess, finishPreview, beginGame, advanceRound, chooseCard };
}
