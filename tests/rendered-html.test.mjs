import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Dual N-Back game", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>双重记忆 · Dual N-Back<\/title>/i);
  assert.match(html, /记住位置与颜色/);
  assert.match(html, /开始计时/);
  assert.match(html, /计时模式/);
  assert.match(html, /挑战/);
  assert.match(html, /彩色方格/);
  assert.match(html, /扑克牌/);
  assert.match(html, /翻牌记忆/);
  assert.match(html, /N-Back/);
  assert.match(html, /位置方块/);
  assert.match(html, /颜色数量/);
  assert.match(html, /训练长度/);
  assert.match(html, /role="switch"/);
  assert.match(html, /aria-checked="false"/);
  assert.match(html, /音效/);
  assert.doesNotMatch(html, /6个位置棋盘/);
  assert.doesNotMatch(html, /位置 ✓ · 颜色 ✓/);
  assert.doesNotMatch(html, /位置 ✓ · 颜色 ×/);
  assert.doesNotMatch(html, /位置 × · 颜色 ✓/);
  assert.doesNotMatch(html, /位置 × · 颜色 ×/);
  assert.match(html, /包含彩色方格 N-Back、扑克牌 N-Back 和翻牌记忆训练/);
  assert.doesNotMatch(html, /<footer|statusbar/);
  assert.doesNotMatch(html, /四色关系判断|codex-preview|react-loading-skeleton/);
});

test("keeps game screens inside the dynamic viewport", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /html, body, #root\s*{[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.app-shell\s*{[^}]*height:\s*100dvh[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\)/s);
  assert.doesNotMatch(css, /\.statusbar/);
  assert.match(css, /\.game-stage\s*{[^}]*height:\s*100%[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.quick-stepper strong,\s*\.stepper strong\s*{\s*background:\s*#fff/);
  assert.match(css, /\.idle-launch\s*{[^}]*gap:\s*clamp\(1\.6rem, 4dvh, 2\.5rem\)/s);
  assert.match(css, /\.sound-toggle\[aria-checked="true"\] \.sound-toggle-track\s*{\s*background:\s*var\(--orange-deep\)/);
  assert.doesNotMatch(css, /\.sound-toggle\[aria-checked="true"\][^}]*var\(--teal\)/s);
  assert.match(css, /\.nback-game\.phase-finished,\s*\.flip-game\.flip-phase-finished\s*{[^}]*align-content:\s*center[^}]*translateY\(clamp\(-6rem, -10dvh, -2\.5rem\)\)/s);
  assert.match(css, /@media \(max-height: 600px\) and \(min-aspect-ratio: 4 \/ 3\)/);
});

test("removes flip-memory instructions once play begins", async () => {
  const source = await readFile(new URL("../app/game/FlipMemoryGame.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /找出目标牌|请依次点出|牌位正在移动|记住全部牌位/);
  assert.match(source, /flipPhase === "idle" \?/);
  assert.match(source, /<IdleSettings settings={settings} onChange={onUpdateSettings}/);
});

test("keeps result screens compact and free of evaluation copy", async () => {
  const sources = await Promise.all([
    readFile(new URL("../app/game/NBackGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game/FlipMemoryGame.tsx", import.meta.url), "utf8"),
  ]);
  const source = sources.join("\n");

  assert.doesNotMatch(source, /本轮表现|先放慢节奏|判断稳定|表现不错|位置记得很稳|降低牌数|升到/);
  assert.match(sources[0], /<IdleSettings settings={settings} onChange={updateSettings}/);
  assert.match(sources[0], />修改设置 <span>→<\/span>/);
  assert.match(sources[1], />修改设置 <span>→<\/span>/);
});

test("uses the requested compact home-setting layouts", async () => {
  const [idleSettings, settingsModal, core] = await Promise.all([
    readFile(new URL("../app/game/IdleSettings.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game/SettingsModal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game/core.ts", import.meta.url), "utf8"),
  ]);

  assert.match(idleSettings, /grid-inline-settings/);
  assert.match(idleSettings, /card-inline-settings/);
  assert.match(idleSettings, /id="quick-flip-count"/);
  assert.match(idleSettings, /quick-setting is-full[\s\S]*训练长度/);
  assert.match(idleSettings, /value={settings\.mode === "challenge" \? settings\.interval : ""}/);
  assert.match(idleSettings, /onChange\(\{ mode: "challenge", interval: Number\(event\.target\.value\) \}\)/);
  assert.doesNotMatch(idleSettings, /训练牌组|13 个点数|4 种花色|quick-fixed-value/);
  assert.doesNotMatch(settingsModal, /固定 2-Back|扑克牌玩法固定|card-pool-setting/);
  assert.match(settingsModal, /VERSION 2\.0/);
  assert.match(settingsModal, /偏好设置/);
  assert.match(settingsModal, /作答音效/);
  assert.doesNotMatch(settingsModal, /音效默认关闭，选择会保存在当前设备/);
  assert.doesNotMatch(settingsModal, /训练内容|牌阵数量|N-Back 难度|训练长度|保存设置|四选一规则/);
  assert.doesNotMatch(core, /trainingType === "cards" \? 2/);
});

test("persists optional feedback sounds and uses distinct correct and wrong tones", async () => {
  const [controller, flipMemory, sound] = await Promise.all([
    readFile(new URL("../app/game/useGameController.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/game/FlipMemoryGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game/sound.ts", import.meta.url), "utf8"),
  ]);

  assert.match(controller, /dual-nback-sound-enabled/);
  assert.match(controller, /playFeedbackSound\(answer === expected \? "correct" : "wrong"\)/);
  assert.match(flipMemory, /playFeedbackSound\(card\.isTarget \? "correct" : "wrong"\)/);
  assert.match(sound, /playCorrectTone/);
  assert.match(sound, /\[659\.25, 880\]/);
  assert.match(sound, /playWrongTone/);
  assert.match(sound, /exponentialRampToValueAtTime\(72/);
});
