import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "双重记忆 · Dual N-Back",
  description: "可自定义位置与颜色数量，支持计时模式和挑战模式的双重 N-Back 前端游戏。",
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
