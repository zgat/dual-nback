import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SETTINGS,
  EMPTY_STATS,
  OPTIONS,
  classify,
  makeBalancedRelations,
  makeFlipCards,
  makeSequence,
  makeVisibleShuffleSteps,
  normalizeSettings,
  recordTrialResult,
} from "../app/game/core.ts";
import {
  DEFAULT_SHORTCUT_KEYS,
  assignShortcutKey,
  normalizeShortcutKey,
  normalizeShortcutKeys,
} from "../app/game/shortcuts.ts";
import {
  createEmptyLeaderboard,
  normalizeLeaderboard,
  rankFlipEntries,
  recordFlipLeaderboardResult,
  recordLeaderboardResult,
} from "../app/game/leaderboard.ts";

function seededRandom(seed = 1) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 2 ** 32;
  };
}

function assertBalanced(relations) {
  const counts = OPTIONS.map(({ id }) => relations.filter((relation) => relation === id).length);
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `relation counts are ${counts.join(",")}`);
  for (let index = 2; index < relations.length; index += 1) {
    assert.notEqual(
      relations[index - 2] === relations[index - 1] && relations[index - 1] === relations[index],
      true,
      `three identical relations at index ${index}`,
    );
  }
}

test("builds balanced relation decks without three-answer streaks", () => {
  assertBalanced(makeBalancedRelations(27, seededRandom(42)));
  assertBalanced(makeBalancedRelations(18, seededRandom(7)));
});

for (const trainingType of ["grid", "cards"]) {
  test(`generates a balanced ${trainingType} N-Back sequence`, () => {
    const settings = { ...DEFAULT_SETTINGS, trainingType, n: 3, total: 30 };
    const sequence = makeSequence(settings, seededRandom(trainingType === "grid" ? 11 : 19));
    const relations = sequence.slice(settings.n).map((trial, index) => classify(trial, sequence[index]));
    assert.equal(sequence.length, settings.total);
    assertBalanced(relations);
  });
}

test("records per-category attempts as well as correct answers", () => {
  let stats = recordTrialResult(EMPTY_STATS, "exact", "exact");
  stats = recordTrialResult(stats, "color", null);
  stats = recordTrialResult(stats, "different", "position");

  assert.deepEqual(
    { correct: stats.correct, total: stats.total, misses: stats.misses, bestStreak: stats.bestStreak },
    { correct: 1, total: 3, misses: 1, bestStreak: 1 },
  );
  assert.equal(stats.categoryHits.exact, 1);
  assert.equal(stats.categoryTotals.exact, 1);
  assert.equal(stats.categoryTotals.color, 1);
  assert.equal(stats.categoryTotals.different, 1);
});

test("normalizes keyboard shortcuts and swaps duplicate assignments", () => {
  assert.equal(normalizeShortcutKey("A"), "a");
  assert.equal(normalizeShortcutKey("Spacebar"), " ");
  assert.equal(normalizeShortcutKey("Enter"), "Enter");
  assert.equal(normalizeShortcutKey("Escape"), null);

  const swapped = assignShortcutKey(DEFAULT_SHORTCUT_KEYS, "exact", "2");
  assert.equal(swapped.exact, "2");
  assert.equal(swapped.position, "1");
  assert.deepEqual(normalizeShortcutKeys(swapped), swapped);
  assert.deepEqual(normalizeShortcutKeys({ ...swapped, color: "2" }), DEFAULT_SHORTCUT_KEYS);
});

test("ranks the ten best timed sessions by accuracy, rounds, then elapsed time", () => {
  const result = (correct, elapsedMs, total = 20) => ({
    settings: { ...DEFAULT_SETTINGS, trainingType: "grid", mode: "self-paced", total },
    elapsedMs,
    stats: { ...EMPTY_STATS, correct, total: 10 },
  });
  let leaderboard = createEmptyLeaderboard();
  leaderboard = recordLeaderboardResult(leaderboard, result(8, 7000), 1);
  leaderboard = recordLeaderboardResult(leaderboard, result(9, 5000, 20), 2);
  leaderboard = recordLeaderboardResult(leaderboard, result(9, 9000, 30), 3);
  leaderboard = recordLeaderboardResult(leaderboard, result(9, 6000, 30), 4);
  for (let index = 0; index < 9; index += 1) {
    leaderboard = recordLeaderboardResult(leaderboard, result(7, 5000 + index), 10 + index);
  }

  assert.equal(leaderboard.timed.grid.length, 10);
  assert.deepEqual(
    leaderboard.timed.grid.slice(0, 4).map(({ accuracy, totalRounds, elapsedMs }) => [accuracy, totalRounds, elapsedMs]),
    [[90, 30, 6000], [90, 30, 9000], [90, 20, 5000], [80, 20, 7000]],
  );
});

test("keeps timed flip best tens and counts challenge successes by card count", () => {
  let leaderboard = createEmptyLeaderboard();
  const add = (mode, difficulty, found, mistakes, rounds, elapsedMs, now, cardCount = 16) => {
    leaderboard = recordFlipLeaderboardResult(leaderboard, {
      cardCount,
      suitCount: 4,
      mode,
      difficulty,
      rounds,
      found,
      mistakes,
      elapsedMs,
    }, now);
  };
  add("self-paced", "classic", 10, 0, 5, 20000, 1);
  add("self-paced", "classic", 9, 1, 8, 9000, 2);
  add("self-paced", "classic", 9, 1, 8, 6000, 3);
  add("self-paced", "classic", 9, 1, 5, 1000, 4);
  for (let index = 0; index < 8; index += 1) add("self-paced", "classic", 5, 5, 8, 5000 + index, 10 + index);
  add("self-paced", "moving", 8, 2, 8, 4000, 20);
  add("challenge", "classic", 10, 0, 5, 1000, 21);
  add("challenge", "classic", 10, 0, 8, 9000, 22);
  add("challenge", "classic", 9, 1, 8, 6000, 23);
  add("challenge", "classic", 10, 0, 8, 4000, 24, 9);
  add("challenge", "moving", 10, 0, 8, 3500, 25);

  assert.equal(leaderboard.flip["self-paced"].classic.length, 10);
  assert.equal(leaderboard.flip["self-paced"].moving.length, 1);
  assert.deepEqual(leaderboard.flip.challenge.classic, { "9": 1, "16": 1 });
  assert.deepEqual(leaderboard.flip.challenge.moving, { "16": 1 });
  const ranked = rankFlipEntries(leaderboard.flip["self-paced"].classic);
  assert.deepEqual(
    ranked.slice(0, 4).map(({ accuracy, rounds, elapsedMs }) => [accuracy, rounds, elapsedMs]),
    [[100, 5, 20000], [90, 8, 6000], [90, 8, 9000], [90, 5, 1000]],
  );

  const oldPerfect = { ...ranked[0] };
  delete oldPerfect.accuracy;
  delete oldPerfect.mode;
  delete oldPerfect.suitCount;
  const migrated = normalizeLeaderboard({ ...leaderboard, version: 5, flip: { classic: [oldPerfect], moving: [] } });
  assert.equal(migrated.flip.challenge.classic["16"], 1);
});

test("fixes N-Back challenges at 30 rounds and flip-memory challenges at 8 rounds", () => {
  assert.equal(normalizeSettings({ ...DEFAULT_SETTINGS, mode: "challenge", total: 20 }).total, 30);
  assert.equal(normalizeSettings({ ...DEFAULT_SETTINGS, mode: "self-paced", total: 20 }).total, 20);
  assert.equal(normalizeSettings({ ...DEFAULT_SETTINGS, flipMode: "challenge" }).flipMode, "challenge");
  assert.equal(normalizeSettings({ ...DEFAULT_SETTINGS, flipMode: "challenge", flipRounds: 5 }).flipRounds, 8);
  assert.equal(normalizeSettings({ ...DEFAULT_SETTINGS, flipSuitCount: 2 }).flipSuitCount, 2);
  assert.equal(normalizeSettings({ ...DEFAULT_SETTINGS, flipMode: "self-paced", flipRounds: 5 }).flipRounds, 5);
  assert.equal(normalizeSettings({ ...DEFAULT_SETTINGS, flipMode: "self-paced", flipRounds: 8 }).flipRounds, 8);
});

test("counts challenge successes separately for every interval and game", () => {
  const result = (trainingType, interval, correct) => ({
    settings: { ...DEFAULT_SETTINGS, trainingType, mode: "challenge", interval },
    elapsedMs: 20000,
    stats: { ...EMPTY_STATS, correct, total: 10 },
  });
  let leaderboard = createEmptyLeaderboard();
  leaderboard = recordLeaderboardResult(leaderboard, result("grid", 2400, 10), 1);
  leaderboard = recordLeaderboardResult(leaderboard, result("grid", 2400, 5), 2);
  leaderboard = recordLeaderboardResult(leaderboard, result("grid", 1800, 10), 3);
  leaderboard = recordLeaderboardResult(leaderboard, result("cards", 2400, 10), 4);

  assert.equal(leaderboard.challenge.grid["2400"], 1);
  assert.equal(leaderboard.challenge.grid["1800"], 1);
  assert.equal(leaderboard.challenge.cards["2400"], 1);

  const migrated = normalizeLeaderboard({ ...leaderboard, version: 4, challenge: { grid: { "2400": 25 }, cards: { "2400": 12 } } });
  assert.deepEqual(migrated.challenge, { grid: {}, cards: {} });
});

test("creates unique flip cards, exact target counts, and visible shuffle steps", () => {
  const twoSuitCards = makeFlipCards(16, 5, 2, seededRandom(23));
  const fourSuitCards = makeFlipCards(16, 5, 4, seededRandom(29));
  assert.equal(new Set(twoSuitCards.map((card) => card.id)).size, 16);
  assert.equal(twoSuitCards.filter((card) => card.isTarget).length, 5);
  assert.equal(new Set(twoSuitCards.map((card) => card.suit.name)).size, 2);
  assert.equal(new Set(fourSuitCards.map((card) => card.suit.name)).size, 4);

  const steps = makeVisibleShuffleSteps(9, seededRandom(31));
  assert.ok(steps.length >= 4);
  assert.ok(steps.every(([from, to]) => from !== to && from >= 0 && to < 9));
  assert.equal(new Set(steps.flat()).size, 9);
});
