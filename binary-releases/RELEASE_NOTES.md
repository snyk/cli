## [1.1297.0](https://github.com/snyk/snyk/compare/v1.1296.2...v1.1297.0) (2025-05-14)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Features

* **container:** Support scanning container images from tar files without specifying a type ([58b0861](https://github.com/snyk/snyk/commit/58b0861f8ff6577b281de49619f711b8842e096a))
* **iac:** Improve IaC deployment to avoid on the fly downloads ([5108f58](https://github.com/snyk/snyk/commit/5108f58954b22de962cc3125f643e5823a439a20))
* **sbom:** Introduce sbom monitor command ([24e96c3](https://github.com/snyk/snyk/commit/24e96c33f153071fe798ed1b7a3ec78e5cc35733))
* **test:** Improve gradle module resolution  ([7991133](https://github.com/snyk/snyk/commit/79911337912082454e4362d9473c40699e059425))
* **language-server:** Introduce explanation of AI fixes in IDEs

### Bug Fixes

* **container:** Fix issue when scanning invalid node manifest files ([ceb8020](https://github.com/snyk/snyk/commit/ceb8020284db2b76abc42637caaa94d227c422ef))
* **iac:** Ensure to use the correct org id when sharing results for v2 ([1c4094a](https://github.com/snyk/snyk/commit/1c4094aff5a21b08eefed47508d33668940af003))
* **iac:** Ensure to use target-name ([2201f0a](https://github.com/snyk/snyk/commit/2201f0a46ac5747b4c58ed01990d1e9ae13f4eb7))
* **sbom:** Fix issues when generating sboms based on NuGet .sln ([80c43d9](https://github.com/snyk/snyk/commit/80c43d9a6f9f3a29f5f0df679d75d82fed48a7f5))
* **test:** Fix issues when scanning gradle projects on Windows ([11586cc](https://github.com/snyk/snyk/commit/11586cc587b3a05c2e7d279a3f40857f8c752068))
* **test:** Improve error messages when using fail-fast, all-projects and json ([a396bd6](https://github.com/snyk/snyk/commit/a396bd6ea4abd443a0ffce2a29b3f7e6154859ac))
* **test:** Fix yarn 2 out of sync issues ([18aee45](https://github.com/snyk/snyk/commit/18aee454a87fbeed480839fc91a04123840c6ff5))
* **test:** Fix pnpm out of sync issue for duplicated peer and dev dependencies ([2581e16](https://github.com/snyk/snyk/commit/2581e169ac813df49e8eccce8ae4bfd85f01378e))
* **test:** Ensure internal dependencies are represented correctly when normalizing Gradle dependencies ([c7e2713](https://github.com/snyk/snyk/commit/c7e2713a4d1d961857b95038c186085e14d8f415))
* **language-server:** Fix and improve issue filtering in IDEs

