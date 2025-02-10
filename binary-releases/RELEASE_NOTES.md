## [1.1295.3](https://github.com/snyk/snyk/compare/v1.1295.2...v1.1295.3) (2025-02-10)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Bug Fixes

* **security:** Upgrades dependencies to address CVE-2025-21614
* **language-server:** Improved memory usage when executing code scans on large projects
* **language-server:** Fix incorrect filtering of files when executing code scans which could fail the analysis
* **language-server:** Fix random unexpected logouts when using OAuth2 authentication 