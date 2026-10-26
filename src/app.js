import { Graph, copy } from "./graph.js";
import {
  Game,
  DIFFICULTIES,
  RULES,
  CONTRACTS,
  LESSONS,
  normaliseSeed,
} from "./game.js";
import { botTurn } from "./bots.js";
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const fmt = (t) =>
  `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
let graph,
  game,
  selected = "Greedy",
  contract = "Classic",
  seed = 3,
  speed = 1,
  guide = true,
  guideTarget = null,
  settingsOpen = false,
  started = false,
  bot = null,
  replay = false,
  replayIndex = 0,
  replayPlaying = false,
  sideKey = "",
  choiceKey = "",
  lastStamp = 0,
  accumulator = 0,
  prevPlayer = null,
  prevEnemy = null;
try {
  const response = await fetch("./data/map.json");
  if (!response.ok) throw Error("Map file unavailable");
  graph = new Graph(await response.json());
  game = new Game(graph, { seed, mode: selected, contract });
  buildBase();
  render();
} catch (e) {
  $("#sidebar").innerHTML =
    `<h2>Unable to load the city.</h2><p>Start the local server and open its localhost address. Opening index.html as a file is unsupported.</p><p>${esc(e.message)}</p>`;
  throw e;
}
function poly(e) {
  return e.geometry.map((p) => p.join(",")).join(" ");
}
function buildBase() {
  const labels = [
    ["BROAD STREET", 350, 248, -10],
    ["HIGH STREET", 476, 515, -10],
    ["CORNMARKET", 208, 414, 77],
    ["TURL STREET", 354, 340, 81],
    ["QUEEN’S LANE", 640, 366, 88],
    ["HOLYWELL STREET", 579, 182, 0],
    ["GEORGE STREET", 115, 329, -8],
    ["SHIP STREET", 271, 327, -8],
  ];
  $("#mapBase").innerHTML =
    `${graph.buildings.map((b) => `<polygon points="${b.geometry.map((p) => p.join(",")).join(" ")}" fill="#1d2c31" stroke="#344348" stroke-width=".5"/>`).join("")}<circle cx="519" cy="383" r="82" fill="url(#warm)"/><circle cx="488" cy="251" r="55" fill="url(#warm)"/>${graph.edges.map((e) => `<polyline points="${poly(e)}" fill="none" stroke="#0a171c" stroke-width="12" stroke-linejoin="round"/><polyline points="${poly(e)}" fill="none" stroke="#617377" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".68"/>`).join("")}${graph.nodes.map((n) => `<circle cx="${n.x}" cy="${n.y}" r="2.2" fill="#869793" opacity=".75"/>`).join("")}${labels.map(([t, x, y, a]) => `<text class="map-label" x="${x}" y="${y}" text-anchor="middle" transform="rotate(${a} ${x} ${y})">${t}</text>`).join("")}<text class="landmark-label" x="519" y="391">Radcliffe</text><text class="landmark-label" x="519" y="402">Camera</text><text class="landmark-label" x="539" y="227">Bodleian Library</text><text class="landmark-label" x="443" y="151">Parks Road</text><text class="landmark-label" x="295" y="473">Covered Market</text><g stroke="#779498" fill="none"><path d="M 70 636 V 640 H 170 V 636" stroke-width="1.2"/></g><text x="120" y="655" text-anchor="middle" font-size="8" fill="#91a6a8">100 m</text>`;
}
function marker(node, content) {
  const n = graph.nodes[node];
  return `<g transform="translate(${n.x} ${n.y})">${content}</g>`;
}
function renderMap(alpha = 1) {
  const f = replay ? game.frames[replayIndex] : null;
  const p = f?.player ?? game.player;
  const e = f?.enemy ?? game.view().enemy;
  const collected = f?.collected ?? game.collected;
  const unlocked = collected.length >= game.scenario.required;
  $("#objectives").innerHTML =
    game.scenario.hides
      .map((n) =>
        marker(
          n,
          `<rect x="-7" y="-7" width="14" height="14" rx="2" fill="#14272d" stroke="#93afa7" stroke-width="1"/><text class="icon-text" y="4" font-size="11" fill="#acc5bb">⌂</text>`,
        ),
      )
      .join("") +
    game.scenario.clues
      .map((n, i) =>
        marker(
          n,
          `<circle r="19" fill="#e8bd7d" opacity="${collected.includes(n) ? ".025" : unlocked ? ".01" : ".08"}"/><path d="M 0 -12 L 11 0 L 0 12 L -11 0 Z" fill="${collected.includes(n) ? "#344d46" : unlocked ? "#27373a" : "#e8bd7d"}" stroke="${collected.includes(n) ? "#8bd8ca" : unlocked ? "#687c7d" : "#fee0ac"}" stroke-width="1.2"/><text class="icon-text" y="4" font-size="10" fill="#102128">${collected.includes(n) ? "✓" : unlocked ? "·" : i + 1}</text>`,
        ),
      )
      .join("") +
    game.scenario.exits
      .map((n, i) =>
        marker(
          n,
          `<rect x="-12" y="-12" width="24" height="24" rx="3" fill="${unlocked ? "#8bd8ca" : "#17292c"}" stroke="${unlocked ? "#c6ffeb" : "#7e9f96"}" stroke-width="1.5"/><text class="icon-text" y="5" font-size="16" fill="${unlocked ? "#122028" : "#8db5a6"}">↗</text><text class="icon-text" y="-19" font-size="8" fill="#b3cbbf">${game.scenario.exits.length > 1 ? String.fromCharCode(65 + i) + " / " : ""}${unlocked ? "OPEN" : "LOCKED"}</text>`,
        ),
      )
      .join("");
  const anchor = graph.anchor(p);
  const canChoose =
    started &&
    !replay &&
    !game.paused &&
    game.state === "playing" &&
    game.time >= game.hideUntil;
  const choiceState = [
    canChoose,
    anchor,
    game.queued,
    game.lesson,
    game.practice,
    bot,
  ].join("|");
  if (choiceState !== choiceKey) {
    choiceKey = choiceState;
    $("#choices").innerHTML =
      canChoose && !bot
        ? routes()
            .map((c) => {
              const n = graph.nodes[c.node],
                edge = graph.edges[c.edge];
              return `<polyline class="road-click" data-node="${c.node}" points="${poly(edge)}" fill="none" stroke="${game.queued === c.node ? "#e8bd7d" : "#a2ded1"}" stroke-width="10" opacity=".24"/><g class="junction-button" data-node="${c.node}" role="button" tabindex="0" aria-label="Move to junction ${c.node} via ${esc(edge.name)}"><circle cx="${n.x}" cy="${n.y}" r="12" fill="#183c3b" stroke="#9bd8c4" stroke-width="1.5"/><circle cx="${n.x}" cy="${n.y}" r="2.6" fill="#a8e7d3"/></g>`;
            })
            .join("")
        : "";
  }
  function position(actor, prev) {
    const q = graph.point(actor);
    if (!replay && started && game.state === "playing" && prev && alpha < 1) {
      const a = graph.point(prev);
      return { x: a.x + (q.x - a.x) * alpha, y: a.y + (q.y - a.y) * alpha };
    }
    return q;
  }
  const pp = position(p, prevPlayer);
  const hidden = f?.hidden ?? game.time < game.hideUntil;
  const running = f?.sprinting ?? game.time < game.sprintUntil;
  let actors = `<g transform="translate(${pp.x} ${pp.y})"><circle r="15" fill="#8bd8ca" opacity=".08"/>${running ? '<circle r="13" fill="none" stroke="#e8bd7d" stroke-width="1.2" stroke-dasharray="4 3"/>' : ""}<circle r="8" fill="#0b2227" stroke="#b4ffeb" stroke-width="2" ${hidden ? 'stroke-dasharray="3 2"' : ""}/><circle r="3" fill="#b4ffeb"/><text x="13" y="4" font-size="7" fill="#bdede1" font-weight="600">YOU${hidden ? " / HIDDEN" : running ? " / SPRINT" : ""}</text></g>`;
  if (e) {
    const ep = position(e, replay || game.mode === "Greedy" ? prevEnemy : null);
    const stale =
      !replay && game.mode !== "Greedy" && game.time - game.lastEnemyTime > 0.6;
    actors += `<g transform="translate(${ep.x} ${ep.y})" opacity="${stale ? 0.45 : 1}"><circle r="17" fill="#f28c7f" opacity=".08"/><path d="M 0 -8 L 8 0 L 0 8 L -8 0 Z" fill="#f28c7f" stroke="#ffd0be" stroke-width="1.2"/><text x="13" y="4" font-size="7" fill="#f7a494" font-weight="600">${game.practice ? "WATCH / WAITING" : stale ? "LAST SEEN" : "PURSUER"}</text></g>`;
  }
  $("#actors").innerHTML = actors;
  drawGuide();
  if (replay) {
    const frames = game.frames.slice(0, replayIndex + 1);
    const trail = (key) =>
      frames
        .map((x) => {
          const q = graph.point(x[key]);
          return `${q.x},${q.y}`;
        })
        .join(" ");
    $("#trails").innerHTML =
      `<polyline points="${trail("player")}" stroke="#8bd8ca" stroke-width="3" fill="none" opacity=".75"/><polyline points="${trail("enemy")}" stroke="#f28c7f" stroke-width="2.5" stroke-dasharray="5 4" fill="none" opacity=".85"/>`;
    $("#belief").innerHTML =
      f.ai.belief
        .map((v, i) =>
          v > 0.004
            ? marker(
                i,
                `<circle r="${3 + Math.sqrt(v) * 31}" fill="#e8bd7d" opacity="${Math.min(0.6, 0.1 + v)}" stroke="#e8bd7d" stroke-width=".6"/>`,
              )
            : "",
        )
        .join("") +
      (f.ai.target !== null
        ? marker(
            f.ai.target,
            '<circle r="16" fill="none" stroke="#e8bd7d" stroke-dasharray="3 3"/>',
          )
        : "");
  } else {
    $("#trails").innerHTML = "";
    $("#belief").innerHTML = "";
  }
}
function routes() {
  const anchor = graph.anchor(game.player);
  if (!game.practice) return graph.adj[anchor];
  if (![0, 2, 4].includes(game.lesson)) return [];
  return graph.adj[anchor].filter(
    (c) => c.node === graph.next[anchor][game.lessonGoal],
  );
}
function guidedGoal() {
  if (game.practice) return game.lessonGoal;
  if (guideTarget !== null && game.goals.includes(guideTarget))
    return guideTarget;
  return game.goals
    .slice()
    .sort(
      (a, b) => graph.toNode(game.player, a) - graph.toNode(game.player, b),
    )[0];
}
function drawGuide() {
  const layer = $("#guidance");
  if (
    !started ||
    replay ||
    game.state !== "playing" ||
    (!guide && !game.practice)
  ) {
    layer.innerHTML = "";
    return;
  }
  const target = guidedGoal(),
    path = graph.route(graph.anchor(game.player), target);
  let edges = [];
  if (game.player.edge !== null) edges.push(game.player.edge);
  for (let i = 1; i < path.length; i++)
    edges.push(graph.adj[path[i - 1]].find((c) => c.node === path[i]).edge);
  layer.innerHTML =
    edges
      .map(
        (id) =>
          `<polyline points="${poly(graph.edges[id])}" fill="none" stroke="#e8bd7d" stroke-width="3" stroke-dasharray="3 7" opacity=".75"/>`,
      )
      .join("") +
    marker(
      target,
      '<circle r="20" fill="none" stroke="#e8bd7d" stroke-width="1.4" stroke-dasharray="4 4"/>',
    );
}
function readSeed() {
  const input = $("#seed");
  if (!input) return seed;
  const n = Number(input.value);
  if (!Number.isInteger(n) || n < 1 || n > 999999) {
    input.setCustomValidity("Use a whole number from 1 to 999999.");
    input.reportValidity();
    return null;
  }
  input.setCustomValidity("");
  return n;
}
function start(kind = null, practice = false) {
  const requested = practice ? seed : readSeed();
  if (requested === null) return;
  seed = normaliseSeed(requested);
  game = new Game(graph, { seed, mode: selected, contract, practice });
  started = true;
  bot = kind;
  guideTarget = null;
  if (practice) speed = 1;
  replay = false;
  replayPlaying = false;
  replayIndex = 0;
  accumulator = 0;
  prevPlayer = null;
  prevEnemy = null;
  sideKey = "";
  choiceKey = "";
  $("#replayPanel").hidden = true;
  $("#lab").close();
  $("#tutorial").close();
  render();
  $(".game-layout").scrollIntoView({ behavior: "smooth", block: "start" });
}
function setupSidebar() {
  $("#sidebar").innerHTML =
    `<p class="eyebrow">FIRST TIME IN THE CITY?</p><h2>Learn by escaping.</h2><p class="side-intro">Click a road. Collect the gold clues. Reach an open arrow. That is all you need to begin.</p><button class="primary wide" id="practiceBtn">Learn to play · safe practice →</button><p class="rule-note">5 guided steps · about a minute · no capture or deadline<br><span lang="zh">入门：移动 → 诱饵 → 线索 → 躲藏 → 出口</span></p><div class="side-separator"></div><div class="contract-switch">${Object.entries(
      CONTRACTS,
    )
      .map(
        ([k, v]) =>
          `<button data-contract="${k}" class="${contract === k ? "selected" : ""}" aria-pressed="${contract === k}"><b>${v.label}</b><small>${v.short}</small></button>`,
      )
      .join(
        "",
      )}</div><p class="rule-note">${CONTRACTS[contract].description}</p><button class="wide" id="startBtn">Start a real night →</button><details class="night-settings" ${settingsOpen ? "open" : ""}><summary>Night settings · ${DIFFICULTIES[selected].label}</summary><span class="mini-label">CHOOSE YOUR PURSUER</span><div class="difficulty">${Object.entries(
      DIFFICULTIES,
    )
      .map(
        ([k, v]) =>
          `<button data-mode="${k}" class="${selected === k ? "selected" : ""}" aria-pressed="${selected === k}"><span><b>${v.label}</b><small>${v.tag}</small></span><span class="radio"></span></button>`,
      )
      .join(
        "",
      )}</div><p class="rule-note">${DIFFICULTIES[selected].description}. Speeds stay fixed across difficulties.</p><div class="seed-row"><label for="seed">NIGHT / SEED</label><input type="number" id="seed" min="1" max="999999" step="1" value="${seed}"></div></details><p class="rule-note">New: two noisy sprints per night.<br>Space to pause. You can plan at your own pace.</p>`;
}
function coach() {
  const l = LESSONS[Math.min(game.lesson, 4)];
  return `<div class="coach"><div class="coach-dots" aria-label="Lesson ${game.lesson + 1} of 5">${LESSONS.map((_, i) => `<span class="${i < game.lesson ? "done" : i === game.lesson ? "current" : ""}">${i < game.lesson ? "✓" : i + 1}</span>`).join("")}</div><p class="eyebrow">SAFE PRACTICE / STEP ${game.lesson + 1} OF 5</p><h3>${l.title}</h3><p>${l.text}</p><p class="coach-zh" lang="zh">${l.zh}</p></div>`;
}
function activeSidebar() {
  const anchor = graph.anchor(game.player),
    inMotion = game.player.edge !== null,
    hide = game.time < game.hideUntil,
    running = game.time < game.sprintUntil;
  const canHide =
    !inMotion &&
    game.scenario.hides.includes(anchor) &&
    game.hideCharges > 0 &&
    !hide &&
    game.time >= game.hideReady &&
    !running &&
    (!game.practice || game.lesson === 3);
  const canDecoy =
    !inMotion && game.decoys > 0 && (!game.practice || game.lesson === 1);
  $("#sidebar").innerHTML =
    `${game.practice ? coach() : ""}<div class="run-status"><div><p class="eyebrow">${game.practice ? "SAFE PRACTICE" : CONTRACTS[game.contract].label.toUpperCase() + " / " + DIFFICULTIES[game.mode].label.toUpperCase()}</p><strong id="clock">${fmt(game.time)}</strong></div><span class="mini-label">${game.practice ? "NO DEADLINE" : "/ 6:00"}</span></div><div id="risk" class="risk"></div><div class="objective-row"><span>◇ Clues secured</span><b>${game.collected.length} / ${game.scenario.required}</b></div><div class="objective-row"><span>↗ ${game.scenario.exits.length > 1 ? "Both exits" : "Exit"}</span><span>${game.unlocked ? "OPEN" : "LOCKED"}</span></div>${!game.practice ? `<div class="goal-picks">${game.goals.map((n) => `<button data-goal="${n}" class="${guidedGoal() === n && guide ? "selected" : ""}" title="Show a route to this target">${game.unlocked ? "↗ Exit " + String.fromCharCode(65 + game.scenario.exits.indexOf(n)) : "◇ Clue " + (game.scenario.clues.indexOf(n) + 1)}</button>`).join("")}</div><button id="guideBtn" class="guide-toggle" aria-pressed="${guide}">${guide ? "◈ Route guide on" : "◈ Show a route"}</button><p class="rule-note guide-warning">Dotted route = shortest path. It ignores danger.</p>` : ""}${bot ? `<p class="bot-banner">WATCHING ${bot.toUpperCase()} <button id="takeControl">Take control</button></p>` : ""}<p class="side-message" id="movement">${hide ? "Hidden for 6 seconds. Wait until the shelter time ends." : inMotion ? `Moving to junction ${anchor}. You may queue one next turn.` : `At junction ${anchor}. Choose a lit road.`}</p><div class="route-options">${routes()
      .map(
        (c) =>
          `<button data-node="${c.node}" ${hide || bot || game.paused ? "disabled" : ""} class="${game.queued === c.node ? "pressed" : ""}" aria-label="Route to junction ${c.node} via ${esc(graph.edges[c.edge].name)}">${esc(graph.edges[c.edge].name)} <span>${Math.round(graph.edges[c.edge].length)}m → ${c.node}</span></button>`,
      )
      .join(
        "",
      )}</div><div class="tool-row"><button id="hideBtn" ${canHide && !game.paused ? "" : "disabled"} title="H · 6s stillness · shelters only">⌂ Hide · ${game.hideCharges}</button><button id="decoyBtn" ${canDecoy && !game.paused ? "" : "disabled"} title="D · delayed 4s · junctions only">◇ Decoy · ${game.decoys}</button>${!game.practice ? `<button id="sprintBtn" ${!inMotion && !hide && !running && game.sprints > 0 && !game.paused ? "" : "disabled"} title="S · 5s faster · loud footsteps within 200m">↝ Sprint · ${game.sprints}</button>` : ""}</div><p class="rule-note">${game.practice ? "The watch waits. Take your time." : "Tools work at junctions. Hide: 6s still. Decoy: 4s delay. Sprint: 5s fast, but loud."}</p><div class="control-row"><button id="pauseBtn">${game.paused ? "▶ Resume" : "Ⅱ Pause"}</button><select id="speed" aria-label="Game speed">${[1, 2, 4, 8].map((n) => `<option value="${n}" ${speed === n ? "selected" : ""}>${n}× speed</option>`).join("")}</select><button id="restartBtn">Restart</button></div><button id="menuBtn" class="wide" style="margin-top:8px;font-size:10px;padding:7px">${game.practice ? "Skip practice / choose a night" : "Change mission / difficulty"}</button><p class="rule-note">Space: pause · H: hide · D: decoy · S: sprint</p>`;
}
function resultSidebar() {
  const won = game.state === "escaped";
  $("#sidebar").innerHTML =
    `<p class="eyebrow">${game.practice ? "PRACTICE COMPLETE" : "THE NIGHT IS OVER"}</p><div class="run-result">${game.practice ? "You know the streets." : won ? "You disappeared." : game.state === "caught" ? "A step too close." : "Dawn found you."}</div><p class="side-intro">${game.practice ? "Next: collect 3 clues, then escape. The watch will move. Try Lantern first; use corners and pause to plan." : won ? "Your route worked. Try another mission or a different clue order." : "Try a different clue order, a longer loop, or a delayed decoy. Replay shows the exact turn where it found you."}</p>${game.practice ? '<button id="graduateBtn" class="primary wide">Play my first real night →</button>' : ""}<div class="stats"><div><strong>${fmt(game.time)}</strong><span>TIME IN THE CITY</span></div><div><strong>${Math.round(game.playerLength)}m</strong><span>DISTANCE TRAVELLED</span></div><div><strong>${game.collected.length}/${game.scenario.required}</strong><span>CLUES SECURED</span></div><div><strong>${game.events.filter((e) => ["found", "refound"].includes(e.type)).length}</strong><span>VISUAL CONTACTS</span></div></div><div class="medals">${game
      .medals()
      .map(
        (m) =>
          `<span title="${esc(m.text)}">✧ ${m.name}<small>${m.text}</small></span>`,
      )
      .join(
        "",
      )}</div><button id="showReplay" class="${game.practice ? "" : "primary"} wide">See through its eyes →</button><button id="againBtn" class="wide" style="margin-top:9px">${game.practice ? "Practise again" : "Replay this night"}</button>${!game.practice ? '<button id="newNightBtn" class="wide" style="margin-top:9px">Next night ↗</button>' : ""}<button id="menuBtn" class="wide" style="margin-top:9px">Choose mission / difficulty</button><p class="rule-note">Every replay reason was recorded at decision time.</p>`;
}
function render(alpha = 1) {
  const key = started
    ? [
        game.state,
        game.player.edge,
        game.player.node,
        graph.anchor(game.player),
        game.queued,
        game.collected.length,
        game.hideCharges,
        game.decoys,
        game.sprints,
        game.time < game.sprintUntil,
        game.time < game.hideUntil,
        game.time >= game.hideReady,
        game.paused,
        bot,
        replay,
        game.lesson,
        guide,
        guideTarget,
      ].join("|")
    : `setup|${selected}|${seed}|${contract}`;
  if (key !== sideKey) {
    if (!started) setupSidebar();
    else if (game.state === "playing") activeSidebar();
    else resultSidebar();
    sideKey = key;
  }
  if (started && game.state === "playing") {
    $("#clock").textContent = fmt(game.time);
    const v = game.view(),
      risk = $("#risk");
    risk.className = `risk ${v.contact ? "danger" : ""}`;
    risk.innerHTML =
      game.practice && v.hidden
        ? `⌂ SHELTER PRACTICE / ${Math.ceil(game.hideUntil - game.time)}s left<span>Stay still. Your next road unlocks when hiding ends.</span>`
        : game.practice
          ? "⌂ SAFE PRACTICE<span>No capture. No deadline. Follow the glowing road.</span>"
          : v.hidden
            ? `⌂ HIDDEN / ${Math.ceil(game.hideUntil - game.time)}s left<span>You cannot move. Capture still applies within 6m.</span>`
            : game.time < game.sprintUntil
              ? `↝ SPRINTING / ${Math.ceil(game.sprintUntil - game.time)}s left<span>Faster footsteps may draw the watch to your launch junction.</span>`
              : v.contact
                ? "◆ IT CAN SEE YOU<span>Turn a corner to break contact. It catches you within 6m.</span>"
                : v.enemy
                  ? `◈ ${game.mode === "Greedy" ? "WATCH VISIBLE" : "LAST SEEN " + Math.floor(v.enemyAge) + "s AGO"}<span>${game.mode === "Greedy" ? "The diamond shows the watch. It only knows you when it sees or hears you." : "This marker is a memory, not a live location."}</span>`
                  : "◈ WATCH OUT OF SIGHT<span>Its location is unknown. Leave room for an escape route.</span>";
  }
  $("#quickRules").hidden = started;
  $("#mapMode").textContent = replay
    ? `REPLAY / ${fmt(game.frames[replayIndex].time)}`
    : !started
      ? "CHOOSE YOUR FIRST NIGHT"
      : game.state === "playing"
        ? game.paused
          ? "PAUSED / PLAN YOUR ROUTE"
          : game.practice
            ? "SAFE PRACTICE / WATCH WAITING"
            : `NIGHT ${String(seed).padStart(2, "0")} / ${DIFFICULTIES[game.mode].label.toUpperCase()}`
        : game.state.toUpperCase();
  $("#mapHint").textContent = replay
    ? "Amber circles show what it believed then."
    : !started
      ? "Teal circle: you. Gold diamonds: clues. Arrow: exit."
      : game.state !== "playing"
        ? "The whole pursuit is ready to replay."
        : game.paused
          ? "Paused. Study the streets, then resume."
          : game.practice
            ? LESSONS[Math.min(game.lesson, 4)].title
            : game.time < game.hideUntil
              ? "Stay still. Listen to the city."
              : game.queued !== null
                ? `Next turn queued → junction ${game.queued}`
                : game.unlocked
                  ? "Exit open. Follow an arrow to escape."
                  : "Click a lit road. Pick any remaining clue.";
  const recent = game.events
    .filter((e) =>
      [
        "clue",
        "found",
        "lost",
        "refound",
        "sound",
        "sprint",
        "lesson",
      ].includes(e.type),
    )
    .at(-1);
  const notice = $("#notice");
  notice.hidden =
    !started ||
    replay ||
    game.state !== "playing" ||
    !recent ||
    game.time - recent.time > 7;
  const message = recent?.text ?? "";
  if (notice.textContent !== message) notice.textContent = message;
  renderMap(alpha);
}
function openReplay() {
  replay = true;
  replayPlaying = false;
  replayIndex = game.frames.length - 1;
  $("#replayPanel").hidden = false;
  $("#timeline").max = String(game.frames.length - 1);
  $("#eventList").innerHTML = game.events
    .filter((e) => !["decision", "start"].includes(e.type))
    .map(
      (e) =>
        `<button data-time="${e.time}"><b>${fmt(e.time)}</b>${esc(e.text)}</button>`,
    )
    .join("");
  updateReplay();
  $("#replayPanel").scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function updateReplay() {
  const f = game.frames[replayIndex];
  $("#timeline").value = String(replayIndex);
  $("#replayTime").textContent = fmt(f.time);
  $("#decision").textContent = f.ai.reason;
  const sum = f.ai.belief.reduce((a, b) => a + b, 0);
  $("#beliefNote").textContent =
    `${f.ai.status} · ${f.ai.seen ? "Visual observation available" : "No live visual observation"} · probability sum ${sum.toFixed(3)} · outlined circle = chosen target`;
  $("#replayPlay").textContent = replayPlaying ? "Ⅱ Pause" : "▶ Play";
  render();
}
$("#sidebar").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  if (b.dataset.contract) {
    const requested = readSeed();
    if (requested === null) return;
    seed = requested;
    contract = b.dataset.contract;
    game = new Game(graph, { seed, mode: selected, contract });
    sideKey = "";
    render();
    return;
  }
  if (b.dataset.goal !== undefined) {
    guide = true;
    guideTarget = Number(b.dataset.goal);
    render();
    return;
  }
  if (b.dataset.mode) {
    const requested = readSeed();
    if (requested === null) return;
    seed = requested;
    selected = b.dataset.mode;
    game = new Game(graph, { seed, mode: selected, contract });
    sideKey = "";
    render();
    return;
  }
  if (b.dataset.node !== undefined) {
    bot = null;
    game.command(Number(b.dataset.node));
    render();
    return;
  }
  switch (b.id) {
    case "practiceBtn":
      start(null, true);
      break;
    case "startBtn":
      start();
      break;
    case "graduateBtn":
      selected = "Greedy";
      seed = 3;
      contract = "Classic";
      speed = 1;
      start();
      break;
    case "guideBtn":
      guide = !guide;
      render();
      break;
    case "pauseBtn":
      game.paused = !game.paused;
      render();
      break;
    case "hideBtn":
      game.hide();
      render();
      break;
    case "decoyBtn":
      game.decoy();
      render();
      break;
    case "sprintBtn":
      game.sprint();
      render();
      break;
    case "restartBtn":
    case "againBtn":
      start(null, game.practice);
      break;
    case "newNightBtn":
      seed++;
      start();
      break;
    case "menuBtn":
      started = false;
      replay = false;
      bot = null;
      replayPlaying = false;
      game = new Game(graph, { seed, mode: selected, contract });
      $("#replayPanel").hidden = true;
      sideKey = "";
      render();
      break;
    case "showReplay":
      openReplay();
      break;
    case "takeControl":
      bot = null;
      render();
      break;
  }
});
$("#sidebar").addEventListener(
  "toggle",
  (e) => {
    if (e.target.matches(".night-settings")) settingsOpen = e.target.open;
  },
  true,
);
$("#sidebar").addEventListener("input", (e) => {
  if (e.target.id === "seed") e.target.setCustomValidity("");
});
$("#sidebar").addEventListener("change", (e) => {
  if (e.target.id === "speed") {
    speed = Number(e.target.value);
    accumulator = 0;
  }
  if (e.target.id === "seed") {
    const n = readSeed();
    if (n !== null) {
      seed = n;
      game = new Game(graph, { seed, mode: selected, contract });
      render();
    }
  }
});
function mapCommand(e) {
  const n = e.target.closest("[data-node]");
  if (n && !replay && started && game.state === "playing") {
    bot = null;
    game.command(Number(n.dataset.node));
    render();
  }
}
$("#map").addEventListener("click", mapCommand);
$("#map").addEventListener("keydown", (e) => {
  if (!e.repeat && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    e.stopPropagation();
    mapCommand(e);
  }
});
function openModal(id) {
  if (started && game.state === "playing") {
    game.paused = true;
    render();
  }
  $(id).showModal();
}
$("#howBtn").onclick = () => openModal("#tutorial");
$("#labBtn").onclick = () => {
  loadResults();
  openModal("#lab");
};
document
  .querySelectorAll(".dialog-close")
  .forEach((x) => (x.onclick = () => x.closest("dialog").close()));
$("#closeLab").onclick = () => $("#lab").close();
$("#rulesPractice").onclick = () => start(null, true);
$("#watchCourier").onclick = () => start("Courier");
$("#watchCautious").onclick = () => start("Cautious");
$("#timeline").oninput = (e) => {
  replayPlaying = false;
  replayIndex = Number(e.target.value);
  updateReplay();
};
$("#replayPlay").onclick = () => {
  if (replayIndex === game.frames.length - 1) replayIndex = 0;
  replayPlaying = !replayPlaying;
  updateReplay();
};
$("#eventList").onclick = (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const t = Number(b.dataset.time);
  replayIndex = game.frames.findIndex((f) => f.time >= t - 1e-6);
  if (replayIndex < 0) replayIndex = game.frames.length - 1;
  replayPlaying = false;
  updateReplay();
};
$("#exportBtn").onclick = () => {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          version: 2,
          seed,
          mode: game.mode,
          contract: game.contract,
          practice: game.practice,
          scenario: game.scenario,
          mapHash: graph.meta.rawSHA256,
          events: game.events,
          frames: game.frames,
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `oxford-night-${seed}-${game.mode}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
document.addEventListener("keydown", (e) => {
  if (
    e.defaultPrevented ||
    e.repeat ||
    e.target.closest(
      'input,select,button,summary,a,[contenteditable="true"]',
    ) ||
    document.querySelector("dialog[open]")
  )
    return;
  if (e.code === "Space" && started && game.state === "playing") {
    e.preventDefault();
    game.paused = !game.paused;
    render();
  }
  if (e.key.toLowerCase() === "h") {
    game.hide();
    render();
  }
  if (e.key.toLowerCase() === "d") {
    game.decoy();
    render();
  }
  if (e.key.toLowerCase() === "s") {
    game.sprint();
    render();
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && started && game.state === "playing") {
    game.paused = true;
    render();
  }
});
async function loadResults() {
  const requested = contract;
  try {
    const response = await fetch(
      requested === "Dossier"
        ? "./data/results-dossier.json"
        : "./data/results.json",
    );
    if (!response.ok) return;
    const data = await response.json();
    if (requested !== contract) return;
    $("#reportLink").href =
      requested === "Dossier" ? "./RESULTS_DOSSIER.md" : "./RESULTS.md";
    $("#results").innerHTML =
      `<p><b>${CONTRACTS[requested].label}</b> · ${data.config.runsPerPair} seeds per pair · ${data.runs.length} games. Three authored layouts recur. Sensing and marker memory vary by difficulty. Bots do not sprint.</p><table><thead><tr><th>Runner</th><th>Pursuer</th><th>Caught</th><th>Escape</th><th>Time</th></tr></thead><tbody>${data.rows.map((r) => `<tr><td>${r.bot}</td><td>${r.mode}</td><td>${(r.captureRate * 100).toFixed(0)}%</td><td>${(r.escapeRate * 100).toFixed(0)}%</td><td>${r.meanTime.toFixed(0)}s</td></tr>`).join("")}</tbody></table><p class="fine">Use the mission selector on the start screen to compare the other report. These are bot outcomes, not human playtest results.</p>`;
  } catch {}
}
loadResults();
let replayAccum = 0;
function loop(stamp) {
  const elapsed = Math.min(0.2, (stamp - lastStamp) / 1000 || 0);
  lastStamp = stamp;
  if (started && game.state === "playing" && !game.paused) {
    accumulator += elapsed * speed;
    while (accumulator >= 0.05 && game.state === "playing") {
      prevPlayer = copy(game.player);
      prevEnemy = copy(game.enemy);
      game.step(0.05, bot ? (x) => botTurn(x, bot) : null);
      accumulator -= 0.05;
    }
    render(accumulator / 0.05);
  } else if (replayPlaying) {
    replayAccum += elapsed * 4;
    while (replayAccum >= 0.5) {
      replayAccum -= 0.5;
      replayIndex++;
      if (replayIndex >= game.frames.length - 1) {
        replayIndex = game.frames.length - 1;
        replayPlaying = false;
        break;
      }
    }
    updateReplay();
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
