## [1.1307.1](https://github.com/snyk/snyk/compare/v1.1307.0...v1.1307.1) (2026-09-07)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Bug Fixes

* **test**: `snyk test` on a repository with no supported manifest files again reports `SNYK-CLI-0008` and exits 3, instead of a generic `SNYK-CLI-0000` with exit 2. `snyk test --json` writes the error document to stdout as expected. ([2cbdbda](https://github.com/snyk/snyk/commit/2cbdbda2c572c6631aed05bde8d99a9359c1c63a))
* **test**: Restores `moduleName`, `insights.triageAdvice`, and `functions_new` fields in `snyk test --json` output. ([8e250c6](https://github.com/snyk/snyk/commit/8e250c614707a67c39e80b01f2307e601d2e4991))
* **test**: `.snyk` policy files are now handled correctly in the unified test flow -- empty, whitespace-only and comment-only policies, date-only timestamps, and other edge cases that previously caused incorrect results or failures. ([4215104](https://github.com/snyk/snyk/commit/4215104d3c9cf2d57089624d84cd39ce5cf6bbc3))
* **general**: Fixes a case where CLI commands that complete with findings (exit 1) could produce duplicate or corrupt JSON output when an unrelated network error occurred during the run. ([292f005](https://github.com/snyk/snyk/commit/292f005152438769cbc2084f50ad0adf7e1b0ade))
* **general**: Fixes debug-log scrubber so that secrets are consistently masked and scrubbing no longer corrupts the surrounding JSON structure. ([0828540](https://github.com/snyk/snyk/commit/0828540b202c873d9e8c314516df000eabba19e9))
* **deps**: Updates dependencies to fix vulnerabilities:
    - CVE-2022-25883 ([6b881ac](https://github.com/snyk/snyk/commit/6b881ac3b510f53c4c9ebb398c28c15bb0285852))
    - CVE-2026-84304 ([19ce4e9](https://github.com/snyk/snyk/commit/19ce4e99cfa9f528d333b4e9cf4d8e0786de7efb))
    - CVE-2026-84375 ([8785a80](https://github.com/snyk/snyk/commit/8785a80ffd6e22b665da2fe94eeade33bbcc46bb))
    - SNYK-GOLANG-GOLANGORGXCRYPTOSSH-19504090 ([8e250c6](https://github.com/snyk/snyk/commit/8e250c614707a67c39e80b01f2307e601d2e4991))
