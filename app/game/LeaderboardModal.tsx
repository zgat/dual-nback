"use client";

import { useState } from "react";
import { PRESET_INTERVALS, formatDuration } from "./core";
import type { GameMode } from "./core";
import type { LeaderboardData, NBackTrainingType } from "./leaderboard";
import { ModalFrame } from "./ModalFrame";

type LeaderboardModalProps = {
  data: LeaderboardData;
  initialTrainingType: NBackTrainingType;
  initialMode: GameMode;
  onClose: () => void;
};

export function LeaderboardModal({ data, initialTrainingType, initialMode, onClose }: LeaderboardModalProps) {
  const [trainingType, setTrainingType] = useState(initialTrainingType);
  const [mode, setMode] = useState(initialMode);
  const timedEntries = data.timed[trainingType];

  return (
    <ModalFrame eyebrow="LOCAL TOP 10" title="排行榜" className="leaderboard-panel" closeLabel="关闭排行榜" onClose={onClose}>
      <div className={`segmented-slider leaderboard-game-switch is-${trainingType}`} role="tablist" aria-label="切换排行榜游戏">
        <button type="button" role="tab" aria-selected={trainingType === "grid"} onClick={() => setTrainingType("grid")}>彩色方格</button>
        <button type="button" role="tab" aria-selected={trainingType === "cards"} onClick={() => setTrainingType("cards")}>扑克牌</button>
      </div>

      <div className="leaderboard-list" aria-live="polite">
        {mode === "self-paced" ? (
          timedEntries.length > 0 ? (
            <ol className="timed-ranking">
              {timedEntries.map((entry, index) => (
                <li key={entry.id}>
                  <b className="rank-number">{index + 1}</b>
                  <span className="rank-result">
                    <strong>{entry.accuracy}%</strong>
                    <small>
                      {entry.n}-BACK · {entry.correct}/{entry.attempts}
                      {trainingType === "grid" ? ` · ${entry.cellCount}格/${entry.colorCount}色` : ""}
                    </small>
                  </span>
                  <time>{formatDuration(entry.elapsedMs)}</time>
                </li>
              ))}
            </ol>
          ) : (
            <div className="leaderboard-empty"><b>暂无计时记录</b><span>完成一次计时模式训练后显示</span></div>
          )
        ) : (
          <ul className="challenge-ranking">
            {PRESET_INTERVALS.map((interval) => (
              <li key={interval}>
                <span><b>{(interval / 1000).toFixed(1)}</b> 秒</span>
                <strong>成功 {data.challenge[trainingType][String(interval)] ?? 0} 次</strong>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={`segmented-slider leaderboard-mode-switch is-${mode}`} role="tablist" aria-label="切换排行榜模式">
        <button type="button" role="tab" aria-selected={mode === "self-paced"} onClick={() => setMode("self-paced")}>计时</button>
        <button type="button" role="tab" aria-selected={mode === "challenge"} onClick={() => setMode("challenge")}>挑战</button>
      </div>
      <p className="leaderboard-device-note">仅记录当前设备</p>
    </ModalFrame>
  );
}
