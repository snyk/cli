## [1.1299.0](https://github.com/snyk/snyk/compare/v1.1298.3...v1.1299.0) (2025-08-28)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Features

* **auth**: Support for PAT auto region configuration. ([ad8e4a7](https://github.com/snyk/snyk/commit/ad8e4a7ab979b0638bd9637bc7c4c7abff394cb4))

### Bug Fixes

* **code:** Fixes `code test --report` when a `project_id` environment variable exists. ([6168b1d](https://github.com/snyk/snyk/commit/6168b1dfdb5c06685871a207a2fb5b476b510f41))
* **code:** Fixes an issue with `snyk code test` where an empty input parameter would cause inconsistent behavior. ([a661235](https://github.com/snyk/cli/pull/6129/commits/a661235d3f4a796596872a5af5de5748ba62e6dd))
* **container**: Stops spawning commands using a shell. ([7ee9e15](https://github.com/snyk/snyk/commit/7ee9e150a418767f36f88e9e3064f73db309571e))
* **dependency:** Fixes `CVE-2025-8959`. ([5a548fb](https://github.com/snyk/snyk/commit/5a548fbb5cad25b97916645b5df59e28b017eb31))
* **general**: Fixes a bug where formatting of log timestamps could cause a crash in some cases. ([92fa8be](https://github.com/snyk/snyk/commit/92fa8be2bae46a9d5efe7a3538efe1f9aedc21d1))
* **iac:** Fixes wrong status code checks. ([77152e5](https://github.com/snyk/snyk/commit/77152e5204e48643a00590c0745a45b8c7760347))
* **language-server**: Fixes a bug related to the analytics environment variables. ([6916af8](https://github.com/snyk/snyk/commit/6916af848ea3dc3e79d7e7e9f07089461e6f5ebf))
* **language-server**: Correctly populates the environment for Open Source scans when called from the IDE. ([945b029](https://github.com/snyk/cli/commit/945b029aafcc30e92ddfcf9e814aa7eb4ff22dfd))
* **language-server**: Ensures changed API URLs are respected during authentication. ([24ed981](https://github.com/snyk/cli/commit/24ed981c9803541025ba2c0579a7daec443f0225))
* **language-server**: MCP tool updates to support feedback and better tool descriptions. ([8f2a8d1](https://github.com/snyk/cli/commit/8f2a8d13f4019d1547f2e6244fbb5467a56adf7f))
* **test:** Fixes a bug where `project.assets.json` files would not be detected in cases where it's destination path was altered with .NET properties. ([75a152e](https://github.com/snyk/cli/pull/6117/commits/75a152ec29e91f9c37a26f0daed77a142cebef39)) 
* **test:** Improves error messages when using `--all-projects`. ([960fa8e](https://github.com/snyk/cli/pull/6129/commits/960fa8e9bd9d5da8ba0c21313ecddbea1cb979a5))
