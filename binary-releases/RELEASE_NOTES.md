## [1.1303.2](https://github.com/snyk/snyk/compare/v1.1303.1...v1.1303.2) (2026-03-23)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Features
* **redteam**: Introducing Snyk Agent Red Teaming with attack profiles (fast, security, safety) via the new --profile flag, allowing users to select pre-configured sets of attack goals. ([99e2953](https://github.com/snyk/cli/commit/99e2953eca6bbc68bc0a529047cba83b71400b72))
* **redteam**: New terminology for goals, strategies, and attacks to better describe Agent Red Teaming workflows. ([99e2953](https://github.com/snyk/cli/commit/99e2953eca6bbc68bc0a529047cba83b71400b72))
* **redteam**: Tenant-based authentication using --tenant-id for routing Agent Red Teaming commands. ([99e2953](https://github.com/snyk/cli/commit/99e2953eca6bbc68bc0a529047cba83b71400b72))
* **redteam**: Interactive wizard to guide users through Agent Red Teaming configuration and setup. ([99e2953](https://github.com/snyk/cli/commit/99e2953eca6bbc68bc0a529047cba83b71400b72))
* **container**: Add Go stdlib vulnerability detection to container scans ([aacdc53](https://github.com/snyk/cli/commit/aacdc535b95135a1473ec0d0a7505927df4388e6))

### Bug Fixes
* **test**: Fixes a bug where the CLI repeatedly evaluated user privileges (feature flags) when scanning multiple Go projects.([d348cb7](https://github.com/snyk/cli/commit/d348cb7252af40b2965c31d2af8f08ad437c5df3))
* **test**: Fixes a bug where scanning Go projects (with a `replace` directive pointing at a relative path) would fail due to badly formatted PackageURLs.([4c6b663](https://github.com/snyk/cli/commit/4c6b663ffaa997debf772663f0cabf4ef798bd27))
* **container**: upgrade minimatch dependency to 3.1.3 ([aacdc53](https://github.com/snyk/cli/commit/aacdc535b95135a1473ec0d0a7505927df4388e6))
* **dependencies**: Fix CVE-2026-33186 ([f8a0602](https://github.com/snyk/cli/commit/f8a0602c03cb4061c9516c442bdca8d69a95b47c))
* **dependencies**: Fix CVE-2025-69873 ([d240fcf](https://github.com/snyk/cli/commit/d240fcfb8e0ffb16d09e416eead7c2449faf6a3d)) 