## [1.1308.3](https://github.com/snyk/snyk/compare/v1.1308.2...v1.1308.3) (2026-10-23)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Bug Fixes

* **deps**: Updates dependencies to fix vulnerabilities:
  - Updates the embedded Node.js runtime to 22.23.4 to address CVE-2026-105481, CVE-2026-105482, CVE-2026-106069, CVE-2026-106073, CVE-2026-106074, and CVE-2026-111497 ([7306c5b5e](https://github.com/snyk/snyk/commit/7306c5b5edd489579780110a68cd21211782a72c))
  - Updates the `toml` library used by `snyk fix` for Poetry projects to 5.0.1 to address CVE-2026-114141, CVE-2026-114142, CVE-2026-114143, and CVE-2026-114144 ([0415aef3e](https://github.com/snyk/snyk/commit/0415aef3e7eb2abded15ccb2cf623b8d813ecee2))
