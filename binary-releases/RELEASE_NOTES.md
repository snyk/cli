## [1.1304.1](https://github.com/snyk/snyk/compare/v1.1304.0...v1.1304.1) (2026-04-27)


The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Bug Fixes
* **general**: Improved error handling to prioritize and surface the most relevant error and derive the correct exit code when multiple errors occur during CLI execution. ([b505a96](https://github.com/snyk/snyk/commit/b505a962897f67fafa1626be70d56ee7918c095b))git 
* **deps**: Updates dependencies to fix vulnerabilities:
 - CVE-2026-4660 ([b3f23a9](https://github.com/snyk/snyk/commit/2a95d85aff26f562f9cf1400d106d9ed12e3beca))
 - CVE-2026-39883 ([b3f23a9](https://github.com/snyk/snyk/commit/2a95d85aff26f562f9cf1400d106d9ed12e3beca))
