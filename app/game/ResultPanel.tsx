import type { CSSProperties, ReactNode } from "react";

export function ResultPanel({label, score, unit = "%", scoreLabel, config, time, metrics, note, retryLabel, onRetry, onEditSettings, onOpenLeaderboard}: {
  label: string;
  score: number;
  unit?: "%" | "ms";
  scoreLabel: string;
  config: ReactNode;
  time?: { label: string; value: string };
  metrics?: ReactNode;
  note?: ReactNode;
  retryLabel: string;
  onRetry: () => void;
  onEditSettings: () => void;
  onOpenLeaderboard: () => void;
}) {
  const reaction = unit === "ms";
  return (
    <section className={`result-panel${reaction ? " reaction-result-panel" : ""}`} aria-label={label}>
      <div className={`score-ring${reaction ? " reaction-score-ring" : ""}`} style={reaction ? undefined : { "--score": `${score * 3.6}deg` } as CSSProperties}>
        <div><strong>{score}</strong><span>{unit}</span><small>{scoreLabel}</small></div>
      </div>
      <div className="result-copy">
        <div className="result-config" aria-label="本轮训练设置">{config}</div>
        {time && <div className="result-time"><small>{time.label}</small><strong>{time.value}</strong></div>}
        {metrics && <div className="result-metrics">{metrics}</div>}
        {note && <p className="result-note">{note}</p>}
        <div className="result-actions">
          <button className="secondary-button" onClick={onRetry}>{retryLabel}</button>
          <button className="primary-button" onClick={onEditSettings}>修改设置 <span>→</span></button>
        </div>
        <button type="button" className="result-leaderboard-link" onClick={onOpenLeaderboard}>查看历史最佳 <span>→</span></button>
      </div>
    </section>
  );
}
