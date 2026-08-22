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
import { playFeedbackSound } from "./sound";
import { usePausableTimers } from "./usePausableTimers";

type RunningPhase = "countdown" | "playing";

export function useGameController(settings: GameSettings, soundEnabled: boolean, inputBlocked = false) {
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

  const settingsRef = useRef(settings);
  const soundEnabledRef = useRef(soundEnabled);
  const sequenceRef = useRef<Trial[]>([]);
  const phaseRef = useRef<Phase>(phase);
  const phaseBeforePauseRef = useRef<RunningPhase>("playing");
  const roundRef = useRef(-1);
  const responseRef = useRef<MatchType | null>(null);
  const statsRef = useRef<Stats>(EMPTY_STATS);
  const stimulusVisibleRef = useRef(false);
  const finalizeRef = useRef<() => void>(() => undefined);
  const countdownStepRef = useRef<() => void>(() => undefined);
  const countdownRemainingRef = useRef(3);
  const sessionStartedAtRef = useRef(0);
  const sessionEndedAtRef = useRef(0);
  const pauseStartedAtRef = useRef(0);
  const pausedDurationRef = useRef(0);
  const timers = usePausableTimers();

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const setVisible = useCallback((visible: boolean) => {
    stimulusVisibleRef.current = visible;
    setStimulusVisible(visible);
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
    setVisible(true);

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
    const endedAt = sessionEndedAtRef.current || Date.now();
    setElapsedMs(Math.max(0, endedAt - sessionStartedAtRef.current - pausedDurationRef.current));
  }, [setVisible, timers]);

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
    sessionStartedAtRef.current = Date.now();
    sessionEndedAtRef.current = 0;
    pausedDurationRef.current = 0;
    pauseStartedAtRef.current = 0;
    startTrial(0);
  }, [startTrial, timers]);

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
    timers.pauseAll();
    phaseRef.current = "paused";
    setPhase("paused");
    if (phaseBeforePauseRef.current === "playing") setStimulusVisible(false);
    pauseStartedAtRef.current = Date.now();
    return true;
  }, [timers]);

  const resumeGame = useCallback(() => {
    if (phaseRef.current !== "paused") return;
    if (pauseStartedAtRef.current && phaseBeforePauseRef.current === "playing") {
      pausedDurationRef.current += Date.now() - pauseStartedAtRef.current;
    }
    pauseStartedAtRef.current = 0;
    phaseRef.current = phaseBeforePauseRef.current;
    setPhase(phaseBeforePauseRef.current);
    if (phaseBeforePauseRef.current === "playing") setStimulusVisible(stimulusVisibleRef.current);
    timers.resumeAll();
  }, [timers]);

  const togglePause = useCallback(() => {
    if (phaseRef.current === "paused") resumeGame();
    else pauseGame();
  }, [pauseGame, resumeGame]);

  const respond = useCallback((answer: MatchType) => {
    if (phaseRef.current !== "playing" || responseRef.current !== null) return;
    const index = roundRef.current;
    const n = settingsRef.current.n;
    if (index < n) return;

    const expected = classify(sequenceRef.current[index], sequenceRef.current[index - n]);
    responseRef.current = answer;
    setSelected(answer);
    setCorrectAnswer(expected);
    if (soundEnabledRef.current) playFeedbackSound(answer === expected ? "correct" : "wrong");
    if (settingsRef.current.mode === "self-paced") {
      if (index >= settingsRef.current.total - 1) sessionEndedAtRef.current = Date.now();
      timers.schedule("trial", () => finalizeRef.current(), 450);
    }
  }, [timers]);

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

  const goHome = useCallback(() => {
    timers.clearAll();
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
      if (event.repeat || inputBlocked) return;
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
