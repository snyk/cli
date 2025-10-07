## [1.1300.0](https://github.com/snyk/snyk/compare/v1.1299.1...v1.1300.0) (2025-10-08)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Features

* **general:** Improve SARIF compatibility by adding runAutomationDetails ([3e232e5](https://github.com/snyk/snyk/commit/3e232e52a105620c638b211bbc1a8baddeddb170))
* **container:** Add support scanning system JARs ([54e84d8](https://github.com/snyk/snyk/commit/54e84d8f4efda07f21b0e729f75440fa4608966c))
* **container:** Add TargetOS to output of container scan ([aa55cd9](https://github.com/snyk/snyk/commit/aa55cd90683995d4143f43173eddee61ecf88167))
* **test:** Add support for godot projects ([d9fc200](https://github.com/snyk/snyk/commit/d9fc2008287349c63b3144634549c77cb3864fd9))
* **test:** Add support for maven metaversions ([f321ffa](https://github.com/snyk/snyk/commit/f321ffa6efdf2f269f0b7fb1a87b91332a7da18e))
* **language-server:** Add CVSSv4 Links in IDE Issue Details
* **mcp:** Workflow and performance improvements


### Bug Fixes

* **container:** Fixed crashes when scanning docker images with very large files ([72cb040](https://github.com/snyk/snyk/commit/72cb04083d3c204d6755f194f7ccc6e522788f66))
* **test:** Re-enable support for python 2.7 ([02c7fe3](https://github.com/snyk/snyk/commit/02c7fe373e3ec1a59d15de1f7fe87e461d3fafb5))
* **test:** Improved error information when using --all-projects ([36d14f9](https://github.com/snyk/snyk/commit/36d14f940003d093df0bdc9d22a32d9b26b6b252))
* **test:** Fix a bug due to case-sensitive ignores ([b432406](https://github.com/snyk/snyk/commit/b4324066fbdca2224e3a1aca223cde5b2b6e0ea2))
* **test:** Resolve project assets file path dynamically ([75a152e](https://github.com/snyk/snyk/commit/75a152ec29e91f9c37a26f0daed77a142cebef39))
* **iac:** Upgrade iac components to address a vulnerability [IAC-3439] ([eaaaf84](https://github.com/snyk/snyk/commit/eaaaf844237b430d9d9ee7109ada5b5bd2e103a5))
* **logging:** Fix broken debug logs due to secret redaction by redacting all user input ([0cf19a7](https://github.com/snyk/snyk/commit/0cf19a7dc8b761ec61d7ae0f3f5d160b0e2b0450))
* **language-server:** Multiple bugfixes
