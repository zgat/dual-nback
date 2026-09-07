"use client";

import { ResultPanel } from "./ResultPanel";

import type { GameSettings, TrainingType } from "./core";
import { GameHome } from "./GameHome";
import type { ReactionSessionResult } from "./leaderboard";
import { useReactionGame } from "./useReactionGame";

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
  const {phase, round, times, falseStarts, feedbackMs, averageMs, bestMs, status, beginTest, handlePointerDown, handleClick, padRef} = useReactionGame({settings, soundEnabled, paused, onSessionActiveChange, onSessionFinished});

  if (phase === "finished") {
    return (
      <div className="reaction-game reaction-phase-finished">
        <div className="stage-heading">
          <span className="eyebrow">反应力测试 · {settings.reactionRounds} 轮</span>
          <h1>测试完成</h1>
        </div>
        <ResultPanel
          label="反应力测试结果" score={averageMs} unit="ms" scoreLabel="平均反应"
          config={<><span><b>{times.length}</b> 轮测试</span><span><b>{falseStarts}</b> 次误触</span></>}
          time={{label: "最快反应", value: String(bestMs) + " ms"}}
          note="仅统计目标变为橙色后的有效点击。"
          retryLabel="再测一次" onRetry={beginTest} onEditSettings={onEditSettings} onOpenLeaderboard={onOpenLeaderboard}
        />
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
            ref={padRef}
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
