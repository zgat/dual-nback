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

test("keeps separate classic and moving flip histories and ranks cards before time", () => {
  let leaderboard = createEmptyLeaderboard();
  for (let index = 0; index < 11; index += 1) {
    leaderboard = recordFlipLeaderboardResult(leaderboard, {
      cardCount: index % 2 === 0 ? 16 : 6,
      difficulty: "classic",
      rounds: 8,
      mistakes: 0,
      elapsedMs: 9000 - index,
    }, index + 1);
  }
  leaderboard = recordFlipLeaderboardResult(leaderboard, {
    cardCount: 16,
    difficulty: "moving",
    rounds: 8,
    mistakes: 0,
    elapsedMs: 2000,
  }, 20);
  leaderboard = recordFlipLeaderboardResult(leaderboard, {
    cardCount: 16,
    difficulty: "moving",
    rounds: 8,
    mistakes: 1,
    elapsedMs: 1000,
  }, 21);

  assert.equal(leaderboard.flip.classic.length, 10);
  assert.equal(leaderboard.flip.moving.length, 1);
  assert.equal(Math.min(...leaderboard.flip.classic.map(({ createdAt }) => createdAt)), 2);
  const ranked = rankFlipEntries(leaderboard.flip.classic);
  assert.ok(ranked.slice(0, 5).every(({ cardCount }) => cardCount === 16));
  assert.ok(ranked[0].elapsedMs < ranked[1].elapsedMs);

  const migrated = normalizeLeaderboard({ ...leaderboard, version: 2, flip: [...leaderboard.flip.classic, ...leaderboard.flip.moving] });
  assert.equal(migrated.flip.classic.length, 9);
  assert.equal(migrated.flip.moving.length, 1);
});

test("fixes challenge sessions at 30 rounds and flip memory at 8 rounds", () => {
  assert.equal(normalizeSettings({ ...DEFAULT_SETTINGS, mode: "challenge", total: 20 }).total, 30);
  assert.equal(normalizeSettings({ ...DEFAULT_SETTINGS, mode: "self-paced", total: 20 }).total, 20);
  assert.equal(normalizeSettings({ ...DEFAULT_SETTINGS, flipRounds: 5 }).flipRounds, 8);
});

test("counts challenge successes separately for every interval and game", () => {
  const result = (trainingType, interval, correct) => ({
    settings: { ...DEFAULT_SETTINGS, trainingType, mode: "challenge", interval },
    elapsedMs: 20000,
    stats: { ...EMPTY_STATS, correct, total: 10 },
  });
  let leaderboard = createEmptyLeaderboard();
  leaderboard = recordLeaderboardResult(leaderboard, result("grid", 2400, 7), 1);
  leaderboard = recordLeaderboardResult(leaderboard, result("grid", 2400, 5), 2);
  leaderboard = recordLeaderboardResult(leaderboard, result("grid", 1800, 4), 3);
  leaderboard = recordLeaderboardResult(leaderboard, result("cards", 2400, 8), 4);

  assert.equal(leaderboard.challenge.grid["2400"], 12);
  assert.equal(leaderboard.challenge.grid["1800"], 4);
  assert.equal(leaderboard.challenge.cards["2400"], 8);
});

test("creates unique flip cards, exact target counts, and visible shuffle steps", () => {
  const cards = makeFlipCards(16, 5, seededRandom(23));
  assert.equal(new Set(cards.map((card) => card.id)).size, 16);
  assert.equal(cards.filter((card) => card.isTarget).length, 5);

  const steps = makeVisibleShuffleSteps(9, seededRandom(29));
  assert.ok(steps.length >= 4);
  assert.ok(steps.every(([from, to]) => from !== to && from >= 0 && to < 9));
  assert.equal(new Set(steps.flat()).size, 9);
});
