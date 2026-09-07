import assert from "node:assert/strict";
import test from "node:test";
import {createElement, useState} from "react";
import {readFileSync} from "node:fs";
import {loadGame, loadHome} from "./helpers/load-game.mjs";
import {mountHook} from "./helpers/react-harness.mjs";

const {DEFAULT_SETTINGS, FLIP_SWAP_DURATION_MS} = loadGame("core");
const {usePresence} = loadGame("usePresence");
const {useFlipMemoryGame} = loadGame("useFlipMemoryGame");
const {useReactionGame} = loadGame("useReactionGame");
const {FlipMemoryGame} = loadGame("FlipMemoryGame");
const noop = () => {};

test("presence retains exit, reverses on reopen, and cancels all removal timers", async t => {
  const h = await mountHook(t, () => {
    const [open, setOpen] = useState(false);
    return {...usePresence(open), setOpen};
  });
  assert.equal(h.pendingCount(), 0);
  await h.run(g => g.setOpen(true));
  assert.equal(h.value.mounted, true);
  await h.run(g => g.setOpen(false));
  await h.tick(100);
  assert.equal(h.value.mounted, true);
  assert.equal(h.value.exiting, true);
  await h.run(g => g.setOpen(true));
  await h.tick(500);
  assert.equal(h.value.mounted, true);
  assert.equal(h.value.exiting, false);
  assert.equal(h.pendingCount(), 0);
  await h.run(g => g.setOpen(false));
  await h.tick(159); assert.equal(h.value.mounted, true);
  await h.tick(1); assert.equal(h.value.mounted, false);
});

test("reduced motion removes overlays without a decorative delay", async t => {
  let open = true;
  const h = await mountHook(t, () => usePresence(open), window => {
    window.matchMedia = () => ({matches: true});
  });
  open = false; await h.render(); await h.tick(0);
  assert.equal(h.value.mounted, false);
});

test("a closing select is inert and can reopen without replacing its portal", async t => {
  const {SelectMenu} = loadGame("SelectMenu");
  let chosen = 0;
  const h = await mountHook(t, () => ({view: createElement(SelectMenu, {
    value: 1, options: [{value:1,label:"一"},{value:2,label:"二"}], placeholder:"选择", ariaLabel:"测试", onChange: () => chosen++,
  })}));
  const trigger = document.querySelector(".custom-select-trigger");
  await h.run(() => trigger.click());
  const menu = document.querySelector("[role=listbox]");
  await h.key("Escape", {}, document.activeElement);
  assert.equal(menu.getAttribute("aria-hidden"), "true");
  assert.ok(menu.hasAttribute("inert"));
  await h.run(() => menu.querySelector("button").click());
  assert.equal(chosen, 0);
  await h.tick(60);
  await h.run(() => trigger.click());
  assert.equal(document.querySelector("[role=listbox]"), menu);
  assert.equal(menu.getAttribute("aria-hidden"), "false");
  await h.tick(200);
  assert.equal(menu.isConnected, true);
});

test("one home preserves selection, disclosure DOM and open height across all four games", async t => {
  const Home = loadHome();
  const originalObserver = Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver");
  t.after(() => originalObserver ? Object.defineProperty(globalThis, "ResizeObserver", originalObserver) : delete globalThis.ResizeObserver);
  const h = await mountHook(t, () => ({view:createElement(Home)}), window => {
    globalThis.ResizeObserver = class { observe() {} disconnect() {} };
    Object.defineProperty(window.HTMLElement.prototype, "scrollHeight", {configurable:true, get() {
      if (!this.classList.contains("settings-reveal-inner")) return 0;
      return this.querySelector(".grid-inline-settings") ? 220
        : this.querySelector(".card-inline-settings") ? 160
        : this.querySelector('[aria-label="选择牌阵数量"]') ? 200 : 90;
    }});
  });
  await h.tick(0);
  const home = document.querySelector(".game-home");
  const switcher = home.querySelector(".training-switch");
  const reveal = home.querySelector(".settings-reveal");
  const disclosure = home.querySelector(".settings-disclosure-toggle");
  await h.run(() => disclosure.click());
  assert.equal(reveal.style.height, "220px");
  for (const [index,height] of [[1,160],[2,200],[3,90],[0,220]]) {
    await h.run(() => switcher.querySelectorAll("button")[index].click());
    assert.equal(document.querySelector(".game-home"), home);
    assert.equal(document.querySelector(".training-switch"), switcher);
    assert.equal(document.querySelector(".settings-reveal"), reveal);
    assert.equal(disclosure.getAttribute("aria-expanded"), "true");
    assert.equal(reveal.style.height, `${height}px`);
    assert.equal(home.querySelector(".training-switch-indicator").style.transform, `translateX(${index * 100}%)`);
  }
  // Rapid close/open retargets the same region rather than mounting another home.
  await h.run(() => disclosure.click()); assert.equal(reveal.style.height,"0px");
  await h.run(() => disclosure.click()); assert.equal(reveal.style.height,"220px");
  for (const index of [0,1,2,3]) {
    await h.run(() => document.querySelectorAll(".training-switch button")[index].click());
    await h.run(() => document.querySelector(".idle-launch .start-button").click());
    assert.equal(document.querySelector(".game-home"), null);
    assert.ok(document.querySelector(index < 2 ? ".countdown-number" : index === 2 ? ".flip-board" : ".reaction-pad"));
    await h.run(() => document.querySelector(".round-home").click());
    assert.ok(document.querySelector(".game-home"));
    assert.equal(document.querySelectorAll(".training-switch button")[index].getAttribute("aria-pressed"), "true");
  }
});

test("modal exit keeps reaction timers paused and restores trigger focus after removal", async t => {
  const {ModalFrame} = loadGame("ModalFrame");
  t.mock.method(Math, "random", () => 0);
  const h = await mountHook(t, () => {
    const [open,setOpen] = useState(false);
    const presence = usePresence(open);
    const game = useReactionGame({settings:DEFAULT_SETTINGS, soundEnabled:false, paused:presence.mounted, onSessionFinished:noop});
    return {...game, view:createElement("div", null,
      createElement("button", {id:"trigger",onClick:()=>setOpen(true)}, "设置"),
      presence.mounted && createElement(ModalFrame, {eyebrow:"设置",title:"设置",closeLabel:"关闭",exiting:presence.exiting,onClose:()=>setOpen(false)}, "内容"),
    )};
  });
  await h.run(g => g.beginTest()); await h.tick(1000);
  const trigger = document.getElementById("trigger");
  await h.run(() => { trigger.focus(); trigger.click(); });
  await h.tick(5000);
  await h.run(() => document.querySelector(".close-button").click());
  await h.tick(159);
  assert.equal(h.value.phase,"waiting");
  assert.ok(document.querySelector("[role=dialog]"));
  await h.tick(1);
  assert.equal(document.querySelector("[role=dialog]"),null);
  assert.equal(document.activeElement,trigger);
  await h.tick(399); assert.equal(h.value.phase,"waiting");
  await h.tick(1); assert.equal(h.value.phase,"target");
});

test("flip layers and status rail persist through covering, shuffling, errors and reveals", async t => {
  const settings = {...DEFAULT_SETTINGS, trainingType:"flip",flipDifficulty:"moving"};
  const h = await mountHook(t, () => {
    const game = useFlipMemoryGame({settings,soundEnabled:false,paused:false,onSessionFinished:noop});
    return {...game,view:createElement(FlipMemoryGame,{settings,game,paused:false,onEditSettings:noop,onOpenLeaderboard:noop})};
  });
  await h.run(g => g.beginGame());
  const board = document.querySelector(".flip-board");
  const status = document.querySelector(".target-prompt");
  const buttons = new Map([...board.querySelectorAll("button")].map((button,index) => [h.value.cards[index].id,button]));
  const faces = new Map([...buttons].map(([id,button]) => [id,button.querySelector(".flip-card-face")]));
  assert.equal(board.querySelectorAll(".memory-card-back").length, settings.flipCardCount);
  await h.run(g => g.finishPreview());
  for (let i=0; h.value.flipPhase === "shuffling" && i<20; i++) await h.tick(FLIP_SWAP_DURATION_MS);
  assert.equal(h.value.flipPhase,"selecting");
  assert.equal(document.querySelector(".target-prompt"), status);
  for (const card of h.value.cards) {
    assert.equal(buttons.get(card.id).querySelector(".flip-card-face"),faces.get(card.id));
    assert.ok(buttons.get(card.id).classList.contains("is-face-down"));
  }
  const wrong = h.value.cards.find(card => !card.isTarget);
  await h.run(g => g.chooseCard(wrong));
  assert.ok(buttons.get(wrong.id).classList.contains("is-face-up"));
  await h.tick(649); assert.ok(buttons.get(wrong.id).classList.contains("is-face-up"));
  await h.tick(1); assert.ok(buttons.get(wrong.id).classList.contains("is-face-down"));
  assert.equal(buttons.get(wrong.id).querySelector(".flip-card-face"),faces.get(wrong.id));
});

for (const type of ["flip", "reaction"]) {
  test(`${type} returning home cancels old work without replacing the controller`, async t => {
    let saved=0;
    const hook=type === "flip" ? useFlipMemoryGame : useReactionGame;
    const h = await mountHook(t, () => hook({settings:{...DEFAULT_SETTINGS,flipMode:"challenge"},soundEnabled:false,paused:false,onSessionFinished:()=>saved++}));
    await h.run(g => type === "flip" ? g.beginGame() : g.beginTest());
    await h.tick(100);
    await h.run(g => g.goHome());
    await h.tick(60000);
    assert.equal(type === "flip" ? h.value.flipPhase : h.value.phase,"idle");
    assert.equal(h.pendingCount(),0);
    assert.equal(saved,0);
  });
}

test("motion uses lightweight properties and keeps measurement-sensitive visuals instant", () => {
  const css = readFileSync(new URL("../app/globals.css",import.meta.url),"utf8");
  assert.doesNotMatch(css,/transition:\s*all\b|will-change:\s*height|animation:\s*memory-flip/);
  assert.match(css,/\.reaction-pad\.is-target\s*{\s*transition: none/);
  assert.match(css,/\.flip-phase-preview \.memory-card-inner\s*{\s*transition: none/);
  assert.match(css,/\.training-switch-indicator\s*{[^}]*transition: transform var\(--motion-layout\)/s);
  assert.match(css,/\.modal-backdrop\[data-exiting="true"\]/);
});
