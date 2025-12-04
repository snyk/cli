## [1.1301.1](https://github.com/snyk/snyk/compare/v1.1301.0...v1.1301.1) (2025-12-04)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Bug Fixes

* **test:** Rendering of fix advice for multiple dependency paths when using the `reachability` flag ([eaf50bb](https://github.com/snyk/cli/commit/eaf50bba0815d0457a02d710ca3161eb3246160c))
* **monitor:** `snyk monitor --reachability=true` command should now work even if double dashed arguments are provided ([e8bdac6](https://github.com/snyk/cli/commit/e8bdac64623863bc142f77e3783dcb54d1620e95))
* **test, monitor:** Code upload speed will be improved when running `snyk test --reachability/snyk monitor --reachability` ([d0bdba1](https://github.com/snyk/cli/commit/d0bdba1788566d700d5a9119516f058b04e18c51))
* **language-server:** Multiple Snyk Language Server related fixes ([485ae55](https://github.com/snyk/cli/commit/485ae55c0a5f942a109b5340a21b6071848a46f0))
* **dependencies:** Upgrade dependencies to address multiple issues. ([e185c92](https://github.com/snyk/cli/commit/e185c92cbbb9102a8b50fb68f5ec9a3ddce280e1))
