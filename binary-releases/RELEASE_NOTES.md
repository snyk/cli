## [1.1303.0](https://github.com/snyk/snyk/compare/v1.1302.1...v1.1303.0) (2026-02-19)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Features

* [OSM-3492] support NuGet packages case-insensitive names ([44bf86b](https://github.com/snyk/snyk/commit/44bf86baa4783a58477622255714d3a983174ca1))
* add disableContainerMonitorProjectNameFix feature flag ([0e8feca](https://github.com/snyk/snyk/commit/0e8feca01832318a1fd03a9d06a6a5e7f8024115))
* add iac --exclude param [IAC-3473] ([3acbc6b](https://github.com/snyk/snyk/commit/3acbc6b81ed88ef5ba999ba40dd8642eba7e011a))
* add missing fields to `--json` output for `snyk test` and `snyk ([9996b27](https://github.com/snyk/snyk/commit/9996b276b5334f2eaebceff7bc284740ad1ad968))
* add mvn and npm scope flags ([89d26f0](https://github.com/snyk/snyk/commit/89d26f0372dc51840e86a0866339458d4b6abc92))
* add option to output errors in json for test ([6c6a11d](https://github.com/snyk/snyk/commit/6c6a11d57dd843054ecc426e8d4be0cb2aadf63b))
* add redteam get command and progress UI ([fba40cc](https://github.com/snyk/snyk/commit/fba40ccd8bb546756609ccb9fb27b242f40158e9))
* add secrets extension [PS-103] ([4decf7b](https://github.com/snyk/snyk/commit/4decf7b72c08b5b92e8a9ee3c0ee523efe564223))
* add uv support to sbom command ([e82c7a0](https://github.com/snyk/snyk/commit/e82c7a0dc9747bbb0b924cac4257d557382b34d0))
* enable go std libs for cli ([4e48c06](https://github.com/snyk/snyk/commit/4e48c06fe2d6945cb0c1e9b7069f2666f5289dac))
* go-module-level flag ([8657258](https://github.com/snyk/snyk/commit/8657258ea1e99c9a2e7b49c0776eb41fb3f9b16e))
* handle maintenance error ([522cf42](https://github.com/snyk/snyk/commit/522cf42e232e60e1ca0dcddf971e5a2777de395a))
* **mcp:** add profile support and package health tool ([2b0edd2](https://github.com/snyk/snyk/commit/2b0edd26877b37e5841857df0b29875a3da9dd9d))
* studio-mcp version bump ([495a2e0](https://github.com/snyk/snyk/commit/495a2e0b909fdfe71a39a8e7062b38241cd1c1bb))
* support calling Go cli commands from TypeScript ([11cdc1b](https://github.com/snyk/snyk/commit/11cdc1b44fbe99e4e9671d04965375495e80262a))
* support new options and handle archive detection in container sbom ([a7015a7](https://github.com/snyk/snyk/commit/a7015a77dbe2db9b8dfec1a7a5433d789f688680))
* update ai bom extension version ([e1fdae7](https://github.com/snyk/snyk/commit/e1fdae7acfb1802fc9d2d897d133a406503df629))
* upgrade snyk-docker-plugin and filter out new fact types ([f8dcc65](https://github.com/snyk/snyk/commit/f8dcc6594f900db8ece55312b615ac71be985159))


### Bug Fixes

* add internal to CLI executable path env var ([ee1e21c](https://github.com/snyk/snyk/commit/ee1e21cbaefe943e7d377a98dcbdc59a972427fc))
* apply ignores correctly for .snyk excludes ([a61589c](https://github.com/snyk/snyk/commit/a61589c4206317497fb5853e1bdcdca7c2973a4a))
* apply target-reference to container application scanResults ([70db44f](https://github.com/snyk/snyk/commit/70db44fd8c783baf23417cf22d091fdb2355e8e9))
* bump @slack/webhook dep to fix vuln ([1e80d74](https://github.com/snyk/snyk/commit/1e80d7454b85ebede70be09da1f6a40c88b5d4a1))
* bump cli extension mcp scan version ([a2e2938](https://github.com/snyk/snyk/commit/a2e2938ac6786d13e3e9605f39ce629159d35c32))
* bump cli-extension-iac and cli-extension-iac-rules [IAC-3497] ([4b3d826](https://github.com/snyk/snyk/commit/4b3d826694d759d7ae892ff6ff824ffdbae32af1))
* bump docker-registry-v2-client to enhance error logging ([cf7d203](https://github.com/snyk/snyk/commit/cf7d203bd80823173446954823d0a13bf4f5893d))
* bump mcp-scan binary version to 0.4 ([19eb6a7](https://github.com/snyk/snyk/commit/19eb6a7dc581b0e0896e9c6e076b05f95de6d030))
* bump mcp-scan cli extension version to latest ([4dcfd1b](https://github.com/snyk/snyk/commit/4dcfd1b639ade84eb2389b540d8b511bac13d8cf))
* bump minimum uv version requirement ([a6ea424](https://github.com/snyk/snyk/commit/a6ea424a4c6a6719c6f0f92e37a862f7eb7422ba))
* chocolatey caching ([31f168c](https://github.com/snyk/snyk/commit/31f168cc899a4229eeaefa31d6522691f7a99e74))
* display Poetry errors correctly ([96b2098](https://github.com/snyk/snyk/commit/96b20985aeec7bd8cbad9746e45ec45e7d231d1d))
* Do not wrap URLs when rendering errors ([763ac26](https://github.com/snyk/snyk/commit/763ac26ec12a6cdcaa0a0176727e40aa2c31797b))
* ensure sarif runAutomationDetails ID is unique ([07dd36f](https://github.com/snyk/snyk/commit/07dd36fdba4ad884b36536af31778fd27f9321a0))
* error when uv manifest is out of sync with lockfile ([d0d0f43](https://github.com/snyk/snyk/commit/d0d0f43fbab8521d0ef4e4634fa8929f4ed10f0f))
* Fix possible panic when TLS config is nil ([f601681](https://github.com/snyk/snyk/commit/f6016812dcb8f15d5f020b9134214cbeee5b4927))
* html report ([aa76c04](https://github.com/snyk/snyk/commit/aa76c04988e51603d6d07509d2ac24a8048174b4))
* include workspace dir prefix in manifest path for uv workspace members ([93eee21](https://github.com/snyk/snyk/commit/93eee21aa6c899f76816651bab88ac4d6de0adbf))
* **language-server:** fedramp API URL construction ([35800c1](https://github.com/snyk/snyk/commit/35800c10aea0807a04baf4e6eafa2bf5f9f3c991))
* linter ([00ac36d](https://github.com/snyk/snyk/commit/00ac36de5691d1d236a0b6268f8a96c04f029da8))
* **mcp:** fix package health tool name ([4537bc5](https://github.com/snyk/snyk/commit/4537bc5561874dbb999d84d722e5835255b316c1))
* missing nil checks during suppression rendering ([5104d23](https://github.com/snyk/snyk/commit/5104d230a5290c76bad8ed195f2602642233e3f9))
* preserve errorCatalog when re-throwing errors in test cmd ([3d02788](https://github.com/snyk/snyk/commit/3d02788d71f0adb4f883a9baccd413faf5fd016c))
* register disableContainerMonitorProjectNameFix in fake server feature flag defaults ([7c6c2d4](https://github.com/snyk/snyk/commit/7c6c2d4bde7c014e24285b9837012897b848b091))
* revert [#6326](https://github.com/snyk/snyk/issues/6326) to resolve `snyk sbom` failure ([fda61e0](https://github.com/snyk/snyk/commit/fda61e060aff529547d60e0efd2b5b5a89aa459d))
* sbom test experimental flag backwards compatibility ([90e9aa4](https://github.com/snyk/snyk/commit/90e9aa41006aa241fb8791978dbb85bcec3f0aff))
* **test:** Improve error reporting when using all-projects ([6e3b5d5](https://github.com/snyk/snyk/commit/6e3b5d533530da2d24cce6a17d55d8a4bae240eb))
* upgrade cli-extension-iac-rules [IAC-3478] ([1d2d723](https://github.com/snyk/snyk/commit/1d2d72372a8b70a2f9cdb58dcfbab54880cd7223))
* use correct identity of replaced Go modules ([64873f3](https://github.com/snyk/snyk/commit/64873f33454a0a6b35b29b7eafefe31357eff4d7))
* use correct projectName in container monitor JSON output ([48e3995](https://github.com/snyk/snyk/commit/48e3995b725d991117fa4f9266084ae5c7d5653a))
* use maven-dependency-plugin@3.9.0 for verbose ([87853a8](https://github.com/snyk/snyk/commit/87853a8b5961290c7e89017390c0ae3c80607416))


### Reverts

* Revert "feat: add PackageURL information to go.mod dependency graphs" ([7eb2978](https://github.com/snyk/snyk/commit/7eb297864039f3ffa80d9b4d0a0fa49b5c1e36a0))

