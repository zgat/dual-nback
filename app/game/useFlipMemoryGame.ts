"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FLIP_CONFIG, FLIP_REVEAL_DURATION_MS, FLIP_SWAP_DURATION_MS, makeFlipCards, makeVisibleShuffleSteps } from "./core";
import type { FlipCard, FlipPhase, GameSettings } from "./core";
import type { FlipSessionResult } from "./leaderboard";
import { playFeedbackSound } from "./sound";
import { usePausableTimers } from "./usePausableTimers";
import { useSessionClock } from "./useSessionClock";

export function useFlipMemoryGame({settings, soundEnabled, paused, onSessionFinished}: {
  settings: GameSettings;
  soundEnabled: boolean;
  paused: boolean;
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
  const phaseRef = useRef<FlipPhase>("idle");
  const changePhase = useCallback((phase: FlipPhase) => {
    phaseRef.current = phase;
    setFlipPhase(phase);
  }, []);
  const [round, setRound] = useState(0);
  const [cards, setCards] = useState<FlipCard[]>([]);
  const [activeSwap, setActiveSwap] = useState<[number, number] | null>(null);
  const [shuffleProgress, setShuffleProgress] = useState({ current: 0, total: 0 });
  const [foundIds, setFoundIds] = useState<string[]>([]);
  const [mistakeIds, setMistakeIds] = useState<string[]>([]);
  const [stats, setStats] = useState({ found: 0, mistakes: 0 });
  const [elapsedMs, setElapsedMs] = useState(0);
  const clock = useSessionClock();
  const cardsRef = useRef(cards);
  const previewFinishedRef = useRef(false);
  const completedResultRef = useRef<FlipSessionResult | null>(null);
  const claimedIdsRef = useRef(new Set<string>());
  const statsRef = useRef({found: 0, mistakes: 0});
  const timers = usePausableTimers();
  const score = stats.found === 0 ? 0 : Math.round((stats.found / (stats.found + stats.mistakes)) * 100);
  const challengeSuccess = !timed && stats.found > 0 && stats.mistakes === 0;

  const finishPreview = useCallback(() => {
    if (paused || phaseRef.current !== "preview" || previewFinishedRef.current) return;
    previewFinishedRef.current = true;
    timers.clear("main");
    if (moving) {
      const steps = makeVisibleShuffleSteps(cardCount);
      changePhase("shuffling");
      setShuffleProgress({ current: 0, total: steps.length });

      const playStep = (stepIndex: number, currentCards: FlipCard[]) => {
        if (stepIndex >= steps.length) {
          setActiveSwap(null);
          changePhase("selecting");
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
      changePhase("covering");
      clock.pause();
      timers.schedule("main", () => {
        changePhase("selecting");
        clock.resume();
      }, FLIP_REVEAL_DURATION_MS);
    }
  }, [cardCount, changePhase, clock, moving, paused, timers]);

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
    claimedIdsRef.current.clear();
    changePhase("revealing");
    clock.pause();
    // Start the full preview budget only after the opening is complete.
    timers.schedule("main", () => {
      changePhase("preview");
      clock.resume();
      if (!timed) timers.schedule("main", finishPreview, previewMs);
    }, FLIP_REVEAL_DURATION_MS);
  }, [cardCount, changePhase, clock, finishPreview, previewMs, suitCount, targetCount, timed, timers]);

  const beginGame = useCallback(() => {
    if (soundEnabled) playFeedbackSound("advance");
    setStats({ found: 0, mistakes: 0 });
    statsRef.current = {found: 0, mistakes: 0};
    setElapsedMs(0);
    completedResultRef.current = null;
    clock.start();
    dealRound(0);
  }, [clock, dealRound, soundEnabled]);

  const goHome = useCallback(() => {
    timers.clearAll();
    clock.finish();
    changePhase("idle");
    setActiveSwap(null);
  }, [changePhase, clock, timers]);

  const finishGame = useCallback(() => {
    timers.clearAll();
    const duration = clock.finish();
    setElapsedMs(duration);
    changePhase("finished");
  }, [changePhase, clock, timers]);

  const advanceRound = () => {
    if (paused || phaseRef.current !== "round-complete") return;
    if (round + 1 >= settings.flipRounds) finishGame();
    else {
      changePhase("dealing");
      clock.pause();
      timers.clearAll();
      timers.schedule("main", () => dealRound(round + 1), FLIP_REVEAL_DURATION_MS);
    }
  };

  const chooseCard = (card: FlipCard) => {
    if (paused || completedResultRef.current || phaseRef.current !== "selecting" || claimedIdsRef.current.has(card.id)) return;
    claimedIdsRef.current.add(card.id);
    if (soundEnabled) playFeedbackSound(card.isTarget ? "correct" : "wrong");
    if (card.isTarget) {
      const nextFound = cardsRef.current.filter(item => item.isTarget && claimedIdsRef.current.has(item.id)).map(item => item.id);
      setFoundIds(nextFound);
      statsRef.current = {...statsRef.current, found: statsRef.current.found + 1};
      setStats(statsRef.current);
      if (nextFound.length === targetCount) {
        if (round + 1 >= settings.flipRounds) {
          const result: FlipSessionResult = {
            cardCount, suitCount, mode: settings.flipMode, difficulty: settings.flipDifficulty,
            rounds: settings.flipRounds, found: statsRef.current.found, mistakes: statsRef.current.mistakes,
            elapsedMs: clock.finish(),
          };
          completedResultRef.current = result;
          setElapsedMs(result.elapsedMs);
          onSessionFinished(result);
        }
        changePhase("round-complete");
      }
    } else {
      setMistakeIds((currentIds) => [...currentIds, card.id]);
      statsRef.current = {...statsRef.current, mistakes: statsRef.current.mistakes + 1};
      setStats(statsRef.current);
      timers.schedule(`mistake-${card.id}`, () => {
        claimedIdsRef.current.delete(card.id);
        setMistakeIds((currentIds) => currentIds.filter((id) => id !== card.id));
      }, 650);
    }
  };

  useEffect(() => {
    if (paused) {
      timers.pauseAll();
      clock.pause();
    } else {
      if (!["revealing", "dealing", "covering"].includes(phaseRef.current)) clock.resume();
      timers.resumeAll();
    }
  }, [clock, paused, timers]);

  return { timed, moving, cardCount, suitCount, flipConfig, targetCount, previewMs, flipPhase, round, cards, activeSwap, shuffleProgress, foundIds, mistakeIds, stats, elapsedMs, score, challengeSuccess, finishPreview, beginGame, advanceRound, chooseCard, goHome };
}
