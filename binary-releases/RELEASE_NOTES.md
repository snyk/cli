## [1.1308.4](https://github.com/snyk/snyk/compare/v1.1308.3...v1.1308.4) (2026-11-04)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Bug Fixes

* **iac**: Fixes a panic in `snyk iac test` when an ARM template contains a property with a null value. ([fbae7febd](https://github.com/snyk/snyk/commit/fbae7febdc046e6bd849b0dc14d8581e4a8b1a66))
* **language server**: Bug fixes for Snyk Language Server used by the Snyk IDE plugins. ([ef0db2c0b](https://github.com/snyk/snyk/commit/ef0db2c0b79eb15d9241fc181c1f649bf88d6ce3))
* **deps**: Updates dependencies to fix vulnerabilities:
  - Updates the Open Policy Agent library used by `snyk iac test` to address CVE-2025-46569 ([126998855](https://github.com/snyk/snyk/commit/126998855504c507513a9e111d3fa5f260de41ee))
  - Updates `moby/buildkit` to 0.31.2 to address CVE-2026-15788 and CVE-2026-61711 ([130ecc217](https://github.com/snyk/snyk/commit/130ecc21718b3c7701758dc7a7442fe254197786))
  - Updates `klauspost/compress` to 1.20.2 and `go-jose/v4` to 4.1.6 to address CVE-2026-116591 and CVE-2026-116587 ([df49f1bd4](https://github.com/snyk/snyk/commit/df49f1bd458b4899ddf6289f733435a28e5ce78f))
  - Updates `golang.org/x/net` to 0.62.0 to address CVE-2026-78661 ([9857f314c](https://github.com/snyk/snyk/commit/9857f314cd74a6456131da277ea8c276f6a1d0f0))
