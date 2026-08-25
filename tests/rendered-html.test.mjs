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
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, />设置</);
  assert.match(html, /role="switch"/);
  assert.match(html, /aria-checked="false"/);
  assert.match(html, /音效/);
  assert.match(html, /历史最佳/);
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
  const [css, nback] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/game/NBackGame.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(css, /html, body, #root\s*{[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.app-shell\s*{[^}]*height:\s*100dvh[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\)/s);
  assert.doesNotMatch(css, /\.statusbar/);
  assert.match(css, /\.game-stage\s*{[^}]*height:\s*100%[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.quick-stepper strong\s*{\s*background:\s*#fff/);
  assert.match(css, /\.idle-launch\s*{[^}]*gap:\s*clamp\(1\.6rem, 4dvh, 2\.5rem\)/s);
  assert.match(css, /\.sound-toggle\[aria-checked="true"\] \.sound-toggle-track\s*{\s*background:\s*var\(--orange-deep\)/);
  assert.doesNotMatch(css, /\.sound-toggle\[aria-checked="true"\][^}]*var\(--teal\)/s);
  assert.match(css, /--nback-board-size:/);
  assert.match(css, /--flip-block-scale:/);
  assert.match(css, /\.nback-game\.phase-finished,\s*\.flip-game\.flip-phase-finished\s*{[^}]*align-content:\s*center[^}]*overflow-y:\s*auto/s);
  assert.doesNotMatch(css, /translateY\(clamp\(-6rem, -10dvh, -2\.5rem\)\)/);
  assert.match(css, /@media \(max-height: 600px\) and \(min-aspect-ratio: 4 \/ 3\)/);
  assert.match(css, /\.warmup-next\s*{[^}]*display:\s*grid[^}]*place-items:\s*center[^}]*text-align:\s*center/s);
  assert.match(nback, />\s*记住了，下一轮\s*<\/button>/);
  assert.doesNotMatch(nback, /Enter ↵/);
});

test("removes flip-memory instructions once play begins", async () => {
  const [source, gameHome] = await Promise.all([
    readFile(new URL("../app/game/FlipMemoryGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game/GameHome.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(source, /请依次点出|牌位正在移动|记住全部牌位/);
  assert.match(source, /flipPhase === "idle" \?/);
  assert.match(source, /<GameHome[\s\S]*description=\{timed \? "自己决定何时盖牌，全部找出后进入下一轮。" : "限时记牌，盖牌后不限时找完全部目标牌。"\}[\s\S]*onUpdateSettings=\{onUpdateSettings\}/);
  assert.match(gameHome, /<IdleSettings settings={settings} onChange={onUpdateSettings}/);
  assert.match(source, /timers\.schedule\(`mistake-\$\{card\.id\}`,[\s\S]*}, 650\)/);
  assert.match(source, /if \(paused\) \{[\s\S]*timers\.pauseAll\(\)/);
});

test("keeps result screens compact and free of evaluation copy", async () => {
  const [nback, flip, page] = await Promise.all([
    readFile(new URL("../app/game/NBackGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game/FlipMemoryGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  const sources = [nback, flip];
  const source = sources.join("\n");

  assert.doesNotMatch(source, /本轮表现|先放慢节奏|判断稳定|表现不错|位置记得很稳|降低牌数|升到/);
  assert.match(sources[0], /<GameHome[\s\S]*onUpdateSettings={updateSettings}/);
  assert.match(sources[0], />修改设置 <span>→<\/span>/);
  assert.match(sources[1], />修改设置 <span>→<\/span>/);
  assert.match(page, /const editHomeSettings = \(\) => \{\s*goHome\(\);\s*setHomeSettingsOpen\(true\);\s*\}/s);
  assert.match(page, /onEditSettings={editHomeSettings}/);
  assert.match(page, /editSettings={editHomeSettings}/);
});

test("uses the requested compact home-setting layouts", async () => {
  const [page, gameHome, idleSettings, settingsModal, selectMenu, core, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game/GameHome.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game/IdleSettings.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game/SettingsModal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game/SelectMenu.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game/core.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /const \[homeSettingsOpen, setHomeSettingsOpen\] = useState\(false\)/);
  assert.match(page, /const \[homeSettingsHeight, setHomeSettingsHeight\] = useState\(0\)/);
  assert.equal((page.match(/homeSettingsOpen={homeSettingsOpen}/g) ?? []).length, 2);
  assert.doesNotMatch(gameHome, /const \[settingsOpen[^\n]*useState/);
  assert.match(gameHome, /new ResizeObserver\(measure\)/);
  assert.match(gameHome, /style=\{\{ height: settingsOpen \? `\$\{settingsHeight\}px` : 0 \}\}/);
  assert.match(gameHome, /aria-expanded={settingsOpen}/);
  assert.match(gameHome, /aria-controls={settingsId}/);
  assert.match(gameHome, /inert={!settingsOpen}/);
  assert.match(gameHome, /settings-disclosure-line/);
  assert.match(gameHome, /<IdleSettings settings={settings} onChange={onUpdateSettings}/);
  assert.match(idleSettings, /grid-inline-settings/);
  assert.match(idleSettings, /card-inline-settings/);
  assert.match(idleSettings, /ariaLabel="选择牌阵数量"/);
  assert.match(idleSettings, /quick-setting is-full[\s\S]*训练长度/);
  assert.match(idleSettings, /value={settings\.mode === "challenge" \? settings\.interval : null}/);
  assert.match(idleSettings, /onChange=\{\(interval\) => onChange\(\{ mode: "challenge", interval \}\)\}/);
  assert.match(idleSettings, /30 轮（固定）/);
  assert.match(idleSettings, /\[5, 8\]\.map\(\(flipRounds\)/);
  assert.doesNotMatch(idleSettings, /<select|<option/);
  assert.match(selectMenu, /aria-haspopup="listbox"/);
  assert.match(selectMenu, /role="listbox"/);
  assert.match(selectMenu, /role="option"/);
  assert.match(selectMenu, /aria-selected={option\.value === value}/);
  assert.match(selectMenu, /ArrowDown|ArrowUp/);
  assert.doesNotMatch(idleSettings, /训练牌组|13 个点数|4 种花色|quick-fixed-value/);
  assert.doesNotMatch(settingsModal, /固定 2-Back|扑克牌玩法固定|card-pool-setting/);
  assert.match(settingsModal, /VERSION \d+\.\d+\.\d+/);
  assert.match(settingsModal, /偏好设置/);
  assert.match(settingsModal, /作答音效/);
  assert.doesNotMatch(settingsModal, /音效默认关闭，选择会保存在当前设备/);
  assert.doesNotMatch(settingsModal, /训练内容|牌阵数量|N-Back 难度|训练长度|保存设置|四选一规则/);
  assert.doesNotMatch(core, /trainingType === "cards" \? 2/);
  assert.match(css, /\.quick-stepper strong\s*{[^}]*font-family:\s*inherit[^}]*font-size:\s*\.65rem[^}]*font-weight:\s*800/s);
  assert.match(css, /\.custom-select-trigger\s*{[^}]*place-items:\s*center[^}]*padding-inline:\s*1\.55rem[^}]*text-align:\s*center/s);
  assert.match(css, /\.custom-select-chevron\s*{[^}]*right:\s*\.78rem/s);
  assert.match(css, /\.custom-select-menu button\s*{[^}]*place-items:\s*center[^}]*text-align:\s*center/s);
  assert.match(css, /\.quick-challenge-select \.custom-select-trigger\s*{[^}]*padding-left:\s*0[^}]*padding-right:\s*calc\(\.78rem \+ 3\.5px\)/s);
  assert.match(css, /\.game-home\s*{[^}]*--home-control-width:\s*min\(100%, 420px\)/s);
  assert.match(css, /\.idle-switches\s*{[^}]*width:\s*var\(--home-control-width/s);
  assert.doesNotMatch(css, /\.idle-switches\s*{\s*width:\s*100%/);
  assert.match(css, /\.settings-disclosure\s*{[^}]*width:\s*var\(--home-control-width\)[^}]*margin-inline:\s*auto/s);
  assert.match(css, /\.settings-reveal-inner\s*{[^}]*padding:\s*\.35rem 0 \.55rem/s);
  assert.match(css, /\.settings-reveal\s*{[^}]*height:\s*0[^}]*overflow:\s*hidden[^}]*height \.22s cubic-bezier\(\.22, 1, \.36, 1\)/s);
  assert.doesNotMatch(css, /\.settings-reveal\s*{[^}]*grid-template-rows/s);
  assert.match(css, /\.settings-disclosure\.is-open \.settings-disclosure-chevron\s*{[^}]*rotate\(225deg\)/s);
  assert.match(css, /\.settings-disclosure-toggle\s*{[^}]*gap:\s*1px[^}]*color:\s*#aaa092/s);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)\s*{\s*\.settings-disclosure-toggle:hover/s);
  assert.match(css, /\.settings-disclosure-line i\s*{[^}]*background:\s*currentColor/s);
  assert.match(css, /\.home-intro\s*{[^}]*grid-template-rows:\s*1\.4rem 1\.25rem/s);
  assert.match(css, /\.nback-game\.phase-idle,\s*\.flip-game\.flip-phase-idle\s*{[^}]*align-content:\s*start/s);
  assert.match(css, /\.game-home\s*{[^}]*padding-top:\s*clamp\(2\.25rem, 7\.5dvh, 4\.5rem\)/s);
  assert.match(css, /\.nback-game\.phase-countdown,[\s\S]*grid-template-rows:\s*auto auto auto/s);
});

test("balances three game sounds and avoids sticky touch hover feedback", async () => {
  const [controller, flipMemory, sound, storage] = await Promise.all([
    readFile(new URL("../app/game/useGameController.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/game/FlipMemoryGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game/sound.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/game/storage.ts", import.meta.url), "utf8"),
  ]);

  assert.match(storage, /dual-nback-sound-enabled/);
  assert.match(controller, /playFeedbackSound\(answer === expected \? "correct" : "wrong"\)/);
  assert.match(controller, /const beginCountdown[\s\S]*playFeedbackSound\("advance"\)/);
  assert.match(controller, /const advanceWarmup[\s\S]*playFeedbackSound\("advance"\)/);
  assert.match(flipMemory, /playFeedbackSound\(card\.isTarget \? "correct" : "wrong"\)/);
  assert.match(flipMemory, /const beginGame[\s\S]*playFeedbackSound\("advance"\)/);
  assert.match(sound, /playCorrectTone/);
  assert.match(sound, /\[659\.25, 880\]/);
  assert.match(sound, /playWrongTone/);
  assert.match(sound, /body\.frequency\.setValueAtTime\(196/);
  assert.match(sound, /playAdvanceTone/);
  assert.match(sound, /createBalancedOutput/);
  assert.match(sound, /compressor\.threshold\.setValueAtTime\(-18/);

  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.match-button\s*{[^}]*touch-action:\s*manipulation[^}]*-webkit-tap-highlight-color:\s*transparent/s);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)\s*{\s*\.warmup-next:hover\s*{[^}]*}\s*\.match-button:not\(:disabled\):hover/s);
});

test("supports persistent web-only custom N-Back keyboard mappings", async () => {
  const [page, controller, preferences, settingsModal, shortcutSettings, shortcuts, storage] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game/useGameController.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/game/usePreferences.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/game/SettingsModal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game/ShortcutSettings.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game/shortcuts.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/game/storage.ts", import.meta.url), "utf8"),
  ]);

  assert.match(shortcuts, /exact:\s*"1"[\s\S]*position:\s*"2"[\s\S]*color:\s*"3"[\s\S]*different:\s*"4"[\s\S]*advance:\s*"Enter"/);
  assert.match(shortcuts, /assignShortcutKey/);
  assert.match(storage, /dual-nback-shortcut-keys/);
  assert.match(preferences, /readShortcutKeys\(\)/);
  assert.match(preferences, /writeShortcutKeys\(next\)/);
  assert.match(controller, /shortcutKeysRef\.current\[item\.id\] === pressedKey/);
  assert.match(controller, /pressedKey === shortcutKeysRef\.current\.advance/);
  assert.match(settingsModal, /!Capacitor\.isNativePlatform\(\)/);
  assert.match(settingsModal, /showKeyboardShortcuts &&/);
  assert.match(shortcutSettings, /点击键位后按下新按键/);
  assert.match(shortcutSettings, /恢复默认/);
  assert.match(page, /showSettings \|\| showLeaderboard/);
  assert.match(page, /useGameController\([\s\S]*shortcutKeys,[\s\S]*showSettings \|\| showLeaderboard/);
});

test("adds donation switching and local history entry points for all games", async () => {
  const [page, settingsModal, donationPanel, leaderboardModal, controller, gameHome, nback, flip, idleSettings, css, wechat, alipay] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game/SettingsModal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game/DonationPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game/LeaderboardModal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game/useGameController.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/game/GameHome.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game/NBackGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game/FlipMemoryGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game/IdleSettings.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../public/donation/wechat.png", import.meta.url)),
    readFile(new URL("../public/donation/alipay.jpg", import.meta.url)),
  ]);

  assert.match(settingsModal, /捐赠支持/);
  assert.match(settingsModal, /<DonationPanel/);
  assert.match(donationPanel, /payment-switch/);
  assert.match(donationPanel, />微信</);
  assert.match(donationPanel, />支付宝</);
  assert.match(donationPanel, /\/donation\/wechat\.png/);
  assert.match(donationPanel, /\/donation\/alipay\.jpg/);
  assert.equal(wechat.subarray(1, 4).toString(), "PNG");
  assert.deepEqual([...alipay.subarray(0, 2)], [0xff, 0xd8]);

  assert.match(page, /showLeaderboard/);
  assert.match(page, /<LeaderboardModal/);
  assert.match(controller, /onSessionFinishedRef\.current\?\.\(/);
  assert.match(gameHome, /leaderboard-entry[\s\S]*历史最佳/);
  assert.match(nback, /result-leaderboard-link[\s\S]*历史最佳/);
  assert.match(flip, /onSessionFinished\(\{/);
  assert.match(flip, /result-leaderboard-link[\s\S]*历史最佳/);
  assert.match(leaderboardModal, /leaderboard-game-switch/);
  assert.match(leaderboardModal, /leaderboard-footer/);
  assert.match(leaderboardModal, /leaderboard-mode-switch/);
  assert.match(leaderboardModal, /leaderboard-flip-filters/);
  assert.match(leaderboardModal, /leaderboard-flip-mode-switch/);
  assert.match(leaderboardModal, />翻牌记忆<\/button>/);
  assert.match(leaderboardModal, />经典<\/button>/);
  assert.match(leaderboardModal, />移动<\/button>/);
  assert.match(leaderboardModal, /计时模式保留最佳 10 次，依次比较正确率、轮数和用时/);
  assert.match(leaderboardModal, /挑战模式仅累计无误完成次数，经典与移动分别统计/);
  assert.match(leaderboardModal, /FLIP_CARD_COUNTS\.map/);
  assert.match(leaderboardModal, /data\.flip\.challenge\[flipDifficulty\]\[String\(cardCount\)\]/);
  assert.match(leaderboardModal, /entry\.suitCount/);
  assert.match(leaderboardModal, /rank-rounds/);
  assert.match(leaderboardModal, /rank-config-dimensions[^\n]*\{entry\.cellCount}格 · \{entry\.colorCount}色/);
  assert.match(leaderboardModal, /rank-config-nback[^\n]*\{entry\.n}-BACK/);
  assert.doesNotMatch(leaderboardModal, /entry\.cellCount}点 · \$\{entry\.colorCount}花色/);
  assert.match(leaderboardModal, /<HistoryTiming elapsedMs=\{entry\.elapsedMs} createdAt=\{entry\.createdAt} \/>/);
  assert.match(leaderboardModal, /dateTime=\{date\.toISOString\(\)}/);
  assert.match(css, /\.rank-timing time \{[^}]*font-size: \.58rem/);
  assert.match(css, /\.rank-config \{[^}]*min-width: max-content/);
  assert.doesNotMatch(css, /\.rank-config-dimensions[^}]*text-overflow: ellipsis/);
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*\.timed-ranking li \{[\s\S]*minmax\(96px, 1fr\)[\s\S]*minmax\(104px, auto\)/);
  assert.doesNotMatch(css, /@media \(max-width: 700px\)[\s\S]*\.rank-timing time \{ display: grid/);
  assert.match(leaderboardModal, /PRESET_INTERVALS\.map/);
  assert.match(leaderboardModal, /固定 30 轮/);
  assert.match(leaderboardModal, /仅记录挑战成功的次数/);
  assert.match(leaderboardModal, /仅记录当前设备/);
  assert.match(nback, /isChallengeSuccess \? "挑战成功" : "训练完成"/);
  assert.match(nback, /isChallengeSuccess \? "再次挑战" : "再练一轮"/);
  assert.match(flip, /challengeSuccess \? "挑战成功" : "训练完成"/);
  assert.match(flip, /settings\.flipMode === "self-paced"/);
  assert.match(flip, /if \(!timed\) timers\.schedule\("main", finishPreview, previewMs\)/);
  assert.match(flip, /记住了，盖牌/);
  assert.match(flip, /记牌中 · \{flipConfig\.previewSeconds\} 秒/);
  assert.match(idleSettings, /flipMode: "self-paced"/);
  assert.match(idleSettings, /flipMode: "challenge"/);
  assert.match(idleSettings, /花色数量/);
  assert.match(idleSettings, /FLIP_SUIT_COUNTS/);
  assert.match(page, /initialFlipMode=\{settings\.flipMode\}/);
  assert.doesNotMatch(page, /showLeaderboard && !isFlipMode/);
});

test("keeps the visible app version synchronized and auto-bumps APK builds", async () => {
  const [gradle, adaptiveIcon, packageJsonText, packageLockText, settingsModal, versionBumpScript, launcher, foreground] = await Promise.all([
    readFile(new URL("../android/app/build.gradle", import.meta.url), "utf8"),
    readFile(new URL("../android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../package-lock.json", import.meta.url), "utf8"),
    readFile(new URL("../app/game/SettingsModal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../scripts/bump-apk-version.mjs", import.meta.url), "utf8"),
    readFile(new URL("../android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png", import.meta.url)),
    readFile(new URL("../android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png", import.meta.url)),
  ]);

  const packageJson = JSON.parse(packageJsonText);
  const packageLock = JSON.parse(packageLockText);
  const versionCode = Number(gradle.match(/versionCode\s+(\d+)/)?.[1]);
  const versionName = gradle.match(/versionName\s+"([^"]+)"/)?.[1];
  assert.ok(Number.isInteger(versionCode) && versionCode >= 15);
  assert.equal(versionName, packageJson.version);
  assert.equal(packageLock.version, packageJson.version);
  assert.equal(packageLock.packages[""].version, packageJson.version);
  assert.match(settingsModal, new RegExp(`VERSION ${packageJson.version.replaceAll(".", "\\.")}`));
  assert.equal(packageJson.scripts["version:bump:apk"], "node scripts/bump-apk-version.mjs");
  assert.match(packageJson.scripts["android:apk"], /version:bump:apk/);
  assert.match(packageJson.scripts["android:apk:no-bump"], /assembleDebug/);
  assert.match(versionBumpScript, /process\.argv\[2\]/);
  assert.match(adaptiveIcon, /@mipmap\/ic_launcher_foreground/);
  assert.equal(launcher.subarray(1, 4).toString(), "PNG");
  assert.equal(launcher.readUInt32BE(16), 192);
  assert.equal(launcher.readUInt32BE(20), 192);
  assert.equal(foreground.readUInt32BE(16), 432);
  assert.equal(foreground.readUInt32BE(20), 432);
});
