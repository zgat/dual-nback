"use client";

import { useState } from "react";
import { PRESET_INTERVALS, formatDuration } from "./core";
import type { FlipDifficulty, GameMode } from "./core";
import { rankFlipEntries } from "./leaderboard";
import type { HistoryGameType, LeaderboardData, NBackTrainingType } from "./leaderboard";
import { ModalFrame } from "./ModalFrame";

type LeaderboardModalProps = {
  data: LeaderboardData;
  initialTrainingType: HistoryGameType;
  initialMode: GameMode;
  initialFlipDifficulty: FlipDifficulty;
  onClose: () => void;
};

export function LeaderboardModal({ data, initialTrainingType, initialMode, initialFlipDifficulty, onClose }: LeaderboardModalProps) {
  const [trainingType, setTrainingType] = useState(initialTrainingType);
  const [mode, setMode] = useState(initialMode);
  const [flipDifficulty, setFlipDifficulty] = useState(initialFlipDifficulty);
  const isFlip = trainingType === "flip";
  const nBackType: NBackTrainingType = trainingType === "cards" ? "cards" : "grid";
  const timedEntries = data.timed[nBackType];
  const flipEntries = rankFlipEntries(data.flip[flipDifficulty]);
  const ruleNote = isFlip
    ? "经典与移动分别保留最佳 10 次，依次比较正确率、轮数和用时。"
    : mode === "challenge"
      ? "仅记录挑战成功的次数。"
      : null;

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
                    <strong>{entry.accuracy}%</strong>
                    <small>{entry.cardCount} 张牌</small>
                  </span>
                  <span className="rank-rounds" aria-label={`${entry.rounds} 轮`}>
                    <strong>{entry.rounds}</strong>
                    <small>轮</small>
                  </span>
                  <time>{formatDuration(entry.elapsedMs)}</time>
                </li>
              ))}
            </ol>
          ) : (
            <div className="leaderboard-empty"><b>暂无训练记录</b><span>完成一次翻牌记忆后显示</span></div>
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
                      {nBackType === "grid"
                        ? `${entry.cellCount}格 · ${entry.colorCount}色 · ${entry.n}-BACK`
                        : `${entry.cellCount}点 · ${entry.colorCount}花色 · ${entry.n}-BACK`}
                    </small>
                  </span>
                  <span className="rank-rounds" aria-label={`${entry.totalRounds} 轮`}>
                    <strong>{entry.totalRounds}</strong>
                    <small>轮</small>
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

      <div className="leaderboard-footer">
        {isFlip ? (
          <div className={`segmented-slider leaderboard-mode-switch leaderboard-flip-mode-switch is-${flipDifficulty}`} role="tablist" aria-label="切换翻牌记忆模式">
            <button type="button" role="tab" aria-selected={flipDifficulty === "classic"} onClick={() => setFlipDifficulty("classic")}>经典</button>
            <button type="button" role="tab" aria-selected={flipDifficulty === "moving"} onClick={() => setFlipDifficulty("moving")}>移动</button>
          </div>
        ) : (
          <div className={`segmented-slider leaderboard-mode-switch is-${mode}`} role="tablist" aria-label="切换历史最佳模式">
            <button type="button" role="tab" aria-selected={mode === "self-paced"} onClick={() => setMode("self-paced")}>计时</button>
            <button type="button" role="tab" aria-selected={mode === "challenge"} onClick={() => setMode("challenge")}>挑战</button>
          </div>
        )}
        <p className={`leaderboard-rule-note ${ruleNote ? "" : "is-placeholder"}`} aria-hidden={!ruleNote}>
          {ruleNote ?? "\u00a0"}
        </p>
        <p className="leaderboard-device-note">仅记录当前设备</p>
      </div>
    </ModalFrame>
  );
}
