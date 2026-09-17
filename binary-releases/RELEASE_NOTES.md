## [1.1307.3](https://github.com/snyk/snyk/compare/v1.1307.2...v1.1307.3) (2026-09-17)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Bug Fixes

* **test**: Reports an unreadable `.snyk` policy file as SNYK-POLICY-0002 with a message identifying the problem, instead of an unspecified error. ([4ada635](https://github.com/snyk/snyk/commit/4ada63568443e210c7b84d3f90c92bdb0421b3b9))
* **test**: `--all-projects` now resolves each project's `.snyk` policy from that project's own directory, instead of applying the scan root's policy to every project. ([f17550f](https://github.com/snyk/snyk/commit/f17550f96593f07f84f04f09b6eb93de1e344a1d))
* **deps**: Updates dependencies to fix vulnerabilities:
  - CVE-2026-63376, CVE-2026-77465 ([b93aa46](https://github.com/snyk/snyk/commit/b93aa46efa7b226723198601bec3e9739c38683d))
  - SNYK-JS-ADMZIP-19846655 ([97689ff](https://github.com/snyk/snyk/commit/97689ff9eac5fb323ad2f354532c94bebe1ee84f))
