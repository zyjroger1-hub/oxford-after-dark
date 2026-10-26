# Release review — 2.0.1-beta.1

## Verdict / 结论

**Suitable for a public GitHub playable beta and portfolio/learning project. Not yet a commercially validated finished game.**

可以公开发行测试版。它有完整可玩的闭环、明确的信息限制、真实决策回放和可复现的实验。完成度和特色较好，但“很好玩、长期耐玩、面向所有设备稳定”还缺少独立玩家与跨浏览器证据，不能仅凭自动对局证明。

| Area | Assessment | Evidence and limit |
|---|---|---|
| Playable completeness | Good for a small beta | Guided practice, two missions, tools, outcomes, replay and restart; actual successful and caught browser runs recorded |
| Distinctiveness | Strong prototype idea | Pursuer-view recorded belief/decision replay; explicit observation boundary |
| Rules and core reliability | Good within tested scope | 41 behavioural tests; continuous road movement, capture, resources, objectives, seed validation and replay regressions |
| Visual design and onboarding | Coherent | Night palette, shape-coded symbols, five-step safe practice, three bilingual rules and optional guidance |
| Fun and balance | Provisional | Only three authored arrangements; no independent human playtest; bot repetition is not player evidence |
| AI realism | Deliberately approximate | Node diffusion, heuristic interception and corridor sight; no trained model and no claim of real-building accuracy |
| Maintainability | Adequate for a small open-source game | Shared modules, readable formatting, zero runtime packages, tests and release checks; UI still uses a small imperative renderer |
| Public distribution | Ready after this pass | Code/data license separation, source provenance, explicit file allowlist, compressed raw source, offline legal text, public-facing README and CI configuration |

## Fixes made for first public release

- Invalid, fractional, blank or out-of-range seeds no longer crash scenario selection. UI validates whole-number input and the core canonicalises invalid external values.
- A keyboard route activation no longer also toggles pause through bubbling. Form controls keep normal keyboard behaviour; repeated keydown does not rapidly toggle actions.
- Lantern renders the pursuer's allowed live position instead of interpolating against a stale sensor marker. Other difficulties retain only their permitted observations.
- A fallback AI road selection now records its actual target and reason consistently.
- Replaced the copied license website wrapper, which included upstream analytics and iframe assets, with the exact official plain legal text and a self-contained offline HTML copy. The legal text itself is unchanged.
- Kept losslessly compressed OSM source and its original SHA-256, excluding the expanded working XML from publication. Runtime map data remains bundled.
- Added an explicit public-file allowlist and automated release verification. Personal paths, scratch files, environment files and matched credential patterns are excluded/checked.

## Remaining limits

Desktop browser play is the primary target. The project has not had a full Safari/Firefox/Chrome matrix, touch-device test, screen-reader audit or older-hardware profile. Screenshots and in-app-browser testing are not equivalent to those audits. Replay JSON export exists; import and persistent progression do not. There is no audio effects system or multiplayer mode.

The 1,200 final matches compare complete difficulty configurations; sensing and player marker memory differ along with planner. Bots do not sprint or hide. They cannot establish an algorithm hierarchy or the enjoyment of new tools. The map supports only three authored objective/start arrangements per mission.

Development used AI assistance. Runtime pursuers are explicit graph/search rules and use no LLM, paid inference API, account or cloud game server. This review describes observed evidence, not an independent quality certification.

## Next quality milestone

Recruit a few first-time players, observe their first five minutes, and record where they hesitate or fail. Use that evidence to adjust guidance and route choices, then add several authored arrangements. That is more valuable now than adding more mechanics or simply increasing pursuer speed.

## Candidate verification on 26 October 2026

Re-ran all 41 tests and the release checks. In the actual browser, a fractional seed (1.5) produced the visible whole-number validation message while remaining on setup; entering seed 3 then pressing Space on the SVG road control started road movement without pausing. A full Archive/Lantern/seed-3 browser run escaped at 4:34 with 1,187m, 3/3 clues and zero visual contacts. Evidence: screenshots/release-candidate-escape.png. Final 100-seed batches were rerun for both missions after the core fixes.
