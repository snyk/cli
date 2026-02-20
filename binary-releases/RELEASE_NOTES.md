## [1.1303.0](https://github.com/snyk/snyk/compare/v1.1302.1...v1.1303.0) (2026-02-19)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Features

* **secrets:** The CLI secrets extension is now available on the preview channel and can be used with the feature flag enabled. [PS-103] ([4decf7b](https://github.com/snyk/snyk/commit/4decf7b72c08b5b92e8a9ee3c0ee523efe564223))
* **iac:** users can now exclude specific files and directories from IaC scans using the `--exclude` parameter ([3acbc6b](https://github.com/snyk/snyk/commit/3acbc6b81ed88ef5ba999ba40dd8642eba7e011a))
* **test, sbom:** `--json` output of `snyk test` and `snyk sbom test` should now contain fields which were previously missing (`isDisputed`, `proprietary`, `severityBasedOn`, `alternativeIds`, `mavenModuleName`) ([9996b27](https://github.com/snyk/snyk/commit/9996b276b5334f2eaebceff7bc284740ad1ad968))
* **sbom:** sbom generated output will contain maven/npm scope information for those organizations with the `show-maven-build-scope/show-npm-scope` feature flag enabled ([89d26f0](https://github.com/snyk/snyk/commit/89d26f0372dc51840e86a0866339458d4b6abc92))
* **aibom:** users can now pass the `--upload` and `--repo` flag to the experimental aibom command to persist their AI BOM into their Snyk organisation ([e1fdae7](https://github.com/snyk/snyk/commit/e1fdae7acfb1802fc9d2d897d133a406503df629))
* **redteam:** users can now retrieve red team scan results using `snyk redteam --experimental get --id=<scan-id>`. The scan command also now shows progress during execution. ([fba40cc](https://github.com/snyk/snyk/commit/fba40ccd8bb546756609ccb9fb27b242f40158e9))
* **mcp:** users can now use `snyk_package_health` to validate package health ([2b0edd2](https://github.com/snyk/snyk/commit/2b0edd26877b37e5841857df0b29875a3da9dd9d))
* **mcp:** users can now use profiles to select which tools are registered based on their use case, profiles can be configured via CLI flag   (`--profile=<lite|full|experimental>`) or environment variable (`SNYK_MCP_PROFILE`). ([2b0edd2](https://github.com/snyk/snyk/commit/2b0edd26877b37e5841857df0b29875a3da9dd9d))
* **mcp:** users will now have their Secure At Inception rules written at the global level. ([495a2e0](https://github.com/snyk/snyk/commit/495a2e0b909fdfe71a39a8e7062b38241cd1c1bb))
* **container:** `snyk container sbom` users can now use `--username` and `--password` to generate SBOMs for images in private registries ([a7015a7](https://github.com/snyk/snyk/commit/a7015a77dbe2db9b8dfec1a7a5433d789f688680))
* **container:** `snyk container sbom` users can now use `--exclude-node-modules` to exclude node_modules directories from the SBOM ([a7015a7](https://github.com/snyk/snyk/commit/a7015a77dbe2db9b8dfec1a7a5433d789f688680))
* **container:** `snyk container sbom` users can now use `--nested-jars-depth` to control the depth of nested JAR unpacking ([a7015a7](https://github.com/snyk/snyk/commit/a7015a77dbe2db9b8dfec1a7a5433d789f688680))
* **container:** `snyk container sbom` users can now pass `docker-archive:`, `oci-archive:`, `kaniko-archive:` prefixed paths or bare `.tar` file paths as the image argument ([a7015a7](https://github.com/snyk/snyk/commit/a7015a77dbe2db9b8dfec1a7a5433d789f688680))
* **dependencies:** updated minimum go version to v1.25.7 ([5927337](https://github.com/snyk/snyk/commit/5927337292351af73843ec96e1f5a0a82ec4fc65))


### Bug Fixes

* **test** correctly scan NuGet package names case-insensitively ([44bf86b](https://github.com/snyk/snyk/commit/44bf86baa4783a58477622255714d3a983174ca1))
* **test** handle absolute target file paths for poetry ([d902590](https://github.com/snyk/snyk/commit/d9025909e7e281743f1e82bed5116dcd74d0c3d1))
* **container** use correct projectName value in container monitor JSON output ([0e8feca](https://github.com/snyk/snyk/commit/0e8feca01832318a1fd03a9d06a6a5e7f8024115))
* **ignores:** ignores created via the `snyk ignore` command are now correctly applied if an expiry is set or if using an absolute filepath ([a61589c](https://github.com/snyk/snyk/commit/a61589c4206317497fb5853e1bdcdca7c2973a4a))
* **container:** the `--target-reference` option is now correctly applied to application scan results in container tests, not just the OS scan results ([70db44f](https://github.com/snyk/snyk/commit/70db44fd8c783baf23417cf22d091fdb2355e8e9))
* **container:** reverts previously introduced stricter validation that was a breaking change (rejecting true as a valid numeric argument) ([70db44f](https://github.com/snyk/snyk/commit/70db44fd8c783baf23417cf22d091fdb2355e8e9))
* **dependencies:** update dependencies to fix SNYK-JS-AXIOS-15252993 ([1e80d74](https://github.com/snyk/snyk/commit/1e80d7454b85ebede70be09da1f6a40c88b5d4a1))
* **dependencies:** update dependencies to fix SNYK-GOLANG-GOOPENTELEMETRYIOOTELSDKRESOURCE-15182758 [IAC-3497] ([4b3d826](https://github.com/snyk/snyk/commit/4b3d826694d759d7ae892ff6ff824ffdbae32af1))
* **ui:** improve the readability of error messages ([763ac26](https://github.com/snyk/snyk/commit/763ac26ec12a6cdcaa0a0176727e40aa2c31797b))
* **test:** fixes an issue where the `runAutomationDetails` field in sarif output is not unique ([07dd36f](https://github.com/snyk/snyk/commit/07dd36fdba4ad884b36536af31778fd27f9321a0))
* **network:** fix a possible panic when TLS config is nil ([f601681](https://github.com/snyk/snyk/commit/f6016812dcb8f15d5f020b9134214cbeee5b4927))
* **redteam:** snyk redteam can now return HTML report via `--html` or `--html-file-output` flags ([aa76c04](https://github.com/snyk/snyk/commit/aa76c04988e51603d6d07509d2ac24a8048174b4))
* **language-server:** fixes an issue around API URL construction ([35800c1](https://github.com/snyk/snyk/commit/35800c10aea0807a04baf4e6eafa2bf5f9f3c991))
* **ui:** some `SNYK-CLI-0000` errors are now correctly categorised and displayed ([3d02788](https://github.com/snyk/snyk/commit/3d02788d71f0adb4f883a9baccd413faf5fd016c))
* **test:** the `automationDetails` field is now rendered correctly when using the `--sarif` flag ([3191e4d](https://github.com/snyk/snyk/commit/3191e4df624cd4dda6a1f1d912124394e9981926))
* **test:** improve error reporting when using `--all-projects` ([6e3b5d5](https://github.com/snyk/snyk/commit/6e3b5d533530da2d24cce6a17d55d8a4bae240eb))
* **dependencies:** update dependencies to fix SNYK-GOLANG-GOLANGORGXCRYPTOSSH-14059803 and SNYK-GOLANG-GITHUBCOMULIKUNITZXZLZMA-12230262 [IAC-3478] ([1d2d723](https://github.com/snyk/snyk/commit/1d2d72372a8b70a2f9cdb58dcfbab54880cd7223))
* **test:**  improved maven version detection for versions greater than 3.6.3 ([87853a8](https://github.com/snyk/snyk/commit/87853a8b5961290c7e89017390c0ae3c80607416))
