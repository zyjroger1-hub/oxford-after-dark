import { copy } from "./graph.js";
import { Pursuer } from "./ai.js";
export const RULES = {
  playerSpeed: 4.4,
  pursuerSpeed: 4.05,
  captureRadius: 6,
  deadline: 360,
  hideDuration: 6,
  hideCooldown: 20,
  hideCharges: 2,
  decoys: 2,
  decoyDelay: 4,
  noiseRange: 260,
  sprintSpeed: 6.6,
  sprintDuration: 5,
  sprintCharges: 2,
  sprintNoiseRange: 200,
};
export const DIFFICULTIES = {
  Greedy: {
    sight: 62,
    enemyMemory: Infinity,
    label: "Lantern",
    tag: "See the watch",
    description: "Greedy pursuit · pursuer always visible · 62m sight",
  },
  Search: {
    sight: 78,
    enemyMemory: 14,
    label: "Shadow",
    tag: "Read the search",
    description: "Candidate search · last sighting fades after 14s · 78m sight",
  },
  Intercept: {
    sight: 90,
    enemyMemory: 9,
    label: "Midnight",
    tag: "Expect an ambush",
    description: "Route prediction · last sighting fades after 9s · 90m sight",
  },
};
export const CONTRACTS = {
  Classic: {
    label: "The archive",
    description: "Three clues. One exit. Choose the order.",
    short: "3 clues · 1 exit",
  },
  Dossier: {
    label: "Open dossier",
    description: "Choose any 3 of 5 clues. Escape through either exit.",
    short: "Pick 3 of 5 · 2 exits",
  },
};
export const LESSONS = [
  {
    title: "Follow a lit road",
    text: "Click the glowing Queen Street junction. Your circle travels along the road; it never jumps.",
    zh: "点亮起的相邻路口，人物会沿道路移动。",
    goal: 10,
  },
  {
    title: "Leave a false trail",
    text: "You are at Carfax. Press Decoy. It sounds here 4 seconds later, giving you time to leave.",
    zh: "点 Decoy 放诱饵，4 秒后原地发声。",
    goal: 10,
  },
  {
    title: "Pick up the clue",
    text: "Follow Cornmarket Street to the gold diamond. Clues are collected automatically on arrival.",
    zh: "沿亮起道路到金色菱形，抵达自动收集。",
    goal: 47,
  },
  {
    title: "Try a shelter",
    text: "Press Hide at this house marker. You stay still for 6 seconds. Two uses in a real night.",
    zh: "点 Hide 躲藏：必须原地等待 6 秒。",
    goal: 47,
  },
  {
    title: "Reach the open exit",
    text: "The arrow is unlocked. Follow Cornmarket Street to it. In a full night, collect 3 clues first.",
    zh: "走到已解锁的箭头出口。正式局需先收齐 3 条线索。",
    goal: 48,
  },
];
export function normaliseSeed(value, fallback = 3) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 999999 ? n : fallback;
}
export function scenario(seed = 1, contract = "Classic") {
  seed = normaliseSeed(seed, 1);
  const variants = [
    { start: 9, enemy: 22, clues: [15, 13, 39], exit: 1 },
    { start: 32, enemy: 1, clues: [34, 24, 31], exit: 22 },
    { start: 37, enemy: 46, clues: [36, 25, 20], exit: 28 },
  ];
  const s = copy(variants[(Math.abs(seed) - 1) % variants.length]);
  s.hides = [5, 23, 20, 31, 36];
  s.pursuerSpeed = RULES.pursuerSpeed;
  s.seed = seed;
  s.required = 3;
  s.exits = [s.exit];
  if (contract === "Dossier") {
    const extras = [
      [31, 23],
      [36, 39],
      [15, 31],
    ][(Math.abs(seed) - 1) % 3];
    s.clues = [...s.clues, ...extras];
    s.exits = [s.exit, [32, 1, 22][(Math.abs(seed) - 1) % 3]];
  }
  return s;
}
export class Game {
  constructor(
    graph,
    {
      seed = 1,
      mode = "Greedy",
      contract = "Classic",
      practice = false,
      record = true,
      scenarioOverride = null,
    } = {},
  ) {
    seed = normaliseSeed(seed);
    this.g = graph;
    this.seed = seed;
    this.mode = practice ? "Greedy" : mode;
    this.contract = contract;
    this.practice = practice;
    this.lesson = 0;
    this.config = DIFFICULTIES[this.mode];
    this.scenario = scenarioOverride
      ? copy(scenarioOverride)
      : scenario(seed, contract);
    if (practice)
      this.scenario = {
        start: 9,
        enemy: 22,
        clues: [47],
        required: 1,
        exit: 48,
        exits: [48],
        hides: [47],
        pursuerSpeed: 0,
        seed,
      };
    this.scenario.required ??= 3;
    this.scenario.exits ??= [this.scenario.exit];
    this.player = graph.actor(this.scenario.start);
    this.enemy = graph.actor(this.scenario.enemy);
    const { clues, exit, exits, hides, pursuerSpeed } = this.scenario;
    this.ai = new Pursuer(
      graph,
      this.enemy,
      { clues, exit, exits, hides, pursuerSpeed },
      this.mode,
      seed + 71,
    );
    if (practice) {
      this.ai.reason = "Practice: the watch waits while you learn.";
      this.ai.status = "PRACTICE";
    }
    this.time = 0;
    this.state = "playing";
    this.collected = [];
    this.queued = null;
    this.paused = false;
    this.hideUntil = 0;
    this.hideReady = 0;
    this.hideCharges = RULES.hideCharges;
    this.decoys = RULES.decoys;
    this.sprintUntil = 0;
    this.sprints = RULES.sprintCharges;
    this.minSeparation = Infinity;
    this.noises = [];
    this.events = [];
    this.frames = [];
    this.recording = record;
    this.nextFrame = 0;
    this.nextSense = 0;
    this.wasSeen = false;
    this.lastEnemy = null;
    this.lastEnemyTime = -999;
    this.playerLength = 0;
    this.enemyLength = 0;
    this.emit(
      "start",
      practice
        ? "A safe first night. The watch waits; follow the five lessons."
        : contract === "Dossier"
          ? "Choose any three clues and either exit."
          : "The archive is scattered. Three clues, then the exit.",
    );
    this.saveFrame();
  }
  get unlocked() {
    return this.collected.length >= this.scenario.required;
  }
  get goals() {
    return this.unlocked
      ? this.scenario.exits
      : this.scenario.clues.filter((n) => !this.collected.includes(n));
  }
  get lessonGoal() {
    return LESSONS[Math.min(this.lesson, 4)].goal;
  }
  lessonStep(stage) {
    this.lesson = stage;
    this.emit(
      "lesson",
      stage < 5
        ? LESSONS[stage].title
        : "Practice complete. You know the streets.",
      { stage },
    );
  }
  emit(type, text, extra = {}) {
    this.events.push({ time: this.time, type, text, ...copy(extra) });
  }
  command(node) {
    if (this.state !== "playing" || this.paused || this.time < this.hideUntil)
      return false;
    const a = this.g.anchor(this.player);
    if (!this.g.adj[a].some((c) => c.node === node)) return false;
    if (
      this.practice &&
      (![0, 2, 4].includes(this.lesson) ||
        this.g.next[a][this.lessonGoal] !== node)
    )
      return false;
    this.queued = node;
    return true;
  }
  hide() {
    if (
      this.state !== "playing" ||
      this.paused ||
      this.player.edge !== null ||
      !this.scenario.hides.includes(this.player.node) ||
      this.hideCharges <= 0 ||
      this.time < this.hideReady ||
      this.time < this.sprintUntil
    )
      return false;
    if (this.practice && this.lesson !== 3) return false;
    this.hideCharges--;
    this.hideUntil = this.time + RULES.hideDuration;
    this.hideReady = this.time + RULES.hideCooldown;
    this.queued = null;
    this.emit(
      "hide",
      `Runner hides for ${RULES.hideDuration}s and cannot move.`,
      { node: this.player.node },
    );
    return true;
  }
  decoy() {
    if (
      this.state !== "playing" ||
      this.paused ||
      this.decoys <= 0 ||
      this.player.edge !== null
    )
      return false;
    if (this.practice && this.lesson !== 1) return false;
    const node = this.player.node;
    this.decoys--;
    this.noises.push({
      node,
      at: this.time + RULES.decoyDelay,
      source: "decoy",
      range: RULES.noiseRange,
    });
    this.emit(
      "decoy",
      `A decoy is set here. It sounds in 4s. Move away before it rings.`,
      { node },
    );
    if (this.practice) this.lessonStep(2);
    return true;
  }
  sprint() {
    if (
      this.practice ||
      this.state !== "playing" ||
      this.paused ||
      this.sprints <= 0 ||
      this.player.edge !== null ||
      this.time < this.hideUntil ||
      this.time < this.sprintUntil
    )
      return false;
    this.sprints--;
    this.sprintUntil = this.time + RULES.sprintDuration;
    this.noises.push({
      node: this.player.node,
      at: this.time,
      source: "sprint",
      range: RULES.sprintNoiseRange,
    });
    this.emit(
      "sprint",
      "Sprint for 5s at 6.6m/s. Loud footsteps can reveal this junction within 200m.",
      { node: this.player.node },
    );
    return true;
  }
  sensor() {
    const g = this.g,
      hidden = this.time < this.hideUntil;
    const sight =
      !this.practice &&
      g.visible(this.enemy, this.player, this.config.sight) &&
      (!hidden || g.distance(this.enemy, this.player) <= 10);
    const due = this.noises.filter((n) => n.at <= this.time);
    this.noises = this.noises.filter((n) => n.at > this.time);
    let noise = null;
    for (const n of due) {
      const source = n.source ?? "decoy",
        heard =
          !this.practice &&
          g.toNode(this.enemy, n.node) <= (n.range ?? RULES.noiseRange);
      this.emit(
        "sound",
        this.practice
          ? "The practice decoy rang. In a real night it can draw the watch away."
          : heard
            ? `The watch heard ${source === "sprint" ? "your sprint footsteps" : "the delayed decoy"}.`
            : `${source === "sprint" ? "Sprint footsteps" : "Decoy"} were beyond hearing range.`,
        { node: n.node, source, heard, changed: heard && !sight },
      );
      // Both sources sound like footsteps. The AI is not told which action made the noise.
      if (heard) noise = { node: n.node };
    }
    const clearNodes = g.nodes
      .filter(
        (n) =>
          !this.scenario.hides.includes(n.id) &&
          g.visible(this.enemy, g.actor(n.id), this.config.sight),
      )
      .map((n) => n.id);
    return {
      time: this.time,
      sight: sight
        ? {
            position: copy(this.player),
            direction: this.player.edge === null ? null : this.player.to,
          }
        : null,
      noise,
      clearNodes,
    };
  }
  sense() {
    const packet = this.sensor();
    if (!this.practice) this.ai.observe(packet);
    if (!!packet.sight !== this.wasSeen) {
      this.emit(
        packet.sight
          ? this.events.some((e) => e.type === "found")
            ? "refound"
            : "found"
          : "lost",
        packet.sight
          ? "Visual contact. Turn a corner to break the sightline."
          : "Contact lost. It must search from its last observation.",
        { player: copy(this.player), enemy: copy(this.enemy) },
      );
      this.wasSeen = !!packet.sight;
    }
    if (
      this.mode === "Greedy" ||
      this.g.visible(this.player, this.enemy, 110)
    ) {
      this.lastEnemy = copy(this.enemy);
      this.lastEnemyTime = this.time;
    }
  }
  step(dt = 0.1, controller = null) {
    if (this.state !== "playing" || this.paused) return;
    let remain = dt;
    while (remain > 1e-9 && this.state === "playing") {
      const h = Math.min(0.05, remain);
      if (controller) controller(this);
      this.tick(h);
      remain -= h;
    }
  }
  tick(h) {
    this.time += h;
    if (this.time + 1e-8 >= this.nextSense) {
      this.sense();
      this.nextSense += 0.5;
    }
    if (!this.practice) {
      const beforeKey = [this.ai.target, this.ai.reason].join("|");
      this.ai.decide(this.time);
      if (beforeKey !== [this.ai.target, this.ai.reason].join("|"))
        this.emit("decision", this.ai.reason, {
          target: this.ai.target,
          status: this.ai.status,
        });
    }
    if (
      this.player.edge === null &&
      this.queued !== null &&
      this.time >= this.hideUntil
    ) {
      this.g.depart(this.player, this.queued);
      this.queued = null;
    }
    const runnerSpeed =
      this.time < this.sprintUntil ? RULES.sprintSpeed : RULES.playerSpeed;
    this.playerLength += this.g.move(
      this.player,
      this.time < this.hideUntil ? 0 : runnerSpeed * h,
    );
    if (!this.practice)
      this.enemyLength += this.g.move(
        this.enemy,
        this.scenario.pursuerSpeed * h,
      );
    // Combined movement <=0.533m per step even during sprint, below the 6m radius.
    const separation = this.g.distance(this.player, this.enemy);
    this.minSeparation = Math.min(this.minSeparation, separation);
    if (!this.practice && separation <= RULES.captureRadius)
      this.finish("caught", "The pursuer closed to within 6 metres.");
    else if (this.player.edge === null) {
      const node = this.player.node;
      if (this.practice && this.lesson === 0 && node === 10) this.lessonStep(1);
      if (
        !this.unlocked &&
        this.scenario.clues.includes(node) &&
        !this.collected.includes(node)
      ) {
        this.collected.push(node);
        this.emit(
          "clue",
          `Clue secured: ${this.collected.length}/${this.scenario.required}. ${this.unlocked ? "Exit unlocked — follow an arrow." : "Choose your next clue."}`,
          { node },
        );
        if (this.practice && this.lesson === 2) this.lessonStep(3);
      }
      if (
        this.practice &&
        this.lesson === 3 &&
        this.hideCharges < RULES.hideCharges &&
        this.time >= this.hideUntil
      )
        this.lessonStep(4);
      if (
        this.scenario.exits.includes(node) &&
        this.unlocked &&
        (!this.practice || this.lesson === 4)
      ) {
        if (this.practice) this.lessonStep(5);
        this.finish(
          "escaped",
          this.practice
            ? "Practice complete. Now you can try a real night."
            : "The required clues reached an unlocked exit.",
        );
      }
    }
    if (
      !this.practice &&
      this.time >= RULES.deadline &&
      this.state === "playing"
    )
      this.finish("timeout", "The six-minute night watch ended before escape.");
    if (this.recording && this.time + 1e-8 >= this.nextFrame) {
      this.saveFrame();
      this.nextFrame += 0.5;
    }
  }
  medals() {
    if (this.practice || this.state !== "escaped") return [];
    const awards = [];
    if (!this.events.some((e) => e.type === "found"))
      awards.push({ name: "Ghost", text: "Escaped without being seen." });
    if (
      this.events.some(
        (e) => e.type === "sound" && e.source === "decoy" && e.changed,
      )
    )
      awards.push({
        name: "False trail",
        text: "A decoy changed the watch’s judgment.",
      });
    if (this.minSeparation < 25)
      awards.push({
        name: "Close call",
        text: "Escaped after the watch came within 25m by road.",
      });
    if (this.time <= 300)
      awards.push({
        name: "Before midnight",
        text: "Reached the exit in under five minutes.",
      });
    return awards;
  }
  finish(state, reason) {
    this.state = state;
    this.emit(state, reason);
    this.saveFrame();
  }
  saveFrame() {
    if (!this.recording) return;
    const f = {
      time: this.time,
      player: copy(this.player),
      enemy: copy(this.enemy),
      collected: this.collected.slice(),
      hidden: this.time < this.hideUntil,
      sprinting: this.time < this.sprintUntil,
      sprints: this.sprints,
      lesson: this.lesson,
      ai: this.ai.record(),
      state: this.state,
      decoys: this.decoys,
    };
    if (this.frames.at(-1)?.time === this.time)
      this.frames[this.frames.length - 1] = f;
    else this.frames.push(f);
  }
  view() {
    const fresh = this.time - this.lastEnemyTime <= this.config.enemyMemory;
    return {
      enemy:
        this.mode === "Greedy"
          ? copy(this.enemy)
          : fresh
            ? copy(this.lastEnemy)
            : null,
      enemyAge: this.mode === "Greedy" ? 0 : this.time - this.lastEnemyTime,
      contact: this.wasSeen,
      hidden: this.time < this.hideUntil,
    };
  }
}
