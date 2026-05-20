## [1.1305.0](https://github.com/snyk/snyk/compare/v1.1304.3...v1.1305.0) (2026-05-20)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Features

* **sbom**: Introduces the `--allow-incomplete-sbom` flag for `snyk sbom`, allowing the SBOM to be generated even when individual projects fail to resolve. Failed projects are surfaced as per-project errors alongside the successful results. ([29ba128](https://github.com/snyk/snyk/commit/29ba128c55afd9f41cfd0ffabe667c013b10a544))
* **container**: Speed up `snyk container monitor` by sending dependency requests in parallel, configurable via the `SNYK_REQUEST_CONCURRENCY` environment variable. ([186c5fb](https://github.com/snyk/snyk/commit/186c5fb6b7c074d94bb9e5d4094f1909671c6f88), [6764f65](https://github.com/snyk/snyk/commit/6764f65247bb3c1c82ad5d8d3d331ba21f7c4a97))
* **general**: Linux ARM64 and AMD64 binaries are now statically linked by default. ([f02b850](https://github.com/snyk/snyk/commit/f02b850ac8a4b6f527448874d5408ab1cfffeaab))
* **mcp**: Adds an experimental breakability evaluation tool to the Snyk MCP Server. ([69806f5](https://github.com/snyk/snyk/commit/69806f5634b06551d46debb070553e454cf9ed54))


### Bug Fixes

* **test**: Fixes resolution of aliased npm packages so the alias from the lockfile is used instead of the target package name. ([9b0e4d9](https://github.com/snyk/snyk/commit/9b0e4d913af096aa1c5a8ce46e3ed1bd5d211e8f))
* **test**: Fixes parsing of Python `.whl` files when scanning projects with `--all-projects`. ([12ac0db](https://github.com/snyk/snyk/commit/12ac0dbb46b64526c584a13892317c80111a1d1a))
* **deps**: Updates dependencies to fix vulnerabilities:
  - CVE-2026-34165 ([1eec8f8](https://github.com/snyk/snyk/commit/1eec8f81e4738985a92dd8e9823e1ab846713fe7))
  - CVE-2026-33762 ([1eec8f8](https://github.com/snyk/snyk/commit/1eec8f81e4738985a92dd8e9823e1ab846713fe7))
  - CVE-2025-62718 ([0c4bdcc](https://github.com/snyk/snyk/commit/0c4bdcc0936bf3ba05e985895d7b44e9a1fcc962))
  - CVE-2026-6321 ([2670813](https://github.com/snyk/cli/commit/26708138ce5208bbd058c87bdccf5cd350d1a2c2))
  - CVE-2026-6322 ([2670813](https://github.com/snyk/cli/commit/26708138ce5208bbd058c87bdccf5cd350d1a2c2))
