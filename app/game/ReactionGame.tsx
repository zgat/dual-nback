"use client";

import { ResultPanel } from "./ResultPanel";
import { AnimatedLabel } from "./AnimatedLabel";

import type { GameSettings } from "./core";
import { useState } from "react";
import type { useReactionGame } from "./useReactionGame";

type ReactionGameProps = {
  settings: GameSettings;
  game: ReturnType<typeof useReactionGame>;
  onEditSettings: () => void;
  onOpenLeaderboard: () => void;
  paused: boolean;
};

export function ReactionGame({
  settings,
  game,
  onEditSettings,
  onOpenLeaderboard,
  paused,
}: ReactionGameProps) {
  const [restartTurns, setRestartTurns] = useState(0);
  const {phase, round, times, falseStarts, feedbackMs, averageMs, bestMs, status, beginTest, handlePointerDown, handleClick, padRef} = game;

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
      {phase !== "idle" && (
        <>
          <div className="reaction-progress" aria-label={`第 ${round + 1} 轮，共 ${settings.reactionRounds} 轮`}>
            <AnimatedLabel text={`第 ${round + 1} / ${settings.reactionRounds} 轮`} />
            <AnimatedLabel text={`平均 ${averageMs || "—"}${averageMs ? " ms" : ""}`} />
          </div>
          <button
            type="button"
            className={`reaction-pad is-${phase} ${phase === "feedback" && feedbackMs === null ? "is-false-start" : ""} ${paused ? "is-paused" : ""}`}
            ref={padRef}
            onPointerDown={handlePointerDown}
            onClick={handleClick}
            aria-label={phase === "target" ? "目标已出现，立即点击" : phase === "waiting" ? "等待目标出现" : status}
          >
            <span className="reaction-target" aria-hidden="true" />
            <strong key={phase === "feedback" ? `feedback-${falseStarts}-${times.length}` : "status"}>{paused ? "已暂停" : status}</strong>
            <small>{phase === "waiting" ? "保持专注，不要预判" : phase === "target" ? "点击屏幕或按空格" : feedbackMs === null ? "本轮重新等待" : "准备下一轮"}</small>
          </button>
          <button className="start-button pause-button flip-restart" disabled={paused} onClick={() => { setRestartTurns(turns => turns + 1); beginTest(); }}><span className="restart-icon" style={{transform: `rotate(${restartTurns * 360}deg)`}} aria-hidden="true">↻</span> 重新开始</button>
        </>
      )}
    </div>
  );
}
