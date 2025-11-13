## [1.1301.0](https://github.com/snyk/snyk/compare/v1.1300.2...v1.1301.0) (2025-11-12)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Features

* **redteam:** Adds a `snyk redteam --experimental` command. This enable a new experimental feature that allows to automatically scan LLM-based application and search for vulnerabilities ([fe37e0f](https://github.com/snyk/snyk/commit/fe37e0f0d74e9737a2daf3730dd236a4ebd87869))
* **container:** The Snyk CLI now supports scanning Ubuntu Chisel images for vulnerabilities ([9328757](https://github.com/snyk/snyk/commit/9328757a00ad290e3b1761b69ed79ce467d9416c))
* **container:** The Snyk CLI now supports scanning container images with zstd-compressed layers ([5080e42](https://github.com/snyk/snyk/commit/5080e42f1a7f305266258aeb5c26aad17189039f))
* **container:** Added a new parameter, `--include-system-jars`, to support scanning of usr/lib JARs ([57078b6](https://github.com/snyk/snyk/commit/57078b68a6869898d7be74d99c0732b35ecab1de))
* **test(maven):** Initial maven 4 support, testing against the most recent release candidate ([88cf47e](https://github.com/snyk/snyk/commit/88cf47e6b6894ac8bac9a0eb75d57ec32c465381))
* **test(maven):** A new experimental flag `--include-provenance` that will produce DepGraphs containing purls with checksum qualifiers for each package. Primarily to be used via --print-graph, not yet used in the main testing flow ([5b8fe0a](https://github.com/snyk/snyk/commit/5b8fe0acf024d9332482ef3ea192f1f1d656d15c))
* **sbom(maven):** A new experimental flag `--include-provenance` that will produce an SBOM with checksum qualifiers in each purl ([5b8fe0a](https://github.com/snyk/snyk/commit/5b8fe0acf024d9332482ef3ea192f1f1d656d15c))


### Bug Fixes

* **general:** Fix incorrect error mapping for varying status codes ([5829500](https://github.com/snyk/snyk/commit/5829500de37508b83aa0fca988cd7cd70406d26a))
* **general:** Some invalid flag combinations are now correctly handled ([ca5903b](https://github.com/snyk/snyk/commit/ca5903b9680041bea7ae79e5ec68642c989746a6))
* **test:** The Snyk CLI now correctly handles optional dependencies without separate package entries
 ([bfcbda7](https://github.com/snyk/snyk/commit/bfcbda70a3428353c29f80e1804f600ed6374a51))
* **test:** The Snyk CLI now correctly handles aliased packages with nested dependencies ([bfcbda7](https://github.com/snyk/snyk/commit/bfcbda70a3428353c29f80e1804f600ed6374a51))
* **test:** The Snyk CLI now correctly handles bundled dependencies with non-hoisted bundle owners ([bfcbda7](https://github.com/snyk/snyk/commit/bfcbda70a3428353c29f80e1804f600ed6374a51))
* **test:** Fixes issue where sub packages were getting grouped incorrectly, leading to deps getting marked as missing. ([b904e8c](https://github.com/snyk/snyk/commit/b904e8ce28982875027988106f2ee7467e182409))
* **test, sbom:** Stops misclassifying NX Build project.json as a NuGet project ([ff6860f](https://github.com/snyk/snyk/commit/ff6860fc5c6450bdfe988a2a82422220aa03063f))
* **test(npm):** Improve npm alias support ([cb37da7](https://github.com/snyk/snyk/commit/cb37da79febf6e9c44b68eccf444633a6508aa3f))
* **test(npm):** The Snyk CLI now correctly handles npm packages with bundled dependencies ([7d93b86](https://github.com/snyk/snyk/commit/7d93b863df3d3b702e0e3db162e167bd264069d7))
* **test(python):** Scanning projects using Python 2.7 will no longer fail with a string formatting error ([4effc7f](https://github.com/snyk/snyk/commit/4effc7f0b696e237bd7b471321f87f0934a1129a))
* **test(python):** Fixed JSON parsing error for Python projects with missing packages ([4effc7f](https://github.com/snyk/snyk/commit/4effc7f0b696e237bd7b471321f87f0934a1129a))
* **test(maven):** Underlying maven commands adjusted slightly to make aggregate projects that encounter issues when rebuilding more likely to succeed ([3b72d86](https://github.com/snyk/snyk/commit/3b72d86326cb3e78e709ad949801a19d11c08f76))
* **test(dotnet):** Fix an issue with NuGet v3 scanner where the netstandard and netcoreapp TargetFrameworks were treated as .netx.x ([227b50c](https://github.com/snyk/snyk/commit/227b50c41fd8f2757fd90a724b3a53a11dd76736))
* **test(dotnet):** Fix an issue with NuGet v3 scanner where the pinned dependencies were not discovered ([0d9b0c4](https://github.com/snyk/snyk/commit/0d9b0c41b9c9e5dc88d00a9848ebe7b3a1420d04))
* **container:** Fixed a bug where scanning docker images with very large files would result in the CLI crashing with no message ([57078b6](https://github.com/snyk/snyk/commit/57078b68a6869898d7be74d99c0732b35ecab1de))
* **container:** Fix rare crash when scanning large Docker images  ([195ed78](https://github.com/snyk/snyk/commit/195ed783a2dfa28afe69613ea280278dd63debdc))
* **container:** Fix issue where go binaries in Linux images with complex paths were not properly detected as go binaries when scanning on Windows ([be8098b](https://github.com/snyk/snyk/commit/be8098b229dcdb3ad0354197646880b0e8122184))
* **code:** Add missing explicit error handling ([755d01f](https://github.com/snyk/snyk/commit/755d01f55dffcfdf05465ae015f31fab8e62581a))
* **unmanaged:** Ignored vulnerabilities in unmanaged (C/C++) projects are now properly excluded from JSON output when using .snyk policy files. This ensures that snyk-to-html and other tools that consume JSON output will correctly respect vulnerability ignores. ([fa808c1](https://github.com/snyk/snyk/commit/fa808c10c89f327783278bfda1ad0792c2b4f323))
* **dependencies:** Fix CVE-2025-58058 and CVE-2025-11065 ([d7e87e2](https://github.com/snyk/snyk/commit/d7e87e296f99d299a87533812399830b60b7c0c3))
* **dependencies:** Upgrade golang to 1.24.10 to fix vulnerabilities ([c039f99](https://github.com/snyk/snyk/commit/c039f9962f1284ed837d049f5bda235390a138fd))
* **dependencies:** Upgrade to golang 1.24.8 ([4dcf97a](https://github.com/snyk/snyk/commit/4dcf97a638ee2277e4ccd93afb6c385e0f4f1f52))
* **dependencies:** Upgrade xcode to avoid flaky signing ([bdcb991](https://github.com/snyk/snyk/commit/bdcb9918166e5ffd4c57e446deb599c0697c046f))
* **dependencies:** Fix CVE-2025-47913 ([a00b0dc](https://github.com/snyk/snyk/commit/a00b0dc5a4a997933655fc1436c59ebd4af57cf6))
