## [1.0.0-monorepo](https://github.com/snyk/snyk/compare/v1.1294.0...v1.0.0-monorepo) (2024-12-18)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Features

* **iac**: include evidence field in json output [IAC-3161] ([9487a08](https://github.com/snyk/snyk/commit/9487a0816693ec5cfd4c69ac5987a9b5ae7c4ddf))
* **auth:** auto detect API Url during OAuth authentication ([6884511](https://github.com/snyk/snyk/commit/688451119275ccb1b22d66d3673bcd1bb26249ed))
* **general**: introduce template based renderer ([cee289d](https://github.com/snyk/snyk/commit/cee289ddc06979c092b87b3533d9e14ade132d30))
* **code**: support severity change overrides in golang snyk code test ([358d731](https://github.com/snyk/snyk/commit/358d73165054373148f1b8c55d885bbf3a330cd2))
* **test**: support verbose gradle graphs for sbom generation ([600ef50](https://github.com/snyk/snyk/commit/600ef5076ca7a6f76e4709dc873d60cd089608f1))


### Bug Fixes

* **general:** prevent snyk-policy lib from interrupting stdout to ensure valid --json --sarif output ([469edf5](https://github.com/snyk/snyk/commit/469edf55457b0827f00c7764de38019c23997e3d))
* **general**: improved error messages around network requests ([f6fc5f7](https://github.com/snyk/snyk/commit/f6fc5f7ed643fbb78826cb95104057c9662664b3))
* **general**: only read SNYK_ prefixed env vars ([5bfcbe8](https://github.com/snyk/snyk/commit/5bfcbe82f15426b399a926fb1f4290208bf7458e))
* **instrumentation:** add default oss product for monitor as well ([83cabc3](https://github.com/snyk/snyk/commit/83cabc38fa75038fbde7ed1c667e8278ab1ff524))
* **container**: optional dependencies are properly connected in the dep-graph ([3205e66](https://github.com/snyk/snyk/commit/3205e666499a7f1273eb67913d5031b1ce98ccdc))
* **container**: package-lock v3 missing sub-dependencies [94c9b7f](https://github.com/snyk/snyk/commit/94c9b7f348c2e23686bf5dce93e27b304201a192))
* **container:** support --exclude-app-vulns with oauth ([73a75fa](https://github.com/snyk/snyk/commit/73a75fa7e68fa0202163e201f6e343591e5bbf7f))
* **monitor**: use error catalog messages for monitor commands ([4e58601](https://github.com/snyk/snyk/commit/4e5860124bf6025c123ecb1e0c8d847bfb797394))
* **iac**: extra error handling and debugging [IAC-3138] ([7fbae0f](https://github.com/snyk/snyk/commit/7fbae0f184c68156ae1d45e7319bd0c4e8f1e0fd))
* **iac**: snyk-iac-test security update [IAC-3171] ([fac22bb](https://github.com/snyk/snyk/commit/fac22bb7aa4a21b3ffa9d647fd469ea6528b8c1a))
* **iac**: update  snyk-iac-parsers version [IAC-3138] ([5326d9d](https://github.com/snyk/snyk/commit/5326d9dd7c059af28ee975c59e4030d932513b1a))
* **iac**: use proxy aware snyk-iac-test [INC-1647] ([d5d1e2e](https://github.com/snyk/snyk/commit/d5d1e2e53dd41fafcf8cadce20e2e2d187f92565))
* **test**: do not treat warnings as errors on restore ([d0113eb](https://github.com/snyk/snyk/commit/d0113eb8c205651b763b4584d8ee886712f9dee8))
* **test**:fix mismatch/off-by-one on unmanagedDependencyCount in the analytics logs UNIFY-340 ([75d8e6d](https://github.com/snyk/snyk/commit/75d8e6dbeedb67c0769f3019b19004ced21a21c6))
* **test**: update snyk-nodejs-plugin to fix micromatch vuln ([766bd1d](https://github.com/snyk/snyk/commit/766bd1d53c8dd5300b4d950a9056d54a50fb1c3b))
* **test**: upgrade mvn-plugin to handle jar scanning sha-not-found error ([060380a](https://github.com/snyk/snyk/commit/060380a32739c3c2e84f2ee8dbc2eb53909415ed))
* **test**: fix runtime versions overwriting nuget versions ([5e715cf](https://github.com/snyk/snyk/commit/5e715cf5c491e49a9576ea59c86b779865fd36b4))
* **instrumentation**: stop sending CLI args in analytics ([6d183fb](https://github.com/snyk/snyk/commit/6d183fba17466e489c1838b936271ae1d011571c))
* **policy** update policy library to fix valid json output ([0bc0aed](https://github.com/snyk/snyk/commit/0bc0aed76ac24d2d5772c2db8af284b63c5985b1))

