"use client";

import { Capacitor } from "@capacitor/core";
import { useState } from "react";
import type { TrainingType } from "./core";
import { DonationPanel } from "./DonationPanel";
import { ModalFrame } from "./ModalFrame";
import { ShortcutSettings } from "./ShortcutSettings";
import type { ShortcutKeys } from "./shortcuts";
import { SoundToggle } from "./SoundToggle";
import { TransitionSurface } from "./TransitionSurface";
import { AnimatedLabel } from "./AnimatedLabel";

type SettingsModalProps = {
  soundEnabled: boolean;
  shortcutKeys: ShortcutKeys;
  trainingType: TrainingType;
  onToggleSound: () => void;
  onUpdateShortcutKeys: (keys: ShortcutKeys) => void;
  onClose: () => void;
  exiting?: boolean;
};

export function SettingsModal({
  soundEnabled,
  shortcutKeys,
  trainingType,
  onToggleSound,
  onUpdateShortcutKeys,
  onClose,
  exiting,
}: SettingsModalProps) {
  const [showDonation, setShowDonation] = useState(false);
  const showKeyboardShortcuts = !Capacitor.isNativePlatform()
    && (trainingType === "grid" || trainingType === "cards");

  return (
    <ModalFrame
      eyebrow={showDonation ? "DONATE" : "VERSION 2.2.5"}
      title={showDonation ? "支持开发" : "偏好设置"}
      className={showDonation ? "donation-panel" : "preferences-panel"}
      closeLabel={showDonation ? "关闭捐赠页面" : "关闭偏好设置"}
      onClose={onClose}
      exiting={exiting}
      footer={
        <button
          type="button"
          className={showDonation ? "secondary-button donation-back" : "start-button preferences-done"}
          onClick={showDonation ? () => setShowDonation(false) : onClose}
        >
          <AnimatedLabel text={showDonation ? "← 返回偏好设置" : "完成"} />
        </button>
      }
    >
      <TransitionSurface viewKey={showDonation ? "donation" : "preferences"} sizing="content">
      {showDonation ? (
        <DonationPanel />
      ) : (
        <>
          <div className="preference-card">
            <div className="preference-copy">
              <b>作答音效</b>
              <p>正确时播放轻快提示，错误时播放低沉提示。</p>
            </div>
            <SoundToggle enabled={soundEnabled} onToggle={onToggleSound} variant="panel" />
          </div>

          {showKeyboardShortcuts && (
            <ShortcutSettings
              keys={shortcutKeys}
              trainingType={trainingType}
              onChange={onUpdateShortcutKeys}
            />
          )}

          <button type="button" className="donation-entry" onClick={() => setShowDonation(true)}>
            <span><b>捐赠支持</b><small>微信 / 支付宝</small></span>
            <i aria-hidden="true">→</i>
          </button>

        </>
      )}
      </TransitionSurface>
    </ModalFrame>
  );
}
