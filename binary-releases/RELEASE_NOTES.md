## [1.1299.0](https://github.com/snyk/snyk/compare/v1.1298.2...v1.1299.0) (2025-08-18)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Features

* add and initialize cli-extension-os-flows ([bb255d5](https://github.com/snyk/snyk/commit/bb255d58cc8feccb37598b075bb0c5213cc4ea35))
* add gradle 9 support to snyk test ([dcb3acd](https://github.com/snyk/snyk/commit/dcb3acde15c8104dc74d69353bc007702584bf39))
* add sbom test with reachability command proxy ([7bb1a1e](https://github.com/snyk/snyk/commit/7bb1a1e112bb8eaeb46713e5948c1adea9a1e8d8))
* automatic integration of language server 0ac0531e19d7594dcd9ba401f2ee62fa8db1e65c ([9108dc0](https://github.com/snyk/snyk/commit/9108dc042010842869c2f24b6b7371d117915418))
* automatic integration of language server 41e841b099e2808f964fc6312c0bf887dd77de5d ([6916af8](https://github.com/snyk/snyk/commit/6916af848ea3dc3e79d7e7e9f07089461e6f5ebf))
* support PAT auto region configuration ([ad8e4a7](https://github.com/snyk/snyk/commit/ad8e4a7ab979b0638bd9637bc7c4c7abff394cb4))
* **tools:** add connectivity check extension ([82f4958](https://github.com/snyk/snyk/commit/82f49587aa0c4f89b03e8a4c0486407b761c26f8))
* update cli-extension-os-flows for Closed Beta. ([e43b073](https://github.com/snyk/snyk/commit/e43b073762ba9e6f9639fc8d424ee3cab2820a64))
* update cli-extension-os-flows for Closed Beta. ([e8f326f](https://github.com/snyk/snyk/commit/e8f326f76ab94767f6efcc7c39ba0a3195b38f87))
* **aibom** This command is now publicly available. Note that the feature is still experimental and subject to breaking changes without notice.
* **test** Added support for Gradle 9.

### Bug Fixes

* bump @slack/webhook@7.0.4 in cli-alert/iac-alert ([81af68f](https://github.com/snyk/snyk/commit/81af68f023294e4c60010088d5abad9456a2d725))
* **ci:** Fix macos acceptance tests ([0f6394b](https://github.com/snyk/snyk/commit/0f6394b6004b5af25cc511c6add5470a58a44a38))
* **code:** Fix code test --report when a project_id env var is exists ([6168b1d](https://github.com/snyk/snyk/commit/6168b1dfdb5c06685871a207a2fb5b476b510f41))
* compiler error ([b8f5503](https://github.com/snyk/snyk/commit/b8f55033485043ef4932094c11f38c6565cc6e7c))
* container support multiple shells across different platforms ([6095a60](https://github.com/snyk/snyk/commit/6095a60762687312f749bf5209e15604483be157))
* **dependency:** Fix CVE-2025-8959 by upgrading go-getter ([5a548fb](https://github.com/snyk/snyk/commit/5a548fbb5cad25b97916645b5df59e28b017eb31))
* enhancing the way we spawn subprocesses in `snyk container scan` ([7ee9e15](https://github.com/snyk/snyk/commit/7ee9e150a418767f36f88e9e3064f73db309571e))
* handle errors when formatting log timestamps ([92fa8be](https://github.com/snyk/snyk/commit/92fa8be2bae46a9d5efe7a3538efe1f9aedc21d1))
* handles aibom unauthorized error correctly ([1187e1e](https://github.com/snyk/snyk/commit/1187e1edc20f68fe21d50ad3bb4ebdc9f465662e))
* **iac:** fix status code checks [IAC-3375] ([77152e5](https://github.com/snyk/snyk/commit/77152e5204e48643a00590c0745a45b8c7760347))
* sbom test --reachability without git context ([6952529](https://github.com/snyk/snyk/commit/6952529bd51545b87856bd08f8d2d0e13ad23a7c))
