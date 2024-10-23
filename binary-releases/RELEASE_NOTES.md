## [1.1294.0](https://github.com/snyk/snyk/compare/v1.1293.0...v1.1294.0) (2024-10-23)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### News

* **CycloneDX 1.6 SBOM support** This new version now supports generating CycloneDX 1.6 SBOMs using the `snyk sbom` command, providing you with more comprehensive and detailed information about your software components and their dependencies. [Read more about the CycloneDX version announcement here](https://cyclonedx.org/news/cyclonedx-v1.6-released/).
* **Improved CLI monitoring of large Cocoapods projects** When doing a `snyk monitor` on very large Cocoapods applications, the CLI sometimes returned an `Invalid String OOM` error and the operation would fail. Although this error was rare, we have fixed it so large Cocoapods applications can now be monitored successfully.
* **Fix for security issue** The Snyk CLI before 1.1294.0 is vulnerable to Code Injection when scanning an untrusted (PHP|Gradle) project. The vulnerability can be triggered if Snyk test is run inside the untrusted project due to the improper handling of the current working directory name. Snyk always recommends not scanning untrusted projects.


### Features

* **sbom:** add CycloneDX 1.6 SBOM support ([1330fc2](https://github.com/snyk/snyk/commit/1330fc2442e48865ea2e1b27a94cf665ff4b0416))
* **deployment:** Deploy alpine arm64 binaries ([9daace4](https://github.com/snyk/snyk/commit/9daace4aa1bdb5d5939d91a118709a5f78b64bb8))
* **monitor:** enable cocoapods to send graphs for cli monitor ([ca56c69](https://github.com/snyk/snyk/commit/ca56c695e65f11b44b0c50f93b892a0e03aea97a))
* **iac:** pass allow analytics flag to snyk-iac-test [IAC-3017] ([b12d3ac](https://github.com/snyk/snyk/commit/b12d3acf99a318c3841977ba4a3277b32a8baa22))


### Bug Fixes

* **all:** restore cert file if it was externally removed ([ef1547f](https://github.com/snyk/snyk/commit/ef1547fde9fa0e53897bbb8c51fa1cf3b02d78b8))
* **auth:** missing auth issue with oauth ([57ae95c](https://github.com/snyk/snyk/commit/57ae95cf5e3fc3d4c744a782feae2def17e70493))
* **iac:** upgrade iac custom rules ext to address vulns [IAC-3065] ([d6cc509](https://github.com/snyk/snyk/commit/d6cc509d919165efa7392b0f0ef532d8840f1207))
* **iac:** upgrade snyk-iac-test to v0.55.1 [IAC-2940] ([0dadc90](https://github.com/snyk/snyk/commit/0dadc901087b97040243bb8a65b4844df9096a3d))
* **monitor:** add normalize help for deriving target files [CLI-448] ([82efb50](https://github.com/snyk/snyk/commit/82efb50280569b5a3f290fda347d18d6a67170ca))
* **sbom:** include CVE in JSON output of sbom test command ([a543179](https://github.com/snyk/cli/commit/a54317939e0b795732e36cd024ed80d5bf5cc167))
* **sbom:** add missing option --gradle-normalize-deps to SBOM command ([151f63d](https://github.com/snyk/cli/commit/151f63df5fe94f7c2734b9cb227b9eb25f35d412))
* **test:** default limit to max vulnerable paths per vuln, add override option `--max-vulnerable-paths` ([302d7ac](https://github.com/snyk/snyk/commit/302d7ac5a396d85cc4c424421ef5b7cfa5f32297))
* **test:** do not show test deps for Dverbose mvn with dependencyManagement ([67e0de9](https://github.com/snyk/snyk/commit/67e0de94c13622c390aff4a5b34bba4791272577))
* **test:** fixed support for pnpm alias packages ([d506de1](https://github.com/snyk/snyk/commit/d506de1203483cf627680a7ad7aa30b1479ed76c))
* **test:** point snyk policy out urls to snyk.io ([28509a3](https://github.com/snyk/snyk/commit/28509a303e5d2b783799291e8db4afd159cd7533))
* **test:** scan non publishable projects on improved net ([a6c0e67](https://github.com/snyk/snyk/commit/a6c0e671937a662c0f3b4bfa4eae4c232511f7e8))
* **test:** scan nuget with PublishSingleFile turned on ([2c74298](https://github.com/snyk/snyk/commit/2c74298094b627ec2d5df6b57f5aa49f67d4c132))
* **dependencies:** update snyk-nodejs-plugin to fix micromatch vuln ([baef934](https://github.com/snyk/cli/commit/baef934d14cb88a128477618c3861235aee1cecc))
* **dependencies:** address security vulnerability in snyk-php-plugin CVE-2024-48963 ([7798d13](https://github.com/snyk/cli/commit/7798d13e072870462e77a72355d0bf1611c41bbb))
* **dependencies:** address security vulnerability in snyk-gradle-plugin CVE-2024-48964 ([c614284](https://github.com/snyk/cli/commit/c614284b4f1f88c7b0784c6133aab630f57ea0a4))
* **dependencies:** upgrade go-getter to 1.7.5 ([970de96](https://github.com/snyk/snyk/commit/970de96595a931f4362c9c95fe2ce901c4c63b55))
* **dependencies:** upgrade iac extension and snyk-iac-test ([9134c05](https://github.com/snyk/snyk/commit/9134c05d3f060daaa4294f47b7d2831bef894e07))
* **dependencies:** upgrade slack/webhook to 7.0.3 ([8ab4433](https://github.com/snyk/snyk/commit/8ab4433d2b9e037cd181270f62d3295a9c6b9086))