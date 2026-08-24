"use client";

import { useState } from "react";

type PaymentMethod = "wechat" | "alipay";

export function DonationPanel({ onBack }: { onBack: () => void }) {
  const [method, setMethod] = useState<PaymentMethod>("wechat");
  const isWechat = method === "wechat";

  return (
    <div className="donation-content">
      <div className={`payment-switch ${isWechat ? "is-wechat" : "is-alipay"}`} role="tablist" aria-label="选择捐赠方式">
        <button type="button" role="tab" aria-selected={isWechat} onClick={() => setMethod("wechat")}>微信</button>
        <button type="button" role="tab" aria-selected={!isWechat} onClick={() => setMethod("alipay")}>支付宝</button>
      </div>

      <div className={`donation-image-frame ${isWechat ? "is-wechat" : "is-alipay"}`}>
        {/* Native and web builds share these static assets, so a plain image element is required. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={isWechat ? "/donation/wechat.png" : "/donation/alipay.jpg"}
          alt={isWechat ? "微信支付捐赠二维码" : "支付宝捐赠二维码"}
          width={isWechat ? 1490 : 1440}
          height={isWechat ? 2030 : 2160}
        />
      </div>

      <button type="button" className="secondary-button donation-back" onClick={onBack}>← 返回偏好设置</button>
    </div>
  );
}
