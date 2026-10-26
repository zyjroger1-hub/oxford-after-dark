import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Graph } from "../src/graph.js";
import { Game, RULES, CONTRACTS } from "../src/game.js";
import { botTurn } from "../src/bots.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const graph = new Graph(
  JSON.parse(fs.readFileSync(path.join(root, "data/map.json"))),
);
const count = Number(
  process.argv.find((x) => x.startsWith("--runs="))?.split("=")[1] || 100,
);
const contract =
  process.argv.find((x) => x.startsWith("--contract="))?.split("=")[1] ||
  "Classic";
if (
  !Number.isInteger(count) ||
  count < 1 ||
  count > 10000 ||
  !CONTRACTS[contract]
)
  throw Error("Use --runs=1..10000 and --contract=Classic or Dossier");
const smoke = process.argv.includes("--smoke"),
  suffix = contract === "Classic" ? "" : "-dossier";
const output = smoke
  ? `evidence/smoke${suffix}.json`
  : `data/results${suffix}.json`;
const runs = [],
  rows = [],
  started = Date.now();
for (const bot of ["Courier", "Cautious"])
  for (const mode of ["Greedy", "Search", "Intercept"]) {
    const subset = [];
    for (let seed = 1; seed <= count; seed++) {
      const game = new Game(graph, { seed, mode, contract, record: false });
      let ticks = 0;
      while (game.state === "playing" && ticks++ < 7202)
        game.step(0.1, (x) => botTurn(x, bot));
      if (game.state === "playing") throw Error("Simulation did not terminate");
      const row = {
        bot,
        mode,
        contract,
        seed,
        result: game.state,
        time: +game.time.toFixed(2),
        runnerDistance: +game.playerLength.toFixed(2),
        pursuerDistance: +game.enemyLength.toFixed(2),
        clues: game.collected.length,
        threeClues: game.unlocked,
        contacts: game.events.filter((e) =>
          ["found", "refound"].includes(e.type),
        ).length,
      };
      runs.push(row);
      subset.push(row);
    }
    const mean = (k) =>
      subset.reduce((n, r) => n + Number(r[k]), 0) / subset.length;
    const row = {
      bot,
      mode,
      runs: count,
      captureRate: subset.filter((r) => r.result === "caught").length / count,
      escapeRate: subset.filter((r) => r.result === "escaped").length / count,
      timeoutRate: subset.filter((r) => r.result === "timeout").length / count,
      taskCompletionRate: mean("threeClues"),
      meanClues: mean("clues"),
      meanTime: mean("time"),
      meanRunnerDistance: mean("runnerDistance"),
      meanPursuerDistance: mean("pursuerDistance"),
    };
    rows.push(row);
    console.log(JSON.stringify(row));
  }
const result = {
  version: 2,
  config: {
    contract,
    runsPerPair: count,
    seeds: `1..${count}`,
    modes: ["Greedy", "Search", "Intercept"],
    bots: ["Courier", "Cautious"],
    stepSeconds: 0.1,
    rules: RULES,
    mapHash: graph.meta.rawSHA256,
    scenarios: 3,
    note: "Seeds cycle 3 authored scenarios. RNG initialises patrol fallback choices. These are repetitions, not 100 independent maps. Bots do not sprint.",
  },
  rows,
  runs,
  elapsedSeconds: (Date.now() - started) / 1000,
};
fs.mkdirSync(path.join(root, "evidence"), { recursive: true });
fs.writeFileSync(path.join(root, output), JSON.stringify(result, null, 2));
if (!smoke) {
  const pct = (x) => (x * 100).toFixed(1) + "%";
  const table = rows
    .map(
      (r) =>
        `| ${r.bot} | ${r.mode} | ${r.runs} | ${pct(r.captureRate)} | ${pct(r.escapeRate)} | ${pct(r.taskCompletionRate)} | ${pct(r.timeoutRate)} | ${r.meanTime.toFixed(1)} | ${r.meanRunnerDistance.toFixed(1)} | ${r.meanPursuerDistance.toFixed(1)} |`,
    )
    .join("\n");
  const doc = `# ${CONTRACTS[contract].label}: reproducible pursuit experiment (v2)\n\nGenerated ${new Date().toISOString()}. Actual final batch: ${runs.length} games, ${count} seeds per runner/pursuer pair. A 5-seed smoke batch (30 games) was run first; retained in evidence/smoke${suffix}.json.\n\n## Configuration\n\n- Mission: **${contract}** — ${CONTRACTS[contract].description}\n- Same seeds 1..${count}, same scenario assignments paired across all three pursuer configurations and both bots. Three authored layouts recur cyclically; this is not ${count} independent maps.\n- Same Graph, Game, sensors, capture and objectives as the interactive game. Outer step 0.1s, internal ≤0.05s with bot actions before each internal step.\n- Runner 4.4m/s; pursuer 4.05m/s. Sight 62 / 78 / 90m. Lantern reveals the pursuer continuously; other difficulties provide stale markers. Planner, sensing and player marker memory therefore change together. This is not an isolated causal test of planner quality.\n- Deadline 360s, capture ≤6m. Two hides, two decoys and two optional 5s sprints exist in the core. **Neither bot uses hiding or sprinting**, so these outcomes do not measure optimal use or player enjoyment of the new tools. Cautious uses delayed decoys when it has contact at a junction.\n- Courier: nearest remaining needed clue by shortest road distance; after three, nearest exit.\n- Cautious: weighted Dijkstra with a risk penalty using only visible/remembered enemy information, followed by nearest weighted goal. Extra clues in Dossier are skipped after the third; either exit is valid.\n- Practice is excluded: it explicitly freezes the watch, removes capture/deadline and teaches one clue.\n\n## Actual results\n\n| Runner | Pursuer | Games | Caught | Escape | All 3 clues | Timeout | Mean seconds | Runner metres | Pursuer metres |\n|---|---|---:|---:|---:|---:|---:|---:|---:|---:|\n${table}\n\nTask completion means the three required clues were collected even if subsequently caught. Escape also requires an open exit. Means include all outcomes. Raw individual rows are in ${output}. Runtime: ${result.elapsedSeconds.toFixed(2)} wall-clock seconds.\n\n## Interpretation and limits\n\nThese are algorithm-versus-algorithm simulations, not human playtest results. Rates are descriptive for three repeated layouts; they are not population estimates. Short corridors make observed heading informative; western loops permit ambiguity, while the eastern Queen’s Lane route offers fewer alternatives. Prediction can select a public goal the runner never intended to visit, so Intercept need not dominate.\n\nOpen Dossier adds route choice through optional clues and two exits. Compare it with the companion report (${contract === "Classic" ? "RESULTS_DOSSIER.md" : "RESULTS.md"}), while remembering that their objective sets differ. An easier outcome is part of the mission design, not proof that an AI got worse. Lantern’s complete enemy marker helps Cautious, while stale markers can produce wasteful detours. Search and Greedy can have identical terminal rates despite different internal beliefs and decisions. Preserve equal and surprising results rather than forcing a ranking.\n\nBelief is a node approximation: local road-length-weighted diffusion, decaying heading bias, reachability pruning, empty-node observations, normalisation and conservative fallback. It is not a calibrated continuous-position posterior. Static unreachable fragments were removed during map processing. Both public exits are hypotheses available to the predictor; the actual chosen clue order and runner clicks remain hidden. Sprint and decoy audio packets contain the same node-only signal, so the AI cannot identify their source.\n\nNext research step: hold sensing and player information fixed while varying only planner, add more authored configurations and recruit human playtesters. A sprint-using bot could examine the new speed/noise tradeoff; the current batch deliberately retains the two established bot definitions.\n\n## Reproduce\n\nRun npm test, then node scripts/experiment.mjs --runs=5 --smoke --contract=${contract}, then node scripts/experiment.mjs --contract=${contract}. No network or paid service is used.\n`;
  fs.writeFileSync(
    path.join(
      root,
      contract === "Classic" ? "RESULTS.md" : "RESULTS_DOSSIER.md",
    ),
    doc,
  );
}
