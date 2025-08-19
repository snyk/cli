## [1.1299.0](https://github.com/snyk/snyk/compare/v1.1298.3...v1.1299.0) (2025-08-18)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Features

* **auth**: Support for PAT auto region configuration. ([ad8e4a7](https://github.com/snyk/snyk/commit/ad8e4a7ab979b0638bd9637bc7c4c7abff394cb4))

### Bug Fixes

* **language-server**: Fixes a bug related to the analytics environment variables. ([6916af8](https://github.com/snyk/snyk/commit/6916af848ea3dc3e79d7e7e9f07089461e6f5ebf))
* **code:** Fixes `code test --report` when a `project_id` environment variable exists. ([6168b1d](https://github.com/snyk/snyk/commit/6168b1dfdb5c06685871a207a2fb5b476b510f41))
* **dependency:** Fixes `CVE-2025-8959`. ([5a548fb](https://github.com/snyk/snyk/commit/5a548fbb5cad25b97916645b5df59e28b017eb31))
* **container**: Stops spawning commands using a shell. ([7ee9e15](https://github.com/snyk/snyk/commit/7ee9e150a418767f36f88e9e3064f73db309571e))
* **general**: Fixes a bug where formatting of log timestamps could cause a crash in some cases. ([92fa8be](https://github.com/snyk/snyk/commit/92fa8be2bae46a9d5efe7a3538efe1f9aedc21d1))
* **aibom**: Fixes a bug where `aibom` would throw the wrong error if unauthorized. ([1187e1e](https://github.com/snyk/snyk/commit/1187e1edc20f68fe21d50ad3bb4ebdc9f465662e))
* **iac:** Fixes wrong status code checks. ([77152e5](https://github.com/snyk/snyk/commit/77152e5204e48643a00590c0745a45b8c7760347))
