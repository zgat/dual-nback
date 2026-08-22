import assert from "node:assert/strict";
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
  assert.match(html, /挑战模式/);
  assert.match(html, /彩色方格/);
  assert.match(html, /扑克牌/);
  assert.match(html, /翻牌记忆/);
  assert.doesNotMatch(html, /6个位置棋盘/);
  assert.doesNotMatch(html, /位置 ✓ · 颜色 ✓/);
  assert.doesNotMatch(html, /位置 ✓ · 颜色 ×/);
  assert.doesNotMatch(html, /位置 × · 颜色 ✓/);
  assert.doesNotMatch(html, /位置 × · 颜色 ×/);
  assert.match(html, /包含彩色方格 N-Back、扑克牌 2-Back 和翻牌记忆训练/);
  assert.doesNotMatch(html, /四色关系判断|codex-preview|react-loading-skeleton/);
});
