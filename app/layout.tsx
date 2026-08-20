import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "双重记忆 · Dual N-Back",
  description: "同时训练空间位置与扑克牌工作记忆的双重 N-Back 前端游戏。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
