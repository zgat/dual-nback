import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "双重记忆 · Dual N-Back",
  description: "包含彩色方格 N-Back、扑克牌 N-Back、翻牌记忆和反应力测试的前端游戏。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/app-icon.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
