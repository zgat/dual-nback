"use client";

import { useState } from "react";

type PaymentMethod = "wechat" | "alipay";

export function DonationPanel() {
  const [method, setMethod] = useState<PaymentMethod>("wechat");
  const isWechat = method === "wechat";

  return (
    <div className="donation-content">
      <div className={`payment-switch ${isWechat ? "is-wechat" : "is-alipay"}`} role="tablist" aria-label="选择捐赠方式">
        <button type="button" role="tab" aria-selected={isWechat} onClick={() => setMethod("wechat")}>微信</button>
        <button type="button" role="tab" aria-selected={!isWechat} onClick={() => setMethod("alipay")}>支付宝</button>
      </div>

      <div className={`donation-image-frame ${isWechat ? "is-wechat" : "is-alipay"}`}>
        {(["wechat", "alipay"] as const).map(payment => (
          // Static assets are shared with the offline native build.
          // eslint-disable-next-line @next/next/no-img-element
          <img key={payment} data-visible={method === payment} aria-hidden={method !== payment}
            src={payment === "wechat" ? "/donation/wechat.png" : "/donation/alipay.jpg"}
            alt={payment === "wechat" ? "微信支付捐赠二维码" : "支付宝捐赠二维码"}
            width={payment === "wechat" ? 1490 : 1440} height={payment === "wechat" ? 2030 : 2160}
          />
        ))}
      </div>
    </div>
  );
}
