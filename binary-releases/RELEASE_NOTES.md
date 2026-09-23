## [1.1307.4](https://github.com/snyk/snyk/compare/v1.1307.3...v1.1307.4) (2026-09-23)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Bug Fixes

* **test**: `--iac`, `--docker`, `--container` and `--code` no longer get silently dropped for orgs on the unified test API — each now runs the correct scan again instead of an open-source test (which could fail with "No supported files found" or scan the wrong target). ([87568ab](https://github.com/snyk/snyk/commit/87568abd6fd55ae098f306634347b5cf300ab1fd))
