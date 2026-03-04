## [1.1303.1](https://github.com/snyk/snyk/compare/v1.1303.0...v1.1303.1) (2026-03-04)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Bug Fixes

* **ui:** Fixed an issue where JSON output was incorrectly printed to stdout when only --json-file-output was specified. ([d6d465d](https://github.com/snyk/snyk/commit/d6d465d3238696e61df472546d3099f84de668dc))
* **language-server:** Fixed an issue where scans would not trigger when Snyk Code was enabled in IDE settings. ([7567881](https://github.com/snyk/snyk/commit/7567881b387ff3464196c4fd3512d79992ab18a9))
* **mcp:** Fixed an issue where Snyk rules were not written locally. ([7567881](https://github.com/snyk/snyk/commit/7567881b387ff3464196c4fd3512d79992ab18a9))