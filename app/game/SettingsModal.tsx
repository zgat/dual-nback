"use client";

import { SoundToggle } from "./SoundToggle";

type SettingsModalProps = {
  soundEnabled: boolean;
  onToggleSound: () => void;
  onClose: () => void;
};

export function SettingsModal({ soundEnabled, onToggleSound, onClose }: SettingsModalProps) {
  return (
    <div className="modal-backdrop">
      <button className="modal-dismiss" onClick={onClose} aria-label="关闭偏好设置" tabIndex={-1} />
      <section className="settings-panel preferences-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="settings-header">
          <div><span className="eyebrow">VERSION 2.0</span><h2 id="settings-title">偏好设置</h2></div>
          <button className="close-button" onClick={onClose} aria-label="关闭设置">×</button>
        </div>

        <div className="preference-card">
          <div className="preference-copy">
            <b>作答音效</b>
            <p>正确时播放轻快提示，错误时播放低沉提示。</p>
          </div>
          <SoundToggle enabled={soundEnabled} onToggle={onToggleSound} variant="panel" />
        </div>

        <button className="start-button" onClick={onClose}>完成</button>
      </section>
    </div>
  );
}
