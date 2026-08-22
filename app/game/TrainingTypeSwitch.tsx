"use client";

import type { TrainingType } from "./core";

const TRAINING_TYPES: Array<{ id: TrainingType; icon: string; label: string }> = [
  { id: "grid", icon: "▦", label: "彩色方格" },
  { id: "cards", icon: "♠", label: "扑克 N-Back" },
  { id: "flip", icon: "▤", label: "翻牌记忆" },
];

export function TrainingTypeSwitch({ selected, onSelect }: {
  selected: TrainingType;
  onSelect: (trainingType: TrainingType) => void;
}) {
  return (
    <div className="idle-switches">
      <div className="training-switch three-options" role="group" aria-label="选择训练内容">
        {TRAINING_TYPES.map((trainingType) => (
          <button
            className={selected === trainingType.id ? "is-selected" : ""}
            onClick={() => onSelect(trainingType.id)}
            aria-pressed={selected === trainingType.id}
            key={trainingType.id}
          >
            <span aria-hidden="true">{trainingType.icon}</span> {trainingType.label}
          </button>
        ))}
      </div>
    </div>
  );
}
