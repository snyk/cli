## [1.1298.2](https://github.com/snyk/snyk/compare/v1.1298.1...v1.1298.2) (2025-07-30)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### News

* Effective with release (Snyk CLI 1.1298.0), the **minimum required GNU C Library (glibc) versions** on Linux will be updated as follows:
    * For Linux x64 environments: **glibc version 2.28** or higher
    * For Linux arm64 environments: **glibc version 2.31** or higher
* If this affects you, please follow the advice [here](https://updates.snyk.io/upcoming-changes-to-snyk-cli-glibc-requirements-for-linux-environments-316315). Possible issues are errors mentioning `GLIBC_2.27` or `GLIBC_2.31` not found.

### Bug Fixes

* **code:** Fix code test --report when a project_id environment variable exists ([8be17d6](https://github.com/snyk/cli/commit/8be17d6580fe3a41ba7d9337662116f10f596742))
* **mcp:** Skip trust browser popup if folder is already trusted
* **mcp:** Improve container scan security
* **language-server:** Fixed missing AI Fix entitlements for cases where the default org didn’t have AI Fix enabled
