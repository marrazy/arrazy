import {
  clampSkill,
  makePairs,
  pairKey,
  makeRound,
  recordRound,
  newMatch,
  addPoint,
  gamesWon,
  gameWinner,
  rulesFor,
  serveCourt,
} from "/badminton/logic.js";
import { ICONS } from "/badminton/icons.js";

const STORE_KEY = "badminton.v1";
const LEVELS = ["", "Beginner", "Casual", "Intermediate", "Advanced", "Expert"];
const TABS = ["players", "teams", "courts", "score"];

// ---------- state ----------

const defaults = () => ({
  tab: "players",
  players: [],
  pairs: null,
  courts: 2,
  format: "doubles",
  round: null,
  roundNo: 0,
  stats: {},
  partners: {},
  setup: { nameA: "Team A", nameB: "Team B", points: 21, bestOf: 3, server: "A" },
  match: null,
  undo: [],
  flipped: false,
});

function load() {
  const base = defaults();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw);
    const s = { ...base, ...saved, setup: { ...base.setup, ...(saved.setup || {}) } };
    s.players = Array.isArray(s.players)
      ? s.players
          .filter((p) => p && typeof p.name === "string" && p.id)
          .map((p) => ({ id: String(p.id), name: p.name.slice(0, 30), skill: clampSkill(p.skill), here: p.here !== false }))
      : [];
    if (!TABS.includes(s.tab)) s.tab = "players";
    // Teams were made differently in the first version; drop them so old data can't break the page.
    delete s.teams;
    delete s.teamCount;
    if (!s.pairs || !Array.isArray(s.pairs.teams) || !Array.isArray(s.pairs.matches)) s.pairs = null;
    if (!Array.isArray(s.undo)) s.undo = [];
    if (typeof s.stats !== "object" || !s.stats) s.stats = {};
    if (typeof s.partners !== "object" || !s.partners) s.partners = {};
    return s;
  } catch {
    return base;
  }
}

let state = load();

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be full or blocked (private browsing). The app still works for this visit.
  }
}

function update(changes) {
  state = { ...state, ...changes };
  save();
  render();
}

const here = () => state.players.filter((p) => p.here);
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

// ---------- tiny DOM helper (text is always set as text, never as HTML) ----------

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "class") el.className = v;
    else if (k in el && typeof v !== "string") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const SVG = "http://www.w3.org/2000/svg";

// A line icon from the lucide set. The path data is a fixed string from icons.js, never user input.
function icon(name) {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "ic");
  svg.innerHTML = ICONS[name];
  return svg;
}

const level = (n) => h("span", { class: "lvl", "aria-label": `level ${n}` }, `L${n}`);

let toastTimer;
function toast(text) {
  const el = document.getElementById("toast");
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2600);
}

function stepper(label, value, min, max, onChange) {
  return h(
    "div",
    { class: "row between" },
    h("span", { class: "label" }, label),
    h(
      "div",
      { class: "stepper" },
      h("button", { type: "button", class: "icon-btn", "aria-label": `Fewer ${label.toLowerCase()}`, disabled: value <= min, onclick: () => onChange(value - 1) }, icon("minus")),
      h("output", { "aria-live": "polite" }, value),
      h("button", { type: "button", class: "icon-btn", "aria-label": `More ${label.toLowerCase()}`, disabled: value >= max, onclick: () => onChange(value + 1) }, icon("plus")),
    ),
  );
}

function seg(options, current, onChange, label) {
  return h(
    "div",
    { class: "seg", role: "group", "aria-label": label },
    options.map(([value, text]) =>
      h("button", { type: "button", "aria-pressed": String(value === current), onclick: () => onChange(value) }, text),
    ),
  );
}

const setting = (label, control) => h("div", { class: "row between" }, h("span", { class: "label" }, label), control);

// ---------- players ----------

let addSkill = 3;
let editingId = null;

// Someone who arrives late starts level with the person who has played least, so they don't play every round.
function catchUpStats(id, stats) {
  if (state.roundNo === 0 || stats[id]) return stats;
  const others = here().filter((p) => p.id !== id && stats[p.id]);
  const minPlayed = others.length ? Math.min(...others.map((p) => stats[p.id].played)) : 0;
  return { ...stats, [id]: { played: minPlayed, sat: 0 } };
}

function nameTaken(name, exceptId) {
  const key = name.trim().toLowerCase();
  return state.players.some((p) => p.id !== exceptId && p.name.trim().toLowerCase() === key);
}

function renderPlayers(root) {
  const msg = h("p", { class: "msg", role: "alert", hidden: true });
  const input = h("input", { type: "text", placeholder: "Name", maxlength: "30", autocomplete: "off", enterkeyhint: "done", "aria-label": "Player name" });

  const levelPicker = h("div", { class: "row" });
  const drawLevel = () => {
    levelPicker.replaceChildren(
      seg([1, 2, 3, 4, 5].map((n) => [n, String(n)]), addSkill, (n) => { addSkill = n; drawLevel(); }, "Level"),
      h("span", { class: "small muted" }, LEVELS[addSkill]),
    );
  };
  drawLevel();

  const add = (e) => {
    e.preventDefault();
    const name = input.value.trim().replace(/\s+/g, " ");
    if (!name) { msg.textContent = "Type a name first"; msg.hidden = false; return; }
    if (nameTaken(name)) { msg.textContent = `${name} is already on the list`; msg.hidden = false; return; }
    const player = { id: newId(), name, skill: addSkill, here: true };
    const stats = catchUpStats(player.id, state.stats);
    update({ players: [...state.players, player], stats });
    const again = document.querySelector("#view-players input[type=text]");
    if (again) again.focus();
  };

  const form = h(
    "form",
    { class: "card", onsubmit: add },
    h("h2", {}, "Add a player"),
    input,
    h("div", { class: "field" }, h("span", { class: "label" }, "Level, from 1 for a beginner to 5 for an expert"), levelPicker),
    msg,
    h("button", { type: "submit", class: "btn primary" }, icon("add"), "Add player"),
  );

  const count = here().length;
  const list = h("div", { class: "list" });
  const sorted = state.players.slice().sort((a, b) => a.name.localeCompare(b.name));
  for (const p of sorted) {
    const setPlayer = (changes) => update({ players: state.players.map((x) => (x.id === p.id ? { ...x, ...changes } : x)) });
    if (editingId === p.id) {
      const edit = h("input", { type: "text", value: p.name, maxlength: "30", "aria-label": "New name" });
      const err = h("p", { class: "msg", role: "alert", hidden: true });
      const saveName = (e) => {
        e.preventDefault();
        const name = edit.value.trim().replace(/\s+/g, " ");
        if (!name) { err.textContent = "The name can't be empty"; err.hidden = false; return; }
        if (nameTaken(name, p.id)) { err.textContent = `${name} is already on the list`; err.hidden = false; return; }
        editingId = null;
        setPlayer({ name });
      };
      list.append(
        h(
          "form",
          { class: "player", onsubmit: saveName },
          h("div", { class: "grow" }, edit, err),
          h("button", { type: "submit", class: "btn sm primary" }, "Save"),
          h("button", { type: "button", class: "btn sm", onclick: () => { editingId = null; render(); } }, "Cancel"),
        ),
      );
      setTimeout(() => edit.focus(), 0);
      continue;
    }
    list.append(
      h(
        "div",
        { class: `player${p.here ? "" : " away"}` },
        h(
          "button",
          {
            type: "button",
            class: "here-hit",
            "aria-pressed": String(p.here),
            "aria-label": `${p.name} is ${p.here ? "here" : "not here"}`,
            onclick: () => {
              const nowHere = !p.here;
              const stats = nowHere ? catchUpStats(p.id, state.stats) : state.stats;
              update({ players: state.players.map((x) => (x.id === p.id ? { ...x, here: nowHere } : x)), stats });
            },
          },
          h("span", { class: `here${p.here ? " on" : ""}` }, p.here ? icon("check") : null),
        ),
        h("button", { type: "button", class: "name", title: "Rename", onclick: () => { editingId = p.id; render(); } }, p.name),
        h(
          "div",
          { class: "stars", role: "group", "aria-label": `${p.name} level` },
          [1, 2, 3, 4, 5].map((n) =>
            h("button", { type: "button", class: n <= p.skill ? "on" : "", "aria-label": `Level ${n}`, "aria-pressed": String(n === p.skill), onclick: () => setPlayer({ skill: n }) }, icon("star")),
          ),
        ),
        h(
          "button",
          {
            type: "button",
            class: "icon-btn",
            "aria-label": `Remove ${p.name}`,
            onclick: () => {
              if (!confirm(`Remove ${p.name}?`)) return;
              update({ players: state.players.filter((x) => x.id !== p.id) });
            },
          },
          icon("x"),
        ),
      ),
    );
  }

  const people = h(
    "div",
    { class: "card" },
    h(
      "div",
      { class: "card-head" },
      h("h2", {}, "Players ", h("span", { class: "lvl" }, `${count} of ${state.players.length} here`)),
      state.players.length
        ? h(
            "div",
            { class: "row" },
            h("button", { type: "button", class: "btn sm", onclick: () => {
              let stats = state.stats;
              for (const p of state.players) if (!p.here) stats = catchUpStats(p.id, stats);
              update({ players: state.players.map((p) => ({ ...p, here: true })), stats });
            } }, "All here"),
            h("button", { type: "button", class: "btn sm", onclick: () => update({ players: state.players.map((p) => ({ ...p, here: false })) }) }, "None"),
          )
        : null,
    ),
    state.players.length
      ? h("p", { class: "note" }, "Tick who is here today. Tap a star to change a level, or a name to rename it.")
      : h("p", { class: "note" }, "No players yet. Add the people you play with above."),
    state.players.length ? list : null,
  );

  root.replaceChildren(h("h1", {}, "Players"), form, people);
}

// ---------- teams ----------

function sideName(side) {
  return side.map((p) => p.name).join(" & ");
}

const avgOf = (side) => side.reduce((t, p) => t + p.skill, 0) / side.length;

function matchCard(m, title) {
  const side = (players, cls) =>
    h("div", { class: `side ${cls}` },
      players.map((p) => h("div", { class: "who" }, h("span", {}, p.name), level(p.skill))),
      players.length > 1 ? h("div", { class: "avg" }, h("span", { class: `dot ${cls}`, "aria-hidden": "true" }), h("span", { class: "mono" }, `avg ${avgOf(players).toFixed(1)}`)) : null,
    );
  return h(
    "div",
    { class: "card match" },
    h("div", { class: "card-head" }, h("h2", {}, title), h("span", { class: "meta" }, m.diff === 0 ? "Even" : `Gap ${m.diff}`)),
    h("div", { class: "sides" }, side(m.a, "a"), side(m.b, "b")),
    h("button", { type: "button", class: "btn sm", onclick: () => startScoreFor(sideName(m.a), sideName(m.b)) }, "Keep score"),
  );
}

function renderTeams(root) {
  const present = here();
  const canMake = present.length >= 2;

  const make = () => {
    // Treat the current teams as "already played together", so making teams again gives
    // different partners whenever that is just as fair.
    const partners = {};
    if (state.pairs) for (const t of state.pairs.teams) partners[pairKey(t.players[0].id, t.players[1].id)] = 1;
    update({ pairs: makePairs(present, partners) });
  };

  const controls = h(
    "div",
    { class: "card" },
    h("h2", {}, "Teams of 2"),
    h("p", { class: "note" }, `Uses the ${present.length} player${present.length === 1 ? "" : "s"} marked as here. Each team's average level is kept as close as possible to the group's, so stronger players partner less strong ones, and the closest teams play each other.`),
    h("button", { type: "button", class: "btn primary", disabled: !canMake, onclick: make }, icon("shuffle"), state.pairs ? "Make new teams" : "Make teams"),
    canMake ? null : h("p", { class: "msg" }, "Mark at least 2 players as here on the Players tab"),
  );

  const parts = [h("h1", {}, "Teams"), controls];
  const pr = state.pairs;
  if (pr && pr.teams.length) {
    const avgs = pr.teams.map((t) => t.average);
    const groupAvg = pr.teams.reduce((t, x) => t + x.total, 0) / (pr.teams.length * 2);
    parts.push(
      h("p", { class: "note" }, "Group average ", h("span", { class: "mono" }, groupAvg.toFixed(2)), ", team averages from ", h("span", { class: "mono" }, Math.min(...avgs).toFixed(1)), " to ", h("span", { class: "mono" }, Math.max(...avgs).toFixed(1))),
      h("div", { class: "grid" }, pr.matches.map((m, i) => matchCard(m, `Match ${i + 1}`))),
      pr.spareTeam ? h("p", { class: "note" }, `Waiting for a court: ${sideName(pr.spareTeam.players)}`) : null,
    );
  }
  if (pr && pr.leftover) {
    parts.push(h("p", { class: "note" }, `Sitting out, odd number of players: ${pr.leftover.name}`));
  }
  root.replaceChildren(...parts.filter(Boolean));
}

// ---------- courts ----------

function renderCourts(root) {
  const present = here();
  const perCourt = state.format === "singles" ? 2 : 4;
  const possible = Math.floor(present.length / perCourt);

  const generate = () => makeRound(present, { courts: state.courts, format: state.format }, state.stats, state.partners);

  const controls = h(
    "div",
    { class: "card" },
    h("h2", {}, "Court rounds"),
    h("p", { class: "note" }, "In doubles each team of 2 is kept close to the average level, and the closest teams play each other. Partners change between rounds when that is just as fair. Whoever has played the fewest games goes on first."),
    setting("Format", seg([["doubles", "Doubles"], ["singles", "Singles"]], state.format, (f) => update({ format: f }), "Format")),
    stepper("Courts", state.courts, 1, 12, (n) => update({ courts: n })),
    possible === 0
      ? h("p", { class: "msg" }, `You need at least ${perCourt} players marked as here for ${state.format}`)
      : possible < state.courts
        ? h("p", { class: "note" }, `Only enough players for ${possible} court${possible === 1 ? "" : "s"} right now`)
        : null,
    h(
      "button",
      { type: "button", class: "btn primary", disabled: possible === 0, onclick: () => update({ round: generate(), roundNo: state.round ? state.roundNo : state.roundNo + 1 }) },
      icon("shuffle"),
      state.round ? "Shuffle this round" : "Make first round",
    ),
  );

  const parts = [h("h1", {}, "Courts"), controls];
  if (state.round) {
    parts.push(
      h("h2", {}, `Round ${state.roundNo}`),
      h("div", { class: "grid" }, state.round.courts.map((c, i) => matchCard(c, `Court ${i + 1}`))),
      state.round.resting.length
        ? h("p", { class: "note" }, `Resting: ${state.round.resting.map((p) => p.name).join(", ")}`)
        : null,
      h(
        "button",
        {
          type: "button",
          class: "btn primary block",
          disabled: possible === 0,
          onclick: () => {
            const ids = new Set(present.map((p) => p.id));
            for (const c of state.round.courts) for (const p of [...c.a, ...c.b]) ids.add(p.id);
            for (const p of state.round.resting) ids.add(p.id);
            const { stats, partners } = recordRound(state.round, [...ids], state.stats, state.partners);
            const round = makeRound(present, { courts: state.courts, format: state.format }, stats, partners);
            update({ stats, partners, round, roundNo: state.roundNo + 1 });
            toast(`Round ${state.roundNo} is ready`);
            window.scrollTo({ top: 0, behavior: "smooth" });
          },
        },
        "Round done, make next round",
      ),
    );
  }

  const rows = state.players
    .filter((p) => p.here || state.stats[p.id])
    .map((p) => ({ p, s: state.stats[p.id] || { played: 0, sat: 0 } }))
    .sort((x, y) => y.s.played - x.s.played || x.p.name.localeCompare(y.p.name));
  if (state.roundNo > 0 && rows.length) {
    parts.push(
      h(
        "div",
        { class: "card" },
        h("h2", {}, "Games this session"),
        h(
          "table",
          {},
          h("thead", {}, h("tr", {}, h("th", {}, "Player"), h("th", { class: "num" }, "Played"), h("th", { class: "num" }, "Rested"))),
          h("tbody", {}, rows.map(({ p, s }) => h("tr", {}, h("td", {}, p.name, p.here ? "" : h("span", { class: "muted" }, " left")), h("td", { class: "num" }, s.played), h("td", { class: "num" }, s.sat)))),
        ),
        h("p", { class: "note" }, "Counts go up when you press Round done"),
        h(
          "button",
          {
            type: "button",
            class: "btn",
            onclick: () => {
              if (!confirm("Start a new session? This clears rounds and game counts.")) return;
              update({ round: null, roundNo: 0, stats: {}, partners: {} });
            },
          },
          icon("reset"),
          "New session",
        ),
      ),
    );
  }
  root.replaceChildren(...parts.filter(Boolean));
}

// ---------- score counter ----------

function startScoreFor(nameA, nameB) {
  if (state.match && !state.match.winner && (state.match.games.length > 1 || state.match.games[0].a + state.match.games[0].b > 0)) {
    if (!confirm("A match is still being scored. Replace it with this one?")) return;
  }
  update({ tab: "score", match: null, undo: [], flipped: false, setup: { ...state.setup, nameA, nameB } });
}

function renderSetup(root) {
  const s = state.setup;
  const setSetup = (changes) => update({ setup: { ...state.setup, ...changes } });
  const nameInput = (key, label, cls) =>
    h("label", { class: "field grow" }, h("span", { class: "label row" }, h("span", { class: `dot ${cls}`, "aria-hidden": "true" }), label), h("input", {
      type: "text",
      maxlength: "40",
      value: s[key],
      oninput: (e) => { state.setup = { ...state.setup, [key]: e.target.value }; save(); },
    }));
  const cap = rulesFor(s.points).cap - 1;

  root.replaceChildren(
    h("h1", {}, "Score"),
    h(
      "form",
      {
        class: "card",
        onsubmit: (e) => {
          e.preventDefault();
          const nameA = (state.setup.nameA || "").trim() || "Team A";
          const nameB = (state.setup.nameB || "").trim() || "Team B";
          update({ match: newMatch({ ...state.setup, nameA, nameB }), undo: [], flipped: false });
        },
      },
      h("h2", {}, "New match"),
      h("div", { class: "row" }, nameInput("nameA", "Side A", "a"), nameInput("nameB", "Side B", "b")),
      setting("Points per game", seg([[21, "21"], [15, "15"], [11, "11"]], s.points, (v) => setSetup({ points: v }), "Points per game")),
      setting("Games", seg([[1, "1 game"], [3, "Best of 3"]], s.bestOf, (v) => setSetup({ bestOf: v }), "Games")),
      setting("First to serve", seg([["A", "Side A"], ["B", "Side B"]], s.server, (v) => setSetup({ server: v }), "First to serve")),
      h("p", { class: "note" }, `Win by 2 points. At ${cap}-${cap} the next point wins.`),
      h("button", { type: "submit", class: "btn primary" }, "Start"),
    ),
  );
}

const NOTICES = {
  interval: (m) => `Interval at ${rulesFor(m.points).interval}, short break`,
  "interval-switch": (m) => `${rulesFor(m.points).interval} points in the deciding game, change ends`,
  game: () => "Game over, change ends",
};

function point(side) {
  if (!state.match || state.match.winner) return;
  const next = addPoint(state.match, side);
  const flip = next.notice === "game" || next.notice === "interval-switch";
  const undo = [...state.undo, { match: state.match, flipped: state.flipped }].slice(-500);
  if (navigator.vibrate) navigator.vibrate(15);
  update({ match: next, undo, flipped: flip ? !state.flipped : state.flipped });
}

// Half a court seen from above, net at the top. The service box to serve from is filled in.
function courtMini(box) {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 56 32");
  svg.setAttribute("class", "court-mini");
  svg.setAttribute("aria-hidden", "true");
  const x = box === "left" ? 4.5 : 28;
  svg.innerHTML =
    `<rect class="box-on" x="${x}" y="8.5" width="23.5" height="19" rx="1" />` +
    `<rect x="4.5" y="4.5" width="47" height="23" rx="1.5" />` +
    `<line x1="4.5" y1="8.5" x2="51.5" y2="8.5" /><line x1="28" y1="8.5" x2="28" y2="27.5" />`;
  return svg;
}

function renderScore(root) {
  const m = state.match;
  if (!m) return renderSetup(root);

  const g = m.games[m.games.length - 1];
  const won = gamesWon(m);
  const need = Math.ceil(m.bestOf / 2);
  const court = serveCourt(m);

  const half = (side) => {
    const isA = side === "A";
    const cls = isA ? "a" : "b";
    const name = isA ? m.nameA : m.nameB;
    const pts = isA ? g.a : g.b;
    const wins = isA ? won.a : won.b;
    const serving = !m.winner && m.server === side;
    return h(
      "button",
      {
        type: "button",
        class: `half ${cls}${serving ? " serving" : ""}`,
        disabled: Boolean(m.winner),
        "aria-label": `${name}: ${pts} points${serving ? `, serving from the ${court} court` : ""}. Tap to add a point.`,
        onclick: () => point(side),
      },
      h("span", { class: "team" }, h("span", { class: `dot ${cls}` }), h("span", { class: "team-name" }, name)),
      m.bestOf > 1 ? h("span", { class: "games", "aria-label": `${wins} games won` }, Array.from({ length: need }, (_, i) => h("i", { class: i < wins ? "on" : "" }))) : null,
      h("span", { class: "pts" }, pts),
      h("span", { class: "serve" }, serving ? [courtMini(court), `Serve from ${court}`] : null),
    );
  };

  const done = m.games.filter((x) => gameWinner(x.a, x.b, m.points));
  const parts = [h("h1", {}, "Score")];
  parts.push(
    h(
      "div",
      { class: "score-head" },
      h("span", {}, m.winner ? "Final" : `Game ${m.games.length}${m.bestOf > 1 ? ` of up to ${m.bestOf}` : ""}, to ${m.points}`),
      done.length ? h("span", { class: "history" }, done.map((x) => h("span", { class: "tag" }, `${x.a}-${x.b}`))) : null,
    ),
  );

  if (m.winner) {
    const name = m.winner === "A" ? m.nameA : m.nameB;
    parts.push(h("div", { class: "notice win", role: "status" }, h("span", { class: `dot ${m.winner === "A" ? "a" : "b"}`, "aria-hidden": "true" }), `${name} win${m.bestOf > 1 ? ` ${Math.max(won.a, won.b)}-${Math.min(won.a, won.b)}` : ""}`));
  } else if (m.notice && NOTICES[m.notice]) {
    parts.push(h("div", { class: "notice", role: "status" }, NOTICES[m.notice](m)));
  }

  const left = state.flipped ? "B" : "A";
  const right = state.flipped ? "A" : "B";
  parts.push(h("div", { class: "board" }, half(left), half(right)));

  parts.push(
    h(
      "div",
      { class: "row" },
      h(
        "button",
        {
          type: "button",
          class: "btn grow",
          disabled: state.undo.length === 0,
          onclick: () => {
            const last = state.undo[state.undo.length - 1];
            update({ match: last.match, flipped: last.flipped, undo: state.undo.slice(0, -1) });
          },
        },
        icon("undo"),
        "Undo",
      ),
      h("button", { type: "button", class: "btn grow", onclick: () => update({ flipped: !state.flipped }) }, icon("swap"), "Swap sides"),
    ),
    h(
      "div",
      { class: "row" },
      m.winner
        ? h("button", { type: "button", class: "btn primary grow", onclick: () => update({ match: newMatch({ ...state.setup, nameA: m.nameA, nameB: m.nameB, points: m.points, bestOf: m.bestOf }), undo: [], flipped: false }) }, "Rematch")
        : null,
      h(
        "button",
        {
          type: "button",
          class: "btn grow",
          onclick: () => {
            if (!m.winner && !confirm("Stop scoring this match?")) return;
            update({ match: null, undo: [], flipped: false, setup: { ...state.setup, nameA: m.nameA, nameB: m.nameB } });
          },
        },
        "New match",
      ),
    ),
    h("p", { class: "note" }, "Tap the side that wins the rally. The rally winner serves next, from the right box on an even score and the left box on an odd one."),
  );
  root.replaceChildren(...parts.filter(Boolean));
}

// ---------- keep the screen on while scoring ----------

let wakeLock = null;
async function syncWakeLock() {
  const want = state.tab === "score" && state.match && !state.match.winner && document.visibilityState === "visible";
  try {
    if (want && !wakeLock && navigator.wakeLock) {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => (wakeLock = null));
    } else if (!want && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    wakeLock = null;
  }
}
document.addEventListener("visibilitychange", syncWakeLock);

// ---------- render ----------

const views = { players: renderPlayers, teams: renderTeams, courts: renderCourts, score: renderScore };

function render() {
  for (const t of TABS) {
    const el = document.getElementById(`view-${t}`);
    el.hidden = t !== state.tab;
  }
  for (const b of document.querySelectorAll(".tabs button")) {
    if (b.dataset.tab === state.tab) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  }
  views[state.tab](document.getElementById(`view-${state.tab}`));
  const n = here().length;
  document.getElementById("top-sub").textContent = state.players.length ? `${n} here` : "";
  document.getElementById("crumb-page").textContent = TAB_NAMES[state.tab];
  syncWakeLock();
}

const TAB_NAMES = { players: "Players", teams: "Teams", courts: "Courts", score: "Score" };

for (const b of document.querySelectorAll(".tabs button")) {
  b.prepend(icon(b.dataset.icon));
  b.addEventListener("click", () => {
    editingId = null;
    if (state.tab !== b.dataset.tab) {
      update({ tab: b.dataset.tab });
      window.scrollTo(0, 0);
    }
  });
}

render();

if ("serviceWorker" in navigator) {
  // When a new version of the app takes over, reload once so the page, styles and code all match.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/badminton/sw.js", { scope: "/badminton/", updateViaCache: "none" }).catch(() => {});
  });
}
