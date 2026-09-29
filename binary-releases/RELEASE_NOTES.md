## [1.1308.0](https://github.com/snyk/snyk/compare/v1.1307.4...v1.1308.0) (2026-09-29)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Features

* **test, code, secrets**: `snyk test`, `snyk code test` and `snyk secrets test` can now generate an HTML report. Use `--html` to print it to stdout, or `--html-file-output=<path>` to write it to a file. ([0e10434](https://github.com/snyk/snyk/commit/0e10434fdb632639177530b2bef62295a9dd5763), [af6a2a4](https://github.com/snyk/snyk/commit/af6a2a428cc3dc006871500ed6305f059d431c7b))
* **agent-scan**: The experimental `snyk agent-scan` command now reports risk indicators instead of issue codes. If you post-process its `--json` output, update your scripts to the new format. ([d5451a6](https://github.com/snyk/snyk/commit/d5451a6d1ec7521ddb1f4fa358c8dff24f8088b4))

### Bug Fixes

* **sbom**: Maven and Gradle SBOMs, and `--print-graph`, no longer stall on large multi-module builds. They now finish seconds after the build tool exits. On projects with dependency cycles, the output may contain extra `pruned: cyclic` placeholder nodes. No packages or dependency edges are dropped. ([73f038c](https://github.com/snyk/snyk/commit/73f038c6eaa546213f785824be42b4376b51215c))
* **test**: Gradle projects with very deep inter-module dependency chains no longer fail with a stack overflow. ([fc4f8ec](https://github.com/snyk/snyk/commit/fc4f8ec07f76e2bb5aecf290335af2f44c5658e8), [ce4e5d6](https://github.com/snyk/snyk/commit/ce4e5d6b0732e7e01c62f00aab5afc8f780c4baa))
* **test**: .NET scans fall back to legacy scanning when the .NET SDK isn't installed. They also handle projects restored in a different build directory, and work when global NuGet source-mapping rules are configured. ([b8461c8](https://github.com/snyk/snyk/commit/b8461c8c7198315b78f8feda23fd8ba3a4fd74aa))
