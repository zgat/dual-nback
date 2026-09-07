"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CARD_FLIP_DURATION_MS,
  EMPTY_STATS,
  OPTIONS,
  classify,
  makeSequence,
  recordTrialResult,
} from "./core";
import type { GameSettings, MatchType, Phase, Stats, Trial } from "./core";
import type { NBackSessionResult } from "./leaderboard";
import { normalizeShortcutKey } from "./shortcuts";
import type { ShortcutKeys } from "./shortcuts";
import { playFeedbackSound } from "./sound";
import { usePausableTimers } from "./usePausableTimers";
import { useSessionClock } from "./useSessionClock";
import { shouldIgnoreGameKey } from "./keyboard";

type RunningPhase = "countdown" | "playing";

export function useGameController(
  settings: GameSettings,
  soundEnabled: boolean,
  shortcutKeys: ShortcutKeys,
  inputBlocked = false,
  onSessionFinished?: (result: NBackSessionResult) => void,
) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState(-1);
  const [current, setCurrent] = useState<Trial | null>(null);
  const [stimulusVisible, setStimulusVisible] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [countdownExiting, setCountdownExiting] = useState(false);
  const [selected, setSelected] = useState<MatchType | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState<MatchType | null>(null);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [roundTransitioning, setRoundTransitioning] = useState(false);
  const warmupAdvancingRef = useRef(false);

  const settingsRef = useRef(settings);
  const soundEnabledRef = useRef(soundEnabled);
  const shortcutKeysRef = useRef(shortcutKeys);
  const onSessionFinishedRef = useRef(onSessionFinished);
  const sequenceRef = useRef<Trial[]>([]);
  const phaseRef = useRef<Phase>(phase);
  const phaseBeforePauseRef = useRef<RunningPhase>("playing");
  const roundRef = useRef(-1);
  const responseRef = useRef<MatchType | null>(null);
  const statsRef = useRef<Stats>(EMPTY_STATS);
  const stimulusVisibleRef = useRef(false);
  const cardRevealStartedAtRef = useRef(0);
  const cardResumeDelayRef = useRef(0);
  const finalizeRef = useRef<() => void>(() => undefined);
  const countdownStepRef = useRef<() => void>(() => undefined);
  const countdownRemainingRef = useRef(3);
  const clock = useSessionClock();
  const timers = usePausableTimers();

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    shortcutKeysRef.current = shortcutKeys;
  }, [shortcutKeys]);

  useEffect(() => {
    onSessionFinishedRef.current = onSessionFinished;
  }, [onSessionFinished]);

  const setVisible = useCallback((visible: boolean) => {
    stimulusVisibleRef.current = visible;
    setStimulusVisible(visible);
  }, []);

  const startTrial = useCallback((index: number) => {
    const trial = sequenceRef.current[index];
    if (!trial) return;

    roundRef.current = index;
    responseRef.current = null;
    setRound(index);
    setCurrent(trial);
    setSelected(null);
    setCorrectAnswer(null);
    warmupAdvancingRef.current = false;
    setRoundTransitioning(false);
    setVisible(true);
    cardRevealStartedAtRef.current = performance.now();

    if (trial.type === "cards" && settingsRef.current.mode === "self-paced") {
      warmupAdvancingRef.current = true;
      setRoundTransitioning(true);
      timers.schedule("card-ready", () => {
        warmupAdvancingRef.current = false;
        setRoundTransitioning(false);
      }, CARD_FLIP_DURATION_MS);
    }

    if (settingsRef.current.mode !== "challenge") return;
    if (trial.type === "cards") {
      const hideAfter = CARD_FLIP_DURATION_MS + settingsRef.current.interval;
      timers.schedule("stimulus", () => {
        setVisible(false);
        timers.schedule("trial", () => finalizeRef.current(), CARD_FLIP_DURATION_MS);
      }, hideAfter);
    } else {
      const showFor = Math.min(2400, Math.round(settingsRef.current.interval * 0.42));
      timers.schedule("stimulus", () => setVisible(false), showFor);
      timers.schedule("trial", () => finalizeRef.current(), settingsRef.current.interval);
    }
  }, [setVisible, timers]);

  const finishSession = useCallback(() => {
    timers.clearAll();
    phaseRef.current = "finished";
    setPhase("finished");
    setVisible(false);
    const elapsed = clock.finish();
    setElapsedMs(elapsed);
    onSessionFinishedRef.current?.({
      settings: { ...settingsRef.current },
      stats: statsRef.current,
      elapsedMs: elapsed,
    });
  }, [clock, setVisible, timers]);

  const finalizeTrial = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    const index = roundRef.current;
    const n = settingsRef.current.n;

    if (index >= n) {
      const expected = classify(sequenceRef.current[index], sequenceRef.current[index - n]);
      const nextStats = recordTrialResult(statsRef.current, expected, responseRef.current);
      statsRef.current = nextStats;
      setStats(nextStats);
    }

    if (index >= settingsRef.current.total - 1) finishSession();
    else startTrial(index + 1);
  }, [finishSession, startTrial]);

  useEffect(() => {
    finalizeRef.current = finalizeTrial;
  }, [finalizeTrial]);

  const completeCountdown = useCallback(() => {
    if (phaseRef.current !== "countdown") return;
    timers.clear("countdown-exit");
    setCountdownExiting(false);
    phaseRef.current = "playing";
    setPhase("playing");
    clock.start();
    startTrial(0);
  }, [clock, startTrial, timers]);

  useEffect(() => {
    countdownStepRef.current = () => {
      countdownRemainingRef.current -= 1;
      if (countdownRemainingRef.current <= 0) {
        setCountdownExiting(true);
        timers.schedule("countdown-exit", completeCountdown, 500);
      } else {
        setCountdown(countdownRemainingRef.current);
        timers.schedule("countdown-step", () => countdownStepRef.current(), 700);
      }
    };
  }, [completeCountdown, timers]);

  const beginCountdown = useCallback(() => {
    timers.clearAll();
    warmupAdvancingRef.current = false;
    setRoundTransitioning(false);
    if (soundEnabledRef.current) playFeedbackSound("advance");
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
    setVisible(false);
    setCountdown(3);
    setCountdownExiting(false);
    countdownRemainingRef.current = 3;
    timers.schedule("countdown-step", () => countdownStepRef.current(), 700);
  }, [setVisible, timers]);

  const pauseGame = useCallback(() => {
    if (phaseRef.current !== "playing" && phaseRef.current !== "countdown") return false;
    phaseBeforePauseRef.current = phaseRef.current;
    // Replace only the opening animation already consumed, not the remaining thinking time.
    cardResumeDelayRef.current = settingsRef.current.trainingType === "cards"
      && settingsRef.current.mode === "challenge" && stimulusVisibleRef.current
      ? Math.min(CARD_FLIP_DURATION_MS, Math.max(0, performance.now() - cardRevealStartedAtRef.current))
      : 0;
    timers.pauseAll();
    phaseRef.current = "paused";
    setPhase("paused");
    if (phaseBeforePauseRef.current === "playing") setStimulusVisible(false);
    if (phaseBeforePauseRef.current === "playing") clock.pause();
    return true;
  }, [clock, timers]);

  const resumeGame = useCallback(() => {
    if (phaseRef.current !== "paused") return;
    if (phaseBeforePauseRef.current === "playing") clock.resume();
    phaseRef.current = phaseBeforePauseRef.current;
    setPhase(phaseBeforePauseRef.current);
    if (phaseBeforePauseRef.current === "playing") setStimulusVisible(stimulusVisibleRef.current);
    timers.extend("stimulus", cardResumeDelayRef.current);
    cardRevealStartedAtRef.current = performance.now();
    if (phaseBeforePauseRef.current === "playing" && stimulusVisibleRef.current
      && settingsRef.current.trainingType === "cards" && settingsRef.current.mode === "self-paced"
      && responseRef.current === null) {
      // Resume conceals then reopens the same card. Keep input locked for that
      // complete opening, even if its earlier ready timer already finished.
      warmupAdvancingRef.current = true;
      setRoundTransitioning(true);
      timers.schedule("card-ready", () => {
        warmupAdvancingRef.current = false;
        setRoundTransitioning(false);
      }, CARD_FLIP_DURATION_MS);
    }
    timers.resumeAll();
  }, [clock, timers]);

  const togglePause = useCallback(() => {
    if (phaseRef.current === "paused") resumeGame();
    else pauseGame();
  }, [pauseGame, resumeGame]);

  const respond = useCallback((answer: MatchType) => {
    if (phaseRef.current !== "playing" || responseRef.current !== null || warmupAdvancingRef.current) return;
    const index = roundRef.current;
    const n = settingsRef.current.n;
    if (index < n) return;

    const expected = classify(sequenceRef.current[index], sequenceRef.current[index - n]);
    responseRef.current = answer;
    setSelected(answer);
    setCorrectAnswer(expected);
    if (soundEnabledRef.current) playFeedbackSound(answer === expected ? "correct" : "wrong");
    if (settingsRef.current.mode === "self-paced") {
      if (index >= settingsRef.current.total - 1) clock.finish();
      if (settingsRef.current.trainingType === "cards") {
        // Close during the existing answer-feedback window. Do not replace a
        // visible face with the next card or add another delay after feedback.
        timers.schedule("stimulus", () => setVisible(false), 450 - CARD_FLIP_DURATION_MS);
      }
      timers.schedule("trial", () => finalizeRef.current(), 450);
    }
  }, [clock, setVisible, timers]);

  const advanceWarmup = useCallback(() => {
    if (
      phaseRef.current === "playing"
      && settingsRef.current.mode === "self-paced"
      && roundRef.current < settingsRef.current.n
      && !warmupAdvancingRef.current
    ) {
      if (soundEnabledRef.current) playFeedbackSound("advance");
      if (settingsRef.current.trainingType === "cards") {
        warmupAdvancingRef.current = true;
        setRoundTransitioning(true);
        setVisible(false);
        timers.schedule("trial", () => finalizeRef.current(), CARD_FLIP_DURATION_MS);
      } else finalizeRef.current();
    }
  }, [setVisible, timers]);

  const optionClass = (id: MatchType) => {
    if (!selected) return "";
    if (selected === id) return selected === correctAnswer ? "is-correct" : "is-wrong";
    if (correctAnswer === id) return "is-answer";
    return "";
  };

  const goHome = useCallback(() => {
    timers.clearAll();
    warmupAdvancingRef.current = false;
    setRoundTransitioning(false);
    statsRef.current = EMPTY_STATS;
    responseRef.current = null;
    roundRef.current = -1;
    phaseRef.current = "idle";
    setPhase("idle");
    setRound(-1);
    setCurrent(null);
    setVisible(false);
    setSelected(null);
    setCorrectAnswer(null);
    setStats(EMPTY_STATS);
    setElapsedMs(0);
    setCountdownExiting(false);
  }, [setVisible, timers]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (inputBlocked || shouldIgnoreGameKey(event)) return;
      // Enter/Space activate the focused control; a global mapping must not steal that action.
      if ((event.key === "Enter" || event.key === " ") && event.target instanceof Element
        && event.target.closest("button, a[href], [role='button']")) return;
      if (settingsRef.current.trainingType !== "grid" && settingsRef.current.trainingType !== "cards") return;
      if (phaseRef.current === "idle" || phaseRef.current === "finished") return;
      const key = event.key.toLowerCase();
      if (key === "escape") {
        event.preventDefault();
        togglePause();
        return;
      }
      const pressedKey = normalizeShortcutKey(event.key);
      if (!pressedKey) return;
      const option = OPTIONS.find((item) => shortcutKeysRef.current[item.id] === pressedKey);
      if (option) {
        if (phaseRef.current !== "playing" || roundRef.current < settingsRef.current.n) return;
        event.preventDefault();
        respond(option.id);
        return;
      }
      if (pressedKey === shortcutKeysRef.current.advance && settingsRef.current.mode === "self-paced") {
        if (phaseRef.current !== "playing" || roundRef.current >= settingsRef.current.n) return;
        event.preventDefault();
        advanceWarmup();
        return;
      }
      if (key === "p") { event.preventDefault(); togglePause(); }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [advanceWarmup, inputBlocked, respond, togglePause]);

  return {
    phase,
    round,
    current,
    stimulusVisible,
    countdown,
    countdownExiting,
    selected,
    stats,
    elapsedMs,
    roundTransitioning,
    beginCountdown,
    completeCountdown,
    pauseGame,
    resumeGame,
    togglePause,
    respond,
    advanceWarmup,
    optionClass,
    goHome,
  };
}
