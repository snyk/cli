## [1.1308.0](https://github.com/snyk/snyk/compare/v1.1307.3...v1.1308.0) (2026-09-29)

The Snyk CLI is being deployed to different deployment channels, users can select the stability level according to their needs. For details please see [this documentation](https://docs.snyk.io/snyk-cli/releases-and-channels-for-the-snyk-cli)

### Features

* [AG-414] add studio extension to CLI ([fa6ea0a](https://github.com/snyk/snyk/commit/fa6ea0a08f5ac3347441d8c4dcf3978ddb6b76a6))
* add TOON acceptance tests ([fcf1aa7](https://github.com/snyk/snyk/commit/fcf1aa7155942834824c13c440cee70114375edd))
* enable TOON and HTML renders ([0e10434](https://github.com/snyk/snyk/commit/0e10434fdb632639177530b2bef62295a9dd5763))
* gate snyk agent commands behind --experimental ([2c4c912](https://github.com/snyk/snyk/commit/2c4c91237b905593b80b289949d3320bf5f2eccb)), closes [snyk/cli-extension-axi#14](https://github.com/snyk/cli-extension-axi/issues/14) [snyk/cli-extension-axi#14](https://github.com/snyk/cli-extension-axi/issues/14) [snyk/axi#8](https://github.com/snyk/axi/issues/8)
* IANDT-27: capture contributors ([dbb0037](https://github.com/snyk/snyk/commit/dbb0037684330f20d424da676beff64eb6ef2b71))
* update agent scan workflow ([d5451a6](https://github.com/snyk/snyk/commit/d5451a6d1ec7521ddb1f4fa358c8dff24f8088b4))


### Bug Fixes

* bump cli-extension-dep-graph to v2.11.0 ([17ae896](https://github.com/snyk/snyk/commit/17ae896c4a67e10b236a1230913a6079c3bd375b)), closes [snyk/cli-extension-dep-graph#235](https://github.com/snyk/cli-extension-dep-graph/issues/235)
* bump gRPC dependency to fix CVE-2026-84304 ([27f00a1](https://github.com/snyk/snyk/commit/27f00a172359cfad66d6b10c24f69a91b2eef8cc))
* bump js-yaml to fix CVE-2026-84375 ([5ceea33](https://github.com/snyk/snyk/commit/5ceea33da5e83f86957182b8b9eb3736d55909ae))
* bump snyk-gradle-plugin to 7.1.3 ([fc4f8ec](https://github.com/snyk/snyk/commit/fc4f8ec07f76e2bb5aecf290335af2f44c5658e8))
* bump snyk-nuget-plugin to 4.5.3 ([b8461c8](https://github.com/snyk/snyk/commit/b8461c8c7198315b78f8feda23fd8ba3a4fd74aa))
* **ci:** align test timeouts to avoid flakiness ([27e9593](https://github.com/snyk/snyk/commit/27e959314bfa7db21ee9a26eb40b71b6840aa7f4))
* **ci:** fix random token access ([1b7f5c9](https://github.com/snyk/snyk/commit/1b7f5c982601839a2bccb807a45fd68e272ad3b1))
* **dependency:** Fix CVE-2026-63376 and CVE-2026-77465 ([306076e](https://github.com/snyk/snyk/commit/306076e4a0c5d3d6631049cd631984cbef8739b8))
* **deps:** upgrade bundled semver to 7.5.2 for CVE-2022-25883 ([465d5f3](https://github.com/snyk/snyk/commit/465d5f3ac81fe330f152579f0e6a20217f2015b5))
* **errors:** differentiate none errors better ([836ee0d](https://github.com/snyk/snyk/commit/836ee0db1bf3462ee8df227cecfe373c0cf282df))
* faster verbose dependency graphs for Maven and Gradle SBOMs ([73f038c](https://github.com/snyk/snyk/commit/73f038c6eaa546213f785824be42b4376b51215c))
* **general:** Reduce rest api feature flag lookups ([7cffb30](https://github.com/snyk/snyk/commit/7cffb30c5e6f300e28c9c2609baca53beaa1b40a))
* handle .snyk policy edge cases in the new snyk test flow [OSF-485] ([a22a563](https://github.com/snyk/snyk/commit/a22a5635f2cb119fdb676c786a10b1fd8cb8a804))
* isolate env in vercel contract tests, fix lint ([81a9e18](https://github.com/snyk/snyk/commit/81a9e181007a3e4109a0c6ce23c2fe1af6d12d86))
* pin cli-extension-os-flows to scan-type routing fix [OSF-504] ([ded9b95](https://github.com/snyk/snyk/commit/ded9b953937f9aefa217080a886ebcb2850e7c8d)), closes [snyk/cli-extension-os-flows#293](https://github.com/snyk/cli-extension-os-flows/issues/293)
* remove daemon initializer from private CLI build ([830c1db](https://github.com/snyk/snyk/commit/830c1db0e847ece9a05a82720f2c3988ef14355e))
* remove stale TOON file writer test ([29e737f](https://github.com/snyk/snyk/commit/29e737f48b9d882f15ec59181083422fa1b7f826))
* report an unreadable .snyk file as SNYK-POLICY-0002 [OSF-495] ([da692a6](https://github.com/snyk/snyk/commit/da692a6a54bc4835358c5f35b55028a87665081e))
* report SNYK-CLI-0008 for repos with no testable projects [OSF-481] ([50cad38](https://github.com/snyk/snyk/commit/50cad38868eef07c68a8bf002f51edec90360151)), closes [snyk/cli-extension-os-flows#278](https://github.com/snyk/cli-extension-os-flows/issues/278)
* resolve .snyk per project under --all-projects [OSF-497] ([80b2f00](https://github.com/snyk/snyk/commit/80b2f0081976d828068496753a189a74f9704e6c)), closes [#7265](https://github.com/snyk/snyk/issues/7265)
* restore env vars with os.Setenv, not t.Setenv, in test cleanup ([4f3592b](https://github.com/snyk/snyk/commit/4f3592bf80b4aecab246c6127affbd49ab7cfeed))
* restore moduleName, triageAdvice, functions_new in JSON [OSF-479] ([4ec3d18](https://github.com/snyk/snyk/commit/4ec3d18904fe000bcc33a8bbc9ac85f9000c93d6)), closes [snyk/go-application-framework#714](https://github.com/snyk/go-application-framework/issues/714) [snyk/cli-extension-os-flows#279](https://github.com/snyk/cli-extension-os-flows/issues/279)
* split '@' versions even for unrecognised harnesses ([5270885](https://github.com/snyk/snyk/commit/52708857d906cd650b8fa622e87649036d9c256d))
* split Harness name and version in persona analytics (CLI-1771) ([6ed8f34](https://github.com/snyk/snyk/commit/6ed8f34673b8f2f5ec4cfd1ea3ebdd088c91037b))
* split Harness version on '@' and isolate agent-detection tests ([33479a0](https://github.com/snyk/snyk/commit/33479a082539286514fefbe8206d6ee2f38d8f87))
* split single-component '@' versions (e.g. devin@1) ([a6b6b8e](https://github.com/snyk/snyk/commit/a6b6b8e0e6fb025a23e491224509a86cbd695c1a))
* surface command timeouts correctly for unified test scanner [OSF-452] ([46300c9](https://github.com/snyk/snyk/commit/46300c9a97667b043d5a1af380142bf6662c1502)), closes [snyk/cli-extension-dep-graph#236](https://github.com/snyk/cli-extension-dep-graph/issues/236) [snyk/cli-extension-os-flows#273](https://github.com/snyk/cli-extension-os-flows/issues/273)
* tidy go.mod after remy/studio bumps and pin GAF to hotfix commit ([0e6c2c7](https://github.com/snyk/snyk/commit/0e6c2c78e82faa9e0e3ed9b7ba44d45d2870ce53))
* unblock 3rd-party license bundling for detect-agent ([bc1ca18](https://github.com/snyk/snyk/commit/bc1ca18f3afce08eed993e8e96c19ada477d2028))


### Reverts

* render CLI errors as TOON ([e104293](https://github.com/snyk/snyk/commit/e104293e3b8872137622e41ddf4a07d8b1130a31))

