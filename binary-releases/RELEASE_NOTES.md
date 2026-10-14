## [1.1308.1](https://github.com/snyk/snyk/compare/v1.1308.0...v1.1308.1) (2026-10-14)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Features

* **test**: `snyk test --html` and `--html-file-output` no longer require preview features to be enabled. ([3bc664655](https://github.com/snyk/snyk/commit/3bc664655bf81383ee198b62966023f959b105fd))

### Bug Fixes

* **test**: Ensure the project name is consistently displayed in the test summary when available. ([ca8744853](https://github.com/snyk/snyk/commit/ca874485305818fbb944d193dd7f248d92544b6c))
* **deps**: Updates dependencies to fix vulnerabilities:
  - CVE-2022-21681 ([334f8735c](https://github.com/snyk/snyk/commit/334f8735cea9d2d77125aab80e40ad246a95ec07))
  - Updates the Go runtime to 1.26.9 to address CVE-2026-56857, CVE-2026-56866, CVE-2026-78659, CVE-2026-78667, CVE-2026-94439, CVE-2026-94440, CVE-2026-97031, and CVE-2026-97032 ([8d515f75c](https://github.com/snyk/snyk/commit/8d515f75c67364d7a26f8ba1db4e95e3bdee4277))
