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

// ---------- Teams: split everyone into N teams of (almost) equal strength ----------

// Team sizes never differ by more than one. Teams are balanced on their average skill.
// Starts from a snake draft, then improves by swapping players. The swap search is repeated
// from many random starting splits and the fairest result is kept, so it does not get stuck.
export function makeTeams(players, teamCount, rng = Math.random) {
  const k = Math.max(1, Math.min(Math.floor(teamCount), players.length || 1));
  const sorted = bySkillDesc(players, rng);
  const base = Math.floor(sorted.length / k);
  const extra = sorted.length % k;
  const caps = Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));
  const overall = avg(sorted);
  const cost = (teams) => teams.reduce((t, team) => t + (avg(team) - overall) ** 2, 0);

  // Snake draft: 1,2,3,3,2,1,... skipping teams that are full.
  const draft = (list) => {
    const teams = Array.from({ length: k }, () => []);
    let order = [];
    while (order.length < list.length) {
      const round = Math.floor(order.length / k);
      const idx = Array.from({ length: k }, (_, i) => i);
      order = order.concat(round % 2 === 0 ? idx : idx.reverse());
    }
    let pick = 0;
    for (const p of list) {
      while (teams[order[pick]].length >= caps[order[pick]]) pick++;
      teams[order[pick]].push(p);
      pick++;
    }
    return teams;
  };

  // Random split with the right team sizes.
  const randomSplit = () => {
    const list = shuffle(sorted, rng);
    const teams = [];
    let at = 0;
    for (const c of shuffle(caps, rng)) {
      teams.push(list.slice(at, at + c));
      at += c;
    }
    return teams;
  };

  // Swap two players from different teams while it makes things fairer.
  const improve = (teams) => {
    let best = cost(teams);
    for (let guard = 0; guard < 1000; guard++) {
      let improved = false;
      for (let a = 0; a < k && !improved; a++) {
        for (let b = a + 1; b < k && !improved; b++) {
          for (let i = 0; i < teams[a].length && !improved; i++) {
            for (let j = 0; j < teams[b].length && !improved; j++) {
              if (teams[a][i].skill === teams[b][j].skill) continue;
              [teams[a][i], teams[b][j]] = [teams[b][j], teams[a][i]];
              const c = cost(teams);
              if (c < best - 1e-9) {
                best = c;
                improved = true;
              } else {
                [teams[a][i], teams[b][j]] = [teams[b][j], teams[a][i]];
              }
            }
          }
        }
      }
      if (!improved) break;
    }
    return { teams, score: best };
  };

  let best = improve(draft(sorted));
  const tries = k > 1 && sorted.length > 3 ? 150 : 0;
  for (let t = 0; t < tries && best.score > 1e-9; t++) {
    const next = improve(randomSplit());
    if (next.score < best.score - 1e-9) best = next;
  }

  return best.teams.map((team) => ({
    players: team.slice().sort((x, y) => y.skill - x.skill || x.name.localeCompare(y.name)),
    total: sum(team),
    average: avg(team),
  }));
}

// ---------- Courts: one round of balanced matches, with fair sitting out ----------

export function pairKey(idA, idB) {
  return idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
}

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

  // Put players of similar level on the same court, then balance the two sides.
  const sorted = bySkillDesc(playing, rng);
  const result = [];
  for (let c = 0; c < courtCount; c++) {
    const group = sorted.slice(c * perCourt, (c + 1) * perCourt);
    if (perCourt === 2) {
      result.push({ a: [group[0]], b: [group[1]], diff: Math.abs(group[0].skill - group[1].skill) });
      continue;
    }
    const [p, q, r, s] = group;
    const options = shuffle(
      [
        [[p, s], [q, r]],
        [[p, r], [q, s]],
        [[p, q], [r, s]],
      ],
      rng,
    ).map(([a, b]) => ({
      a,
      b,
      diff: Math.abs(sum(a) - sum(b)),
      repeats: (partners[pairKey(a[0].id, a[1].id)] || 0) + (partners[pairKey(b[0].id, b[1].id)] || 0),
    }));
    options.sort((x, y) => x.diff - y.diff || x.repeats - y.repeats);
    const { a, b, diff } = options[0];
    result.push({ a, b, diff });
  }
  return { courts: result, resting };
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
