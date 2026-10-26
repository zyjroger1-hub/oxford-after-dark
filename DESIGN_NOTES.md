# Design notes — v2

## The playable loop

The runner selects one neighbouring junction at a time and moves along retained road geometry. The Archive retains three fixed clues and one exit; Open Dossier offers any three of five clues and either of two public exits. A complete run ends in escape, capture or a six-minute deadline, followed by an explainable replay and immediate restart. The three authored arrangements keep opening separation above 300 road metres. Seed 1 asks the runner to decide whether to approach the eastern clues directly or use the western loops. Seed 3 offers a forgiving introductory route. The fastest uncomplicated runs last roughly 4½ minutes; detours can reach the deadline.

The street network, one pursuer and limited tools are the content budget. A five-step safe practice teaches actual inputs before a live pursuit; its stationary watch, one-clue objective, no capture and no deadline are explicitly labelled training rules. There are no extra enemies, skill trees, inventory puzzles or online systems. All named characters and pursuit events are fictional. The map is a selected game subgraph of real OSM geometry; clipping and filters change which routes are available.


## v2: lowering the first-minute cost

The home screen states three rules in English and Chinese: click a lit road, collect three clues, reach an open arrow. Difficulty and seed settings are collapsed. The main action is a safe playable practice rather than a long modal. Five lessons reveal one action at a time: move to Carfax, set a delayed decoy, collect the one training clue, spend six seconds hidden and reach the exit. Only the next lesson route is selectable. It uses the same continuous movement, input, hide and decoy mechanics, with an explicitly stationary watch and disabled capture/deadline. Continuous completion takes about 65 simulated seconds; reading time is unlimited. Graduation starts the forgiving seed 3 Archive/Lantern at 1×.

A route guide is on by default. It computes a shortest path to a public clue/exit, lets the player select a goal chip, and can be disabled. It never plans automatic movement and never reaches AI state. The warning that it ignores danger is deliberate: shortest path and safest path are different. New event notices confirm pickups, contact changes and footsteps.

## v2: more choices without another subsystem

Open Dossier reuses the three authored opening arrangements but gives each five clue candidates, requires only three and offers two exits. Both exits are public planner hypotheses. The player can abandon a dangerous candidate without extra inventory rules. Game.goals exposes only the runner’s own remaining objective choices to its controller/UI; it is not passed to Pursuer. The bots use this same helper so they also stop collecting after three and choose an exit.

Sprint is a short timing option: two activations, at junctions, five seconds at 6.6m/s. It consumes time even if the player waits, cannot overlap hiding and never prevents capture. The launch produces an audible node within 200m. Decoys and sprints give the AI identical node-only footstep packets; only the omniscient replay labels the source. Seeing the runner still overrides hearing. The predictor continues to assume normal running speed, so a sprint may invalidate its ETA; it is a heuristic, not a promise about arrival.

Escape badges are derived from recorded events and outcomes: no sighting, a successful decoy, a close call, or a finish within five minutes. They are post-game feedback, not an opaque score that rewards repetitive actions. Practice and losses earn none. No persistent profile or network account was added.

## Why buildless JavaScript and SVG

A local game should start without a package registry or a build chain. ES modules separate the graph, rules, AI, bots and UI; Node can load the same modules for automated tests and experiments. SVG gives crisp roads, large clickable road hit areas, distinctive shape-coded markers and accessible route controls. Buildings and labels are static; moving actors render separately. Clickable junctions are updated only when available choices change, avoiding target replacement during a mouse click. Objective symbols do not intercept pointer events meant for road junctions.

The original visual language is charcoal blue, muted stone footprints, warm landmark light, a teal circle for the runner and a coral diamond for the pursuer. Clues carry numbers, shelters carry house symbols, the exit an arrow, and contact warnings have text. Nothing essential depends only on colour. System fonts and Georgia avoid external font requests.

## Graph and continuous positions

`Graph` models an undirected weighted multigraph. Each edge retains its source way reference, full polyline geometry and length in metres. Intersections, street-name changes and dead ends become junctions; long degree-two chains are divided at existing OSM points. Crossings do not create junctions unless OSM contains a shared node. The resulting 52-node, 59-edge component is small enough for Floyd–Warshall all-pairs shortest distances and next-hop tables. Complexity is O(V³) once on load, then route lookup is constant time per hop.

An actor is either at a junction or on an edge with a direction and travelled offset. Drawing interpolates along the polyline’s cumulative arc length, not a straight chord. Network distance between actors is the minimum over endpoint routes plus a same-edge direct-distance case. The direct case is essential for two actors approaching head-on: using only endpoint routes would miss a mid-road encounter.

Movement and capture run at internal steps of at most 0.05s. At the configured speeds the maximum combined movement in a step is 0.5325m with a sprint, far smaller than the 6m capture radius. This prevents two passing actors from jumping across the whole capture interval. Adjacent-edge approaches to a junction use the same network metric. Capture is checked before pickup and exit success, so simultaneous events have a stable priority. Steps stop immediately on a terminal outcome.

No geographic stretch is applied. Runner 4.4m/s and pursuer 4.05m/s are fictional game speeds and remain fixed between difficulties. Two optional five-second sprints raise runner speed to 6.6m/s; their cost is audible footsteps at the launch junction. Visible animation interpolates the last two simulation positions. Playback speed multiplies simulated time for both actors and all timers. Hiding a tab pauses the game to avoid background throttling changing the outcome.

## Information boundary

The world state owns the real runner position, input queue and collected clues. Only `Game.sensor()` may turn those into permitted observations. The sensor produces:

- simulation time;
- an observed runner position and heading only while visible;
- an audible decoy junction only when its delayed sound falls within hearing range;
- public-map junctions currently visible and empty, excluding shelters where invisibility is possible.

`Pursuer` receives a static graph, a reference to its own actor, public objective/shelter locations and these packets. It never receives the `Game` object, the hidden runner actor, the collected list, future click, queued turn or bot target. Tests check packet shape, source separation and identical decisions under identical observations. This is a code boundary and tested discipline, not a language-level security sandbox.

The player has a separate information model. On Lantern the pursuer is always drawn. On other modes the player sees it through the same corridor test at 110m; otherwise the last observed marker persists for 14s or 9s and is labelled as stale. The interface never substitutes a fresh hidden enemy coordinate for a remembered marker.

## Visibility approximation

Two positions can see each other only within the configured road-distance radius. Same-edge positions are visible even if that edge is curved. Otherwise, road distance must be at most 1.065 times Euclidean distance plus 3m. This cheaply approximates a straight corridor and blocks substantial turns. It is intentionally a game rule, not building-polygon ray casting. There are edge cases at gentle bends, short corners and curved source ways. At shelters, hiding suppresses observation beyond 10m but never protects against capture within 6m. Sensors sample every 0.5s, making reaction latency explicit.

## Three actual pursuer methods

### Greedy

With a sighting, pursue the observed road position through its shortest-path entry endpoint. If already at that endpoint, enter the observed edge toward its opposite endpoint. Without sight, go to the final observed destination and mark that observation checked. Then patrol the least recently checked public clue/exit, breaking priority ties by travel distance and using seeded fallback choices when necessary. It does not continuously retarget to a hidden runner. Checking an observation once is tracked explicitly, preventing an oscillation between a searched junction and its neighbour.

### Search

Maintain a finite probability vector over junctions. A sighting replaces the prior with inverse-distance endpoint weights, favouring the observed direction of motion (forward weight 1.6, backward 0.7). Without sight, approximately once per second, diffuse mass through neighbouring roads. Transition rate scales inversely with road length and degree, and observed heading adds a small directional bias that decays over 12 seconds. A conservative support bound removes junctions beyond 4.4 × elapsed seconds + 110m from the last observed position; the 110m slack acknowledges the coarse node representation.

Visible empty non-shelter junctions are removed and the vector is normalised. At a decision junction, score candidate mass plus 0.3 times neighbouring mass, divide by travel cost (18m + distance), and penalise recently checked junctions. If the representation is exhausted, normalisation falls back to a conservative uniform prior rather than producing NaNs. This fallback can discard information; this is one reason the displayed cloud is an approximation rather than a calibrated posterior. The code and tests enforce non-negative finite mass and a sum of one. Static unreachable components are excluded by map preprocessing.

This is heuristic graph diffusion, not an exact continuous-time hidden-state filter. It does not model arbitrary waiting, every edge-interior position or a learned human strategy. The cloud says what the algorithm currently prioritises, not where it is guaranteed the runner must be.

### Intercept

With visual contact, enumerate shortest routes from the observed runner direction toward each public clue and the exit. The actual remaining clues and chosen order are hidden. For upcoming nodes up to roughly 42 seconds along those routes, compare runner and pursuer estimated arrival times. A candidate is usable if the pursuer arrives no more than 1.5 seconds after the predicted runner. Heading alignment and junction degree influence ranking. Choose a reachable interception node rather than blindly following the runner’s rear.

Without visual contact, use the Search distribution and modestly weight public objective/choke junctions. Every chosen target is reached via shortest paths from the pursuer’s own location. It cannot react to the runner’s unobserved click. Prediction can be wrong: all public goals remain hypotheses even after the runner silently collects them. In this prototype the pursuer reconsiders a road choice only at a junction; updated observations do not let it teleport or reverse mid-edge.

### Decoy evidence

A decoy sounds four seconds after placement. A heard sound with no current sighting shifts 70% of belief mass to that junction and starts a bounded investigation. A simultaneous visual observation takes precedence. The event records whether it was heard and whether it changed judgment. A sound may change the probability cloud while the pursuer is still travelling; the next route decision occurs at its next junction. Investigation expires after 13s or reaching its target. Two decoys and two shelter activations are finite resources.

## Replay as evidence

Every 0.5s the engine snapshots actual positions, collected clues, hidden status, state, AI probability vector, last observation, sight flag, target, status and reason. It also records discrete decisions, sight acquisitions/losses, clue pickups, hides, decoy placement/sound and terminal outcome. Frame zero and the exact final state are included. Frames also save sprint activity, remaining sprints and practice lesson. The UI never generates a new story from hindsight: it displays the reason saved on that frame. Trails include only frames up to the chosen time, so the scrubber can reconstruct the information history.

Limitations: frames are half-second samples, so drawn trail segments can trim a tiny corner between samples. Events retain their exact simulation time and state transitions. JSON export is provided, but replay import, persistent best scores and cross-browser deterministic UI input recordings are not implemented. Replaying a fixed seed and identical timed inputs is deterministic; two humans clicking at different times need not get identical results.

## Experiment interpretation

The same `Game.step()` invokes both bot controllers before each internal time step, preventing outer 0.1s versus 0.05s controller timing differences. Courier targets the nearest remaining clue; Cautious uses visible-marker risk penalties, route detours and decoys. Both have only player-visible enemy information. They do not share the pursuer’s hidden state or belief.

The two v2 batches total 1,200 games, 600 per mission, and cycle three authored arrangements with paired seeds. The established bots do not use sprinting or hiding, so those batches do not evaluate optimal new-tool use. Those repetitions are useful for regression and fair configuration pairing; they are not 100 independent maps or enough to establish a universal algorithm ranking. Sensing and player marker memory vary along with the planner. RESULTS.md reports that confound explicitly. Greedy and Search can produce identical outcomes on a direct runner despite having different internal searches. Cautious benefits greatly from Lantern’s always-visible pursuer and can over-detour when the marker is stale. No result is relabelled to make Intercept look superior.

## Best next improvement

Add more authored opening configurations and a small observed human playtest, then tune on meaningful route choices rather than raising enemy speed. For algorithm research, independently vary sight radius, marker memory and planner under a held-constant interface. An edge-based belief filter and obstacle-aware sight are valuable later extensions; neither should be described as implemented today.
