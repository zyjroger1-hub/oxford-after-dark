# Open dossier: reproducible pursuit experiment (v2)

Generated 2026-10-26T22:45:26.776Z. Actual final batch: 600 games, 100 seeds per runner/pursuer pair. A 5-seed smoke batch (30 games) was run first; retained in evidence/smoke-dossier.json.

## Configuration

- Mission: **Dossier** — Choose any 3 of 5 clues. Escape through either exit.
- Same seeds 1..100, same scenario assignments paired across all three pursuer configurations and both bots. Three authored layouts recur cyclically; this is not 100 independent maps.
- Same Graph, Game, sensors, capture and objectives as the interactive game. Outer step 0.1s, internal ≤0.05s with bot actions before each internal step.
- Runner 4.4m/s; pursuer 4.05m/s. Sight 62 / 78 / 90m. Lantern reveals the pursuer continuously; other difficulties provide stale markers. Planner, sensing and player marker memory therefore change together. This is not an isolated causal test of planner quality.
- Deadline 360s, capture ≤6m. Two hides, two decoys and two optional 5s sprints exist in the core. **Neither bot uses hiding or sprinting**, so these outcomes do not measure optimal use or player enjoyment of the new tools. Cautious uses delayed decoys when it has contact at a junction.
- Courier: nearest remaining needed clue by shortest road distance; after three, nearest exit.
- Cautious: weighted Dijkstra with a risk penalty using only visible/remembered enemy information, followed by nearest weighted goal. Extra clues in Dossier are skipped after the third; either exit is valid.
- Practice is excluded: it explicitly freezes the watch, removes capture/deadline and teaches one clue.

## Actual results

| Runner | Pursuer | Games | Caught | Escape | All 3 clues | Timeout | Mean seconds | Runner metres | Pursuer metres |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Courier | Greedy | 100 | 67.0% | 33.0% | 100.0% | 0.0% | 195.7 | 859.5 | 791.2 |
| Courier | Search | 100 | 67.0% | 33.0% | 100.0% | 0.0% | 195.7 | 859.5 | 791.2 |
| Courier | Intercept | 100 | 67.0% | 33.0% | 100.0% | 0.0% | 210.2 | 923.2 | 849.7 |
| Cautious | Greedy | 100 | 33.0% | 34.0% | 67.0% | 33.0% | 272.8 | 1197.8 | 1102.7 |
| Cautious | Search | 100 | 67.0% | 33.0% | 100.0% | 0.0% | 195.7 | 859.5 | 791.2 |
| Cautious | Intercept | 100 | 33.0% | 67.0% | 100.0% | 0.0% | 236.8 | 1039.9 | 957.1 |

Task completion means the three required clues were collected even if subsequently caught. Escape also requires an open exit. Means include all outcomes. Raw individual rows are in data/results-dossier.json. Runtime: 2.50 wall-clock seconds.

## Interpretation and limits

These are algorithm-versus-algorithm simulations, not human playtest results. Rates are descriptive for three repeated layouts; they are not population estimates. Short corridors make observed heading informative; western loops permit ambiguity, while the eastern Queen’s Lane route offers fewer alternatives. Prediction can select a public goal the runner never intended to visit, so Intercept need not dominate.

Open Dossier adds route choice through optional clues and two exits. Compare it with the companion report (RESULTS.md), while remembering that their objective sets differ. An easier outcome is part of the mission design, not proof that an AI got worse. Lantern’s complete enemy marker helps Cautious, while stale markers can produce wasteful detours. Search and Greedy can have identical terminal rates despite different internal beliefs and decisions. Preserve equal and surprising results rather than forcing a ranking.

Belief is a node approximation: local road-length-weighted diffusion, decaying heading bias, reachability pruning, empty-node observations, normalisation and conservative fallback. It is not a calibrated continuous-position posterior. Static unreachable fragments were removed during map processing. Both public exits are hypotheses available to the predictor; the actual chosen clue order and runner clicks remain hidden. Sprint and decoy audio packets contain the same node-only signal, so the AI cannot identify their source.

Next research step: hold sensing and player information fixed while varying only planner, add more authored configurations and recruit human playtesters. A sprint-using bot could examine the new speed/noise tradeoff; the current batch deliberately retains the two established bot definitions.

## Reproduce

Run npm test, then node scripts/experiment.mjs --runs=5 --smoke --contract=Dossier, then node scripts/experiment.mjs --contract=Dossier. No network or paid service is used.
