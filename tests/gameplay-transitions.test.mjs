import assert from "node:assert/strict";
import test from "node:test";
import {createElement, useState} from "react";
import {loadGame} from "./helpers/load-game.mjs";
import {mountHook} from "./helpers/react-harness.mjs";

const {DEFAULT_SETTINGS, CARD_FLIP_DURATION_MS, FLIP_REVEAL_DURATION_MS, FLIP_CONFIG} = loadGame("core");
const {DEFAULT_SHORTCUT_KEYS} = loadGame("shortcuts");
const {AnimatedLabel} = loadGame("AnimatedLabel");
const {TransitionSurface} = loadGame("TransitionSurface");
const {useGameController} = loadGame("useGameController");
const {useFlipMemoryGame} = loadGame("useFlipMemoryGame");
const {NBackGame} = loadGame("NBackGame");
const {FlipMemoryGame} = loadGame("FlipMemoryGame");
const noop = () => {};

test("labels reverse on their existing nodes and remove only the inactive label", async t => {
  const h = await mountHook(t, () => {
    const [text, setText] = useState("暂停训练");
    return {setText, view:createElement(AnimatedLabel, {text})};
  });
  const original = document.querySelector(".label-current");
  await h.run(g => g.setText("继续训练"));
  assert.equal(document.querySelector(".label-leaving"), original);
  assert.equal(original.getAttribute("aria-hidden"), "true");
  await h.tick(90);
  await h.run(g => g.setText("暂停训练"));
  assert.equal(document.querySelector(".label-current"), original);
  await h.tick(179); assert.ok(document.querySelector(".label-leaving"));
  await h.tick(1); assert.equal(document.querySelector(".label-leaving"), null);
  assert.equal(original.textContent, "暂停训练");
  assert.equal(h.pendingCount(), 0);
});

test("surfaces retain an inert outgoing view, reverse in place, and start games instantly", async t => {
  const h = await mountHook(t, () => {
    const [view, setView] = useState("game");
    const [count, setCount] = useState(0);
    return {setView, setCount, view:createElement(TransitionSurface, {viewKey:view, instant:view === "game"},
      createElement("button", null, `${view}-${count}`))};
  });
  const game = document.querySelector(".surface-view");
  await h.run(g => g.setView("result"));
  assert.equal(document.querySelector(".is-leaving"), game);
  assert.ok(game.hasAttribute("inert"));
  assert.equal(game.getAttribute("aria-hidden"), "true");
  const result = document.querySelector(".is-current");
  await h.run(g => g.setCount(1));
  assert.equal(document.querySelector(".is-current"), result);
  assert.equal(result.textContent, "result-1");
  await h.tick(90);
  await h.run(g => g.setView("home"));
  assert.equal(document.querySelector(".is-leaving"), result);
  await h.run(g => g.setView("result"));
  assert.equal(document.querySelector(".is-current"), result);
  await h.tick(180);
  assert.equal(document.querySelectorAll(".surface-view").length, 1);
  await h.run(g => g.setView("game"));
  assert.ok(document.querySelector(".is-current.is-instant"));
  assert.equal(document.querySelector(".is-leaving"), null);
  assert.equal(h.pendingCount(), 0);
});

function mockResizeObserver(t, window, heights = {}) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver");
  t.after(() => original ? Object.defineProperty(globalThis, "ResizeObserver", original) : delete globalThis.ResizeObserver);
  globalThis.ResizeObserver = class {observe() {} disconnect() {}};
  Object.defineProperty(window.HTMLElement.prototype, "scrollHeight", {configurable:true, get() {
    return this.querySelector(".donation-content") ? heights.donation ?? 460 : heights.preferences ?? 240;
  }});
}

test("preferences and donation resize one modal and skip outgoing controls in the focus trap", async t => {
  const {SettingsModal} = loadGame("SettingsModal");
  const h = await mountHook(t, () => ({view:createElement(SettingsModal, {
    soundEnabled:false, shortcutKeys:DEFAULT_SHORTCUT_KEYS, trainingType:"grid",
    onToggleSound:noop, onUpdateShortcutKeys:noop, onClose:noop,
  })}), window => mockResizeObserver(t, window));
  const modal = document.querySelector("[role=dialog]");
  const surface = modal.querySelector(".transition-surface");
  assert.equal(surface.style.height, "240px");
  const donation = document.querySelector(".donation-entry");
  await h.run(() => {donation.focus(); donation.click();});
  assert.equal(document.querySelector("[role=dialog]"), modal);
  assert.equal(surface.style.height, "460px");
  assert.ok(donation.closest("[inert]"));
  await h.key("Tab", {}, donation);
  assert.equal(document.activeElement, modal.querySelector(".close-button"));
  await h.key("Tab", {shiftKey:true}, document.activeElement);
  assert.equal(document.activeElement, modal.querySelector(".is-current .donation-back"));
  await h.run(() => document.activeElement.click());
  assert.equal(surface.style.height, "240px");
  await h.tick(180);
  assert.equal(surface.querySelector(".is-leaving"), null);
});

test("history game and mode switches retain the fixed list shell with inert old rows", async t => {
  const {LeaderboardModal} = loadGame("LeaderboardModal");
  const {createEmptyLeaderboard} = loadGame("leaderboard");
  const h = await mountHook(t, () => ({view:createElement(LeaderboardModal, {
    data:createEmptyLeaderboard(), initialTrainingType:"grid", initialNBackMode:"self-paced",
    initialFlipMode:"self-paced", initialFlipDifficulty:"classic", onClose:noop,
  })}));
  const list = document.querySelector(".leaderboard-list");
  const first = list.querySelector(".is-current");
  await h.run(() => document.querySelectorAll(".leaderboard-game-switch button")[2].click());
  assert.equal(document.querySelector(".leaderboard-list"), list);
  assert.ok(first.hasAttribute("inert"));
  await h.run(() => document.querySelectorAll(".leaderboard-mode-switch button")[1].click());
  assert.ok(list.querySelector(".is-current .flip-challenge-ranking"));
  await h.tick(180);
  assert.equal(list.querySelectorAll(".surface-view").length, 1);
});

for (const trainingType of ["grid", "cards"]) {
  test(`${trainingType} keeps board, pause button and answer controls through countdown and warmup`, async t => {
    const settings = {...DEFAULT_SETTINGS, trainingType, n:1};
    const h = await mountHook(t, () => {
      const game = useGameController(settings, false, DEFAULT_SHORTCUT_KEYS);
      return {...game, view:createElement(NBackGame, {settings, game, editSettings:noop, onOpenLeaderboard:noop})};
    });
    await h.run(g => g.beginCountdown());
    const footer = document.querySelector(".pause-button");
    const board = document.querySelector(trainingType === "grid" ? ".game-grid" : ".card-board");
    const choices = [...document.querySelectorAll(".match-button")];
    const prompt = document.querySelector(".warmup-next");
    await h.tick(2100);
    assert.equal(h.value.countdownExiting, true);
    // A nested decorative animation must not finish the 400 ms mask exit.
    await h.run(() => document.querySelector(".countdown-digit").dispatchEvent(new window.Event("animationend", {bubbles:true})));
    assert.equal(h.value.phase, "countdown");
    await h.run(() => document.querySelector(".countdown-value").dispatchEvent(new window.Event("animationend", {bubbles:true})));
    assert.equal(h.value.phase, "playing");
    if (trainingType === "cards") await h.tick(CARD_FLIP_DURATION_MS);
    await h.run(g => g.pauseGame());
    assert.equal(document.querySelector(".pause-button"), footer);
    assert.equal(document.querySelector(".pause-overlay").dataset.open, "true");
    assert.equal(prompt.disabled, true);
    await h.run(() => footer.click());
    if (trainingType === "cards") await h.tick(CARD_FLIP_DURATION_MS);
    await h.run(() => prompt.click());
    if (trainingType === "cards") await h.tick(2 * CARD_FLIP_DURATION_MS);
    assert.equal(h.value.round, 1);
    assert.equal(board.isConnected, true);
    assert.deepEqual([...document.querySelectorAll(".match-button")], choices);
    assert.equal(document.querySelector(".warmup-next"), prompt);
    assert.ok(document.querySelector(".answer-transition.is-options"));
    assert.equal(choices.every(button => !button.disabled), true);
    await h.run(() => choices[0].click());
    assert.equal(choices.every(button => button.disabled), true);
    assert.ok(choices[0].matches(".is-correct, .is-wrong"));
    await h.tick(450 + (trainingType === "cards" ? CARD_FLIP_DURATION_MS : 0));
    assert.equal(choices[0].matches(".is-correct, .is-wrong"), false);
    assert.equal(document.querySelector(".pause-button"), footer);
  });
}

test("self-paced poker closes before replacing the face and synchronously rejects double advance", async t => {
  const h = await mountHook(t, () => useGameController({...DEFAULT_SETTINGS,trainingType:"cards",n:1}, false, DEFAULT_SHORTCUT_KEYS));
  await h.run(g => g.beginCountdown()); await h.tick(2600);
  const first = h.value.current;
  await h.run(g => g.advanceWarmup()); assert.equal(h.value.round, 0);
  await h.tick(CARD_FLIP_DURATION_MS);
  await h.run(g => {g.advanceWarmup(); g.advanceWarmup();});
  assert.equal(h.value.stimulusVisible, false);
  await h.tick(CARD_FLIP_DURATION_MS - 1); assert.equal(h.value.current, first);
  await h.tick(1); assert.equal(h.value.round, 1);
  await h.run(g => g.respond("exact")); assert.equal(h.value.selected, null);
  await h.tick(CARD_FLIP_DURATION_MS);
  const second = h.value.current;
  await h.run(g => g.respond("exact"));
  await h.tick(449 - CARD_FLIP_DURATION_MS); assert.equal(h.value.stimulusVisible, true);
  await h.tick(1); assert.equal(h.value.stimulusVisible, false);
  await h.tick(CARD_FLIP_DURATION_MS - 1); assert.equal(h.value.current, second);
  await h.tick(1); assert.equal(h.value.round, 2);
});

test("self-paced poker resume relocks for a full opening and restart cancels queued replacement", async t => {
  const h = await mountHook(t, () => useGameController({...DEFAULT_SETTINGS,trainingType:"cards"}, false, DEFAULT_SHORTCUT_KEYS));
  await h.run(g => g.beginCountdown()); await h.tick(2700);
  await h.run(g => g.pauseGame()); await h.tick(5000); await h.run(g => g.resumeGame());
  await h.tick(CARD_FLIP_DURATION_MS - 1); await h.run(g => g.advanceWarmup());
  assert.equal(h.value.roundTransitioning, true); assert.equal(h.value.stimulusVisible, true);
  await h.tick(1); await h.run(g => g.advanceWarmup());
  assert.equal(h.value.stimulusVisible, false);
  await h.run(g => g.pauseGame()); await h.tick(5000); await h.run(g => g.resumeGame());
  await h.tick(CARD_FLIP_DURATION_MS - 1); assert.equal(h.value.round, 0);
  await h.tick(1); assert.equal(h.value.round, 1);
  await h.tick(CARD_FLIP_DURATION_MS); await h.run(g => g.advanceWarmup());
  await h.run(g => g.beginCountdown()); await h.tick(500);
  assert.equal(h.value.phase, "countdown"); assert.equal(h.value.round, -1); assert.equal(h.value.current, null);
});

for (const flipMode of ["self-paced", "challenge"]) {
  test(`flip ${flipMode} closes the old deck and preserves its full preview budget after dealing`, async t => {
    const settings = {...DEFAULT_SETTINGS,trainingType:"flip",flipMode};
    const h = await mountHook(t, () => {
      const game = useFlipMemoryGame({settings,soundEnabled:false,paused:false,onSessionFinished:noop});
      return {...game, view:createElement(FlipMemoryGame, {settings,game,paused:false,onEditSettings:noop,onOpenLeaderboard:noop})};
    });
    await h.run(g => g.beginGame());
    const footer = document.querySelector(".flip-action");
    const board = document.querySelector(".flip-board");
    assert.equal(h.value.flipPhase, "revealing"); assert.equal(footer.disabled, true);
    await h.run(g => g.finishPreview()); assert.equal(h.value.flipPhase, "revealing");
    await h.tick(FLIP_REVEAL_DURATION_MS); assert.equal(h.value.flipPhase, "preview");
    if (flipMode === "challenge") {
      await h.tick(FLIP_CONFIG[settings.flipCardCount].previewSeconds * 1000 - 1);
      assert.equal(h.value.flipPhase, "preview");
      await h.tick(1);
    } else {
      await h.tick(10000); assert.equal(h.value.flipPhase, "preview");
      await h.run(g => g.finishPreview());
    }
    assert.equal(h.value.flipPhase, "covering");
    await h.run(g => g.chooseCard(g.cards.find(card => card.isTarget)));
    assert.equal(h.value.stats.found, 0);
    await h.tick(FLIP_REVEAL_DURATION_MS);
    const chips = [...document.querySelectorAll(".target-prompt i")];
    await h.run(g => g.cards.filter(card => card.isTarget).forEach(g.chooseCard));
    assert.equal(h.value.flipPhase, "round-complete");
    assert.deepEqual([...document.querySelectorAll(".target-prompt i")], chips);
    assert.equal(chips.every(chip => chip.dataset.found === "true"), true);
    const previousCards = h.value.cards;
    await h.run(g => {g.advanceRound(); g.advanceRound();});
    assert.equal(h.value.flipPhase, "dealing");
    assert.equal(board.querySelectorAll(".is-face-down").length, settings.flipCardCount);
    await h.tick(FLIP_REVEAL_DURATION_MS - 1); assert.equal(h.value.cards, previousCards);
    await h.tick(1); assert.equal(h.value.round, 1); assert.equal(h.value.flipPhase, "revealing");
    await h.tick(FLIP_REVEAL_DURATION_MS); assert.equal(h.value.flipPhase, "preview");
    assert.equal(document.querySelector(".flip-action"), footer);
    assert.equal(document.querySelector(".flip-board"), board);
  });
}

test("flip opening and redeal animations exclude paused and decorative time from results", async t => {
  let paused = false, saved;
  const settings = {...DEFAULT_SETTINGS, flipRounds:5};
  const h = await mountHook(t, () => useFlipMemoryGame({settings,soundEnabled:false,paused,onSessionFinished:r => {saved = r;}}));
  await h.run(g => g.beginGame());
  for (let round = 0; round < 5; round++) {
    await h.tick(80); paused = true; await h.render(); await h.tick(5000);
    assert.equal(h.value.flipPhase, "revealing");
    paused = false; await h.render(); await h.tick(FLIP_REVEAL_DURATION_MS - 80);
    await h.tick(1000); await h.run(g => g.finishPreview());
    await h.tick(FLIP_REVEAL_DURATION_MS);
    await h.run(g => g.cards.filter(card => card.isTarget).forEach(g.chooseCard));
    await h.run(g => g.advanceRound());
    if (round < 4) await h.tick(FLIP_REVEAL_DURATION_MS);
  }
  assert.equal(saved.elapsedMs, 5000);
  assert.equal(saved.found, 10);
});

test("flip same-frame repeated taps count once, including mistakes and the final saved result", async t => {
  const saved = [];
  const h = await mountHook(t, () => useFlipMemoryGame({settings:DEFAULT_SETTINGS,soundEnabled:false,paused:false,onSessionFinished:r => saved.push(r)}));
  await h.run(g => g.beginGame()); await h.tick(FLIP_REVEAL_DURATION_MS);
  for (let round = 0; round < 5; round++) {
    await h.run(g => g.finishPreview());
    await h.tick(FLIP_REVEAL_DURATION_MS);
    const wrong = h.value.cards.find(card => !card.isTarget);
    await h.run(g => {g.chooseCard(wrong); g.chooseCard(wrong);});
    assert.equal(h.value.stats.mistakes, round + 1);
    await h.run(g => g.cards.filter(card => card.isTarget).forEach(card => {g.chooseCard(card); g.chooseCard(card);}));
    assert.equal(h.value.stats.found, 2 * (round + 1));
    assert.equal(h.value.flipPhase, "round-complete");
    await h.run(g => g.advanceRound());
    if (round < 4) await h.tick(2 * FLIP_REVEAL_DURATION_MS);
  }
  assert.equal(saved.length, 1); assert.equal(saved[0].mistakes, 5); assert.equal(saved[0].found, 10);
});

test("reaction false-start feedback is distinct, while target onset and pointer measurement remain instant", async t => {
  const {useReactionGame} = loadGame("useReactionGame");
  const {ReactionGame} = loadGame("ReactionGame");
  t.mock.method(Math, "random", () => 0);
  const h = await mountHook(t, () => {
    const game = useReactionGame({settings:DEFAULT_SETTINGS,soundEnabled:false,paused:false,onSessionFinished:noop});
    return {...game, view:createElement(ReactionGame,{settings:DEFAULT_SETTINGS,game,paused:false,onEditSettings:noop,onOpenLeaderboard:noop})};
  });
  await h.run(g => g.beginTest());
  const pad = document.querySelector(".reaction-pad");
  await h.tick(100); await h.run(g => g.handlePointerDown({button:0,isPrimary:true,timeStamp:h.now()}));
  assert.ok(pad.classList.contains("is-false-start"));
  assert.equal(pad.querySelector("strong").textContent, "太早了");
  await h.tick(720 + 1400);
  assert.equal(document.querySelector(".reaction-pad"), pad);
  assert.ok(pad.classList.contains("is-target"));
  assert.equal(pad.classList.contains("is-false-start"), false);
  await h.tick(123); await h.run(g => g.handlePointerDown({button:0,isPrimary:true,timeStamp:h.now()}));
  assert.deepEqual(h.value.times, [123]);
  assert.equal(pad.querySelector("strong").textContent, "123 ms");
});

for (const trainingType of ["grid", "cards", "flip", "reaction"]) {
  test(`${trainingType} completes into the shared result handoff and retries without a stale view`, async t => {
    const {useReactionGame} = loadGame("useReactionGame");
    const {ReactionGame} = loadGame("ReactionGame");
    const settings = {...DEFAULT_SETTINGS,trainingType};
    const saved = [];
    if (trainingType === "reaction") t.mock.method(Math, "random", () => .2);
    const h = await mountHook(t, () => {
      const nback = useGameController(settings,false,DEFAULT_SHORTCUT_KEYS,false,r => saved.push(r));
      const flip = useFlipMemoryGame({settings,soundEnabled:false,paused:false,onSessionFinished:r => saved.push(r)});
      const reaction = useReactionGame({settings,soundEnabled:false,paused:false,onSessionFinished:r => saved.push(r)});
      const game = trainingType === "flip" ? flip : trainingType === "reaction" ? reaction : nback;
      const finished = (game.flipPhase ?? game.phase) === "finished";
      const content = trainingType === "flip"
        ? createElement(FlipMemoryGame, {settings,game,paused:false,onEditSettings:noop,onOpenLeaderboard:noop})
        : trainingType === "reaction"
          ? createElement(ReactionGame, {settings,game,paused:false,onEditSettings:noop,onOpenLeaderboard:noop})
          : createElement(NBackGame, {settings,game,editSettings:noop,onOpenLeaderboard:noop});
      return {...game,view:createElement(TransitionSurface, {viewKey:finished ? "result" : "game",instant:!finished},content)};
    });
    if (trainingType === "grid" || trainingType === "cards") {
      await h.run(g => g.beginCountdown()); await h.tick(2600);
      for (let round = 0; round < settings.total; round++) {
        await h.tick(1000);
        if (round < settings.n) {
          await h.run(g => g.advanceWarmup());
          if (trainingType === "cards") await h.tick(CARD_FLIP_DURATION_MS);
        } else {await h.run(g => g.respond("exact")); await h.tick(450);}
      }
    } else if (trainingType === "flip") {
      await h.run(g => g.beginGame()); await h.tick(FLIP_REVEAL_DURATION_MS);
      for (let round = 0; round < settings.flipRounds; round++) {
        await h.run(g => g.finishPreview()); await h.tick(FLIP_REVEAL_DURATION_MS);
        await h.run(g => g.cards.filter(card => card.isTarget).forEach(g.chooseCard));
        await h.run(g => g.advanceRound());
        if (round + 1 < settings.flipRounds) await h.tick(2 * FLIP_REVEAL_DURATION_MS);
      }
    } else {
      await h.run(g => g.beginTest());
      for (let round = 0; round < settings.reactionRounds; round++) {
        await h.tick(1840 + 200);
        await h.run(g => g.handlePointerDown({button:0,timeStamp:h.now()}));
        await h.tick(720);
      }
    }
    assert.equal(saved.length, 1);
    assert.ok(document.querySelector(".surface-view.is-current .result-panel"));
    assert.ok(document.querySelector(".surface-view.is-leaving[inert]"));
    assert.equal(h.value.phase ?? h.value.flipPhase, "finished");
    await h.tick(180);
    assert.equal(document.querySelector(".surface-view.is-leaving"), null);
    await h.run(() => document.querySelector(".result-actions .secondary-button").click());
    assert.equal(Boolean(document.querySelector(".result-panel")), false);
    assert.ok(document.querySelector(".surface-view.is-current.is-instant"));
    assert.equal(saved.length, 1);
  });
}
