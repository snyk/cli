## [1.1306.0](https://github.com/snyk/snyk/compare/v1.1305.2...v1.1306.0) (2026-06-26)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Features

* [ADS-391] Log Machine IDs ([b8ce4ff](https://github.com/snyk/snyk/commit/b8ce4ff792dd401483547e7e5d62ba802d0492e9))
* add acceptance tests for secrets ignore output [PS-669] ([72aec84](https://github.com/snyk/snyk/commit/72aec84a8e8f3ecf273990550ada8a73a9873345))
* add support for user-doc-based help routing + manifest generation ([33fd1eb](https://github.com/snyk/snyk/commit/33fd1ebf7b43e7c989c9d4398b9fae1a243df013))
* bump cli-exntenstion-dep-graph and os flows [CMPA-593] ([1246101](https://github.com/snyk/snyk/commit/1246101a69f95b2965a499bf1270e6e0bfd62cfe))
* enable json and sarif output formats for secrets [PS-588] ([f44b091](https://github.com/snyk/snyk/commit/f44b0917d9feceb915cb10e0191c9167e8f93e14))
* improve ecosystem specific fixes for SCA ([a97fe80](https://github.com/snyk/snyk/commit/a97fe80f2bb92a3d3dc657d1b184c92b0a26ca99))
* mcp promote brekability to default profile ([56a9196](https://github.com/snyk/snyk/commit/56a91963c5eb3b42d2a85c1c7fc53b5418143337))
* show `TEST_SNYK_IGNORE_LIST` patterns in the pipeline ([13ada8e](https://github.com/snyk/snyk/commit/13ada8e483975d87bfc76c0cf8cb791e2b8db798))
* support html flags in gaf ([d8714ae](https://github.com/snyk/snyk/commit/d8714ae03207b27ad3e7f5cd50488c97e86b488e))
* update CircleCI workflow and `createJestConfig` to support `TEST_SNYK_IGNORE_LIST` for selective test skipping ([b2c8d32](https://github.com/snyk/snyk/commit/b2c8d32d21bf40ec2c9330f181a9eb2e52145c4c))
* update snyk-docker-plugin to v9.11.0 ([51f4cb8](https://github.com/snyk/snyk/commit/51f4cb8b8fdd216e3994049072add852fb78a6cd))
* update studio-mcp ([9734153](https://github.com/snyk/snyk/commit/973415379ed3945e9773166e50e6e72b07743d65))
* Upgrade `snyk-gradle-plugin` to `v7.0.0` ([c819b69](https://github.com/snyk/snyk/commit/c819b6936b48407005ab0c266e2d51e464638994))
* upgrade container scanner to expand jvm detection and support .NET ([5586aac](https://github.com/snyk/snyk/commit/5586aacb30549bbf515af06acf08ff8493d2e08c))


### Bug Fixes

* [DGP-1765] bump go-application-framework to pull in asset inventory link from Test API ([cd3f480](https://github.com/snyk/snyk/commit/cd3f480027b67e2252be274d7524eaf61a4524d5))
* bump @snyk/snyk-cocoapods-plugin to 3.1.1 to address vuln ([ed15dd8](https://github.com/snyk/snyk/commit/ed15dd876d6b56ef5bfc235a9c29e6d040668bdf))
* bump cli-extension-os-flows to include reachability poll timeout fix (FAN-148) ([85e3e6b](https://github.com/snyk/snyk/commit/85e3e6bc0f47a7f152718bde9fd3e3f05fd8d01f))
* bump cli-extension-os-flows to include unified scanners improvements ([fdcfeaa](https://github.com/snyk/snyk/commit/fdcfeaa83e70831bf433f78efeef480982c2ac21))
* bump snyk-swiftpm-plugin to 1.5.1 resolves registry identity URLs to github ([64ac442](https://github.com/snyk/snyk/commit/64ac44286045062366dfe3f5200d635f01aba37c))
* **ci:** add tag for npm preview publishing ([40929a4](https://github.com/snyk/snyk/commit/40929a489944a1539a6a8e87dbe2924ae389ebdd))
* **ci:** check-dependecies gh action now uses npm token to access private packages ([3511a3d](https://github.com/snyk/snyk/commit/3511a3dc30412a75a7a38cd72dbca26a9b8ec8b3))
* handle missing dotnet CLI during NuGet runtime resolution scans ([af28836](https://github.com/snyk/snyk/commit/af28836bb477508265587d403ef2ee29c233ede8))
* improve typing of docker registry client ([41807b3](https://github.com/snyk/snyk/commit/41807b31c400d7e0d09b10ca6fab942f9712a203))
* **nodejs:** prune yarn workspace dev-dep leak in workspace scans ([ade08e4](https://github.com/snyk/snyk/commit/ade08e4450e0fac2d9a8d861cbfe0bf7c6a7a98e)), closes [snyk/nodejs-lockfile-parser#311](https://github.com/snyk/nodejs-lockfile-parser/issues/311)
* prevent workflow engine logger race during concurrent startup ([d9a4b5b](https://github.com/snyk/snyk/commit/d9a4b5b7b4f05c73ac3baaed7e01020a82f69f8e))
* replace manifest.txt help with embedded user docs directory ([cf2d449](https://github.com/snyk/snyk/commit/cf2d4498da629e8d96140d34ed8afb1bcf7ea802))
* resolve relative path normalisation in printDepGraphError[CSENG-200] ([f0eb4d0](https://github.com/snyk/snyk/commit/f0eb4d067fe816f8570290ce10a646dabc38a07f))
* run formatter on agents.md ([8f463a0](https://github.com/snyk/snyk/commit/8f463a086a2e64d9873cb7c0b499701728bc642b))
* **scripts:** make upgrade of go deps exit on errors ([0a5b4e6](https://github.com/snyk/snyk/commit/0a5b4e6f8d9ddbc8c2aa198dd8a88f0f747992da))
* skip reachability upload when no supported files are present ([9ba448c](https://github.com/snyk/snyk/commit/9ba448c46f33c01ab0e990219540410d730b14ef))
* trust snyk homebrew tap in deployment tests ([7eb0c0c](https://github.com/snyk/snyk/commit/7eb0c0c9d1174a4af1b12cc318978b642b42ca1f))
* update `tmp` dependency to solve CVE-2026-44705 ([e5f49a4](https://github.com/snyk/snyk/commit/e5f49a4348dbc67ee7a34078feb77ef860c74fd4))
* update sbt plugin to v3.1.1 to handle custom scala configs ([5765a12](https://github.com/snyk/snyk/commit/5765a12b56b240f8789c8684b69ad23d81a0e0d7))
* upgrade GAF and handle retry notifications ([f803397](https://github.com/snyk/snyk/commit/f803397aee953b9a28f530bdc72f600a6b97fa8d))
* upgrade prod pkgs which depend on `tmp` to avoid CVE-2026-44705 ([3094112](https://github.com/snyk/snyk/commit/30941126e1db5f0fb953c761fd02fb7900b14636))


### Reverts

* snyk-ls pointing to bad commit ([6ab4936](https://github.com/snyk/snyk/commit/6ab493693d665f9f8d4196a3664d07aef245fd55)), closes [#6766](https://github.com/snyk/snyk/issues/6766)

