// Pure logic for the badminton app: balanced teams, balanced court matches and the score counter.
// Nothing in this file touches the page, so it can be tested with `node --test`.

export const SKILL_MIN = 1;
export const SKILL_MAX = 5;

export function clampSkill(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 3;
  return Math.min(SKILL_MAX, Math.max(SKILL_MIN, n));
}

// Fisher-Yates shuffle on a copy. `rng` returns a number in [0, 1).
export function shuffle(list, rng = Math.random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Strongest first. Players with the same skill come out in random order,
// so pressing "shuffle" again gives a different but still fair result.
function bySkillDesc(players, rng) {
  return shuffle(players, rng).sort((x, y) => y.skill - x.skill);
}

const sum = (list) => list.reduce((t, p) => t + p.skill, 0);
const avg = (list) => (list.length ? sum(list) / list.length : 0);

// ---------- Teams of 2: every team as close as possible to the group average ----------

export function pairKey(idA, idB) {
  return idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
}

const toTeam = (pair) => {
  const players = pair.slice().sort((x, y) => y.skill - x.skill || x.name.localeCompare(y.name));
  return { players, total: sum(players), average: avg(players) };
};

// How uneven a set of teams is: squared distance of each team total from the mean team total.
function imbalance(pairs) {
  if (!pairs.length) return 0;
  const totals = pairs.map((p) => p[0].skill + p[1].skill);
  const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
  return totals.reduce((t, x) => t + (x - mean) ** 2, 0);
}

function repeats(pairs, partners) {
  return pairs.reduce((t, [a, b]) => t + (partners[pairKey(a.id, b.id)] || 0), 0);
}

// Pairs an even number of players into teams of 2.
// Fairness comes first: the most even split possible (strongest with weakest, and so on).
// Only between equally fair options does it pick partners who have played together less.
function bestPairing(list, partners, rng) {
  const n = list.length;
  if (n < 2) return { pairs: [], imbalance: 0, repeats: 0 };
  const score = (pairs) => ({ imbalance: imbalance(pairs), repeats: repeats(pairs, partners) });
  const better = (x, y) => x.imbalance < y.imbalance - 1e-9 || (Math.abs(x.imbalance - y.imbalance) <= 1e-9 && x.repeats < y.repeats);

  // Swap players between two teams while it helps.
  const improve = (pairs) => {
    let cur = score(pairs);
    for (let guard = 0; guard < 1000; guard++) {
      let improved = false;
      for (let i = 0; i < pairs.length && !improved; i++) {
        for (let j = i + 1; j < pairs.length && !improved; j++) {
          const [a, b] = pairs[i];
          const [c, d] = pairs[j];
          for (const [x, y] of shuffle([[[a, c], [b, d]], [[a, d], [b, c]]], rng)) {
            const old = [pairs[i], pairs[j]];
            pairs[i] = x;
            pairs[j] = y;
            const next = score(pairs);
            if (better(next, cur)) {
              cur = next;
              improved = true;
              break;
            }
            [pairs[i], pairs[j]] = old;
          }
        }
      }
      if (!improved) break;
    }
    return { pairs, ...cur };
  };

  // Strongest with weakest is always the most even split. Start there, then look for
  // equally even splits with fewer repeat partners from many random starting points.
  const sorted = bySkillDesc(list, rng);
  const start = [];
  for (let i = 0; i < n / 2; i++) start.push([sorted[i], sorted[n - 1 - i]]);
  let best = improve(start);
  const tries = n >= 4 ? 120 : 0;
  for (let t = 0; t < tries && best.repeats > 0; t++) {
    const s = shuffle(list, rng);
    const pairs = [];
    for (let i = 0; i < n; i += 2) pairs.push([s[i], s[i + 1]]);
    const next = improve(pairs);
    if (better(next, best)) best = next;
  }
  return best;
}

// Put teams against each other: the two closest teams share a court.
function matchUp(teams, rng) {
  const sorted = shuffle(teams, rng).sort((x, y) => y.total - x.total);
  const matches = [];
  for (let i = 0; i + 1 < sorted.length; i += 2) {
    matches.push({ a: sorted[i].players, b: sorted[i + 1].players, diff: Math.abs(sorted[i].total - sorted[i + 1].total) });
  }
  return { matches, spare: sorted.length % 2 ? sorted[sorted.length - 1] : null };
}

// Splits everyone into teams of 2 and matches them up.
// With an odd number of players, the one who keeps the teams most even sits out.
// Returns { teams, matches, spareTeam, leftover }
export function makePairs(players, partners = {}, rng = Math.random) {
  let leftover = null;
  let pool = players;
  if (players.length % 2 === 1) {
    // Try leaving out one player of each level, keep the fairest result.
    let best = null;
    for (const skill of shuffle([...new Set(players.map((p) => p.skill))], rng)) {
      const out = shuffle(players.filter((p) => p.skill === skill), rng)[0];
      const rest = players.filter((p) => p !== out);
      const r = bestPairing(rest, partners, rng);
      if (!best || r.imbalance < best.r.imbalance - 1e-9 || (Math.abs(r.imbalance - best.r.imbalance) <= 1e-9 && r.repeats < best.r.repeats)) {
        best = { out, r };
      }
    }
    leftover = best.out;
    pool = players.filter((p) => p !== leftover);
  }
  const teams = bestPairing(pool, partners, rng).pairs.map(toTeam);
  const { matches, spare } = matchUp(teams, rng);
  return { teams: teams.sort((x, y) => y.total - x.total), matches, spareTeam: spare, leftover };
}

// ---------- Courts: one round of balanced matches, with fair sitting out ----------

// players: [{ id, name, skill }]
// stats:   { [id]: { played, sat } } games played and rounds sat out this session
// partners: { [pairKey]: count } how often two players have been partners
// Returns { courts: [{ a: [...], b: [...], diff }], resting: [...] }
export function makeRound(players, { courts = 1, format = "doubles" } = {}, stats = {}, partners = {}, rng = Math.random) {
  const perCourt = format === "singles" ? 2 : 4;
  const courtCount = Math.max(0, Math.min(Math.floor(courts), Math.floor(players.length / perCourt)));
  const needed = courtCount * perCourt;

  // Who plays: fewest games first, then whoever sat out most, then random.
  const st = (p) => stats[p.id] || { played: 0, sat: 0 };
  const queue = shuffle(players, rng).sort((x, y) => st(x).played - st(y).played || st(y).sat - st(x).sat);
  const playing = queue.slice(0, needed);
  const resting = queue.slice(needed).sort((x, y) => x.name.localeCompare(y.name));

  if (perCourt === 2) {
    // Singles: players of the closest level play each other.
    const sorted = bySkillDesc(playing, rng);
    const result = [];
    for (let c = 0; c < courtCount; c++) {
      const [x, y] = sorted.slice(c * 2, c * 2 + 2);
      result.push({ a: [x], b: [y], diff: Math.abs(x.skill - y.skill) });
    }
    return { courts: result, resting };
  }

  // Doubles: every team of 2 as close to the average as possible, closest teams play each other.
  const teams = bestPairing(playing, partners, rng).pairs.map(toTeam);
  return { courts: matchUp(teams, rng).matches, resting };
}

// Update session stats after a round has been played.
export function recordRound(round, allIds, stats = {}, partners = {}) {
  const nextStats = { ...stats };
  const nextPartners = { ...partners };
  const playing = new Set();
  for (const court of round.courts) {
    for (const side of [court.a, court.b]) {
      for (const p of side) playing.add(p.id);
      if (side.length === 2) {
        const key = pairKey(side[0].id, side[1].id);
        nextPartners[key] = (nextPartners[key] || 0) + 1;
      }
    }
  }
  for (const id of allIds) {
    const prev = nextStats[id] || { played: 0, sat: 0 };
    nextStats[id] = playing.has(id) ? { played: prev.played + 1, sat: prev.sat } : { played: prev.played, sat: prev.sat + 1 };
  }
  return { stats: nextStats, partners: nextPartners };
}

// ---------- Score counter (rally point scoring) ----------

// 21 points is the official game: win by 2, and at 29-29 the next point wins (30 cap).
export const GAME_RULES = {
  21: { target: 21, cap: 30, interval: 11 },
  15: { target: 15, cap: 21, interval: 8 },
  11: { target: 11, cap: 15, interval: 6 },
};

export function rulesFor(points) {
  return GAME_RULES[points] || GAME_RULES[21];
}

export function gameWinner(a, b, points = 21) {
  const { target, cap } = rulesFor(points);
  if (a >= cap || (a >= target && a - b >= 2)) return "A";
  if (b >= cap || (b >= target && b - a >= 2)) return "B";
  return null;
}

export function newMatch({ nameA = "Team A", nameB = "Team B", points = 21, bestOf = 3, server = "A" } = {}) {
  return {
    nameA,
    nameB,
    points: GAME_RULES[points] ? points : 21,
    bestOf: [1, 3, 5].includes(bestOf) ? bestOf : 3,
    games: [{ a: 0, b: 0 }],
    server: server === "B" ? "B" : "A",
    winner: null,
    notice: null,
  };
}

export function gamesWon(match) {
  let a = 0;
  let b = 0;
  for (const g of match.games) {
    const w = gameWinner(g.a, g.b, match.points);
    if (w === "A") a++;
    if (w === "B") b++;
  }
  return { a, b };
}

// The rally winner gets a point and serves next. Returns a new match object.
export function addPoint(match, side) {
  if (match.winner || (side !== "A" && side !== "B")) return match;
  const games = match.games.map((g) => ({ ...g }));
  const game = games[games.length - 1];
  if (side === "A") game.a++;
  else game.b++;

  const next = { ...match, games, server: side, notice: null };
  const rules = rulesFor(match.points);
  const finished = gameWinner(game.a, game.b, match.points);

  if (finished) {
    const won = gamesWon(next);
    const need = Math.ceil(match.bestOf / 2);
    if (won.a >= need || won.b >= need) {
      next.winner = won.a >= need ? "A" : "B";
      next.notice = "match";
    } else {
      // Winner of the game serves first in the next one. Players change ends.
      games.push({ a: 0, b: 0 });
      next.notice = "game";
    }
  } else {
    // First time a side reaches the interval score (11 in a 21-point game).
    const mine = side === "A" ? game.a : game.b;
    const theirs = side === "A" ? game.b : game.a;
    const reachedNow = mine === rules.interval && theirs < rules.interval;
    if (reachedNow) {
      const deciding = games.length === match.bestOf;
      next.notice = deciding ? "interval-switch" : "interval";
    }
  }
  return next;
}

// Which service court the server stands in: right when their score is even.
export function serveCourt(match) {
  const g = match.games[match.games.length - 1];
  const score = match.server === "A" ? g.a : g.b;
  return score % 2 === 0 ? "right" : "left";
}
