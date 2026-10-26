import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Graph, copy } from "../src/graph.js";
import { Game, scenario, normaliseSeed } from "../src/game.js";
import { Pursuer } from "../src/ai.js";
import { botTurn } from "../src/bots.js";
const data = JSON.parse(
  fs.readFileSync(new URL("../data/map.json", import.meta.url)),
);
const g = new Graph(data);
const mini = new Graph({
  nodes: [
    { id: 0, x: 0, y: 0 },
    { id: 1, x: 100, y: 0 },
    { id: 2, x: 100, y: 100 },
    { id: 3, x: 0, y: 100 },
  ],
  edges: [
    {
      id: 0,
      a: 0,
      b: 1,
      length: 100,
      name: "A",
      geometry: [
        [0, 0],
        [100, 0],
      ],
    },
    {
      id: 1,
      a: 1,
      b: 2,
      length: 100,
      name: "B",
      geometry: [
        [100, 0],
        [100, 100],
      ],
    },
    {
      id: 2,
      a: 2,
      b: 3,
      length: 100,
      name: "C",
      geometry: [
        [100, 100],
        [0, 100],
      ],
    },
    {
      id: 3,
      a: 3,
      b: 0,
      length: 100,
      name: "D",
      geometry: [
        [0, 100],
        [0, 0],
      ],
    },
  ],
});
const sc = {
  start: 0,
  enemy: 2,
  clues: [0, 1, 3],
  exit: 2,
  hides: [0],
  pursuerSpeed: 4.05,
};
function fixture() {
  return new Game(mini, { scenarioOverride: sc });
}
function simulate(seed, mode, record = false) {
  const x = new Game(g, { seed, mode, record });
  while (x.state === "playing") {
    x.step(0.1, (z) => botTurn(z, "Courier"));
  }
  return x;
}
test("cached OSM graph is connected, all geometry and edge lengths valid", () => {
  assert.equal(g.nodes.length, 52);
  assert.equal(g.edges.length, 59);
  for (let i = 0; i < g.nodes.length; i++)
    for (let j = 0; j < g.nodes.length; j++)
      assert(Number.isFinite(g.dist[i][j]));
  for (const e of g.edges) {
    assert(e.length > 0);
    assert(Math.abs(e.cumulative.at(-1) - e.length) < 0.1);
  }
});
test("every authored objective is reachable and opening distance is fair", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const s = scenario(seed);
    assert(g.dist[s.start][s.enemy] > 300);
    for (const n of [...s.clues, s.exit, ...s.hides])
      assert(Number.isFinite(g.dist[s.start][n]));
  }
});
test("movement follows geometry, scales with distance, and cannot jump roads", () => {
  const a = mini.actor(0);
  assert(!mini.depart(a, 2));
  assert(mini.depart(a, 1));
  assert.equal(mini.move(a, 25), 25);
  assert.deepEqual(mini.point(a), { x: 25, y: 0 });
  assert.equal(mini.distance(a, mini.actor(1)), 75);
  mini.move(a, 200);
  assert.equal(a.node, 1);
  assert.equal(a.edge, null);
});
test("only adjacent route commands accepted and one turn queued at next junction", () => {
  const x = fixture();
  assert(!x.command(2));
  assert(x.command(1));
  x.step(1);
  assert.equal(x.player.edge, 0);
  assert(x.command(2));
  assert(!x.command(3));
  assert.equal(x.queued, 2);
});
test("same-road sight works but right-angle corner blocks sight", () => {
  let a = mini.actor(0),
    b = mini.actor(1);
  assert(mini.visible(a, b, 110));
  mini.depart(a, 1);
  mini.move(a, 75);
  mini.depart(b, 2);
  mini.move(b, 25);
  assert(!mini.visible(a, b, 100));
});
test("mid-edge head-on encounter captures before either reaches endpoint", () => {
  const x = fixture();
  mini.depart(x.player, 1);
  mini.move(x.player, 47);
  x.enemy = mini.actor(1);
  x.ai.own = x.enemy;
  mini.depart(x.enemy, 0);
  mini.move(x.enemy, 46);
  x.step(2);
  assert.equal(x.state, "caught");
  assert(x.player.edge !== null);
  assert(mini.distance(x.player, x.enemy) <= 6);
});
test("junction approach from two different roads captures consistently", () => {
  const x = fixture();
  mini.depart(x.player, 1);
  mini.move(x.player, 96);
  x.enemy = mini.actor(2);
  x.ai.own = x.enemy;
  mini.depart(x.enemy, 1);
  mini.move(x.enemy, 97);
  x.step(0.5);
  assert.equal(x.state, "caught");
});
test("nearby parallel streets do not trigger capture through buildings", () => {
  const a = mini.actor(0),
    b = mini.actor(3);
  mini.depart(a, 1);
  mini.move(a, 50);
  mini.depart(b, 2);
  mini.move(b, 50);
  assert.equal(mini.distance(a, b), 200);
});
test("all clues collect only at nodes and exit remains locked until three", () => {
  const x = fixture();
  x.enemy = mini.actor(2);
  x.ai.own = x.enemy;
  x.step(0.05);
  assert.deepEqual(x.collected, [0]);
  x.player = mini.actor(2);
  x.enemy = mini.actor(0);
  x.ai.own = x.enemy;
  x.step(0.05);
  assert.equal(x.state, "playing");
  for (const n of [1, 3]) {
    x.player = mini.actor(n);
    x.enemy = mini.actor(2);
    x.ai.own = x.enemy;
    x.step(0.05);
  }
  assert.equal(x.collected.length, 3);
  x.player = mini.actor(2);
  x.enemy = mini.actor(0);
  x.ai.own = x.enemy;
  x.step(0.05);
  assert.equal(x.state, "escaped");
});
test("paused simulation and all tools/commands leave state unchanged", () => {
  const x = fixture();
  x.paused = true;
  const old = JSON.stringify([
    x.time,
    x.player,
    x.enemy,
    x.collected,
    x.events,
  ]);
  assert(!x.command(1));
  assert(!x.hide());
  assert(!x.decoy());
  x.step(30);
  assert.equal(
    JSON.stringify([x.time, x.player, x.enemy, x.collected, x.events]),
    old,
  );
});
test("hiding has stillness cost, finite charges and cooldown", () => {
  const x = fixture();
  assert(x.hide());
  assert.equal(x.hideCharges, 1);
  assert(!x.command(1));
  x.step(1);
  assert.equal(x.player.edge, null);
  assert(!x.hide());
  x.hideReady = x.time;
  x.hideUntil = 0;
  assert(x.hide());
  x.hideReady = x.time;
  x.hideUntil = 0;
  assert(!x.hide());
});
test("decoys delayed and limited; noise explains whether judgment changed", () => {
  const x = fixture();
  assert(x.decoy());
  assert(x.decoy());
  assert(!x.decoy());
  x.step(3);
  assert.equal(x.events.filter((e) => e.type === "sound").length, 0);
  x.step(1.6);
  assert.equal(x.events.filter((e) => e.type === "sound").length, 2);
  assert(
    x.events
      .filter((e) => e.type === "sound")
      .every((e) => typeof e.changed === "boolean"),
  );
});
test("hidden shelter suppresses sight but close-range capture still works", () => {
  const x = fixture();
  x.hide();
  assert.equal(x.sensor().sight, null);
  x.enemy = mini.actor(0);
  x.ai.own = x.enemy;
  x.step(0.05);
  assert.equal(x.state, "caught");
});
test("sensor packet has no hidden player location, route, collected list or future clicks", () => {
  const x = fixture();
  x.queued = 1;
  const obs = x.sensor();
  assert.equal(obs.sight, null);
  assert.deepEqual(Object.keys(obs).sort(), [
    "clearNodes",
    "noise",
    "sight",
    "time",
  ]);
  const raw = fs.readFileSync(new URL("../src/ai.js", import.meta.url), "utf8");
  assert(!/\b(game|player|queued|collected)\s*[.\[]/.test(raw));
});
test("identical allowed observations yield identical AI choices despite hidden worlds", () => {
  for (const mode of ["Greedy", "Search", "Intercept"]) {
    const a = new Pursuer(mini, mini.actor(2), sc, mode, 12),
      b = new Pursuer(mini, mini.actor(2), sc, mode, 12);
    for (let t = 0; t < 25; t++) {
      const obs = {
        time: t,
        sight: t === 0 ? { position: mini.actor(0), direction: 1 } : null,
        noise: null,
        clearNodes: [],
      };
      a.observe(copy(obs));
      b.observe(copy(obs));
      a.decide(t);
      b.decide(t);
      assert.deepEqual(a.record(), b.record());
      assert.deepEqual(a.own, b.own);
      mini.move(a.own, 4);
      mini.move(b.own, 4);
    }
  }
});
test("belief remains finite, nonnegative and normalised after negative and decoy evidence", () => {
  const ai = new Pursuer(g, g.actor(22), scenario(1), "Search", 1);
  for (let t = 0; t < 200; t++) {
    ai.observe({
      time: t,
      sight: t === 0 ? { position: g.actor(15), direction: null } : null,
      noise: t === 20 ? { node: 13 } : null,
      clearNodes: t === 90 ? g.nodes.map((n) => n.id) : [22, 46],
    });
    assert(ai.belief.every((x) => Number.isFinite(x) && x >= 0));
    assert(Math.abs(ai.belief.reduce((a, b) => a + b, 0) - 1) < 1e-10);
  }
});
test("restart resets time, resources and replay; seed reproduces terminal path and events", () => {
  const a = simulate(2, "Intercept", true),
    b = simulate(2, "Intercept", true);
  assert.deepEqual(a.frames, b.frames);
  assert.deepEqual(a.events, b.events);
  const fresh = new Game(g, { seed: 2, mode: "Intercept" });
  assert.equal(fresh.time, 0);
  assert.equal(fresh.frames.length, 1);
  assert.equal(fresh.decoys, 2);
});
test("replay starts at zero, includes terminal truth and stable recorded explanations", () => {
  const a = simulate(1, "Greedy", true);
  assert.equal(a.frames[0].time, 0);
  assert.equal(a.frames.at(-1).state, a.state);
  assert.deepEqual(a.frames.at(-1).player, a.player);
  const saved = copy(a.frames[10]);
  a.ai.reason = "changed afterwards";
  assert.deepEqual(a.frames[10], saved);
  for (const f of a.frames)
    assert(Math.abs(f.ai.belief.reduce((x, y) => x + y, 0) - 1) < 1e-9);
});
test("interactive-sized and automated outer steps agree", () => {
  for (const mode of ["Greedy", "Search", "Intercept"]) {
    const a = new Game(g, { seed: 1, mode, record: false }),
      b = new Game(g, { seed: 1, mode, record: false });
    for (let t = 0; t < 1000; t++) {
      a.step(0.1, (x) => botTurn(x));
      for (let j = 0; j < 2; j++) {
        b.step(0.05, (x) => botTurn(x));
      }
    }
    assert(Math.abs(a.time - b.time) < 1e-6);
    assert.equal(a.state, b.state);
    assert(Math.abs(a.playerLength - b.playerLength) < 1e-6);
    assert.deepEqual(a.collected, b.collected);
  }
});
test("all modes finish and fixed seed outcomes include a viable escape", () => {
  let wins = 0;
  for (const mode of ["Greedy", "Search", "Intercept"])
    for (let seed = 1; seed <= 3; seed++) {
      const x = simulate(seed, mode);
      assert(["escaped", "caught", "timeout"].includes(x.state));
      if (x.state === "escaped") wins++;
    }
  assert(wins > 0);
});
test("heading biases the last observed distribution toward the direction of motion", () => {
  const ai = new Pursuer(mini, mini.actor(2), sc, "Search", 1),
    p = mini.actor(0);
  mini.depart(p, 1);
  mini.move(p, 50);
  ai.observe({
    time: 1,
    sight: { position: p, direction: 1 },
    noise: null,
    clearNodes: [],
  });
  assert(ai.belief[1] > ai.belief[0]);
});
test("interception uses observed forward routes and public goals to get ahead", () => {
  const ai = new Pursuer(
      mini,
      mini.actor(1),
      { ...sc, clues: [2, 3, 1] },
      "Intercept",
      1,
    ),
    p = mini.actor(0);
  mini.depart(p, 1);
  mini.move(p, 20);
  ai.observe({
    time: 1,
    sight: { position: p, direction: 1 },
    noise: null,
    clearNodes: [],
  });
  ai.decide(1);
  assert.equal(ai.status, "INTERCEPT");
  assert(ai.reason.includes("predicted runner arrival"));
  assert.notEqual(ai.target, mini.anchor(p));
});
test("Greedy checks a lost sighting once before resuming objective patrol", () => {
  const ai = new Pursuer(mini, mini.actor(0), sc, "Greedy", 1);
  ai.observe({
    time: 1,
    sight: { position: mini.actor(0), direction: null },
    noise: null,
    clearNodes: [],
  });
  ai.observe({ time: 2, sight: null, noise: null, clearNodes: [] });
  ai.decide(2);
  assert.equal(ai.checkedAt, 1);
  mini.move(ai.own, 100);
  ai.decide(30);
  assert.notEqual(ai.target, 0);
});
test("current visual observation overrides a contradictory decoy", () => {
  const ai = new Pursuer(mini, mini.actor(2), sc, "Search", 1);
  ai.observe({
    time: 2,
    sight: { position: mini.actor(0), direction: null },
    noise: { node: 3 },
    clearNodes: [],
  });
  assert.equal(ai.noise, null);
  assert.equal(ai.belief[0], 1);
});
test("conservative elapsed-time reachability excludes far nodes after loss", () => {
  const ai = new Pursuer(g, g.actor(22), scenario(1), "Search", 1);
  ai.observe({
    time: 1,
    sight: { position: g.actor(9), direction: null },
    noise: null,
    clearNodes: [],
  });
  ai.observe({ time: 2, sight: null, noise: null, clearNodes: [] });
  for (const n of g.nodes)
    if (g.dist[9][n.id] > 114.4) assert.equal(ai.belief[n.id], 0);
});
test("deadline produces a terminal loss with a final replay frame", () => {
  const x = new Game(mini, { scenarioOverride: { ...sc, pursuerSpeed: 0 } });
  x.step(361);
  assert.equal(x.state, "timeout");
  assert(x.time >= 360 && x.time < 360.06);
  assert.equal(x.frames.at(-1).state, "timeout");
});
test("visual shortest pursuit enters the observed edge when already at its endpoint", () => {
  const own = mini.actor(1),
    ai = new Pursuer(mini, own, sc, "Greedy", 1),
    p = mini.actor(0);
  mini.depart(p, 1);
  mini.move(p, 80);
  ai.observe({
    time: 1,
    sight: { position: p, direction: 1 },
    noise: null,
    clearNodes: [],
  });
  ai.decide(1);
  assert.equal(own.edge, 0);
  assert.equal(own.to, 0);
});
test("each authored Lantern opening has a verified viable escape", () => {
  const first = new Game(g, { seed: 1, record: false });
  const waypoints = [13, 15, 39, 1];
  let i = 0;
  while (first.state === "playing")
    first.step(0.1, (z) => {
      if (z.player.edge !== null) return;
      if (z.player.node === waypoints[i]) i++;
      if (i < waypoints.length) z.command(g.next[z.player.node][waypoints[i]]);
    });
  assert.equal(first.state, "escaped");
  for (const seed of [2, 3]) {
    const x = new Game(g, { seed, record: false });
    while (x.state === "playing")
      x.step(0.1, (z) => botTurn(z, seed === 2 ? "Cautious" : "Courier"));
    assert.equal(x.state, "escaped");
  }
});
test("guided practice completes five real lessons without capture or deadline", () => {
  const x = new Game(g, { practice: true });
  const initialEnemy = copy(x.enemy);
  assert(!x.command(32));
  assert(!x.hide());
  assert(!x.decoy());
  assert(!x.sprint());
  let guard = 0;
  while (x.state === "playing" && guard++ < 3000)
    x.step(0.1, (z) => {
      if (z.player.edge !== null) return;
      if (z.lesson === 1) z.decoy();
      else if (z.lesson === 3) {
        if (z.hideCharges === 2) z.hide();
      } else z.command(g.next[z.player.node][z.lessonGoal]);
    });
  assert.equal(x.state, "escaped");
  assert.equal(x.lesson, 5);
  assert.equal(x.collected.length, 1);
  assert.equal(x.decoys, 1);
  assert.equal(x.hideCharges, 1);
  assert.deepEqual(x.enemy, initialEnemy);
  assert(x.time < 90);
  assert.equal(x.frames.at(-1).lesson, 5);
  assert.deepEqual(x.medals(), []);
  const idle = new Game(g, { practice: true, record: false });
  idle.step(370);
  assert.equal(idle.state, "playing");
  assert.equal(idle.lesson, 0);
});
test("practice restart resets lesson, charges and training objectives", () => {
  const x = new Game(g, { practice: true });
  x.command(10);
  x.step(20);
  assert.equal(x.lesson, 1);
  const fresh = new Game(g, { practice: true });
  assert.equal(fresh.lesson, 0);
  assert.equal(fresh.decoys, 2);
  assert.deepEqual(fresh.scenario.clues, [47]);
});
test("Open Dossier has five unique reachable clues and two reachable exits for every layout", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const s = scenario(seed, "Dossier");
    assert.equal(new Set(s.clues).size, 5);
    assert.equal(new Set(s.exits).size, 2);
    assert.equal(s.required, 3);
    for (const n of [...s.clues, ...s.exits])
      assert(Number.isFinite(g.dist[s.start][n]));
  }
});
test("any three dossier clues unlock BOTH exits; extra clues are optional", () => {
  for (const exitIndex of [0, 1]) {
    const x = new Game(g, { contract: "Dossier" });
    const chosen = x.scenario.clues.slice(2, 5);
    for (const n of chosen) {
      x.player = g.actor(n);
      x.enemy = g.actor(30);
      x.ai.own = x.enemy;
      x.step(0.05);
    }
    assert(x.unlocked);
    assert.equal(x.collected.length, 3);
    assert(x.goals.includes(x.scenario.exits[exitIndex]));
    x.player = g.actor(x.scenario.exits[exitIndex]);
    x.enemy = g.actor(30);
    x.ai.own = x.enemy;
    x.step(0.05);
    assert.equal(x.state, "escaped");
  }
});
test("sprint is finite, faster, junction-only, audible, incompatible with shelter, and replayed", () => {
  const x = fixture();
  assert(x.sprint());
  assert.equal(x.sprints, 1);
  assert(!x.sprint());
  assert(!x.hide());
  assert(x.command(1));
  x.step(2);
  assert(x.playerLength > 12 && x.playerLength < 14);
  assert(!x.sprint());
  assert(x.frames.some((f) => f.sprinting && f.sprints === 1));
  assert(
    x.events.some(
      (e) => e.type === "sound" && e.source === "sprint" && e.heard,
    ),
  );
  x.paused = true;
  const t = x.time;
  x.step(2);
  assert.equal(x.time, t);
  assert(!x.sprint());
});
test("AI cannot distinguish decoy and sprint noise or see remaining sprint charges", () => {
  const a = fixture(),
    b = fixture();
  a.decoy();
  a.time = 4;
  b.sprint();
  const oa = a.sensor(),
    ob = b.sensor();
  assert.deepEqual(oa.noise, ob.noise);
  assert.deepEqual(Object.keys(ob).sort(), [
    "clearNodes",
    "noise",
    "sight",
    "time",
  ]);
  assert.deepEqual(Object.keys(ob.noise), ["node"]);
});
test("sprint expires and capture still applies during a sprint", () => {
  const x = fixture();
  x.sprint();
  x.command(1);
  x.step(6);
  assert(x.time >= x.sprintUntil);
  const distance = x.playerLength;
  x.step(1);
  assert(Math.abs(x.playerLength - distance - 4.4) < 0.01);
  const y = fixture();
  y.enemy = mini.actor(0);
  y.ai.own = y.enemy;
  y.sprint();
  y.step(0.05);
  assert.equal(y.state, "caught");
});
test("dossier bots use the same terminal rules and reproduce fixed seed frames", () => {
  const runs = [];
  for (let k = 0; k < 2; k++) {
    const x = new Game(g, { seed: 3, contract: "Dossier", mode: "Search" });
    while (x.state === "playing") x.step(0.1, (z) => botTurn(z));
    runs.push(x);
  }
  assert.deepEqual(runs[0].frames, runs[1].frames);
  assert.equal(runs[0].state, "escaped");
  assert.equal(runs[0].collected.length, 3);
});
test("medals use recorded outcomes, are absent on losses, and explain their conditions", () => {
  const x = new Game(g, { seed: 3 });
  while (x.state === "playing") x.step(0.1, (z) => botTurn(z));
  assert(x.medals().some((m) => m.name === "Ghost"));
  assert(x.medals().every((m) => m.text.length > 5));
  x.state = "caught";
  assert.deepEqual(x.medals(), []);
});
test("all three Dossier Lantern openings have a verified escape route", () => {
  for (const seed of [1, 3]) {
    const x = new Game(g, { seed, contract: "Dossier", record: false });
    while (x.state === "playing")
      x.step(0.1, (z) => botTurn(z, seed === 1 ? "Cautious" : "Courier"));
    assert.equal(x.state, "escaped");
  }
  const x = new Game(g, { seed: 2, contract: "Dossier", record: false }),
    plan = [34, 36, 24, 22];
  let i = 0;
  while (x.state === "playing")
    x.step(0.1, (z) => {
      if (z.player.edge !== null) return;
      if (z.player.node === plan[i]) i++;
      if (i < plan.length) z.command(g.next[z.player.node][plan[i]]);
    });
  assert.equal(x.state, "escaped");
});
test("invalid public seeds are canonicalised instead of crashing scenario lookup", () => {
  for (const value of [0, -1, 1.5, NaN, Infinity, 1000000, "bad", ""]) {
    assert.equal(normaliseSeed(value), 3);
    const x = new Game(g, { seed: value });
    assert.equal(x.seed, 3);
    assert.equal(x.player.node, scenario(3).start);
    assert(Number.isInteger(scenario(value).start));
  }
  assert.equal(new Game(g, { seed: "2" }).seed, 2);
  assert.equal(normaliseSeed(999999), 999999);
});
test("Lantern view tracks the public enemy continuously without revealing hidden modes", () => {
  const x = new Game(g, { mode: "Greedy" });
  assert.deepEqual(x.view().enemy, x.enemy);
  x.step(1);
  assert.deepEqual(x.view().enemy, x.enemy);
  assert.equal(x.view().enemyAge, 0);
  const hidden = new Game(g, { mode: "Search" });
  assert.equal(hidden.view().enemy, null);
  const snapshot = g.actor(22);
  hidden.lastEnemy = copy(snapshot);
  hidden.lastEnemyTime = 0;
  hidden.time = 2;
  hidden.enemy = g.actor(13);
  assert.deepEqual(hidden.view().enemy, snapshot);
  hidden.time = 20;
  assert.equal(hidden.view().enemy, null);
});
test("recorded fallback target agrees with the actual outgoing road", () => {
  const ai = new Pursuer(mini, mini.actor(0), sc, "Greedy", 1);
  ai.observe({
    time: 1,
    sight: { position: mini.actor(0), direction: null },
    noise: null,
    clearNodes: [],
  });
  ai.decide(1);
  assert.equal(ai.target, ai.own.to);
  assert(ai.reason.includes("adjacent junction"));
});
