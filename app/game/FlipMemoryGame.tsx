"use client";

import { ResultPanel } from "./ResultPanel";
import { AnimatedLabel } from "./AnimatedLabel";

import type { CSSProperties } from "react";
import { useState } from "react";
import { FLIP_CARD_GAP, FLIP_REVEAL_DURATION_MS, FLIP_SWAP_DURATION_MS, formatDuration } from "./core";
import type { FlipCard, GameSettings } from "./core";
import type { useFlipMemoryGame } from "./useFlipMemoryGame";

function FlipCardFace({ card }: { card: FlipCard }) {
  return (
    <span className={`flip-card-face ${card.suit.color === "red" ? "is-red" : ""}`}>
      <span className="flip-card-rank">{card.rank.name}</span>
      <span className="flip-card-suit">{card.suit.symbol}</span>
    </span>
  );
}

type FlipMemoryGameProps = {
  settings: GameSettings;
  game: ReturnType<typeof useFlipMemoryGame>;
  onEditSettings: () => void;
  onOpenLeaderboard: () => void;
  paused: boolean;
};

export function FlipMemoryGame({
  settings,
  game,
  onEditSettings,
  onOpenLeaderboard,
  paused,
}: FlipMemoryGameProps) {
  const [restartTurns, setRestartTurns] = useState(0);
  const restart = () => { setRestartTurns(turns => turns + 1); beginGame(); };
  const { timed, moving, cardCount, suitCount, flipConfig, targetCount, previewMs, flipPhase, round, cards, activeSwap, shuffleProgress, foundIds, mistakeIds, stats, elapsedMs, score, challengeSuccess, finishPreview, beginGame, advanceRound, chooseCard } = game;

  const showAllFaces = flipPhase === "revealing" || flipPhase === "preview" || flipPhase === "round-complete";
  const targets = cards.filter((card) => card.isTarget);
  const targetPromptVisible = flipPhase === "selecting" || flipPhase === "round-complete";
  const preparing = flipPhase === "dealing" || flipPhase === "revealing" || flipPhase === "covering";
  const actionLabel = flipPhase === "covering" ? "盖牌中…" : flipPhase === "revealing" ? "翻牌中…"
    : flipPhase === "dealing" ? "准备下一轮…" : flipPhase === "preview"
    ? timed ? "记住了，盖牌" : `记牌中 · ${flipConfig.previewSeconds} 秒`
    : flipPhase === "round-complete" ? round + 1 >= settings.flipRounds ? "查看结果" : "下一轮" : "重新开始";
  const actionDisabled = paused || preparing || (flipPhase === "preview" && !timed);
  const action = flipPhase === "preview" ? finishPreview : flipPhase === "round-complete" ? advanceRound : restart;

  if (flipPhase === "finished") {
    return (
      <div className={`flip-game flip-phase-${flipPhase} flip-count-${cardCount}`}>
        <div className="stage-heading flip-heading">
          <span className="eyebrow">翻牌记忆 · {timed ? "计时模式" : "挑战模式"} · {moving ? "移动" : "经典"}</span>
          <h1>{challengeSuccess ? "挑战成功" : "训练完成"}</h1>
        </div>
        <ResultPanel
          label="翻牌记忆结果" score={score} scoreLabel="选择正确率"
          config={<><span><b>{settings.flipRounds}</b> 轮训练</span><span><b>{cardCount}</b> 张 · {suitCount} 花色</span></>}
          time={{label: "总用时", value: formatDuration(elapsedMs)}}
          note={<>找对 {stats.found} 张 · 误点 {stats.mistakes} 张</>}
          retryLabel={timed ? "再练一轮" : "再次挑战"}
          onRetry={beginGame} onEditSettings={onEditSettings} onOpenLeaderboard={onOpenLeaderboard}
        />
      </div>
    );
  }

  return (
    <div className={`flip-game flip-phase-${flipPhase} flip-count-${cardCount}`} data-paused={paused} style={{ "--swap-duration": `${FLIP_SWAP_DURATION_MS}ms`, "--flip-reveal-duration": `${FLIP_REVEAL_DURATION_MS}ms` } as CSSProperties}>
      {flipPhase !== "idle" && (
        <>
            <div className="target-prompt" aria-label="本轮目标牌" aria-hidden={!targetPromptVisible} data-visible={targetPromptVisible}>
              <span>第 {round + 1} / {settings.flipRounds} 轮 · 剩余 <b>{Math.max(0, targetCount - foundIds.length)}</b></span>
              {targets.map((card) => (
                <span className={card.suit.color === "red" ? "is-red" : ""} key={card.id}>
                  {card.rank.name}{card.suit.symbol}
                  <i data-found={foundIds.includes(card.id)} aria-label={foundIds.includes(card.id) ? "已找到" : undefined} aria-hidden={!foundIds.includes(card.id)}>✓</i>
                </span>
              ))}
            </div>

          <div
            className={`flip-board ${cardCount >= 12 ? "is-dense" : ""} ${flipPhase === "shuffling" ? "is-shuffling" : ""}`}
            style={{ "--flip-columns": flipConfig.columns, "--flip-board-width": `${flipConfig.boardWidth}px` } as CSSProperties}
            aria-label={`${cardCount}张扑克牌记忆区`}
          >
            {cards.map((card, index) => {
              const found = foundIds.includes(card.id);
              const mistake = mistakeIds.includes(card.id);
              const faceUp = flipPhase !== "dealing" && (showAllFaces || found || mistake);
              const swapRole = activeSwap?.[0] === index ? "leading" : activeSwap?.[1] === index ? "trailing" : null;
              const destination = swapRole === "leading" ? activeSwap![1] : swapRole === "trailing" ? activeSwap![0] : index;
              const columnDelta = (destination % flipConfig.columns) - (index % flipConfig.columns);
              const rowDelta = Math.floor(destination / flipConfig.columns) - Math.floor(index / flipConfig.columns);
              const arcDirection = swapRole === "leading" ? -1 : 1;
              const arcX = -Math.sign(rowDelta) * 12 * arcDirection;
              const arcY = Math.sign(columnDelta) * 12 * arcDirection;
              return (
                <button
                  className={`memory-card ${faceUp ? "is-face-up" : "is-face-down"} ${found ? "is-found" : ""} ${mistake ? "is-mistake" : ""} ${swapRole ? `is-swapping is-swap-${swapRole}` : ""}`}
                  onClick={() => chooseCard(card)}
                  disabled={paused || flipPhase !== "selecting" || found || mistake}
                  aria-label={faceUp ? `${card.suit.name}${card.rank.name}${found ? "，目标牌" : mistake ? "，不是目标" : ""}` : "盖住的扑克牌"}
                  style={swapRole ? {
                    "--move-x": `calc(${columnDelta * 100}% + ${columnDelta * FLIP_CARD_GAP}px)`,
                    "--move-y": `calc(${rowDelta * 100}% + ${rowDelta * FLIP_CARD_GAP}px)`,
                    "--move-mid-x": `calc(${columnDelta * 50}% + ${columnDelta * FLIP_CARD_GAP * 0.5 + arcX}px)`,
                    "--move-mid-y": `calc(${rowDelta * 50}% + ${rowDelta * FLIP_CARD_GAP * 0.5 + arcY}px)`,
                  } as CSSProperties : undefined}
                  key={card.id}
                >
                  <span className="memory-card-inner" aria-hidden="true">
                    <FlipCardFace card={card} />
                    <span className="memory-card-back"><i>N²</i></span>
                  </span>
                </button>
              );
            })}
            {flipPhase === "shuffling" && (
              <div className="shuffle-overlay" aria-live="polite">
                换位 {shuffleProgress.current || 1} / {shuffleProgress.total}
              </div>
            )}
          </div>

          <div className="preview-timer" data-visible={flipPhase === "preview" && !timed} aria-hidden="true" style={{ "--preview-duration": `${previewMs}ms`, "--flip-board-width": `${flipConfig.boardWidth}px` } as CSSProperties}><i key={round} /></div>

          <button className={`start-button flip-action ${actionDisabled ? "is-muted" : ""}`} onClick={action} disabled={actionDisabled}>
            <AnimatedLabel text={actionLabel} />
            <span className="action-icon" aria-hidden="true">
              <span className="restart-icon" data-visible={actionLabel === "重新开始"} style={{transform: `rotate(${restartTurns * 360}deg)`}}>↻</span>
              <span data-visible={actionLabel !== "重新开始" && !actionDisabled}>→</span>
            </span>
          </button>
        </>
      )}
    </div>
  );
}
