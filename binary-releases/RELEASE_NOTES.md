## [1.0.0-monorepo](https://github.com/snyk/snyk/compare/v1.1290.0...v1.0.0-monorepo) (2024-04-29)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Features

- **ci:** First release on stable channel ([#5183](https://github.com/snyk/snyk/issues/5183)) ([f18cbce](https://github.com/snyk/snyk/commit/f18cbcec7466b4ea1de9632fa2cef1aa68ff5f4b))
- **ls:** Add support for IDE themes ([c1c4d08](https://github.com/snyk/snyk/commit/c1c4d0805252ee96c7e081edd6b4e42a23cee3b8))

### Bug Fixes

- [OSM-1016] .NET runtime resolution testing now supports projects targeting .NET Standard frameworks ([#5169](https://github.com/snyk/snyk/issues/5169)) ([44d0861](https://github.com/snyk/snyk/commit/44d0861e41de81f847c6b57c74a67c5fc816e9df))
- **ci:** Adapt script to work on different environments ([#5182](https://github.com/snyk/snyk/issues/5182)) ([e54b227](https://github.com/snyk/snyk/commit/e54b227a4a05de78d3a210f099da93693f77fdc4))
- **ci:** Fix build pipeline for release branches [CLI-287](<[#5195](https://github.com/snyk/snyk/issues/5195)>) ([67e9588](https://github.com/snyk/snyk/commit/67e9588ae29bf7f756089aa1250b253de4b45bc6))
- **ci:** remove failing checks and simplify prepare release ([#5187](https://github.com/snyk/snyk/issues/5187)) ([4446b9d](https://github.com/snyk/snyk/commit/4446b9d16ce88637b009cf9026a87f2525e67ebf))
- **ci:** Remove node 14 from github actions and add node 20 for testing ([#5205](https://github.com/snyk/snyk/issues/5205)) ([522c19d](https://github.com/snyk/snyk/commit/522c19dc367230c8815f85185cd6224869f406cb))
- **iac:** Upgrade iac custom rules to address Vulnerabilities [IAC-2944](<[#5191](https://github.com/snyk/snyk/issues/5191)>) ([453db24](https://github.com/snyk/snyk/commit/453db24fb3fa8e58e4a69920ba18045ecbd650a2))
- support cyclic dependencies in maven with dverbose ([#5208](https://github.com/snyk/snyk/issues/5208)) ([fb24c02](https://github.com/snyk/snyk/commit/fb24c024a8bee69ae59acf79adfac7866255b2b7))
- **test:** Add tool version and informationUri to sarif output ([#5203](https://github.com/snyk/snyk/issues/5203)) ([b899fd3](https://github.com/snyk/snyk/commit/b899fd3af211e8b95656a08b9b0ecefc086ef5d5))
