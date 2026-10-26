# v2 verification record

Local update on 26 October 2026. The original v1 verification remains in QA.md; this file records the onboarding and gameplay expansion. No publication or online service was used.

## Automated checks: 38 / 38 passing

Run `node --test tests/*.test.mjs`. Actual console output is retained in `work/test-output-v2.txt`.

The original 28 tests continue to pass: connectivity, lengths, valid movement and queueing, road/corner visibility, head-on and junction captures, objectives, locked exits, pause, resources, decoys, observation boundaries, normalised belief, deterministic replay, step-size equivalence, interception, Greedy search completion and viable original Lantern openings.

Ten additions check:

1. Practice completes all five real lessons, freezes its watch, has no deadline/capture, refuses out-of-lesson actions and records the final lesson.
2. Restart resets practice state and one-clue training objective.
3. Every Dossier layout has five distinct reachable clues and two distinct reachable exits.
4. Any three clues unlock either exit; all five are not required.
5. Sprint speed, finite charges, junction-only activation, shelter conflict, noise, pause and recorded sprint frames.
6. Decoy and sprint produce indistinguishable node-only audio packets for the AI; remaining charges are not leaked.
7. Sprint expires and close-range capture still applies.
8. Dossier bot runs use the same outcomes and reproduce identical seeded frames.
9. Medals follow actual recorded outcomes, have explanations and are absent on losses/practice.
10. Every Dossier Lantern opening has a verified escape: seed 1 Cautious, seed 2 fixed clue order 34→36→24 then exit 22, seed 3 Courier. This establishes at least one viable route per authored opening, not a guarantee every route wins.

## Final experiments

Two final 600-game batches, one per mission: **1,200 games total**. Each batch is 2 runner policies × 3 pursuer configurations × 100 paired seeds. Each first ran 5 seeds per pair (30 games); both smoke JSONs remain in evidence/. Reports and exact raw rows are in RESULTS.md / data/results.json and RESULTS_DOSSIER.md / data/results-dossier.json.

The 100 seeds repeat three authored arrangements. Bots do not use sprinting or hiding. Outcomes therefore do not measure optimal new-tool use, human enjoyment, or a pure planner-only effect. Dossier Cautious/Lantern times out on one repeated layout; that result is retained rather than discarded. The two established bot definitions were kept consistent.

## Actual browser operation

Used the Codex in-app browser on this Mac. Observed viewports included approximately 1280×720 and 805×823; these are desktop browser layouts, not a physical mobile-device test.

- Opened the revised first screen. Verified the three English/Chinese rules, prominent safe-practice action, two mission cards and collapsed night settings.
- Started safe practice via the actual UI. Clicked the SVG junction to Carfax, activated Decoy, followed Cornmarket to collect the single clue, activated Hide and waited for the next road, then reached the exit. Each of the five coach steps advanced from actual actions. No fake state or terminal result was injected. Time includes reading/waiting; unlimited practice stayed playable.
- Clicked graduation. Verified a real Archive/Lantern/seed-3 run at 1×, activated Sprint, selected a road and paused. UI showed SPRINTING / 5s left, one sprint remaining, and the sound beyond-hearing event.
- Switched to Open Dossier. Verified five clue chips, two locked arrows and the ability to select the guide to Clue 3 while paused. Screenshot: screenshots/v2-dossier-guide.png.
- Played a full Dossier/Lantern/seed-3 run with route buttons and one sprint. Collected clue numbers 1, 4 and 2 (nodes 36, 15, 25), skipped the other two and used **exit B at Holywell Street (node 22)**. The actual browser showed **You disappeared**, **3:58**, **1033m**, **3/3**, **0 visual contacts**. It awarded Ghost and Before midnight with condition text. Screenshot: screenshots/v2-dossier-escape.png.
- Opened that replay, moved the slider with Home / ArrowRight, and clicked the sprint event. The timeline moved to 0:02 with a recorded beyond-hearing sound and PATROL / no visual observation / probability sum 1.000. Screenshot: screenshots/v2-sprint-replay.png.
- Reloaded the final UI and opened **How to play / 入门规则**. Verified the actual three bilingual rules, Hide/Decoy/Sprint costs and safe-practice entry. Screenshot: screenshots/v2-beginner-rules.png.
- Opened collapsed night settings, changed seed to 1, started the Courier live demonstration and selected 8× for a final capture/replay regression check. It ended **caught at 2:58, 786m, 2/3 clues**; the replay showed the recorded chase via junction 25 and probability sum 1.000. Screenshot: screenshots/v2-caught-replay.png.

- Switched the start-screen mission to Dossier and opened Explain / Lab; verified it showed the Dossier 600-game table (including Cautious/Greedy 34% escape) rather than the Archive table.

The original v1 successful/caught browser runs and images remain as historical evidence. The v2 images use distinct filenames; the original ZIP remains untouched.

## Usability repairs from this pass

- Put settings behind a collapsed summary, preserve it when choosing a mode, and make seed 3 the default introductory arrangement.
- Reveal just one practice route/action at a time; provide an explicit skip and a one-click graduation.
- Add goal chips and switchable dotted guidance, with an explicit warning that shortest does not mean safe.
- Move the persistent map hint below the SVG instead of covering southern roads and character markers.
- Clamp desktop map height to the viewport and scroll the game into view on starting.
- Show a shelter countdown during practice, outline sprinting actors, and mute unneeded Dossier clues once the required three are collected.
- Use the same node-only audio packet for decoys and sprints; the AI reason now says footsteps, without magically identifying the source.

## Limits

No independent human playtest, Safari/Firefox/Chrome matrix, physical touch-device test, full screen-reader audit or older-hardware performance profile was performed. Browser capture/replay export is implemented; importing exported JSON is still absent. The double-click Mac launcher is retained but was not separately launched through Finder. The Python localhost route was actually used.

The map and three authored arrangements are unchanged. The node belief and road-corridor sight are approximations, not building-accurate ray tracing. New missions/tools add choices, but enjoyment and balance still need human evidence. There is no persistent progression profile or account.
