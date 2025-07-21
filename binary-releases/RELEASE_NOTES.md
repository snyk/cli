## [1.1298.1](https://github.com/snyk/snyk/compare/v1.1298.0...v1.1298.1) (2025-07-22)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### News

* Effective with release (Snyk CLI 1.1298.0), the **minimum required GNU C Library (glibc) versions** on Linux will be updated as follows:
    * For Linux x64 environments: **glibc version 2.28** or higher
    * For Linux arm64 environments: **glibc version 2.31** or higher
* If this affects you, please follow the advice [here](https://updates.snyk.io/upcoming-changes-to-snyk-cli-glibc-requirements-for-linux-environments-316315). Possible issues are errors mentioning `GLIBC_2.27` or `GLIBC_2.31` not found.

### Bug Fixes

* **container:** Fix failing scan of local container images ([6095a60](https://github.com/snyk/cli/pull/6052/commits/6095a60762687312f749bf5209e15604483be157))
* **mcp:** Fix incomplete mcp instrumentation ([9108dc0](https://github.com/snyk/cli/commit/9108dc042010842869c2f24b6b7371d117915418))
