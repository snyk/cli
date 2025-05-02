## [1.1297.0](https://github.com/snyk/snyk/compare/v1.1296.2...v1.1297.0) (2025-05-14)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Features

* **container:** Support scanning container images from tar files without specifying a type ([58b0861](https://github.com/snyk/snyk/commit/58b0861f8ff6577b281de49619f711b8842e096a))
* **iac:** Improve IaC deployment to avoid on the fly downloads ([5108f58](https://github.com/snyk/snyk/commit/5108f58954b22de962cc3125f643e5823a439a20))
* **sbom:** Introduce sbom monitor command ([24e96c3](https://github.com/snyk/snyk/commit/24e96c33f153071fe798ed1b7a3ec78e5cc35733))
* **test:** Improve gradle module resolution  ([7991133](https://github.com/snyk/snyk/commit/79911337912082454e4362d9473c40699e059425))

* automatic integration of language server 0a3a8f61bc2897cbef1b84e09b1a9bd73b3c724e ([92de43b](https://github.com/snyk/snyk/commit/92de43b19f6e406d2a687d88cc4b1de9d7f94398))
* automatic integration of language server 137c0037fe26039a1fba3b8b6b7d0cddc26ef994 ([74fa322](https://github.com/snyk/snyk/commit/74fa3224aef6ba68b7f55006b7d0ced92c6d7e57))
* automatic integration of language server 2181ed7f671945a8b36bc1848ab04b38aa432454 ([7c22b54](https://github.com/snyk/snyk/commit/7c22b5458eab71de9f71349a9e0df182cd242730))
* automatic integration of language server 28c5359ba0cd3cb325db0ae4d929db21ec8f2021 ([9bd6900](https://github.com/snyk/snyk/commit/9bd69004a32ab565ce487568024d8fe78715b855))
* automatic integration of language server 3077a9b9c1be3958b36fade5f64846d6a6d6fdba ([349438a](https://github.com/snyk/snyk/commit/349438a00711f9dafdfe473cfe5aaffdaa719dec))
* automatic integration of language server 38b8db4dcba330f06257458d7a2748f211231c82 ([e9f2118](https://github.com/snyk/snyk/commit/e9f2118735b253c5a366d35e41db3c311bbbd522))
* automatic integration of language server 5cb7aada7dd47fa74917aa1851583302a4b60b35 ([78193b7](https://github.com/snyk/snyk/commit/78193b761012f19d3a94865239cc96652d0ea1e2))
* automatic integration of language server 6fca9b5a8c5847f4082fe3ab2a6fd27d81e234d5 ([7a49b48](https://github.com/snyk/snyk/commit/7a49b48b735ebf4344ea426ca3b420857ee928b2))
* automatic integration of language server 8b04f4e6aabea2d9ea6fcc19341f210efc44cbcc ([e933ff0](https://github.com/snyk/snyk/commit/e933ff0b330f7e9d65c35929268b529280b5df25))
* automatic integration of language server 8b677f5b917b0aa6b915bb79fcac424615880a27 ([0021691](https://github.com/snyk/snyk/commit/002169163d9c64fa1c55ccc69f6586eb5d4141b8))
* automatic integration of language server 9dcb85a2ef64cf7e32aef4eac2c290ed060aab75 ([a474d67](https://github.com/snyk/snyk/commit/a474d67a55c5b0684462b867fba1acf5dabcb000))
* automatic integration of language server cccbea841e2663861f3ab4f7368796983cdefc07 ([5b2f094](https://github.com/snyk/snyk/commit/5b2f09486f61d42080896dcabe9019e62eec22c8))


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

