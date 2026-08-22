type SoundToggleProps = {
  enabled: boolean;
  onToggle: () => void;
  variant?: "compact" | "panel";
};

export function SoundToggle({ enabled, onToggle, variant = "compact" }: SoundToggleProps) {
  return (
    <button
      type="button"
      className={`sound-toggle sound-toggle-${variant}`}
      role="switch"
      aria-checked={enabled}
      aria-label={`音效，当前${enabled ? "开启" : "关闭"}`}
      onClick={onToggle}
    >
      {variant === "compact" && <span className="sound-toggle-copy"><b>音效</b></span>}
      <span className="sound-toggle-state">{enabled ? "开" : "关"}</span>
      <span className="sound-toggle-track" aria-hidden="true"><i /></span>
    </button>
  );
}
