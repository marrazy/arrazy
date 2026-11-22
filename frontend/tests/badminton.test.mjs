// Tests for the badminton app logic. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clampSkill,
  shuffle,
  makeTeams,
  makeRound,
  recordRound,
  pairKey,
  gameWinner,
  newMatch,
  addPoint,
  gamesWon,
  serveCourt,
} from "../public/badminton/logic.js";

// Small seeded random generator so results can be repeated.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const people = (skills) => skills.map((skill, i) => ({ id: `p${i}`, name: `P${i}`, skill }));
const allIds = (teams) => teams.flatMap((t) => t.players.map((p) => p.id)).sort();
const play = (m, seq) => [...seq].reduce((x, s) => addPoint(x, s), m);
const points = (side, n) => side.repeat(n);

// ---------- helpers ----------

test("clampSkill keeps levels between 1 and 5", () => {
  assert.equal(clampSkill(0), 1);
  assert.equal(clampSkill(9), 5);
  assert.equal(clampSkill("4"), 4);
  assert.equal(clampSkill(2.6), 3);
  assert.equal(clampSkill("abc"), 3);
});

test("shuffle keeps every item and does not change the input", () => {
  const input = [1, 2, 3, 4, 5, 6];
  const out = shuffle(input, seeded(1));
  assert.deepEqual(input, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(out.slice().sort(), input);
});

// ---------- teams ----------

test("makeTeams uses every player exactly once", () => {
  const ps = people([5, 4, 4, 3, 3, 2, 2, 1, 1]);
  for (let k = 2; k <= 5; k++) {
    const teams = makeTeams(ps, k, seeded(k));
    assert.equal(teams.length, k);
    assert.deepEqual(allIds(teams), ps.map((p) => p.id).sort());
  }
});

test("makeTeams sizes differ by at most one", () => {
  for (let n = 2; n <= 17; n++) {
    for (let k = 2; k <= Math.min(6, n); k++) {
      const sizes = makeTeams(people(Array.from({ length: n }, (_, i) => (i % 5) + 1)), k, seeded(n * 10 + k)).map((t) => t.players.length);
      assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `n=${n} k=${k} sizes=${sizes}`);
    }
  }
});

test("makeTeams finds a perfect split when one exists", () => {
  // 5+1+3+3 vs 4+2+4+2 style: totals 24 over 8 players -> two teams of 12
  const teams = makeTeams(people([5, 5, 4, 3, 2, 1, 1, 3]), 2, seeded(3));
  assert.equal(teams[0].total, teams[1].total);
});

test("makeTeams never puts the two best players together when that is avoidable", () => {
  for (let seed = 1; seed < 30; seed++) {
    const teams = makeTeams(people([5, 5, 1, 1]), 2, seeded(seed));
    for (const t of teams) assert.deepEqual(t.players.map((p) => p.skill), [5, 1]);
  }
});

test("makeTeams finds the best possible split for random groups", () => {
  // Compare with brute force on small groups split into 2 teams.
  const rng = seeded(42);
  for (let trial = 0; trial < 300; trial++) {
    const n = 4 + Math.floor(rng() * 7); // 4..10 players
    const skills = Array.from({ length: n }, () => 1 + Math.floor(rng() * 5));
    const ps = people(skills);
    const teams = makeTeams(ps, 2, seeded(trial));
    const got = Math.abs(teams[0].average - teams[1].average);

    const half = Math.floor(n / 2);
    let best = Infinity;
    for (let mask = 0; mask < 1 << n; mask++) {
      const size = mask.toString(2).split("1").length - 1;
      if (size !== half) continue;
      const a = skills.filter((_, i) => mask & (1 << i));
      const b = skills.filter((_, i) => !(mask & (1 << i)));
      const d = Math.abs(a.reduce((x, y) => x + y, 0) / a.length - b.reduce((x, y) => x + y, 0) / b.length);
      best = Math.min(best, d);
    }
    assert.ok(got <= best + 1e-9, `skills=${skills} got=${got} best=${best}`);
  }
});

test("makeTeams handles more teams than players and empty lists", () => {
  const teams = makeTeams(people([3, 2]), 5, seeded(1));
  assert.equal(teams.length, 2);
  assert.deepEqual(makeTeams([], 2, seeded(1)).map((t) => t.players.length), [0]);
});

test("makeTeams reports totals and averages", () => {
  const teams = makeTeams(people([4, 2]), 2, seeded(1));
  const t4 = teams.find((t) => t.total === 4);
  assert.equal(t4.average, 4);
});

// ---------- courts ----------

test("makeRound fills courts with 4 different players each and rests the rest", () => {
  const ps = people([5, 4, 4, 3, 3, 3, 2, 2, 1, 1]);
  const round = makeRound(ps, { courts: 2 }, {}, {}, seeded(1));
  assert.equal(round.courts.length, 2);
  const used = round.courts.flatMap((c) => [...c.a, ...c.b]).map((p) => p.id);
  assert.equal(new Set(used).size, 8);
  assert.equal(round.resting.length, 2);
  for (const r of round.resting) assert.ok(!used.includes(r.id));
});

test("makeRound uses fewer courts when there are not enough players", () => {
  assert.equal(makeRound(people([3, 3, 3, 3, 3]), { courts: 3 }, {}, {}, seeded(1)).courts.length, 1);
  assert.equal(makeRound(people([3, 3, 3]), { courts: 1 }, {}, {}, seeded(1)).courts.length, 0);
  assert.equal(makeRound(people([3, 3, 3]), { courts: 2, format: "singles" }, {}, {}, seeded(1)).courts.length, 1);
});

test("makeRound balances a doubles court: best with weakest", () => {
  const round = makeRound(people([5, 4, 2, 1]), { courts: 1 }, {}, {}, seeded(7));
  const c = round.courts[0];
  assert.equal(c.diff, 0);
  const sides = [c.a, c.b].map((s) => s.map((p) => p.skill).sort().join(","));
  assert.deepEqual(sides.sort(), ["1,5", "2,4"]);
});

test("makeRound puts similar levels on the same court", () => {
  const ps = people([5, 5, 5, 5, 1, 1, 1, 1]);
  for (let seed = 1; seed < 20; seed++) {
    const round = makeRound(ps, { courts: 2 }, {}, {}, seeded(seed));
    for (const c of round.courts) {
      const levels = new Set([...c.a, ...c.b].map((p) => p.skill));
      assert.equal(levels.size, 1);
    }
  }
});

test("makeRound gives a turn to whoever has played least", () => {
  const ps = people([3, 3, 3, 3, 3, 3]);
  const stats = { p0: { played: 2, sat: 0 }, p1: { played: 2, sat: 0 }, p2: { played: 1, sat: 1 }, p3: { played: 1, sat: 1 }, p4: { played: 1, sat: 1 }, p5: { played: 1, sat: 1 } };
  const round = makeRound(ps, { courts: 1 }, stats, {}, seeded(1));
  assert.deepEqual(round.resting.map((p) => p.id).sort(), ["p0", "p1"]);
});

test("playing many rounds keeps game counts within one of each other", () => {
  const ps = people([5, 4, 4, 3, 3, 2, 2, 1, 1]); // 9 players, 2 courts: one rests each round
  let stats = {};
  let partners = {};
  const rng = seeded(99);
  for (let r = 0; r < 25; r++) {
    const round = makeRound(ps, { courts: 2 }, stats, partners, rng);
    ({ stats, partners } = recordRound(round, ps.map((p) => p.id), stats, partners));
    const played = ps.map((p) => stats[p.id].played);
    assert.ok(Math.max(...played) - Math.min(...played) <= 1, `round ${r}: ${played}`);
  }
});

test("makeRound avoids the same partners when skills are equal", () => {
  const ps = people([3, 3, 3, 3]);
  const partners = { [pairKey("p0", "p1")]: 3, [pairKey("p2", "p3")]: 3, [pairKey("p0", "p2")]: 1, [pairKey("p1", "p3")]: 1 };
  for (let seed = 1; seed < 15; seed++) {
    const c = makeRound(ps, { courts: 1 }, {}, partners, seeded(seed)).courts[0];
    const keys = [pairKey(c.a[0].id, c.a[1].id), pairKey(c.b[0].id, c.b[1].id)].sort();
    assert.deepEqual(keys, [pairKey("p0", "p3"), pairKey("p1", "p2")].sort());
  }
});

test("singles rounds have one player a side", () => {
  const round = makeRound(people([5, 4, 2, 1]), { courts: 2, format: "singles" }, {}, {}, seeded(2));
  assert.equal(round.courts.length, 2);
  for (const c of round.courts) {
    assert.equal(c.a.length, 1);
    assert.equal(c.b.length, 1);
  }
});

test("recordRound counts games, rests and partners", () => {
  const ps = people([3, 3, 3, 3, 3]);
  const round = makeRound(ps, { courts: 1 }, {}, {}, seeded(5));
  const { stats, partners } = recordRound(round, ps.map((p) => p.id));
  const resting = round.resting[0].id;
  assert.deepEqual(stats[resting], { played: 0, sat: 1 });
  assert.equal(Object.values(stats).filter((s) => s.played === 1).length, 4);
  assert.equal(Object.values(partners).reduce((a, b) => a + b, 0), 2);
  const c = round.courts[0];
  assert.equal(partners[pairKey(c.a[0].id, c.a[1].id)], 1);
});

// ---------- score counter ----------

test("gameWinner follows the 21 point rules", () => {
  assert.equal(gameWinner(21, 19), "A");
  assert.equal(gameWinner(21, 20), null);
  assert.equal(gameWinner(22, 20), "A");
  assert.equal(gameWinner(20, 22), "B");
  assert.equal(gameWinner(29, 29), null);
  assert.equal(gameWinner(30, 29), "A");
  assert.equal(gameWinner(29, 30), "B");
  assert.equal(gameWinner(20, 0), null);
  assert.equal(gameWinner(0, 21), "B");
});

test("gameWinner follows the 15 and 11 point rules", () => {
  assert.equal(gameWinner(15, 13, 15), "A");
  assert.equal(gameWinner(15, 14, 15), null);
  assert.equal(gameWinner(21, 20, 15), "A");
  assert.equal(gameWinner(11, 9, 11), "A");
  assert.equal(gameWinner(14, 14, 11), null);
  assert.equal(gameWinner(14, 15, 11), "B");
});

test("a point goes to the rally winner who then serves", () => {
  let m = newMatch({ server: "A" });
  m = addPoint(m, "B");
  assert.deepEqual(m.games, [{ a: 0, b: 1 }]);
  assert.equal(m.server, "B");
  m = addPoint(m, "B");
  assert.equal(m.server, "B");
  m = addPoint(m, "A");
  assert.equal(m.server, "A");
});

test("addPoint does not change the old match object", () => {
  const m = newMatch();
  const n = addPoint(m, "A");
  assert.deepEqual(m.games, [{ a: 0, b: 0 }]);
  assert.deepEqual(n.games, [{ a: 1, b: 0 }]);
});

test("serve court is right on even score, left on odd", () => {
  let m = newMatch({ server: "A" });
  assert.equal(serveCourt(m), "right");
  m = addPoint(m, "A"); // 1-0, A serves
  assert.equal(serveCourt(m), "left");
  m = addPoint(m, "B"); // 1-1, B serves with 1
  assert.equal(serveCourt(m), "left");
  m = addPoint(m, "B"); // 1-2, B serves with 2
  assert.equal(serveCourt(m), "right");
});

test("a best of 3 match: game ends, next game starts, winner serves", () => {
  let m = newMatch({ bestOf: 3, server: "B" });
  m = play(m, points("A", 21));
  assert.equal(m.notice, "game");
  assert.equal(m.games.length, 2);
  assert.deepEqual(m.games[1], { a: 0, b: 0 });
  assert.equal(m.server, "A");
  assert.deepEqual(gamesWon(m), { a: 1, b: 0 });
  assert.equal(m.winner, null);

  m = play(m, points("B", 21));
  assert.equal(m.games.length, 3);
  assert.equal(m.server, "B");
  assert.deepEqual(gamesWon(m), { a: 1, b: 1 });

  m = play(m, points("B", 20) + points("A", 20) + "AB" + "AA");
  assert.equal(m.winner, "A");
  assert.equal(m.notice, "match");
  assert.deepEqual(m.games[2], { a: 23, b: 21 });
  assert.deepEqual(gamesWon(m), { a: 2, b: 1 });
});

test("no more points are counted after the match is won", () => {
  let m = newMatch({ bestOf: 1 });
  m = play(m, points("A", 21));
  assert.equal(m.winner, "A");
  const after = addPoint(m, "B");
  assert.equal(after, m);
  assert.equal(m.games.length, 1);
});

test("straight games win a best of 3", () => {
  let m = newMatch({ bestOf: 3 });
  m = play(m, points("B", 21) + points("B", 21));
  assert.equal(m.winner, "B");
  assert.equal(m.games.length, 2);
});

test("29-29 then the next point wins at 30", () => {
  let m = newMatch({ bestOf: 1 });
  m = play(m, "AB".repeat(29));
  assert.deepEqual(m.games[0], { a: 29, b: 29 });
  assert.equal(m.winner, null);
  m = addPoint(m, "B");
  assert.equal(m.winner, "B");
  assert.deepEqual(m.games[0], { a: 29, b: 30 });
});

test("interval notice at 11, and change ends in the deciding game", () => {
  let m = newMatch({ bestOf: 3 });
  m = play(m, points("A", 10));
  assert.equal(m.notice, null);
  m = addPoint(m, "A");
  assert.equal(m.notice, "interval");
  m = addPoint(m, "B");
  assert.equal(m.notice, null);
  m = play(m, points("B", 10)); // 11-11, B reaches 11 second: no new interval
  assert.deepEqual(m.games[0], { a: 11, b: 11 });
  assert.equal(m.notice, null);

  let d = newMatch({ bestOf: 3 });
  d = play(d, points("A", 21) + points("B", 21) + points("B", 11));
  assert.equal(d.games.length, 3);
  assert.equal(d.notice, "interval-switch");
});

test("newMatch falls back to safe settings", () => {
  const m = newMatch({ points: 99, bestOf: 4, server: "X" });
  assert.equal(m.points, 21);
  assert.equal(m.bestOf, 3);
  assert.equal(m.server, "A");
});
