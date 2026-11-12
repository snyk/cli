## [1.1309.0](https://github.com/snyk/snyk/compare/v1.1308.4...v1.1309.0) (2026-11-18)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Features

* **test, monitor**: sbt 2 projects are now supported. Scanning them requires Java 17 or later. ([4a5b392](https://github.com/snyk/snyk/commit/4a5b392863f074ba163006aeaddedbe21041f04d))
* **container**: `snyk container test` and `snyk container monitor` now report the index and manifest digests of an image reference. When you don't pass registry credentials, they fall back to your existing `docker login` credentials. ([d43f814](https://github.com/snyk/snyk/commit/d43f814f0e8ede8ba68ba160774667566be97442))
* **secrets**: `snyk secrets test` now scans files up to 50 MB. Files larger than 1 MB were previously skipped. ([83b317d](https://github.com/snyk/snyk/commit/83b317db724c8a169d27294e32dcf3c76980c1bc))
* **fix**: `snyk fix --agentic` can now fix Agentic Security Review findings with `--asr --asr-report <path>`. ([d58bba7](https://github.com/snyk/snyk/commit/d58bba71726bb35a3519f54ee6e145414a16d310))
* **fix**: When a `snyk fix --agentic` upgrade raises a language or JDK version, it now also updates the matching version pins in CI configuration, Dockerfiles and version files. ([024e6ee](https://github.com/snyk/snyk/commit/024e6eeb1285540dc9cd10aff2868721e4639d34))
* **fix**: `snyk fix --agentic --auto-approve --issue-ids` now also fixes new vulnerabilities that its own upgrades introduce, when they match your `--severity-filter` or `--severity-threshold`. ([b1056ba](https://github.com/snyk/snyk/commit/b1056ba45a7feda4a8e5e8644f353dfb1206fd2d))
* **fix**: The `snyk fix --agentic` fix report now shows an outcome for each requested issue ID and a summary of the changes made for each fix. ([76a5cb7](https://github.com/snyk/snyk/commit/76a5cb784ed47f194fe305e6a3f8424cb11d64b1))
* **studio**: The experimental `snyk studio install` now sets up VS Code Copilot hooks where VS Code reads them, adds MCP support for Antigravity, and lets you exclude an assistant from every install. ([9ee2460](https://github.com/snyk/snyk/commit/9ee246022499564e20ab6409b5c7d07a3cb663ad))

### Bug Fixes

* **test, monitor**: npm projects with lockfile v2 or v3 now report vulnerabilities in the peer dependencies that npm installs for your dependencies. Scans of affected projects can show new issues. ([ae14e1a](https://github.com/snyk/snyk/commit/ae14e1aadba102db6a6043cd4f8bbd373c1d622b))
* **test**: npm projects with lockfile v2 or v3 now report the correct version of packages that are installed more than once. ([b67d629](https://github.com/snyk/snyk/commit/b67d6290e03bdcc94e6f9d98a6ed50003713d799))
* **test**: pip scans now include packages pulled in through extras and respect environment markers on requirements. ([9017841](https://github.com/snyk/snyk/commit/901784188f46ee9a053112c90076e052e92c5c8b))
* **test**: Maven scans no longer fail with `Could not parse "[...s][info][gc]..."` when the JVM writes GC log lines to stdout, for example with a small heap on CI agents. ([f5a8c1d](https://github.com/snyk/snyk/commit/f5a8c1df59c3e56a6c0488a205a9c28f02eb681a))
* **test**: `snyk test` no longer fails when `--maven-skip-wrapper` or `--include-provenance` is provided. ([11cf1aa](https://github.com/snyk/snyk/commit/11cf1aa1dbd0aaef54160de9fe177fd3b6548eed))
* **test**: Gradle projects that use dependency verification no longer return an empty dependency graph when a checksum is rejected. ([6e9970f](https://github.com/snyk/snyk/commit/6e9970f00ff128d3e437c5b61b140471fcdb3980))
* **test**: Gradle scans of Kotlin Gradle Plugin 2.0.0 projects no longer report false-positive vulnerabilities for dependency versions that were never resolved. ([c9446f7](https://github.com/snyk/snyk/commit/c9446f72031304562e78dd61d90c441c3f94ecb3))
* **test, monitor**: Gradle builds without a root `build.gradle` no longer report every module once per module with `--all-projects`. Duplicate projects that `snyk monitor` already created need to be deleted from your organization. ([7b75622](https://github.com/snyk/snyk/commit/7b75622c50acabfe6c7994107a629074ccfb890a))
* **test**: NuGet `packages.config` and `project.json` projects no longer produce duplicate dependencies, or crash on findings without a dependency path, when package IDs differ only by case. ([0cc47c9](https://github.com/snyk/snyk/commit/0cc47c9ca24e04590d268163ae31e26c2d8e3f43), [67ba874](https://github.com/snyk/snyk/commit/67ba87497fa984775d802b67b3c2e2fbcb5b97a3))
* **test**: .NET scans of solutions with many projects run faster, and their debug output is much smaller. ([9f788ce](https://github.com/snyk/snyk/commit/9f788ced2743e91b5a2bdd25f81ed8b57053b233))
* **container**: `snyk container test` no longer reports .NET framework reference assemblies as vulnerable NuGet packages. ([a280e2f](https://github.com/snyk/snyk/commit/a280e2f19ca6f18e92e82c0933cd4df9724c93b6))
* **container**: `snyk container test` now reports the right version for nested Go modules in vendored binaries, which removes false-positive vulnerabilities. ([c5d1dcb](https://github.com/snyk/snyk/commit/c5d1dcb7e58136fffa84d68889d2bb82f117fcc5))
* **container**: `snyk container test` and `snyk container monitor` no longer print the outdated "Beginning January 24th, 2023" notice about application vulnerabilities. ([0a0bfe6](https://github.com/snyk/snyk/commit/0a0bfe643e847bc0d09a87e849f5702693c00b5e))
* **secrets**: `snyk secrets test` on a single file now honours exclusions from parent `.gitignore` and `.snyk` files. ([a376fed](https://github.com/snyk/snyk/commit/a376fed52c91a00e188ee3299b8bd696f8aaef6f))
* **fix**: `snyk fix --agentic --issue-ids` no longer fails when only some of the requested issues could be fixed. It exits 0 and lists the unfixed IDs in its summary. ([544eacf](https://github.com/snyk/snyk/commit/544eacfdca7218ab6ec8b40d1b36b97706963523))
* **studio**: Installing and uninstalling Snyk Studio now replaces and removes all Snyk hooks cleanly, and concurrent installs no longer drop each other's entries. `snyk studio logs` no longer crashes when no home directory is set. ([9ee2460](https://github.com/snyk/snyk/commit/9ee246022499564e20ab6409b5c7d07a3cb663ad))
* **general**: `snyk --version` now prints the version immediately, without contacting the Snyk API. ([0b62ca8](https://github.com/snyk/snyk/commit/0b62ca818837eb3c7658ebb697514cbffc5c6368))
* **general**: The CLI now restricts the permissions of its configuration file so that only its owner can read it. ([e9ee053](https://github.com/snyk/snyk/commit/e9ee05373dda48908226349ccb88ef9c10aa6b98))
* **deps**: Updates dependencies to fix vulnerabilities:
  - Updates `open` to 11.0.4 to address CVE-2026-119025 ([1ca93ab](https://github.com/snyk/snyk/commit/1ca93ab1c03987fcfb7fa0d4856bd325ff4c11d6))
