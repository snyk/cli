## [1.1292.0](https://github.com/snyk/snyk/compare/v1.1291.0...v1.1292.0) (2024-06-26)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Features

- **test:** Added pnpm support under 'enablePnpmCli' feature flag ([#5181](https://github.com/snyk/snyk/issues/5181)) ([46769cc](https://github.com/snyk/snyk/commit/46769ccefc0c9ca98a44ad4bdd2b4d8161294dbf))
- **test:** Support scan of npm/yarn projects without lockfiles ([e2d77a9](https://github.com/snyk/snyk/commit/e2d77a93da3701f4ade32e7432f870945c3763b2))
- **monitor:** Set target-reference in the monitor request ([51ed8f5](https://github.com/snyk/snyk/commit/51ed8f53595d7545537900762836823ced29c958))
- **code:** Centrally check if code test is enabled ([#5239](https://github.com/snyk/snyk/issues/5239)) ([e5a00e2](https://github.com/snyk/snyk/commit/e5a00e24cbe17b3b9859a39d74f1fe85e773ae4b))
- **sbom:** Improve depgraph for Maven projects ([fbb33d7](https://github.com/snyk/snyk/commit/fbb33d7e17f5866501abd4e4022e86eecb390415))
- **sbom:** Use RFC 3339 for all timestamps in sbom test result ([#5204](https://github.com/snyk/snyk/issues/5204)) ([91bf191](https://github.com/snyk/snyk/commit/91bf1911997534c0bc2a6c0e093cf113f1292c49))
- **language-server:** Add --all-projects flag scans by default [IDE-318](<[#5247](https://github.com/snyk/snyk/issues/5247)>) ([fdcf30e](https://github.com/snyk/snyk/commit/fdcf30e7421b7f8342d11003508f293661264a66))
- **language-server:** Enable incremental scanning [IDE-275](<[#5291](https://github.com/snyk/snyk/issues/5291)>) ([d198685](https://github.com/snyk/snyk/commit/d1986856b152419e1712fa2c35b9b73303c428f9))
- **language-server:** Add support for IDE themes ([c1c4d08](https://github.com/snyk/snyk/commit/c1c4d0805252ee96c7e081edd6b4e42a23cee3b8))
- **language-server:** Consistent styling acorss intellij and vscode ([#5282](https://github.com/snyk/snyk/issues/5282)) ([9aa6f76](https://github.com/snyk/snyk/commit/9aa6f76201661e8270a92ccc38c75285df435634))
- **logging:** Redact additional types of sensitive data from debug logs ([#5254](https://github.com/snyk/snyk/issues/5254)) ([056cdab](https://github.com/snyk/snyk/commit/056cdab070102aec927db831090b5bb82df9d31e))

### Bug Fixes

- **auth:** Autodetect IDE usage and fallback to API token based authentication ([#5241](https://github.com/snyk/snyk/issues/5241)) ([4c795e0](https://github.com/snyk/snyk/commit/4c795e008e17386ac04466a45a9785e81258853b))
- **iac:** Upgrade iac custom rules to address Vulnerabilities [IAC-2944](<[#5191](https://github.com/snyk/snyk/issues/5191)>) ([453db24](https://github.com/snyk/snyk/commit/453db24fb3fa8e58e4a69920ba18045ecbd650a2))
- **language-server:** Caching problem when no vulnerabilities in the IDE ([#5223](https://github.com/snyk/snyk/issues/5223)) ([89c9491](https://github.com/snyk/snyk/commit/89c949162edd89d0553b6e6cbb1c14c62379eae9))
- **language-server:** Remove incorrect /v1 path ([#5214](https://github.com/snyk/snyk/issues/5214)) ([cf16470](https://github.com/snyk/snyk/commit/cf16470090b6f1db7fd7f7577a243e4d356d843f))
- **dependencies:** Update dependencies to reduce vulnerabilities ([#5131](https://github.com/snyk/snyk/issues/5131)) ([4c7cb3c](https://github.com/snyk/snyk/commit/4c7cb3cd0931e0b8717425ac4857b116cee001ee))
- **sbom:** sbom test output padding ([e3b7cac](https://github.com/snyk/snyk/commit/e3b7cac1b3fc628407e1ba520302f3569684d115))
- **sbom:** Fix container purl generation for apt and rpm ([#5207](https://github.com/snyk/snyk/issues/5207)) ([fa9d512](https://github.com/snyk/snyk/commit/fa9d512512203adcdc133ed988ac260543f8816a))
- **sbom:** Retain error code during SBOM generation ([#5202](https://github.com/snyk/snyk/issues/5202)) ([5e98aaa](https://github.com/snyk/snyk/commit/5e98aaa6b14fe2d3622a3cc1ce76b655f43bb42c))
- **test:** support cyclic dependencies in maven with dverbose ([#5208](https://github.com/snyk/snyk/issues/5208)) ([fb24c02](https://github.com/snyk/snyk/commit/fb24c024a8bee69ae59acf79adfac7866255b2b7))
- **test:** Add tool version and informationUri to sarif output ([#5203](https://github.com/snyk/snyk/issues/5203)) ([b899fd3](https://github.com/snyk/snyk/commit/b899fd3af211e8b95656a08b9b0ecefc086ef5d5))
- **test:** fixing several .NET bugs ([#5217](https://github.com/snyk/snyk/issues/5217)) ([c27d767](https://github.com/snyk/snyk/commit/c27d7671c1c9d20089f10663b71875e6bcf05481))
- **test:** fixing a bug causing .NET beta scanning to fail on older versions of .NET ([#5228](https://github.com/snyk/snyk/issues/5228)) ([5fdecf7](https://github.com/snyk/snyk/commit/5fdecf72e6f370bd31baadce6d1e5273018798c1))
- **test:** .NET runtime resolution testing now supports projects targeting .NET Standard frameworks ([#5169](https://github.com/snyk/snyk/issues/5169)) ([44d0861](https://github.com/snyk/snyk/commit/44d0861e41de81f847c6b57c74a67c5fc816e9df))
- **test:** fix issues of type 'Cannot find module ...' in snyk-docker-plugin ([#5301](https://github.com/snyk/snyk/issues/5301)) ([88efd54](https://github.com/snyk/snyk/commit/88efd549956513fd3052de8af47da5d0a1bfb477))
- **monitor:** fix project name when using assets-project-name flag ([#5077](https://github.com/snyk/snyk/issues/5077)) ([57dc718](https://github.com/snyk/snyk/commit/57dc7189eb6c353041b8526af3fe939b0526d996))
