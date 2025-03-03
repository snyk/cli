## [1.1296.0](https://github.com/snyk/snyk/compare/v1.1295.3...v1.1296.0) (2025-03-03)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Features

* [OSM-2206] python support for local wheel files specifiers ([42675eb](https://github.com/snyk/snyk/commit/42675eb4da17307ad8ab6a090b761fd3ab9a8a2f))
* add support for poetry v2 ([52e31e0](https://github.com/snyk/snyk/commit/52e31e0e9ab6326b759933ec7ee5d5c5925c3823))
* adds kaniko support ([bfb69c8](https://github.com/snyk/snyk/commit/bfb69c83ddda560b2940ee1eb771da665737eb42))
* automatic integration of language server 007da850d52b004806bd3f5d5701dfedc51428f8 ([e5924fc](https://github.com/snyk/snyk/commit/e5924fcd0a0efb47c36e8c89cc54db6ab5da57f7))
* automatic integration of language server 1f69850f5daa439720bbe1d73e918a69b6812737 ([6f80a03](https://github.com/snyk/snyk/commit/6f80a03a57a1c73e5936aa9f537af5774bf3c6b6))
* automatic integration of language server 465285ee6c042d1e512af59f7ddefad42a0da46b ([2759d82](https://github.com/snyk/snyk/commit/2759d827c1f80abe3b0f8bfa5b43520b9cefd098))
* automatic integration of language server 70650224e06612f07a315d40127abbc02d2fec18 ([0a05e66](https://github.com/snyk/snyk/commit/0a05e66779df877e869352f374516737dbc93c70))
* automatic integration of language server 7122ee6defeafd981de723d4c193865469b56c01 ([64920ac](https://github.com/snyk/snyk/commit/64920ac2547f6d07600bed89915ef4deab7409d9))
* automatic integration of language server 807e06dcd3dfc420596648151cb4045f66169cdb ([1908a08](https://github.com/snyk/snyk/commit/1908a0860f366c334614a611f862f53ea5649831))
* automatic integration of language server b692957e61a8f3db863429e34f8198ecb6697776 ([fc80c9c](https://github.com/snyk/snyk/commit/fc80c9cc35a717e5ad5ba2a7cdc6dd470f97c97e))
* automatic integration of language server c87400c00e0612ff4164db1b13be177f24e9c609 ([8e7ab06](https://github.com/snyk/snyk/commit/8e7ab0669aa1bbb2c66c45db03c7edbb662414b3))
* automatic integration of language server d26343cf2dc5f80b96388ca9c28974cccb788c81 ([fb7518e](https://github.com/snyk/snyk/commit/fb7518e014b226c6482ac51dc8dd5c31277ad83c))
* automatic integration of language server db40cd79ea0fae1afe26e284bea58da98279d4fe ([a18975a](https://github.com/snyk/snyk/commit/a18975a99e9a684e190fe1076748854079a5b1ea))
* automatic integration of language server df77c59bfe6aebe3534e43a12cb5c4695827f264 ([26d118f](https://github.com/snyk/snyk/commit/26d118fff0f5825dcf70fe001df69e809e153881))
* automatic integration of language server e6272ebd04f8494644ea643d15f22709119030c8 ([50d0770](https://github.com/snyk/snyk/commit/50d0770bca6bfa938f67e1d8ef2a58a8ed1847db))
* compose error catalog errors in TS custom errors ([14792de](https://github.com/snyk/snyk/commit/14792def282fb8fe53acb8a82c8854d2f94d0b73))
* container test/monitor add support for --exclude-node-modules option ([4756f27](https://github.com/snyk/snyk/commit/4756f270f16fcd1588fec1f4d4be846c32e31271))
* dep-graph json output file ([90f24ec](https://github.com/snyk/snyk/commit/90f24ecdba80b431fb8db4116a82f3fb6db45f80))
* display a unique interactionID alongside each error ([960a71c](https://github.com/snyk/snyk/commit/960a71c81f17f0b5743e5ebd61cbf1b88c7d0c40))
* display all applicable maven unmanaged identities ([ebf6ba1](https://github.com/snyk/snyk/commit/ebf6ba1f832f1416adc9d5501081e8a681b1ff5f))
* enable v1 fingerprints in code sarif output ([00644af](https://github.com/snyk/snyk/commit/00644af4ad77e9dc09b49973bac30a3fcd7eef0a))
* error transfer between typescript and golang ([e2aee81](https://github.com/snyk/snyk/commit/e2aee814a6833d20825a19cd1586fb16a6dda768))
* minimise how often countPathsToGraphRoot is called ([d9ae050](https://github.com/snyk/snyk/commit/d9ae0502b67bb343ee7b4c12e3c4b2086b2e41b7))
* pkg id provenance labels ([4d529b3](https://github.com/snyk/snyk/commit/4d529b372de1ea0561119f5e7cf9bb9361e8089d))
* print legacy tree with json file output ([b256937](https://github.com/snyk/snyk/commit/b2569378135e3156eca44b27902dc799def1e430))
* **python:** added Python support for sys_platform ([1aa1565](https://github.com/snyk/snyk/commit/1aa1565bca1863c8f362f0c19baed76981fabdc2))


### Bug Fixes

* (test/monitor) fix dotnet UTF-16LE support for target framework ([e90075a](https://github.com/snyk/snyk/commit/e90075aab4ed9bc55ba438d4435b47c8e65d16f9))
* (test/monitor) reduce false positives when scanning improved dotnet projects ([c21625a](https://github.com/snyk/snyk/commit/c21625a59468dea2fe963a2ded40f947fbbe9be5))
* add container test doc info for --exclude-node-modules ([2faf2d1](https://github.com/snyk/snyk/commit/2faf2d16338b7d7b67e6faa116db6e4408864d15))
* add string limit to some very long debug logs ([015a877](https://github.com/snyk/snyk/commit/015a877901e50acb3e5be19ef6a08460ede3ceda))
* **code:** Don't write sarif files when no results are found ([5a15113](https://github.com/snyk/snyk/commit/5a151137c68704cdfb82025a2cc616a7378792a3))
* **code:** Support single file test for golang native implementation ([d7881f1](https://github.com/snyk/snyk/commit/d7881f128197d3384de75129cdcfeef8c2dc9370))
* copy / paste error ([c94ff20](https://github.com/snyk/snyk/commit/c94ff207a32bee369267601371a19e7a6a4bf8b5))
* **deps:** upgrade goproxy to latest ([073b0a1](https://github.com/snyk/snyk/commit/073b0a1a6059a87c93de89d81896710c5ce3f9cf))
* do not buffer error logs in tscli ([2741d58](https://github.com/snyk/snyk/commit/2741d58528d58637d26f6f1a9326b0a92b7e46a9))
* do not include extra certs in proxy certificate ([95694dc](https://github.com/snyk/snyk/commit/95694dc2ba5b8dee9d69f369619993f585459227))
* ensure nested typescript cli invocations forward errors ([105b32c](https://github.com/snyk/snyk/commit/105b32c358e90244846b0b835dd02986c4f8b5b6))
* fix CVE-2025-21614 and CVE-2025-21614 (iac) ([9f1116e](https://github.com/snyk/snyk/commit/9f1116e003229ecfbd5536f1161b56be63cfe4ff))
* fix OutOfSync errors in pnpm for download urls ([b6e4ea0](https://github.com/snyk/snyk/commit/b6e4ea01fb4a188e35efc0b462d343cd674614f2))
* fix OutOfSync errors in pnpm git protocol dependencies ([5c8dc34](https://github.com/snyk/snyk/commit/5c8dc34477f24354924edae770e1e249e79be1cb))
* go.mod gaf ([ffb864b](https://github.com/snyk/snyk/commit/ffb864bac3bb8beafbc57f306c110955d91c80d4))
* **iac:** upgrade snyk-iac-test to next minor version [IAC-3196] ([6ee9f54](https://github.com/snyk/snyk/commit/6ee9f541eee3551f72aa8b669400f0a3f2e3d91a))
* install-go in job ([e29fe3c](https://github.com/snyk/snyk/commit/e29fe3c70d2eaaa34fb9a965a9549426d04eb23d))
* make smoke test expectation less implementation bound ([5939b17](https://github.com/snyk/snyk/commit/5939b171f6cb425237d392e3aef0c31f11460c47))
* mavenAggregateProject with Dverbose or sbom ([e88cf71](https://github.com/snyk/snyk/commit/e88cf712f21e7a26056796d46356e98b6d453bf4))
* rebase ([072c7f4](https://github.com/snyk/snyk/commit/072c7f435f697d08a3bcb53dbeb73d44ecb384d0))
* remove hardcoded patch version bump ([cc2f334](https://github.com/snyk/snyk/commit/cc2f334a52cf39a79a18fa5bf222a7c2b972aca2))
* resolve CVE-2025-21614 vulnerability in CLI ([2aed7cb](https://github.com/snyk/snyk/commit/2aed7cb97fb36bb0a2664c7a06ef41d70a87c9d5))
* split node and go certificates ([462983c](https://github.com/snyk/snyk/commit/462983c4dd2fafc723e75ba8f183db28c60d441a))
* update iac-rules [IAC-3242] ([2cc20b5](https://github.com/snyk/snyk/commit/2cc20b54a354d438488958587919bed9d47937d0))
* update share results message for iac v2 ([1c9b3b3](https://github.com/snyk/snyk/commit/1c9b3b30d5ed2d17a8113b42169f3f7e4d4d88ea))
* upgrade cli-extension-iac-rules to address vulns [IAC-3195] ([521c206](https://github.com/snyk/snyk/commit/521c2069b395b80576e770870351aec2c2f27fe4))
* use --strict-out-of-sync when set to false with pnpm for top level dependencies ([8d5b71a](https://github.com/snyk/snyk/commit/8d5b71a1209a4f06f455fc0bd0639f9578bbc1e1))


### Reverts

* remove insecure argument ([2fd2712](https://github.com/snyk/snyk/commit/2fd271293344085e7b2deaab5b85e74d4fee165d))

