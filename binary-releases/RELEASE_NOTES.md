## [1.1306.1](https://github.com/snyk/snyk/compare/v1.1306.0...v1.1306.1) (2026-07-15)

### Bug Fixes

* **all**: Ensures stable CLI releases are built with private build mode enforced in the release pipeline. ([15b2ed9](https://github.com/snyk/snyk/commit/15b2ed9bf9668a4b7234f3060e5bb72aa7ac2ed8))

## [1.1306.0](https://github.com/snyk/snyk/compare/v1.1305.2...v1.1306.0) (2026-07-09)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Features

* **doctor**: Adds the `snyk doctor` command to diagnose common CLI problems: generate a diagnostic report for the current system, or analyze debug log output. ([ab56a0e](https://github.com/snyk/snyk/commit/ab56a0e5a297826b5e00ead30b3fb4249a73936b))
* **container**: Container scans now detect the Java runtime version across a wider range of JVM base images, and can now find vulnerabilities in .NET application dependencies. ([5586aac](https://github.com/snyk/snyk/commit/5586aacb30549bbf515af06acf08ff8493d2e08c))
* **mcp**: The breakability evaluation tool in the Snyk MCP Server is now enabled by default and no longer requires an experimental flag. ([56a9196](https://github.com/snyk/snyk/commit/56a91963c5eb3b42d2a85c1c7fc53b5418143337))
* **test**: Improves dependency detection for Gradle projects. ([c819b69](https://github.com/snyk/snyk/commit/c819b6936b48407005ab0c266e2d51e464638994))
* **redteam**: The experimental `snyk redteam` command has been removed from the CLI, following its deprecation (deprecation date May 31, 2026). ([c7d0e3e](https://github.com/snyk/snyk/commit/c7d0e3ecd385af116559ff998dfa44fe40a23766))


### Bug Fixes

* **general**: Shows a warning when a request is automatically retried due to rate limiting, instead of retrying silently. ([f803397](https://github.com/snyk/snyk/commit/f803397aee953b9a28f530bdc72f600a6b97fa8d))
* **general**: Skips the reachability upload when no supported files are present, instead of failing. ([9ba448c](https://github.com/snyk/snyk/commit/9ba448c46f33c01ab0e990219540410d730b14ef))
* **test**: Fixes dependency resolution for Swift Package Manager projects that reference packages by registry identity, so they're correctly matched to their GitHub source for vulnerability scanning. ([64ac442](https://github.com/snyk/snyk/commit/64ac44286045062366dfe3f5200d635f01aba37c))
* **test**: Fixes scanning of sbt projects with custom Scala configurations. ([5765a12](https://github.com/snyk/snyk/commit/5765a12b56b240f8789c8684b69ad23d81a0e0d7))
* **test**: Fixes a bug where scanning Yarn workspaces could report vulnerabilities from a workspace member's dev dependencies as if they were production dependencies, when that member was consumed by a sibling package. ([ade08e4](https://github.com/snyk/snyk/commit/ade08e4450e0fac2d9a8d861cbfe0bf7c6a7a98e))
* **deps**: Updates dependencies to fix vulnerabilities:
  - CVE-2026-41178 ([a1d2e64](https://github.com/snyk/snyk/commit/a1d2e6486e2c51ec7316ec69c4965745c128f367))
  - CVE-2026-5160 ([b8a3659](https://github.com/snyk/snyk/commit/b8a3659319f5e54e148e195d4b985be4c36dbbc6))
  - CVE-2025-64718, CVE-2026-53550 ([ed15dd8](https://github.com/snyk/snyk/commit/ed15dd876d6b56ef5bfc235a9c29e6d040668bdf))
  - CVE-2026-39822, CVE-2026-42505 ([5b0e051](https://github.com/snyk/snyk/commit/5b0e0517f8e053a67c768a960b95ada464160875))
