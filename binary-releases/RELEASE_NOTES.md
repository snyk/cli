## [1.1300.1](https://github.com/snyk/snyk/compare/v1.1300.0...v1.1300.1) (2025-10-20)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Features

* **mcp:** Added support for the MCP server to use IDE extension storage when running in VS Code ([7f26dc6](https://github.com/snyk/snyk/commit/7f26dc63f2b650f88bc27604a5568d9e80bcb2a6))

### Bug Fixes

* **test:** Fix issue where npm aliases only detected the latest version of a dependency ([cb37da7](https://github.com/snyk/snyk/commit/cb37da79febf6e9c44b68eccf444633a6508aa3f))
* **security:** Upgrades dependencies to address CVE-2025-58058 and CVE-2025-11065 ([d7e87e2](https://github.com/snyk/snyk/commit/d7e87e296f99d299a87533812399830b60b7c0c3))
* **general:** Improved error messaging ([5d16466](https://github.com/snyk/snyk/commit/5d16466e76ad0d278e62c023001ed78f06b3cd01))
