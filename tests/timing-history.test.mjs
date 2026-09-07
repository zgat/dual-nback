import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import { createSessionClock } from "../app/game/sessionClock.ts";
import { createEmptyLeaderboard, normalizeLeaderboard, recordLeaderboardResult, recordFlipLeaderboardResult } from "../app/game/leaderboard.ts";
import { DEFAULT_SETTINGS, EMPTY_STATS } from "../app/game/core.ts";
import { loadGame } from "./helpers/load-game.mjs";

const { createHistoryStore } = loadGame("historyStore");
const result = (overrides = {}) => ({ settings: DEFAULT_SETTINGS, stats: { ...EMPTY_STATS, correct: 18, total: 18 }, elapsedMs: 27650, ...overrides });

test("finished session time is frozen through repeated pauses and result delays", () => {
  let now = 0;
  const clock = createSessionClock(() => now);
  clock.start(); now = 1000; clock.pause(); now = 6000; clock.resume();
  now = 32650;
  assert.equal(clock.finish(), 27650);
  clock.pause(); now += 60000; clock.resume();
  assert.equal(clock.finish(), 27650);
  assert.equal(clock.elapsed(), 27650);
  clock.start(); now += 6000;
  assert.equal(clock.finish(), 6000);
  now += 10000;
  assert.equal(clock.finish(), 6000);
});

test("sorts exact accuracy before rounds and preserves precision after reload", () => {
  let data = createEmptyLeaderboard();
  for (const [correct, total, n, rounds] of [[14,15,5,20],[27,29,1,30]]) {
    data = recordLeaderboardResult(data, result({ settings: { ...DEFAULT_SETTINGS, n, total: rounds }, stats: { ...EMPTY_STATS, correct, total } }));
  }
  assert.deepEqual(data.timed.grid.map(e => e.correct), [14,27]);
  for (const [found,mistakes,rounds,cardCount] of [[25,4,5,16],[24,4,8,8]]) {
    data = recordFlipLeaderboardResult(data, { found,mistakes,rounds,cardCount,suitCount:4,mode:"self-paced",difficulty:"classic",elapsedMs:10000 });
  }
  const reloaded = normalizeLeaderboard(JSON.parse(JSON.stringify(data)));
  assert.deepEqual(reloaded.flip["self-paced"].classic.map(e => e.correct), [25,24]);
  assert.ok(reloaded.flip["self-paced"].classic.every(e => e.attempts));
});

test("concurrent tabs keep both new scores and migrate legacy history without deleting it", async () => {
  const db = new IDBFactory();
  const legacy = recordLeaderboardResult(createEmptyLeaderboard(), result({elapsedMs:10000}), 1);
  const tabA = createHistoryStore(() => db, () => legacy);
  const tabB = createHistoryStore(() => db, () => legacy);
  await Promise.all([tabA.read(),tabB.read()]);
  await Promise.all([
    tabA.update(data => recordLeaderboardResult(data, result({elapsedMs:20000}), 2)),
    tabB.update(data => recordLeaderboardResult(data, result({elapsedMs:30000}), 3)),
  ]);
  const {data} = await tabA.read();
  assert.deepEqual(data.timed.grid.map(e => e.elapsedMs), [10000,20000,30000]);
  assert.equal(legacy.timed.grid.length, 1);
});

test("concurrent challenge successes are incremented atomically", async () => {
  const db = new IDBFactory();
  const tabs = Array.from({length:8}, () => createHistoryStore(() => db, createEmptyLeaderboard));
  const challenge = result({settings:{...DEFAULT_SETTINGS, mode:"challenge", total:30}});
  await Promise.all(tabs.map(tab => tab.update(data => recordLeaderboardResult(data, challenge))));
  const {data,revision} = await tabs[0].read();
  assert.equal(data.challenge.grid[2400], 8);
  assert.equal(revision, 8);
});

test("disabled storage retains session history in memory", async () => {
  const store = createHistoryStore(() => undefined, createEmptyLeaderboard);
  await store.update(data => recordLeaderboardResult(data, result()));
  const snapshot=await store.read();
  assert.equal(snapshot.data.timed.grid.length, 1);
  assert.equal(snapshot.storageAvailable,false);
});

test("one transient open failure is retried without hiding saved history",async()=>{
  const db=new IDBFactory();
  const seed=createHistoryStore(()=>db,createEmptyLeaderboard);
  await seed.update(data=>recordLeaderboardResult(data,result(),1));
  let calls=0;
  const factory={open(...args) {
    if(++calls>1) return db.open(...args);
    const request={};
    queueMicrotask(()=>{request.error=new DOMException("Temporary error","UnknownError");request.onerror();});
    return request;
  }};
  const store=createHistoryStore(()=>factory,createEmptyLeaderboard);
  const snapshot=await store.read();
  assert.equal(snapshot.storageAvailable,true);
  assert.equal(snapshot.data.timed.grid.length,1);
  assert.equal(calls,2);
});

test("recovered writes merge pending scores with concurrent tab changes exactly once",async()=>{
  const db=new IDBFactory();
  let available=false;
  const store=createHistoryStore(()=>available?db:undefined,createEmptyLeaderboard);
  const other=createHistoryStore(()=>db,createEmptyLeaderboard);
  const challenge=result({settings:{...DEFAULT_SETTINGS,mode:"challenge",total:30}});
  await store.update(data=>recordLeaderboardResult(data,result({elapsedMs:10000}),1));
  await store.update(data=>recordLeaderboardResult(data,challenge));
  await store.update(data=>recordLeaderboardResult(data,challenge));
  await other.update(data=>recordLeaderboardResult(data,result({elapsedMs:20000}),2));
  await other.update(data=>recordLeaderboardResult(data,challenge));
  available=true;
  const recovered=await store.read();
  assert.equal(recovered.storageAvailable,true);
  assert.deepEqual(recovered.data.timed.grid.map(e=>e.elapsedMs),[10000,20000]);
  assert.equal(recovered.data.challenge.grid[2400],3);
  const reread=await store.read();
  assert.equal(reread.data.challenge.grid[2400],3);
  assert.equal(reread.revision,5);
  assert.deepEqual((await other.read()).data,recovered.data);
});

test("an aborted write is retried without double counting challenge success",async()=>{
  const db=new IDBFactory();
  const store=createHistoryStore(()=>db,createEmptyLeaderboard);
  const {IDBObjectStore}=await import("fake-indexeddb");
  const originalPut=IDBObjectStore.prototype.put;
  let fail=true;
  IDBObjectStore.prototype.put=function(...args) {
    const request=originalPut.apply(this,args);
    if(fail) {fail=false;this.transaction.abort();}
    return request;
  };
  try {
    const challenge=result({settings:{...DEFAULT_SETTINGS,mode:"challenge",total:30}});
    const saved=await store.update(data=>recordLeaderboardResult(data,challenge));
    assert.equal(saved.storageAvailable,true);
    assert.equal(saved.data.challenge.grid[2400],1);
    assert.equal((await store.read()).data.challenge.grid[2400],1);
  } finally { IDBObjectStore.prototype.put=originalPut; }
});
