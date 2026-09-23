## [1.1307.4](https://github.com/snyk/snyk/compare/v1.1307.3...v1.1307.4) (2026-09-23)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Features

* **studio**: New experimental `snyk studio` command that sets up Snyk Studio in your AI coding tools (Cursor, Claude Code, Codex, Copilot, Gemini, Kiro, Windsurf), so the code they generate gets scanned in the background as it's written. Run `snyk studio install --experimental` to get started. ([49653c8](https://github.com/snyk/snyk/commit/49653c889f0c2d812395e473194b278fce0e0512))
* **fix**: New `snyk fix --agentic` flags to narrow down what gets fixed: `--severity-filter` fixes only the listed severities, `--breakability-filter` fixes only Open Source upgrades with the listed breakability, and `--exclude-ids` fixes everything except the listed issue IDs. ([35298ae](https://github.com/snyk/snyk/commit/35298ae98f2b731bbfaddd7a0ee38c8bc1967168))
* **fix**: `snyk fix --agentic` now keeps a failed fix's changes by default so you can review them, and reports the fix as failed. Pass `--enable-revert` to roll the changes back automatically instead. ([35298ae](https://github.com/snyk/snyk/commit/35298ae98f2b731bbfaddd7a0ee38c8bc1967168))

### Bug Fixes

* **test**: `--iac`, `--docker`, `--container` and `--code` no longer get silently dropped for orgs on the unified test API — each now runs the correct scan again instead of an open-source test (which could fail with "No supported files found" or scan the wrong target). ([87568ab](https://github.com/snyk/snyk/commit/87568abd6fd55ae098f306634347b5cf300ab1fd))
