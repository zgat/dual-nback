"use client";

import { useState } from "react";
import { PRESET_INTERVALS, formatDuration } from "./core";
import type { GameMode } from "./core";
import { rankFlipEntries } from "./leaderboard";
import type { HistoryGameType, LeaderboardData, NBackTrainingType } from "./leaderboard";
import { ModalFrame } from "./ModalFrame";

type LeaderboardModalProps = {
  data: LeaderboardData;
  initialTrainingType: HistoryGameType;
  initialMode: GameMode;
  onClose: () => void;
};

export function LeaderboardModal({ data, initialTrainingType, initialMode, onClose }: LeaderboardModalProps) {
  const [trainingType, setTrainingType] = useState(initialTrainingType);
  const [mode, setMode] = useState(initialMode);
  const isFlip = trainingType === "flip";
  const nBackType: NBackTrainingType = trainingType === "cards" ? "cards" : "grid";
  const timedEntries = data.timed[nBackType];
  const flipEntries = rankFlipEntries(data.flip);

  return (
    <ModalFrame eyebrow="LOCAL TOP 10" title="历史最佳" className="leaderboard-panel" closeLabel="关闭历史最佳" onClose={onClose}>
      <div className={`segmented-slider leaderboard-game-switch is-${trainingType}`} role="tablist" aria-label="切换历史最佳游戏">
        <button type="button" role="tab" aria-selected={trainingType === "grid"} onClick={() => setTrainingType("grid")}>彩色方格</button>
        <button type="button" role="tab" aria-selected={trainingType === "cards"} onClick={() => setTrainingType("cards")}>扑克牌</button>
        <button type="button" role="tab" aria-selected={isFlip} onClick={() => setTrainingType("flip")}>翻牌记忆</button>
      </div>

      <div className="leaderboard-list" aria-live="polite">
        {isFlip ? (
          flipEntries.length > 0 ? (
            <ol className="timed-ranking flip-ranking">
              {flipEntries.map((entry, index) => (
                <li key={entry.id}>
                  <b className="rank-number">{index + 1}</b>
                  <span className="rank-result">
                    <strong>{entry.cardCount} 张牌</strong>
                    <small>{entry.rounds} 轮 · {entry.difficulty === "moving" ? "移动进阶" : "经典模式"} · 全对</small>
                  </span>
                  <time>{formatDuration(entry.elapsedMs)}</time>
                </li>
              ))}
            </ol>
          ) : (
            <div className="leaderboard-empty"><b>暂无全对记录</b><span>完成一次无误点的翻牌记忆后显示</span></div>
          )
        ) : mode === "self-paced" ? (
          timedEntries.length > 0 ? (
            <ol className="timed-ranking">
              {timedEntries.map((entry, index) => (
                <li key={entry.id}>
                  <b className="rank-number">{index + 1}</b>
                  <span className="rank-result">
                    <strong>{entry.accuracy}%</strong>
                    <small>
                      {entry.totalRounds} 轮 · {entry.n}-BACK · {entry.correct}/{entry.attempts}
                      {nBackType === "grid" ? ` · ${entry.cellCount}格/${entry.colorCount}色` : ""}
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
                <span><b>{(interval / 1000).toFixed(1)}</b> 秒 · 固定 30 轮</span>
                <strong>成功 {data.challenge[nBackType][String(interval)] ?? 0} 次</strong>
              </li>
            ))}
          </ul>
        )}
      </div>

      {isFlip ? (
        <p className="leaderboard-rule-note">仅保留最近 10 次全对记录，牌数优先，其次比较用时。</p>
      ) : (
        <div className={`segmented-slider leaderboard-mode-switch is-${mode}`} role="tablist" aria-label="切换历史最佳模式">
          <button type="button" role="tab" aria-selected={mode === "self-paced"} onClick={() => setMode("self-paced")}>计时</button>
          <button type="button" role="tab" aria-selected={mode === "challenge"} onClick={() => setMode("challenge")}>挑战</button>
        </div>
      )}
      <p className="leaderboard-device-note">仅记录当前设备</p>
    </ModalFrame>
  );
}
