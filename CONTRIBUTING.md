# Contributing

This is a small playable beta. Reproducible bug reports and observed playtest feedback are especially useful.

Run `node --test tests/*.test.mjs` and `node scripts/verify-release.mjs` with Node 20 or newer. No package installation is required. For a quick simulation use `node scripts/experiment.mjs --runs=5 --smoke`; repeat with `--contract=Dossier`. Full report batches use 100 seeds per pair. The three authored arrangements repeat across seeds; do not call them 100 independently generated maps.

Keep gameplay in the shared core. Pursuer must receive only static/public map information, its own state and explicit observation packets. Do not pass player clicks, private collected objectives or hidden world coordinates to it. A replay explanation must come from the decision log rather than retrospective inference. Add a behavioural regression for a real rule change.

Code is formatted with Prettier. Formatting is a developer convenience, not a runtime dependency. Keep network use out of gameplay; static asset loading and deliberate source/license links are sufficient. Preserve the map attribution and ODbL database license separately from the MIT game code.

Screenshots should contain only the game. Do not include credentials, local usernames, home paths, unrelated browser tabs or personal information. The explicit `release-files.json` allowlist governs release packaging. Scratch files, environment files, caches and expanded raw XML stay outside the published set; the complete OSM XML is distributed losslessly as gzip and verified against its recorded SHA-256.
