## [1.1298.3](https://github.com/snyk/snyk/compare/v1.1298.2...v1.1298.3) (2025-08-14)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### News

* Effective with release (Snyk CLI 1.1298.0), the **minimum required GNU C Library (glibc) versions** on Linux will be updated as follows:
    * For Linux x64 environments: **glibc version 2.28** or higher
    * For Linux arm64 environments: **glibc version 2.31** or higher
* If this affects you, please follow the advice [here](https://updates.snyk.io/upcoming-changes-to-snyk-cli-glibc-requirements-for-linux-environments-316315). Possible issues are errors mentioning `GLIBC_2.27` or `GLIBC_2.31` not found.

### Bug Fixes

* **aibom** This command is now publicly available. Note that the feature is still experimental and subject to breaking changes without notice.
* **test** Added support for Gradle 9.
