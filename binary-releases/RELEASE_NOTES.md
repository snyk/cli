## [1.1302.0](https://github.com/snyk/snyk/compare/v1.1301.2...v1.1302.0) (2026-01-14)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Features

* **aibom:** Improved Exit Code handling ([d8fed82](https://github.com/snyk/snyk/commit/d8fed82450a92f4d06858b11d3e55b741c742567))
* **container:** Added support for OCI images with manifests missing platform fields ([dae56aa](https://github.com/snyk/snyk/commit/dae56aada1b0ba22f9e681b71bd7437e99e83c94))
* **container:** Added container scan support for cgo and stripped Go binaries ([9b2ee6e](https://github.com/snyk/snyk/commit/9b2ee6ee055eceacb7fcf9fde656a7369f9b48f1))
* **container:** Added pnpm lockfile support ([47db111](https://github.com/snyk/snyk/commit/47db111dd0737224b28678268d1d712b525ca0a7))
* **mcp-scan:** Added experimental mcp-scan command ([54b8376](https://github.com/snyk/snyk/commit/54b83769e33f8a0adf499e5c2b725bc076146864))
* **sbom:** Improved PackageURLs in SBOM documents for go.mod projects ([c145efc](https://github.com/snyk/snyk/commit/c145efc1fc1b0d29fc3ce13d8f02391a195ccc0c))
* **sbom test:** Added support for deb, apk and rpm ([9fd6f84](https://github.com/snyk/snyk/commit/9fd6f84af10495f4ccb91c79ad6c6089ecda5976))
* **test:** Added PackageURL information to go.mod dependency graphs ([d90b54e](https://github.com/snyk/snyk/commit/d90b54e17801e74fa324f0f5c71aa2ec827eb49c))
* **test:** Added support for poetry development dependencies ([6977004](https://github.com/snyk/snyk/commit/697700425d0eb71ca6965698658a09bce2cc4f77))

### Bug Fixes

* **container:** Resolves false positive vulnerabilities for RHEL 10 container images ([d4afe60](https://github.com/snyk/snyk/commit/d4afe602fd14cf7284d88575669c58f2e153cc1f))
* **general:** Upgraded multiple dependencies ([e185c92](https://github.com/snyk/snyk/commit/e185c92cbbb9102a8b50fb68f5ec9a3ddce280e1))
* **general:** Fixed Exit Code handling when using incompatible glibc versions ([66fbb50](https://github.com/snyk/snyk/commit/66fbb50f4ed9b7a60641c214bdbc628556a5b50c))
* **general:** Improved file filtering support with .gitignore ([a16b853](https://github.com/snyk/snyk/commit/a16b85338efb4209917198a890ca307b8c1a0ac8))
* **mcp:** Added rule file to .gitignore if not previously ignored ([cc78694](https://github.com/snyk/snyk/commit/cc78694b5eab5cf41c004dfec89bd72ab5076723))
* **test:** Improved upload speed when using --reachability ([da21315](https://github.com/snyk/snyk/commit/da2131536111d43de1a83150b3b7b9da025cc6e1))
* **test:** Fixed npm v2 dependency resolution when using shadowing aliases ([237a4f5](https://github.com/snyk/snyk/commit/237a4f5ceb5b2b1e75cc2ce682e80f2abf7d8562))
* **test:** Fixed --exclude support for pnpm workspaces ([293d9b1](https://github.com/snyk/snyk/commit/293d9b1be73185324712c5a5c4952afda855dabe))
* **test:** Fixed SARIF output for Gradle projects to include the complete path in artifactLocation ([ec1262e](https://github.com/snyk/snyk/commit/ec1262e0d76f485872ec84414b84439070d1a4cc))


