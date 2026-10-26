# Verification record

Verified locally on 26 October 2026. This record distinguishes automated checks from actual browser operation.

## Automated: 28 / 28 passing

Command: `node --test tests/*.test.mjs` (Node runtime available in the workspace). The suite checks:

- All 52 junctions in one connected component; positive lengths match retained polyline lengths.
- Reachable clues, exit and shelters for all three authored arrangements; starting separation >300m for seeds 1–100.
- Continuous movement, distance-based time, rejected non-neighbour input and one queued next turn.
- Same-road sight, a right-angle corner breaking sight, and shortest visual pursuit entering the correct edge from an endpoint.
- Mid-edge head-on capture and capture approaching a junction from different roads.
- No through-building capture between parallel roads.
- Clue arrival, locked exit, all-three collection and successful terminal escape.
- Pause freezing state, inputs and tool resources.
- Shelter stillness, finite charges and cooldown; hiding does not prevent close capture.
- Delayed decoy sounds, finite charges and recorded effects; current vision overriding contradictory sound.
- Exact shape of hidden sensor packets and AI source separation.
- Identical permitted observations producing identical decisions regardless of hypothetical hidden worlds.
- Finite nonnegative normalised candidate mass, including exhausted-representation fallback.
- Forward heading bias, concrete interception, Greedy checking the old location once, conservative reachability bound.
- Restart resetting resources and frames; deterministic seeded simulation frames and event history.
- Replay starts at zero, includes exact terminal state and preserves historical reasons after later changes.
- Equal outcomes and travel under 0.1s versus 0.05s external stepping with the same internal controller cadence.
- Deadline produces a terminal timeout and replay frame.
- All modes terminate. Each authored Lantern opening has a verified escape: seed 1 via a clue order of 13→15→39 then exit, seed 2 with Cautious, seed 3 with Courier.

## Automated match batches

A 5-seed smoke batch (30 games) was run before the final 100-seed batch (600 games). Both use the final game core. `work/smoke.json` retains the small-batch rows; `data/results.json` retains all final individual rows, full configuration and summary metrics. See RESULTS.md for scale, repeated-layout limitations and sensing confounds.

## Actual browser play

Used the Codex in-app browser on this Mac, viewport approximately 805 × 823px. No fake terminal outcome or edited game state was used to obtain the browser results.

1. Opened the localhost page; inspected the actual first-screen layout, rules, map, attribution and start control.
2. Selected seed 3, started Lantern, changed speed to 8× and selected real route buttons. Waiting during route planning let the pursuer catch the runner. The browser showed **A step too close**, **4:19**, **413m**, **1/3 clues**.
3. Opened that failure’s pursuer replay. It displayed a recorded shortest-route chase toward junction 15, a contact event and capture. Scrubbed to frame zero and confirmed the initial **No sighting** patrol reason and probability sum 1.000.
4. Restarted seed 3 and continuously selected adjacent route controls along the streets. The browser showed **You disappeared**, **4:32**, **1187m**, **3/3 clues**. The final-code repeat using the Python server finished at **4:30**; that screenshot is `screenshots/browser-escape.png`. The small difference from the scripted bot’s 270.35s is real input timing.
5. Tested the SVG map junction control directly, not only the side buttons. It started continuous movement toward junction 10 via Queen Street. Paused while on the road; the UI showed movement to junction 10 with controls disabled and the clock stopped.
6. Continued through Cornmarket and St Michael’s Street to shelter junction 36. Resumed at 1×, activated Hide and a Decoy, then paused. The UI showed **HIDDEN / 6s remaining**, movement locked, **Hide · 1 left**, **Decoy · 1 left**.
7. Inspected the tutorial and Explain / Lab views, final local experiment table and live bot demonstration controls. Selected Shadow and Midnight configuration controls in the final UI and checked their sensing/memory descriptions.

8. On the final code and Python server, ran the Courier demonstration on seed 4. The browser showed **A step too close**, **2:58**, **786m**, **2/3 clues**. Opened the final recorded chase replay; `screenshots/browser-replay.png` shows the chosen entry junction 25 and the 1.000 probability sum.
9. Verified the dependency-free Node and Python server alternatives both return the page, map, ES modules, documentation and experiment data successfully. The Mac double-click launcher itself was created with executable permissions; starting it from Finder was not separately tested.

## Fixes made from testing

- Bot input timing initially differed between outer time steps. Moved controller calls inside the shared internal-step loop, then verified equality.
- Greedy initially risked repeatedly returning to a previously checked sighting. Added explicit observation-check tracking and a regression test.
- Map junction targets were rebuilt on every animation frame, interfering with clicks. Cached that layer by available-choice state; retested direct SVG clicks successfully.
- Objective/actor symbols could cover clickable junctions. Made those visual layers pointer-transparent.
- Pause visually offered actions that the engine refused. Disabled those controls and map choices while paused.
- Moved Start above longer difficulty details so it remains prominent in the tested viewport.
- Replaced a decorative CSS scale with a true 100-metre SVG scale.
- Corrected shortest visual pursuit from an edge endpoint: enter the observed road rather than choose an unrelated outgoing road. Re-ran the full tests and final 600-game batch after this fix.

## Verification limits

No extended independent human playtest, mobile touch-device test, Safari/Firefox/Chrome matrix, screen-reader audit or performance profile on older hardware was performed. The tested browser was the in-app browser. Keyboard and focus handling have accessible labels, but that is not a full accessibility certification. Screenshot represents a completed real browser game, not a mocked state.

The 28 automated tests establish targeted invariants; they do not prove all possible trajectories or guarantee every opening is winnable. There are only three authored arrangements. An edge-based posterior and building-accurate line of sight are not implemented. Exported replay import and persistence across page reloads are not implemented.
