## [1.1302.1](https://github.com/snyk/snyk/compare/v1.1302.0...v1.1302.1) (2026-01-21)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Bug Fixes

* **code:** Resolves FedRAMP URI construction in the IDE ([35800c1](https://github.com/snyk/cli/pull/6433/commits/35800c10aea0807a04baf4e6eafa2bf5f9f3c991))
* **test:** PackageURL validation failed with go.mod replace directive (SNYK-CLI-0000) for snyk test ([7eb2978](https://github.com/snyk/cli/commit/7eb297864039f3ffa80d9b4d0a0fa49b5c1e36a0))
* **sbom:** PackageURL validation failed with go.mod replace directive (SNYK-CLI-0000) for snyk sbom ([fda61e0](https://github.com/snyk/cli/commit/fda61e060aff529547d60e0efd2b5b5a89aa459d))