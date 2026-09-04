"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent, PointerEvent } from "react";
import type { GameSettings, ReactionPhase, TrainingType } from "./core";
import { GameHome } from "./GameHome";
import type { ReactionSessionResult } from "./leaderboard";
import { playFeedbackSound } from "./sound";
import { usePausableTimers } from "./usePausableTimers";

const MIN_WAIT_MS = 1400;
const WAIT_SPREAD_MS = 2200;
const FEEDBACK_MS = 720;

type ReactionGameProps = {
  settings: GameSettings;
  onSelectTrainingType: (trainingType: TrainingType) => void;
  onUpdateSettings: (patch: Partial<GameSettings>) => void;
  onEditSettings: () => void;
  onSessionActiveChange: (active: boolean) => void;
  onSessionFinished: (result: ReactionSessionResult) => void;
  onOpenLeaderboard: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  paused: boolean;
  homeSettingsOpen: boolean;
  homeSettingsHeight: number;
  onHomeSettingsOpenChange: (open: boolean) => void;
  onHomeSettingsHeightChange: (height: number) => void;
};

function average(values: number[]) {
  return values.length === 0 ? 0 : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function ReactionGame({
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
}: ReactionGameProps) {
  const [phase, setPhase] = useState<ReactionPhase>("idle");
  const [round, setRound] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const [falseStarts, setFalseStarts] = useState(0);
  const [feedbackMs, setFeedbackMs] = useState<number | null>(null);
  const targetShownAtRef = useRef(0);
  const pausedAtRef = useRef(0);
  const timers = usePausableTimers();

  const showTarget = useCallback(() => {
    targetShownAtRef.current = performance.now();
    setPhase("target");
  }, []);

  const prepareRound = useCallback((roundIndex: number) => {
    timers.clear("main");
    setRound(roundIndex);
    setFeedbackMs(null);
    setPhase("waiting");
    timers.schedule("main", showTarget, MIN_WAIT_MS + Math.random() * WAIT_SPREAD_MS);
  }, [showTarget, timers]);

  const beginTest = useCallback(() => {
    if (soundEnabled) playFeedbackSound("advance");
    setTimes([]);
    setFalseStarts(0);
    prepareRound(0);
  }, [prepareRound, soundEnabled]);

  const finishTest = useCallback((completedTimes: number[], completedFalseStarts: number) => {
    timers.clearAll();
    setPhase("finished");
    onSessionFinished({
      rounds: completedTimes.length,
      averageMs: average(completedTimes),
      bestMs: Math.min(...completedTimes),
      falseStarts: completedFalseStarts,
    });
  }, [onSessionFinished, timers]);

  const activatePad = useCallback(() => {
    if (paused || phase === "feedback" || phase === "idle" || phase === "finished") return;

    if (phase === "waiting") {
      const nextFalseStarts = falseStarts + 1;
      timers.clear("main");
      setFalseStarts(nextFalseStarts);
      setFeedbackMs(null);
      setPhase("feedback");
      if (soundEnabled) playFeedbackSound("wrong");
      timers.schedule("main", () => prepareRound(round), FEEDBACK_MS);
      return;
    }

    const reactionMs = Math.max(1, Math.round(performance.now() - targetShownAtRef.current));
    const completedTimes = [...times, reactionMs];
    setTimes(completedTimes);
    setFeedbackMs(reactionMs);
    setPhase("feedback");
    if (soundEnabled) playFeedbackSound("correct");
    timers.schedule("main", () => {
      if (completedTimes.length >= settings.reactionRounds) finishTest(completedTimes, falseStarts);
      else prepareRound(round + 1);
    }, FEEDBACK_MS);
  }, [falseStarts, finishTest, paused, phase, prepareRound, round, settings.reactionRounds, soundEnabled, times, timers]);

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    activatePad();
  };

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail === 0) activatePad();
  };

  useEffect(() => {
    if (paused) {
      timers.pauseAll();
      if (phase === "target" && !pausedAtRef.current) pausedAtRef.current = performance.now();
    } else {
      if (phase === "target" && pausedAtRef.current) {
        targetShownAtRef.current += performance.now() - pausedAtRef.current;
      }
      pausedAtRef.current = 0;
      timers.resumeAll();
    }
  }, [paused, phase, timers]);

  useEffect(() => {
    onSessionActiveChange(phase !== "idle");
  }, [onSessionActiveChange, phase]);

  useEffect(() => () => onSessionActiveChange(false), [onSessionActiveChange]);

  const averageMs = average(times);
  const bestMs = times.length > 0 ? Math.min(...times) : 0;
  const status = phase === "waiting"
    ? "等待变色"
    : phase === "target"
      ? "现在点击"
      : feedbackMs === null
        ? "太早了"
        : `${feedbackMs} ms`;

  if (phase === "finished") {
    return (
      <div className="reaction-game reaction-phase-finished">
        <div className="stage-heading">
          <span className="eyebrow">反应力测试 · {settings.reactionRounds} 轮</span>
          <h1>测试完成</h1>
        </div>
        <section className="result-panel reaction-result-panel" aria-label="反应力测试结果">
          <div className="score-ring reaction-score-ring">
            <div><strong>{averageMs}</strong><span>ms</span><small>平均反应</small></div>
          </div>
          <div className="result-copy">
            <div className="result-config">
              <span><b>{times.length}</b> 轮测试</span>
              <span><b>{falseStarts}</b> 次误触</span>
            </div>
            <div className="result-time"><small>最快反应</small><strong>{bestMs} ms</strong></div>
            <p className="result-note">仅统计目标变为橙色后的有效点击。</p>
            <div className="result-actions">
              <button className="secondary-button" onClick={beginTest}>再测一次</button>
              <button className="primary-button" onClick={onEditSettings}>修改设置 <span>→</span></button>
            </div>
            <button type="button" className="result-leaderboard-link" onClick={onOpenLeaderboard}>查看历史最佳 <span>→</span></button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={`reaction-game reaction-phase-${phase}`}>
      {phase === "idle" ? (
        <GameHome
          eyebrow={`反应力测试 · ${settings.reactionRounds} 轮`}
          title="看到橙色立即点击"
          description="等待目标变色后尽快点击，提前点击会记为误触。"
          introVisual={<span className="reaction-legend" />}
          settings={settings}
          startLabel="开始测试"
          onStart={beginTest}
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
          <div className="reaction-progress" aria-label={`第 ${round + 1} 轮，共 ${settings.reactionRounds} 轮`}>
            <span>第 {round + 1} / {settings.reactionRounds} 轮</span>
            <span>平均 {averageMs || "—"}{averageMs ? " ms" : ""}</span>
          </div>
          <button
            type="button"
            className={`reaction-pad is-${phase} ${paused ? "is-paused" : ""}`}
            onPointerDown={handlePointerDown}
            onClick={handleClick}
            aria-label={phase === "target" ? "目标已出现，立即点击" : phase === "waiting" ? "等待目标出现" : status}
          >
            <span className="reaction-target" aria-hidden="true" />
            <strong>{paused ? "已暂停" : status}</strong>
            <small>{phase === "waiting" ? "保持专注，不要预判" : phase === "target" ? "点击屏幕或按空格" : feedbackMs === null ? "本轮重新等待" : "准备下一轮"}</small>
          </button>
          <button className="start-button pause-button flip-restart" onClick={beginTest}><span aria-hidden="true">↻</span> 重新开始</button>
        </>
      )}
    </div>
  );
}
