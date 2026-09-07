"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MouseEvent, PointerEvent } from "react";
import type { GameSettings, ReactionPhase } from "./core";
import type { ReactionSessionResult } from "./leaderboard";
import { shouldIgnoreGameKey } from "./keyboard";
import { playFeedbackSound } from "./sound";
import { usePausableTimers } from "./usePausableTimers";
import { useSessionClock } from "./useSessionClock";

const MIN_WAIT_MS = 1400;
const WAIT_SPREAD_MS = 2200;
const FEEDBACK_MS = 720;
const average = (values: number[]) => values.length === 0 ? 0 : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

export function useReactionGame({settings, soundEnabled, paused, onSessionActiveChange, onSessionFinished}: {
  settings: GameSettings;
  soundEnabled: boolean;
  paused: boolean;
  onSessionActiveChange: (active: boolean) => void;
  onSessionFinished: (result: ReactionSessionResult) => void;
}) {
  const [phase, setPhase] = useState<ReactionPhase>("idle");
  const [round, setRound] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const [falseStarts, setFalseStarts] = useState(0);
  const [feedbackMs, setFeedbackMs] = useState<number | null>(null);
  const phaseRef = useRef<ReactionPhase>("idle");
  const targetCommittedAt = useRef(0);
  const padRef = useRef<HTMLButtonElement>(null);
  const timers = usePausableTimers();
  const clock = useSessionClock();

  const changePhase = useCallback((next: ReactionPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  // Begin at the DOM commit, not in the timer that merely requests a React update.
  // The target changes instantly: no decorative transition participates in measurement.
  useLayoutEffect(() => {
    if (phase !== "target") return;
    targetCommittedAt.current = performance.now();
    clock.start();
    phaseRef.current = "target";
  }, [clock, phase]);

  const prepareRound = useCallback((roundIndex: number) => {
    timers.clear("main");
    setRound(roundIndex);
    setFeedbackMs(null);
    changePhase("waiting");
    timers.schedule("main", () => setPhase("target"), MIN_WAIT_MS + Math.random() * WAIT_SPREAD_MS);
  }, [changePhase, timers]);

  const beginTest = useCallback(() => {
    timers.clearAll();
    if (soundEnabled) playFeedbackSound("advance");
    setTimes([]);
    setFalseStarts(0);
    prepareRound(0);
  }, [prepareRound, soundEnabled, timers]);

  const activatePad = useCallback((eventTime?: number) => {
    if (paused || (phaseRef.current !== "waiting" && phaseRef.current !== "target")) return;
    const now = performance.now();
    const at = eventTime !== undefined && eventTime >= 0 && eventTime <= now ? eventTime : now;
    const tooEarly = phaseRef.current === "waiting" || at < targetCommittedAt.current;
    // Lock synchronously, including multiple input events before the next React render.
    changePhase("feedback");
    if (tooEarly) {
      timers.clear("main");
      setFalseStarts(count => count + 1);
      setFeedbackMs(null);
      if (soundEnabled) playFeedbackSound("wrong");
      timers.schedule("main", () => prepareRound(round), FEEDBACK_MS);
      return;
    }

    const reactionMs = Math.max(1, Math.round(clock.finish(at)));
    const completedTimes = [...times, reactionMs];
    setTimes(completedTimes);
    setFeedbackMs(reactionMs);
    if (soundEnabled) playFeedbackSound("correct");
    timers.schedule("main", () => {
      if (completedTimes.length >= settings.reactionRounds) {
        timers.clearAll();
        changePhase("finished");
        onSessionFinished({ rounds: completedTimes.length, averageMs: average(completedTimes), bestMs: Math.min(...completedTimes), falseStarts });
      } else prepareRound(round + 1);
    }, FEEDBACK_MS);
  }, [changePhase, clock, falseStarts, onSessionFinished, paused, prepareRound, round, settings.reactionRounds, soundEnabled, times, timers]);

  useLayoutEffect(() => {
    if (paused) { timers.pauseAll(); clock.pause(); }
    else { timers.resumeAll(); clock.resume(); }
  }, [clock, paused, timers]);

  useEffect(() => {
    if (phase === "idle" || phase === "finished" || paused) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== " " && event.key !== "Enter") return;
      const button = event.target instanceof Element ? event.target.closest("button") : null;
      if (button && button !== padRef.current) return;
      if (event.key === "Enter" && button !== padRef.current) return;
      if (shouldIgnoreGameKey(event)) {
        if (event.repeat && button === padRef.current) event.preventDefault();
        return;
      }
      event.preventDefault();
      activatePad(event.timeStamp);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activatePad, paused, phase]);

  useEffect(() => { onSessionActiveChange(phase !== "idle"); }, [onSessionActiveChange, phase]);
  useEffect(() => () => onSessionActiveChange(false), [onSessionActiveChange]);

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button === 0 && event.isPrimary !== false) activatePad(event.timeStamp);
  };
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail === 0) activatePad(event.timeStamp);
  };
  const averageMs = average(times);
  const bestMs = times.length > 0 ? Math.min(...times) : 0;
  const status = phase === "waiting" ? "等待变色" : phase === "target" ? "现在点击" : feedbackMs === null ? "太早了" : `${feedbackMs} ms`;

  return { phase, round, times, falseStarts, feedbackMs, averageMs, bestMs, status, beginTest, handlePointerDown, handleClick, padRef };
}
