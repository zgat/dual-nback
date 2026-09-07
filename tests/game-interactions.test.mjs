import assert from "node:assert/strict";
import test from "node:test";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import { loadGame } from "./helpers/load-game.mjs";
import { mountHook } from "./helpers/react-harness.mjs";

const {DEFAULT_SETTINGS, classify, FLIP_REVEAL_DURATION_MS, FLIP_SWAP_DURATION_MS, CARD_FLIP_DURATION_MS} = loadGame("core");
const {DEFAULT_SHORTCUT_KEYS} = loadGame("shortcuts");
const {useGameController} = loadGame("useGameController");
const {useFlipMemoryGame} = loadGame("useFlipMemoryGame");
const {useReactionGame} = loadGame("useReactionGame");
const noop = () => {};

for(const trainingType of ["grid","cards"]) {
  test(`${trainingType} N-Back last-answer pause cannot reduce the final time`,async t=>{
    let saved;
    const h=await mountHook(t,()=>useGameController({...DEFAULT_SETTINGS,trainingType},false,DEFAULT_SHORTCUT_KEYS,false,result=>{saved=result;}));
    await h.run(g=>g.beginCountdown()); await h.tick(2600);
    const seen=[];
    for(let round=0;round<20;round++) {
      seen.push(h.value.current); await h.tick(1000);
      await h.run(g=>round<2 ? g.advanceWarmup() : g.respond(classify(seen[round],seen[round-2])));
      if (round<2 && trainingType==="cards") await h.tick(CARD_FLIP_DURATION_MS);
      if(round===19) {
        await h.run(g=>g.pauseGame()); await h.tick(60000); await h.run(g=>g.resumeGame());
      }
      if(round>=2) await h.tick(450);
    }
    assert.equal(saved.elapsedMs,27650 + (trainingType === "cards" ? 2 * CARD_FLIP_DURATION_MS : 0));
    assert.equal(saved.stats.correct,18);
  });
}

test("N-Back shortcuts preserve home, other games, editable controls and browser shortcuts",async t=>{
  let settings=DEFAULT_SETTINGS;
  const h=await mountHook(t,()=>useGameController(settings,false,DEFAULT_SHORTCUT_KEYS));
  assert.equal((await h.key("Enter")).defaultPrevented,false);
  await h.run(g=>g.beginCountdown()); await h.tick(2600);
  assert.equal((await h.key("Escape")).defaultPrevented,true);
  assert.equal(h.value.phase,"paused");
  await h.key("Escape"); assert.equal(h.value.phase,"playing");
  const input=document.createElement("input"); document.body.appendChild(input);
  assert.equal((await h.key("Enter",{},input)).defaultPrevented,false);
  assert.equal((await h.key("Enter",{ctrlKey:true})).defaultPrevented,false);
  assert.equal((await h.key("Enter",{repeat:true})).defaultPrevented,false);
  assert.equal(h.value.round,0);
  assert.equal((await h.key("Enter")).defaultPrevented,true);
  assert.equal(h.value.round,1);
  await h.run(g=>g.goHome());
  for(const trainingType of ["flip","reaction"]) {
    settings={...DEFAULT_SETTINGS,trainingType}; await h.render();
    assert.equal((await h.key("Enter")).defaultPrevented,false);
    assert.equal((await h.key("1")).defaultPrevented,false);
  }
});

test("N-Back leaves Enter and mapped Space to the focused control",async t=>{
  const h=await mountHook(t,()=>useGameController(DEFAULT_SETTINGS,false,{...DEFAULT_SHORTCUT_KEYS,advance:" "}));
  await h.run(g=>g.beginCountdown());await h.tick(2600);
  const button=document.createElement("button");document.body.appendChild(button);button.focus();
  assert.equal((await h.key("Enter",{},button)).defaultPrevented,false);
  assert.equal((await h.key(" ",{},button)).defaultPrevented,false);
  assert.equal(h.value.round,0);
  button.blur();await h.key(" ");assert.equal(h.value.round,1);
});

for(const interval of [1200,2400,3000]) for(const pauseAt of [80,240,1000]) {
  test(`card ${interval} ms visible budget survives pause at ${pauseAt} ms`,async t=>{
    const h=await mountHook(t,()=>useGameController({...DEFAULT_SETTINGS,trainingType:"cards",mode:"challenge",interval,total:30},false,DEFAULT_SHORTCUT_KEYS));
    await h.run(g=>g.beginCountdown());await h.tick(2600);
    await h.tick(interval+2*CARD_FLIP_DURATION_MS);assert.equal(h.value.round,1);
    await h.tick(pauseAt);await h.run(g=>g.pauseGame());await h.tick(5000);
    assert.equal(h.value.stimulusVisible,false);
    await h.run(g=>g.resumeGame());
    const fullyVisibleBefore=Math.max(0,pauseAt-CARD_FLIP_DURATION_MS);
    const remaining=CARD_FLIP_DURATION_MS+interval-fullyVisibleBefore;
    await h.tick(remaining-1);assert.equal(h.value.stimulusVisible,true);
    await h.tick(1);assert.equal(h.value.stimulusVisible,false);
    await h.run(g=>g.pauseGame());await h.tick(5000);await h.run(g=>g.resumeGame());
    await h.tick(CARD_FLIP_DURATION_MS);assert.equal(h.value.round,2);
  });
}

test("repeated card pauses compensate each fresh opening exactly once",async t=>{
  const h=await mountHook(t,()=>useGameController({...DEFAULT_SETTINGS,trainingType:"cards",mode:"challenge"},false,DEFAULT_SHORTCUT_KEYS));
  await h.run(g=>g.beginCountdown());await h.tick(2600);
  for(const duration of [1000,80,500]) {
    await h.tick(duration);await h.run(g=>g.pauseGame());await h.run(g=>g.pauseGame());
    await h.tick(1);await h.run(g=>g.resumeGame());await h.run(g=>g.resumeGame());
  }
  // 760 + 0 + 260 ms of full face time consumed; 1380 ms plus a 240 ms opening remain.
  await h.tick(1619);assert.equal(h.value.stimulusVisible,true);
  await h.tick(1);assert.equal(h.value.stimulusVisible,false);
});

for(const flipMode of ["self-paced","challenge"]) {
  test(`flip ${flipMode} saves at the last target, once per completed session`,async t=>{
    const saved=[];
    const settings={...DEFAULT_SETTINGS,trainingType:"flip",flipMode,flipRounds:flipMode==="challenge"?8:5};
    const h=await mountHook(t,()=>useFlipMemoryGame({settings,soundEnabled:false,paused:false,onSessionActiveChange:noop,onSessionFinished:r=>saved.push(r)}));
    await h.run(g=>g.beginGame());
    await h.tick(FLIP_REVEAL_DURATION_MS);
    for(let round=0;round<settings.flipRounds;round++) {
      await h.tick(flipMode==="challenge"?5000:1000);
      if(flipMode==="self-paced") await h.run(g=>g.finishPreview());
      await h.tick(FLIP_REVEAL_DURATION_MS);
      const targets=h.value.cards.filter(c=>c.isTarget);
      for(const card of targets) {await h.tick(100);await h.run(g=>g.chooseCard(card));}
      if(round+1<settings.flipRounds) {
        assert.equal(saved.length,0);await h.run(g=>g.advanceRound());
        await h.tick(2 * FLIP_REVEAL_DURATION_MS);
      } else {
        assert.equal(saved.length,1);
        assert.equal(saved[0].found,settings.flipRounds*2);
        assert.equal(saved[0].mistakes,0);
        await h.run(g=>g.chooseCard(targets.at(-1)));
        await h.tick(60000);await h.run(g=>g.advanceRound());await h.run(g=>g.advanceRound());
        assert.equal(saved.length,1);
      }
    }
    assert.equal(h.value.elapsedMs,saved[0].elapsedMs);
    await h.run(g=>g.beginGame());assert.equal(h.value.stats.found,0);
    assert.equal(saved.length,1);
  });
}

test("flip final target freezes elapsed time before waiting for results",async t=>{
  let saved,paused=false;
  const h=await mountHook(t,()=>useFlipMemoryGame({settings:DEFAULT_SETTINGS,soundEnabled:false,paused,onSessionActiveChange:noop,onSessionFinished:result=>{saved=result;}}));
  await h.run(g=>g.beginGame());
  await h.tick(FLIP_REVEAL_DURATION_MS);
  for(let round=0;round<5;round++) {
    await h.tick(1000); await h.run(g=>g.finishPreview()); await h.tick(FLIP_REVEAL_DURATION_MS);
    for(const card of h.value.cards.filter(card=>card.isTarget)) {
      await h.tick(100); await h.run(g=>g.chooseCard(card));
    }
    if(round===4) {paused=true;await h.render();await h.tick(5000);paused=false;await h.render();await h.tick(10000);}
    await h.run(g=>g.advanceRound());
    if (round < 4) await h.tick(2 * FLIP_REVEAL_DURATION_MS);
  }
  assert.equal(saved.elapsedMs,6000);
  assert.equal(saved.found,10);
});

test("flip errors close after 650 active ms and swaps keep their remaining paused duration",async t=>{
  let paused=false;
  const h=await mountHook(t,()=>useFlipMemoryGame({settings:{...DEFAULT_SETTINGS,flipDifficulty:"moving"},soundEnabled:false,paused,onSessionActiveChange:noop,onSessionFinished:noop}));
  await h.run(g=>g.beginGame()); await h.tick(FLIP_REVEAL_DURATION_MS); await h.run(g=>g.finishPreview()); await h.tick(420);
  assert.ok(h.value.activeSwap);
  const before=h.value.cards.map(c=>c.id);
  await h.tick(200); paused=true;await h.render();await h.tick(3000);
  assert.deepEqual(h.value.cards.map(c=>c.id),before);
  paused=false;await h.render();await h.tick(FLIP_SWAP_DURATION_MS-201);
  assert.deepEqual(h.value.cards.map(c=>c.id),before);
  await h.tick(1); assert.notDeepEqual(h.value.cards.map(c=>c.id),before);
  await h.tick(10000); assert.equal(h.value.flipPhase,"selecting");
  const wrong=h.value.cards.find(c=>!c.isTarget);
  await h.run(g=>g.chooseCard(wrong)); await h.tick(200);
  paused=true;await h.render();await h.tick(3000);
  assert.ok(h.value.mistakeIds.includes(wrong.id));
  paused=false;await h.render();await h.tick(449);
  assert.ok(h.value.mistakeIds.includes(wrong.id));
  await h.tick(1);assert.equal(h.value.mistakeIds.length,0);
});

test("reaction timing starts at target commit; pointer down and space count once without release",async t=>{
  t.mock.method(Math,"random",()=>0);
  const h=await mountHook(t,()=>useReactionGame({settings:DEFAULT_SETTINGS,soundEnabled:false,paused:false,onSessionActiveChange:noop,onSessionFinished:noop}));
  await h.run(g=>g.beginTest()); await h.tick(1400,40); await h.tick(200);
  await h.run(g=>{
    g.handlePointerDown({button:0,isPrimary:true,timeStamp:h.now()});
    g.handleClick({detail:0,timeStamp:h.now()});
  });
  assert.deepEqual(h.value.times,[200]);
  await h.tick(720); await h.tick(1400); await h.tick(250);
  const space=await h.key(" ");
  assert.equal(space.defaultPrevented,true);
  assert.deepEqual(h.value.times,[200,250]);
  await h.key(" ",{repeat:true}); assert.equal(h.value.times.length,2);
});

test("reaction pause excludes paused time and restarting clears the previous round",async t=>{
  t.mock.method(Math,"random",()=>0);
  let paused=false;
  const h=await mountHook(t,()=>useReactionGame({settings:DEFAULT_SETTINGS,soundEnabled:false,paused,onSessionActiveChange:noop,onSessionFinished:noop}));
  await h.run(g=>g.beginTest());await h.tick(1400);await h.tick(100);
  paused=true;await h.render();await h.tick(5000);
  await h.run(g=>g.handlePointerDown({button:0,timeStamp:h.now()}));assert.equal(h.value.times.length,0);
  paused=false;await h.render();await h.tick(100);
  await h.run(g=>g.handlePointerDown({button:0,timeStamp:h.now()}));assert.deepEqual(h.value.times,[200]);
  await h.run(g=>g.beginTest());assert.equal(h.value.times.length,0);
  await h.tick(1000);assert.equal(h.value.phase,"waiting");
  await h.tick(400);assert.equal(h.value.phase,"target");
});

test("select menu portals out of clipped game layout and retains keyboard focus",async t=>{
  const {SelectMenu}=loadGame("SelectMenu");
  let selected=1;
  const options=[{value:1,label:"第一项"},{value:2,label:"第二项"}];
  const h=await mountHook(t,()=>({view:createElement(SelectMenu,{value:selected,options,placeholder:"选择",ariaLabel:"测试选择",onChange:value=>{selected=value;}})}));
  const trigger=document.querySelector(".custom-select-trigger");
  await h.run(()=>trigger.click());
  const menu=document.querySelector("[role=listbox]");
  assert.equal(menu.parentElement,document.body);
  assert.equal(menu.style.visibility,"visible");
  await h.key("ArrowDown",{},document.activeElement);
  assert.equal(document.activeElement.textContent,"第二项");
  await h.run(()=>document.activeElement.click());await h.tick(120);await h.render();
  assert.equal(selected,2);assert.equal(document.querySelector("[role=listbox]"),null);
  assert.equal(document.activeElement,trigger);
  await h.run(()=>trigger.click());await h.key("Escape",{},document.activeElement);
  assert.equal(document.querySelector("[role=listbox]").getAttribute("aria-hidden"),"true");
  await h.tick(120);
  assert.equal(document.querySelector("[role=listbox]"),null);
});

test("all score units use the shared result shell with the correct ring and actions",()=>{
  const {ResultPanel}=loadGame("ResultPanel");
  for(const unit of ["%","ms"]) {
    const html=renderToStaticMarkup(createElement(ResultPanel,{label:"结果",score:unit==="%"?90:240,unit,scoreLabel:"成绩",config:createElement("span",null,"5 轮"),time:{label:"用时",value:"10 秒"},retryLabel:"再练一轮",onRetry:noop,onEditSettings:noop,onOpenLeaderboard:noop}));
    assert.match(html,/result-config/);assert.match(html,/result-actions/);assert.match(html,/修改设置/);assert.match(html,/查看历史最佳/);
    if(unit==="ms") {assert.match(html,/score-ring reaction-score-ring/);assert.doesNotMatch(html,/--score/);}
    else assert.match(html,/--score:324deg/);
  }
});

test("history failure state recovers automatically and broadcasts replayed writes",async t=>{
  const {IDBFactory}=await import("fake-indexeddb");
  const {createHistoryStore}=loadGame("historyStore");
  const {createEmptyLeaderboard}=loadGame("leaderboard");
  const {useLeaderboard}=loadGame("useLeaderboard");
  const db=new IDBFactory();
  let available=false,now=1000;
  t.mock.method(Date,"now",()=>now);
  const store=createHistoryStore(()=>available?db:undefined,createEmptyLeaderboard);
  const h=await mountHook(t,()=>useLeaderboard(store));
  assert.equal(h.value.storageAvailable,false);
  await h.run(async g=>{
    g.recordReactionResult({rounds:5,averageMs:250,bestMs:210,falseStarts:0});
    await store.read();
  });
  assert.equal(h.value.data.reaction.length,1);
  assert.equal(window.localStorage.getItem("dual-nback-history-revision"),null);
  available=true;now=6000;await h.tick(5000);
  // Drain the real IndexedDB transaction queue used by the delayed retry.
  await h.run(()=>store.read());
  assert.equal(h.value.storageAvailable,true);
  assert.equal(h.value.data.reaction[0].createdAt,1000);
  assert.equal(window.localStorage.getItem("dual-nback-history-revision"),"1");
  await h.run(g=>g.retrySaving());
  assert.equal(h.value.data.reaction.length,1);
});
