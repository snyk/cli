## [1.1296.0](https://github.com/snyk/snyk/compare/v1.1295.3...v1.1296.0) (2025-02-28)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### News
* **general:** Improved error logging and handling

### Features

* **container:** add support for --exclude-node-modules option ([4756f27](https://github.com/snyk/snyk/commit/4756f270f16fcd1588fec1f4d4be846c32e31271))
* **container:** adds kaniko support ([bfb69c8](https://github.com/snyk/snyk/commit/bfb69c83ddda560b2940ee1eb771da665737eb42))
* **general:** display a unique interactionID alongside each error ([960a71c](https://github.com/snyk/snyk/commit/960a71c81f17f0b5743e5ebd61cbf1b88c7d0c40))
* **test:** python support for local wheel files specifiers ([42675eb](https://github.com/snyk/snyk/commit/42675eb4da17307ad8ab6a090b761fd3ab9a8a2f))
* **test:** add support for poetry v2 ([52e31e0](https://github.com/snyk/snyk/commit/52e31e0e9ab6326b759933ec7ee5d5c5925c3823))
* **test:** dep-graph json file output ([90f24ec](https://github.com/snyk/snyk/commit/90f24ecdba80b431fb8db4116a82f3fb6db45f80))
* **test:** print legacy tree with json file output ([b256937](https://github.com/snyk/snyk/commit/b2569378135e3156eca44b27902dc799def1e430))
* **test:** display all applicable maven unmanaged identities ([ebf6ba1](https://github.com/snyk/snyk/commit/ebf6ba1f832f1416adc9d5501081e8a681b1ff5f))
* **code:** enable v1 fingerprints in code sarif output ([00644af](https://github.com/snyk/snyk/commit/00644af4ad77e9dc09b49973bac30a3fcd7eef0a))
* **test:** Add 'pkgIdProvenance' labels to dependency graph nodes when the package identity has been changed from what has been discovered in the manifest files ([4d529b3](https://github.com/snyk/snyk/commit/4d529b372de1ea0561119f5e7cf9bb9361e8089d))
* **python:** added Python support for sys_platform ([1aa1565](https://github.com/snyk/snyk/commit/1aa1565bca1863c8f362f0c19baed76981fabdc2))


### Bug Fixes

* **container:** add container test doc info for --exclude-node-modules ([2faf2d1](https://github.com/snyk/snyk/commit/2faf2d16338b7d7b67e6faa116db6e4408864d15))
* **test:** fix dotnet UTF-16LE support for target framework ([e90075a](https://github.com/snyk/snyk/commit/e90075aab4ed9bc55ba438d4435b47c8e65d16f9))
* **test:** reduce false positives when scanning improved dotnet projects ([c21625a](https://github.com/snyk/snyk/commit/c21625a59468dea2fe963a2ded40f947fbbe9be5))
* **test:** use --strict-out-of-sync when set to false with pnpm for top level dependencies ([8d5b71a](https://github.com/snyk/snyk/commit/8d5b71a1209a4f06f455fc0bd0639f9578bbc1e1))
* **test:** fix OutOfSync errors in pnpm for download urls ([b6e4ea0](https://github.com/snyk/snyk/commit/b6e4ea01fb4a188e35efc0b462d343cd674614f2))
* **test:** fix OutOfSync errors in pnpm git protocol dependencies ([5c8dc34](https://github.com/snyk/snyk/commit/5c8dc34477f24354924edae770e1e249e79be1cb))
* **code:** Don't write sarif files when no results are found ([5a15113](https://github.com/snyk/snyk/commit/5a151137c68704cdfb82025a2cc616a7378792a3))
* **code:** Support single file test for golang native implementation ([d7881f1](https://github.com/snyk/snyk/commit/d7881f128197d3384de75129cdcfeef8c2dc9370))
* **sbom:** mavenAggregateProject with Dverbose or sbom ([e88cf71](https://github.com/snyk/snyk/commit/e88cf712f21e7a26056796d46356e98b6d453bf4))
* **iac:** Updates the user messages for snyk iac test --report for IaC V2 ([1c9b3b3](https://github.com/snyk/snyk/commit/1c9b3b30d5ed2d17a8113b42169f3f7e4d4d88ea))


