## [1.1293.0](https://github.com/snyk/snyk/compare/v1.1292.3...v1.1293.0) (2024-08-16)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### News

- Starting with this version, Snyk cli binaries will be distributed via `downloads.snyk.io` instead of `static.snyk.io`. This includes intallation from `npm`, `homebrew` and `scoop` as well as many of the CI/CD integrations.

### Features

- **sbom:** add support for license issues in sbom test ([6948668](https://github.com/snyk/snyk/commit/6948668d57523c2e7fd76ff363cf2d1625b6f0f3))
- **auth:** Use OAuth2 as default authentication mechanism ([35949c4](https://github.com/snyk/snyk/commit/35949c4acdd3bcbd510a6ac076523f21366b91c2))
  **config:** Introduce config environment command ([0d8dd2b](https://github.com/snyk/snyk/commit/0d8dd2b04278e38fe5fd335ec3023f753c944988))
- **container:** When docker is not installed, platform parameter is now supported ([64b405d](https://github.com/snyk/snyk/commit/64b405d02733fb2423798f4cfbff19fa04110c2d))

### Bug Fixes

- **auth:** align auth failure error messages for oauth ([e3bfec3](https://github.com/snyk/snyk/commit/e3bfec354e56499a2266a45804d0a93d17f46bce))
- **auth:** ensure environment variable precedence for auth tokens ([24417d6](https://github.com/snyk/snyk/commit/24417d6e7c7661c1a288a1f01502af17fdb54e64))
- **test:** fix a bug related to multi-project .NET folder structures ([755a38f](https://github.com/snyk/snyk/commit/755a38fc6b5c7b4f7631fced9e8f0fd8ed391819))
- **test:** multiple pnpm workspace improvements ([da5c14f](https://github.com/snyk/snyk/commit/da5c14fc344f17c7ac8c0969f2e0cb24ba59b6cd))
- **test:** fixes a bug regarding Snyk attempting to get the dependencies from the wrong nuget \*.deps.json file.([2e17434](https://github.com/snyk/snyk/commit/2e17434de99d342ea7dcedf5ba5bd250aae85eb3))
- **test:** support for pipenv with python 3.12 ([09df3bc](https://github.com/snyk/snyk/commit/09df3bc7dbcb184a56021ead7703732fa66ea273))
- **test:** support multi-part comparison for python pip versions. ([b625eb9](https://github.com/snyk/snyk/commit/b625eb90410d69047ef87b65cc0289f9360251fe))
- **container:** container monitor with --json now outputs valid json([039c9bd](https://github.com/snyk/snyk/commit/039c9bd13efa9397a8e442e80206bfabcc529125))
- **container:** support hashing large .jar files ([6f82231](https://github.com/snyk/snyk/commit/6f822317209e8b60bb07bf073bdcb9c78f402eb8))
- **sbom:** fix issues in JSON output of `sbom test` command, include CWE values on `CWE` property ([#5331](https://github.com/snyk/snyk/issues/5331)) ([99773c3](https://github.com/snyk/snyk/commit/99773c3eac6c41c61c9da7fc0f1b991e5298dc37))
- **sbom:** include all detected dep-graphs of a container image ([ea43977](https://github.com/snyk/snyk/commit/ea439770e88093d1a99d88957f48ea63ea82b09a))
- **iac:** fixed an issue where the resource path was missing for certain Terraform resources. [IAC-3015](<[0b5823a](https://github.com/snyk/snyk/commit/0b5823ae2673bfbec7a055c881e8055eeb8c01ee)>)
- **general:** map previously unhandled exit codes to exit code 2 ([9fde4fe](https://github.com/snyk/snyk/commit/9fde4fec680f2ae0650baf6b1cfed5908984e9ef))
- **general:** use entitlements when signing bundled macos binaries ([bebc59c](https://github.com/snyk/snyk/commit/bebc59cbfbd20aef2e8531845579f2d78c5b07ca))
