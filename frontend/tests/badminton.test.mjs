// Tests for the badminton app logic. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clampSkill,
  shuffle,
  makePairs,
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

// ---------- teams of 2 ----------

// Every way to split an even list into teams of 2.
function allPairings(list) {
  if (list.length === 0) return [[]];
  const [first, ...rest] = list;
  const out = [];
  for (let i = 0; i < rest.length; i++) {
    const others = rest.filter((_, j) => j !== i);
    for (const p of allPairings(others)) out.push([[first, rest[i]], ...p]);
  }
  return out;
}
const spreadOf = (totals) => Math.max(...totals) - Math.min(...totals);
const squares = (totals) => {
  const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
  return totals.reduce((t, x) => t + (x - mean) ** 2, 0);
};
const teamIds = (r) => [...r.teams.flatMap((t) => t.players.map((p) => p.id)), ...(r.leftover ? [r.leftover.id] : [])].sort();

test("makePairs makes teams of exactly 2 and uses everyone once", () => {
  for (let n = 2; n <= 15; n++) {
    const ps = people(Array.from({ length: n }, (_, i) => (i % 5) + 1));
    const r = makePairs(ps, {}, seeded(n));
    for (const t of r.teams) assert.equal(t.players.length, 2);
    assert.equal(r.teams.length, Math.floor(n / 2));
    assert.equal(Boolean(r.leftover), n % 2 === 1);
    assert.deepEqual(teamIds(r), ps.map((p) => p.id).sort());
  }
});

test("makePairs pairs the strongest with the weakest", () => {
  const r = makePairs(people([5, 5, 4, 4, 2, 2, 1, 1]), {}, seeded(1));
  // Every team adds up to 6, average 3, the same as the group.
  assert.deepEqual(r.teams.map((t) => t.total), [6, 6, 6, 6]);
  for (const t of r.teams) assert.equal(t.average, 3);
});

test("makePairs always finds the fairest possible teams", () => {
  const rng = seeded(42);
  for (let trial = 0; trial < 300; trial++) {
    const n = 2 * (2 + Math.floor(rng() * 4)); // 4..10 players
    const skills = Array.from({ length: n }, () => 1 + Math.floor(rng() * 5));
    const ps = people(skills);
    const r = makePairs(ps, {}, seeded(trial));
    const got = r.teams.map((t) => t.total);
    const all = allPairings(ps).map((pairing) => pairing.map(([a, b]) => a.skill + b.skill));
    const bestSpread = Math.min(...all.map(spreadOf));
    const bestSquares = Math.min(...all.map(squares));
    assert.equal(spreadOf(got), bestSpread, `skills=${skills}`);
    assert.ok(squares(got) <= bestSquares + 1e-9, `skills=${skills}`);
  }
});

test("makePairs with an odd number leaves out the player that keeps teams most even", () => {
  const rng = seeded(7);
  for (let trial = 0; trial < 150; trial++) {
    const n = 5 + 2 * Math.floor(rng() * 3); // 5, 7, 9
    const skills = Array.from({ length: n }, () => 1 + Math.floor(rng() * 5));
    const ps = people(skills);
    const r = makePairs(ps, {}, seeded(trial));
    let best = Infinity;
    for (const out of ps) {
      const rest = ps.filter((p) => p !== out);
      for (const pairing of allPairings(rest)) best = Math.min(best, squares(pairing.map(([a, b]) => a.skill + b.skill)));
    }
    assert.ok(squares(r.teams.map((t) => t.total)) <= best + 1e-9, `skills=${skills} left out ${r.leftover.skill}`);
  }
});

test("makePairs matches the closest teams against each other", () => {
  const r = makePairs(people([5, 5, 4, 4, 3, 3, 3, 1]), {}, seeded(3));
  assert.equal(r.matches.length, 2);
  const sideTotal = (side) => side.reduce((t, p) => t + p.skill, 0);
  const diffs = r.matches.map((m) => Math.abs(sideTotal(m.a) - sideTotal(m.b)));
  // totals are 6,7,7,8: closest matching is 8v7 and 7v6, each a gap of 1
  assert.deepEqual(diffs, [1, 1]);
  assert.equal(r.spareTeam, null);
});

test("makePairs with an odd number of teams leaves one team waiting", () => {
  const r = makePairs(people([5, 4, 3, 3, 2, 1]), {}, seeded(1));
  assert.equal(r.teams.length, 3);
  assert.equal(r.matches.length, 1);
  assert.ok(r.spareTeam);
});

test("makePairs picks new partners when it is just as fair", () => {
  // All the same level: any split is equally fair, so it must avoid the old pairs.
  const ps = people([3, 3, 3, 3, 3, 3]);
  const old = { [pairKey("p0", "p1")]: 1, [pairKey("p2", "p3")]: 1, [pairKey("p4", "p5")]: 1 };
  for (let seed = 1; seed < 20; seed++) {
    const r = makePairs(ps, old, seeded(seed));
    for (const t of r.teams) assert.ok(!old[pairKey(t.players[0].id, t.players[1].id)]);
  }
});

test("makePairs never gives up fairness to avoid repeat partners", () => {
  const ps = people([5, 4, 2, 1]);
  const partners = { [pairKey("p0", "p3")]: 5, [pairKey("p1", "p2")]: 5 };
  const r = makePairs(ps, partners, seeded(1));
  assert.deepEqual(r.teams.map((t) => t.total), [6, 6]);
});

test("makePairs handles tiny groups", () => {
  assert.deepEqual(makePairs([], {}, seeded(1)).teams, []);
  const one = makePairs(people([3]), {}, seeded(1));
  assert.equal(one.teams.length, 0);
  assert.equal(one.leftover.id, "p0");
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

test("makeRound makes every doubles team close to the average, not strong courts and weak courts", () => {
  const ps = people([5, 5, 5, 5, 1, 1, 1, 1]);
  for (let seed = 1; seed < 20; seed++) {
    const round = makeRound(ps, { courts: 2 }, {}, {}, seeded(seed));
    for (const c of round.courts) {
      for (const side of [c.a, c.b]) assert.deepEqual(side.map((p) => p.skill).sort(), [1, 5]);
      assert.equal(c.diff, 0);
    }
  }
});

test("makeRound doubles teams are the fairest possible", () => {
  const rng = seeded(11);
  for (let trial = 0; trial < 100; trial++) {
    const skills = Array.from({ length: 8 }, () => 1 + Math.floor(rng() * 5));
    const ps = people(skills);
    const round = makeRound(ps, { courts: 2 }, {}, {}, seeded(trial));
    const totals = round.courts.flatMap((c) => [c.a, c.b]).map((s) => s[0].skill + s[1].skill);
    const best = Math.min(...allPairings(ps).map((pr) => squares(pr.map(([a, b]) => a.skill + b.skill))));
    assert.ok(squares(totals) <= best + 1e-9, `skills=${skills}`);
  }
});

test("partners change from round to round when it is just as fair", () => {
  const ps = people([4, 4, 4, 4, 2, 2, 2, 2]);
  let stats = {};
  let partners = {};
  const rng = seeded(5);
  for (let r = 0; r < 4; r++) {
    const round = makeRound(ps, { courts: 2 }, stats, partners, rng);
    for (const c of round.courts) {
      for (const side of [c.a, c.b]) {
        assert.deepEqual(side.map((p) => p.skill).sort(), [2, 4]);
        assert.equal(partners[pairKey(side[0].id, side[1].id)] || 0, 0, `round ${r} repeated a pair`);
      }
    }
    ({ stats, partners } = recordRound(round, ps.map((p) => p.id), stats, partners));
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
