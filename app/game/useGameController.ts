"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_SETTINGS,
  EMPTY_STATS,
  OPTIONS,
  classify,
  makeSequence,
  normalizeSettings,
  scorePercent,
} from "./core";
import type { GameMode, GameSettings, MatchType, Phase, Stats, TrainingType, Trial } from "./core";

export function useGameController() {
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
  const [flipSessionActive, setFlipSessionActive] = useState(false);
  const [flipSessionKey, setFlipSessionKey] = useState(0);

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

  const finalizeTrial = useCallback(() => {
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

    if (index >= settingsRef.current.total - 1) finishSession(nextStats);
    else startTrial(index + 1);
  }, [finishSession, startTrial]);

  useEffect(() => {
    finalizeRef.current = finalizeTrial;
  }, [finalizeTrial]);

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
    if (settingsRef.current.trainingType === "flip" && flipSessionActive) {
      setFlipSessionKey((value) => value + 1);
      setFlipSessionActive(false);
    }
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
    if (phaseRef.current !== "idle") {
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

  const goHome = () => {
    if (phaseRef.current === "playing") return;
    clearTimers();
    phaseRef.current = "idle";
    setPhase("idle");
    setRound(-1);
    setCurrent(null);
    setStimulusVisible(false);
    if (flipSessionActive) {
      setFlipSessionKey((value) => value + 1);
      setFlipSessionActive(false);
    }
  };

  useEffect(() => {
    const hydrateTimer = window.setTimeout(() => {
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
    }, 0);
    return () => window.clearTimeout(hydrateTimer);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (showSettings) {
        if (event.key === "Escape") setShowSettings(false);
        return;
      }
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

  useEffect(() => clearTimers, [clearTimers]);

  return {
    settings,
    draftSettings,
    setDraftSettings,
    phase,
    round,
    current,
    stimulusVisible,
    countdown,
    selected,
    stats,
    bestScore,
    elapsedMs,
    showSettings,
    setShowSettings,
    flipSessionActive,
    setFlipSessionActive,
    flipSessionKey,
    beginCountdown,
    togglePause,
    respond,
    advanceWarmup,
    optionClass,
    openSettings,
    saveSettings,
    selectMode,
    selectTrainingType,
    levelUp,
    goHome,
  };
}
