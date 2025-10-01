## [1.1300.0](https://github.com/snyk/snyk/compare/v1.1299.1...v1.1300.0) (2025-10-01)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Features

* [CN-249] support scanning system JARs ([54e84d8](https://github.com/snyk/snyk/commit/54e84d8f4efda07f21b0e729f75440fa4608966c))
* [CN-342] Add TargetOS to output of container scan ([aa55cd9](https://github.com/snyk/snyk/commit/aa55cd90683995d4143f43173eddee61ecf88167))
* add linux static experimental binary ([86305ef](https://github.com/snyk/snyk/commit/86305ef4d9e769d483e33e51d84760685d8050c9))
* add runAutomationDetails ID to SARIF output ([3e232e5](https://github.com/snyk/snyk/commit/3e232e52a105620c638b211bbc1a8baddeddb170))
* add support for godot projects ([d9fc200](https://github.com/snyk/snyk/commit/d9fc2008287349c63b3144634549c77cb3864fd9))
* enable reachability checks in OS extension [OSF-91] ([efaa4bc](https://github.com/snyk/snyk/commit/efaa4bc9554f187cebfd7705c0c2775c2d1f2459))
* **monitor:** add --reachability-id support ([58af8cc](https://github.com/snyk/snyk/commit/58af8ccfca7c1f5cbe8c216abd181787c78cbaec))
* re-enable sbom reachability user journey test ([ca72c3e](https://github.com/snyk/snyk/commit/ca72c3e63d8676060d9cc6435ab603b96911e2c2))
* skip sbom reachability test ([ceb25b8](https://github.com/snyk/snyk/commit/ceb25b8c09ea1058acf01a227b6c57cf5f9f0048))
* support new test service commit ID metadata ([1df4d26](https://github.com/snyk/snyk/commit/1df4d2619cee501cb4a1ac2e9480f0d2c7ddcf08))
* **test:** Adds support for maven metaversions ([f321ffa](https://github.com/snyk/snyk/commit/f321ffa6efdf2f269f0b7fb1a87b91332a7da18e))


### Bug Fixes

* adapt input directory handling to preserve whitespaces ([5a0f7eb](https://github.com/snyk/snyk/commit/5a0f7eb5dfb05b0d6a5fa5fc54fcf473bf3827e1))
* **auth:** Fix improper regex during auth that can lead to SSRF ([18466b3](https://github.com/snyk/snyk/commit/18466b3bbe60b4b1aad6d409f1cab62ff2df3fb7))
* changed fixture used for integration test for faster success ([a5ac939](https://github.com/snyk/snyk/commit/a5ac939e5b417237dcb290e150327119fb0c1f77))
* **cicd:** "gobject-introspection: no bottle available" error when setting up macos acceptance tests ([7891cc2](https://github.com/snyk/snyk/commit/7891cc2da2d7949ee07c1b047a73f7242ab67508))
* **cicd:** follow redirect with wget ([e267b96](https://github.com/snyk/snyk/commit/e267b96a9c12932b1458532cd6510be4930b0823))
* conforming the way we take precedence of auth config values ([57ae3ca](https://github.com/snyk/snyk/commit/57ae3ca91b6a19e6e7850b803373664b91450fd9))
* display error details for all project scans on failing targets ([36d14f9](https://github.com/snyk/snyk/commit/36d14f940003d093df0bdc9d22a32d9b26b6b252))
* enhancing shell spawn hardening from OSS plugins ([f7881f1](https://github.com/snyk/snyk/commit/f7881f1c4b4dcce465fb6db7df24048a73a37e04))
* Ensure to not redact crucial debug values ([8432371](https://github.com/snyk/snyk/commit/84323710d666431e6494f584677ae958ba9ac4ac))
* Fix reduced configuration cache usage ([ae111a3](https://github.com/snyk/snyk/commit/ae111a32e9508db3366b37435e99002ed73a49f6))
* fixing broken alpine installation ([57a5a92](https://github.com/snyk/snyk/commit/57a5a927c7f63b63c70521b2d81b05ad4bf3c9bf))
* fixing host auto-detection bug in snyk auth ([1fd2e56](https://github.com/snyk/snyk/commit/1fd2e569d3f3a4022275b317be041e460996f4ba))
* **iac:** upgrade iac components to address a vulnerability [IAC-3439] ([eaaaf84](https://github.com/snyk/snyk/commit/eaaaf844237b430d9d9ee7109ada5b5bd2e103a5))
* ignore casing fix in the policy lib ([b432406](https://github.com/snyk/snyk/commit/b4324066fbdca2224e3a1aca223cde5b2b6e0ea2))
* Increase tolerance for invalid input directories ([ce96a31](https://github.com/snyk/snyk/commit/ce96a3160de0b26a2b13ad1ea7eb58496f8fa1f6))
* **instrumentation:** Fix mapping of floating point values ([c0be734](https://github.com/snyk/snyk/commit/c0be7342e1ef3d2e3116006ee86850cdbda20106))
* **logging:** pass known CLI parameters to scrub out sensitive data ([0cf19a7](https://github.com/snyk/snyk/commit/0cf19a7dc8b761ec61d7ae0f3f5d160b0e2b0450))
* making test fixtures in regression tests gradle 9 compatible ([5604157](https://github.com/snyk/snyk/commit/5604157481ae0bb68361f38826082c3f392a803b))
* moving to a private docker repo ([2c96c50](https://github.com/snyk/snyk/commit/2c96c50a236e83e27b5195c22802ec28fa9d6c10))
* requiring Node 20 as a minimum ([31254f3](https://github.com/snyk/snyk/commit/31254f3443045d7016a55ef054b7f41dda66b88e))
* resolve project assets file path dynamically ([75a152e](https://github.com/snyk/snyk/commit/75a152ec29e91f9c37a26f0daed77a142cebef39))
* updating wrong markdown files ([af688db](https://github.com/snyk/snyk/commit/af688db493b99b65e52583830509b26ac78b0370))
* upgrade to go 1.24.6 ([045f864](https://github.com/snyk/snyk/commit/045f86465daaf5ff174f4541c673d4e43f79f9d2))
* Use snyk-code-0006 for sast consistently ([e36f813](https://github.com/snyk/snyk/commit/e36f813ae20cd18c4012a744de9fbdc7d873a0e7))
* using Gradle 9 on build image ([cc1f80d](https://github.com/snyk/snyk/commit/cc1f80dbcbb6492aa43c2b51a94ec4b1973c12f7))

