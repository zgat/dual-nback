# 双重记忆 · Dual N-Back

一个面向网页与 Android 的认知训练游戏，包含彩色方格 N-Back、扑克牌 N-Back、翻牌记忆和反应力测试四种玩法。

[在线体验](https://dual-nback-studio.urzga321877.chatgpt.site/) · [下载最新版 APK](https://github.com/zgat/dual-nback/releases/latest)

## 游戏玩法

### 彩色方格 N-Back

同时比较当前色块与 N 轮前的：

- 位置和颜色都相同
- 位置相同、颜色不同
- 颜色相同、位置不同
- 位置和颜色都不同

位置方块数、颜色数和 N-Back 难度均可调整。

### 扑克牌 N-Back

比较当前扑克牌与 N 轮前的点数和花色关系。N-Back 难度可以自定义。

### 翻牌记忆

先记住牌面，再从牌背中找出目标牌：

- 经典模式：牌的位置保持不变
- 移动模式：盖牌后会展示牌的移动过程
- 计时模式：自己决定何时盖牌，可选择 5 或 8 轮
- 挑战模式：限时记牌，固定 8 轮

### 反应力测试

等待测试区域变为橙色后立即点击。提前点击会记为误触并重新等待，可选择 5 轮或 10 轮测试。完成后显示平均反应、最快反应与误触次数。

## 功能

- 计时模式与挑战模式
- 本地历史最佳记录
- 网页端自定义键盘快捷键
- 可选作答音效，设置保存在当前设备
- 响应式网页布局
- Android 16 兼容 APK
- 所有训练记录只保存在浏览器或应用的本地存储中

## 本地开发

需要 Node.js 22.13 或更高版本。

```bash
npm ci
npm run dev
```

常用命令：

```bash
npm run lint          # 代码检查
npm run typecheck     # TypeScript 类型检查
npm test              # 构建并运行测试
npm run mobile:build  # 构建移动端静态资源
```

## Android 构建

需要 JDK 21 和 Android SDK 36。

```bash
npm ci
npm run android:apk
```

该命令会自动递增补丁版本号和 Android `versionCode`，然后生成 Debug APK。输出位于：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## 项目结构

```text
app/                 网页与游戏界面
app/game/            游戏组件、状态和核心逻辑
mobile/              Capacitor 移动端入口
android/             Android 工程
tests/               核心逻辑与渲染测试
scripts/             版本管理脚本
```

## 贡献

请从 `main` 创建功能分支，通过 Pull Request 合并。提交前运行：

```bash
npm run lint
npm run typecheck
npm test
npm run mobile:build
```

详细约定见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 使用许可

本项目以 [PolyForm Noncommercial License 1.0.0](LICENSE) 提供源代码：

- 仅允许非商业目的使用、修改和分发。
- 分发原项目或修改版本时，必须保留许可证及项目来源声明。
- 商业使用需要另行取得作者书面授权。

由于包含非商业用途限制，本项目属于“源码公开”，并非 OSI 定义的开源软件。
