"use client";

import { useState } from "react";
import { FLIP_CARD_COUNTS, PRESET_INTERVALS, formatDuration } from "./core";
import type { FlipDifficulty, GameMode } from "./core";
import { rankFlipEntries, rankReactionEntries } from "./leaderboard";
import type { HistoryGameType, LeaderboardData, NBackTrainingType } from "./leaderboard";
import { ModalFrame } from "./ModalFrame";
import { TransitionSurface } from "./TransitionSurface";

type LeaderboardModalProps = {
  data: LeaderboardData;
  initialTrainingType: HistoryGameType;
  initialNBackMode: GameMode;
  initialFlipMode: GameMode;
  initialFlipDifficulty: FlipDifficulty;
  onClose: () => void;
  exiting?: boolean;
};

function HistoryDate({ createdAt }: { createdAt: number }) {
  const date = new Date(createdAt);
  const pad = (value: number) => String(value).padStart(2, "0");
  const calendarDate = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const clockTime = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return (
    <time dateTime={date.toISOString()} aria-label={`${calendarDate} ${clockTime}`}>
      <span>{calendarDate}</span>
      <span>{clockTime}</span>
    </time>
  );
}

function HistoryTiming({ elapsedMs, createdAt }: { elapsedMs: number; createdAt: number }) {
  return <span className="rank-timing"><strong>{formatDuration(elapsedMs)}</strong><HistoryDate createdAt={createdAt} /></span>;
}

function ReactionTiming({ bestMs, createdAt }: { bestMs: number; createdAt: number }) {
  return <span className="rank-timing"><strong>最快 {bestMs} ms</strong><HistoryDate createdAt={createdAt} /></span>;
}

export function LeaderboardModal({ data, initialTrainingType, initialNBackMode, initialFlipMode, initialFlipDifficulty, onClose, exiting }: LeaderboardModalProps) {
  const [trainingType, setTrainingType] = useState(initialTrainingType);
  const [nBackMode, setNBackMode] = useState(initialNBackMode);
  const [flipMode, setFlipMode] = useState(initialFlipMode);
  const [flipDifficulty, setFlipDifficulty] = useState(initialFlipDifficulty);
  const isFlip = trainingType === "flip";
  const isReaction = trainingType === "reaction";
  const nBackType: NBackTrainingType = trainingType === "cards" ? "cards" : "grid";
  const timedEntries = data.timed[nBackType];
  const flipEntries = rankFlipEntries(data.flip["self-paced"][flipDifficulty]);
  const reactionEntries = rankReactionEntries(data.reaction);
  const ruleNote = isReaction
    ? "保留平均反应最快的 10 次；平均相同则依次比较误触、轮数和最快反应。"
    : isFlip
    ? flipMode === "self-paced"
      ? "计时模式保留最佳 10 次，依次比较正确率、轮数和用时。"
      : "挑战模式仅累计无误完成次数，经典与移动分别统计。"
    : nBackMode === "challenge"
      ? "仅记录挑战成功的次数。"
      : null;

  return (
    <ModalFrame eyebrow="LOCAL TOP 10" title="历史最佳" className="leaderboard-panel" closeLabel="关闭历史最佳" onClose={onClose} exiting={exiting}>
      <div className={`segmented-slider leaderboard-game-switch is-${trainingType}`} role="tablist" aria-label="切换历史最佳游戏">
        <button type="button" role="tab" aria-selected={trainingType === "grid"} onClick={() => setTrainingType("grid")}>彩色方格</button>
        <button type="button" role="tab" aria-selected={trainingType === "cards"} onClick={() => setTrainingType("cards")}>扑克牌</button>
        <button type="button" role="tab" aria-selected={isFlip} onClick={() => setTrainingType("flip")}>翻牌记忆</button>
        <button type="button" role="tab" aria-selected={isReaction} onClick={() => setTrainingType("reaction")}>反应力</button>
      </div>

      <div className="leaderboard-list" aria-live="polite">
        <TransitionSurface viewKey={`${trainingType}-${isFlip ? `${flipMode}-${flipDifficulty}` : nBackMode}`}>
        {isReaction ? (
          reactionEntries.length > 0 ? (
            <ol className="timed-ranking reaction-ranking">
              {reactionEntries.map((entry, index) => (
                <li key={entry.id}>
                  <b className="rank-number">{index + 1}</b>
                  <span className="rank-result">
                    <strong>{entry.averageMs} ms</strong>
                    <small>平均 · 误触 {entry.falseStarts} 次</small>
                  </span>
                  <span className="rank-rounds" aria-label={`${entry.rounds} 轮`}>
                    <strong>{entry.rounds}</strong>
                    <small>轮</small>
                  </span>
                  <ReactionTiming bestMs={entry.bestMs} createdAt={entry.createdAt} />
                </li>
              ))}
            </ol>
          ) : (
            <div className="leaderboard-empty"><b>暂无反应力记录</b><span>完成一次反应力测试后显示</span></div>
          )
        ) : isFlip ? (
          flipMode === "self-paced" ? (
            flipEntries.length > 0 ? (
              <ol className="timed-ranking flip-ranking">
                {flipEntries.map((entry, index) => (
                  <li key={entry.id}>
                    <b className="rank-number">{index + 1}</b>
                    <span className="rank-result">
                      <strong>{entry.accuracy}%</strong>
                      <small>{entry.cardCount} 张 · {entry.suitCount} 花色</small>
                    </span>
                    <span className="rank-rounds" aria-label={`${entry.rounds} 轮`}>
                      <strong>{entry.rounds}</strong>
                      <small>轮</small>
                    </span>
                    <HistoryTiming elapsedMs={entry.elapsedMs} createdAt={entry.createdAt} />
                  </li>
                ))}
              </ol>
            ) : (
              <div className="leaderboard-empty"><b>暂无计时记录</b><span>完成一次翻牌记忆计时训练后显示</span></div>
            )
          ) : (
            <ul className="challenge-ranking flip-challenge-ranking">
              {FLIP_CARD_COUNTS.map((cardCount) => (
                <li key={cardCount}>
                  <span><b>{cardCount}</b> 张牌</span>
                  <strong>成功 {data.flip.challenge[flipDifficulty][String(cardCount)] ?? 0} 次</strong>
                </li>
              ))}
            </ul>
          )
        ) : nBackMode === "self-paced" ? (
          timedEntries.length > 0 ? (
            <ol className="timed-ranking">
              {timedEntries.map((entry, index) => (
                <li key={entry.id}>
                  <b className="rank-number">{index + 1}</b>
                  <span className="rank-result">
                    <strong>{entry.accuracy}%</strong>
                    <small className="rank-config">
                      {nBackType === "grid" && (
                        <>
                          <span className="rank-config-dimensions">{entry.cellCount}格 · {entry.colorCount}色</span>
                          <span className="rank-config-separator" aria-hidden="true">·</span>
                        </>
                      )}
                      <span className="rank-config-nback">{entry.n}-BACK</span>
                    </small>
                  </span>
                  <span className="rank-rounds" aria-label={`${entry.totalRounds} 轮`}>
                    <strong>{entry.totalRounds}</strong>
                    <small>轮</small>
                  </span>
                  <HistoryTiming elapsedMs={entry.elapsedMs} createdAt={entry.createdAt} />
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
        </TransitionSurface>
      </div>

      <div className="leaderboard-footer">
        {isReaction ? null : isFlip ? (
          <div className="leaderboard-flip-filters">
            <div className={`segmented-slider leaderboard-mode-switch is-${flipMode}`} role="tablist" aria-label="切换翻牌记忆计时或挑战模式">
              <button type="button" role="tab" aria-selected={flipMode === "self-paced"} onClick={() => setFlipMode("self-paced")}>计时</button>
              <button type="button" role="tab" aria-selected={flipMode === "challenge"} onClick={() => setFlipMode("challenge")}>挑战</button>
            </div>
            <div className={`segmented-slider leaderboard-mode-switch leaderboard-flip-mode-switch is-${flipDifficulty}`} role="tablist" aria-label="切换翻牌记忆经典或移动难度">
              <button type="button" role="tab" aria-selected={flipDifficulty === "classic"} onClick={() => setFlipDifficulty("classic")}>经典</button>
              <button type="button" role="tab" aria-selected={flipDifficulty === "moving"} onClick={() => setFlipDifficulty("moving")}>移动</button>
            </div>
          </div>
        ) : (
          <div className={`segmented-slider leaderboard-mode-switch is-${nBackMode}`} role="tablist" aria-label="切换历史最佳模式">
            <button type="button" role="tab" aria-selected={nBackMode === "self-paced"} onClick={() => setNBackMode("self-paced")}>计时</button>
            <button type="button" role="tab" aria-selected={nBackMode === "challenge"} onClick={() => setNBackMode("challenge")}>挑战</button>
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
